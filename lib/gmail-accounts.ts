import { supabaseAdmin, resolveOwnerUserId } from './owner';

// Fluxo de OAuth pra conectar contas de Gmail ADICIONAIS (fora do login principal
// do app, que já usa Google via Supabase Auth). Guarda access+refresh token em
// `contas_email_conectadas`, pra o MCP conseguir ler email em segundo plano, sem
// depender de sessão de navegador aberta. Só leitura — nunca envia (ver ADR).

const SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly email';

function redirectUri() {
  // Precisa estar registrado EXATAMENTE assim no Google Cloud Console
  // (projeto 168-app) pro fluxo funcionar. Domínio de marca pessoal, não o
  // legado saacs.com.br — decisão do Luciano, 2026-10-31.
  return 'https://168.lucianomaeda.com.br/api/email-accounts/callback';
}

export function buildGoogleAuthUrl(apelido: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // força reemissão do refresh_token mesmo se já autorizou antes
    state: apelido,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar code por token: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token: ${await res.text()}`);
  return res.json();
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Falha ao buscar e-mail da conta: ${await res.text()}`);
  const json = await res.json();
  return json.email as string;
}

type ContaEmail = {
  id: string;
  email: string;
  apelido: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expira_em: string | null;
};

// Devolve um access_token válido pra conta, renovando via refresh_token se tiver
// expirado (ou perto disso — margem de 2min).
async function tokenValido(conta: ContaEmail): Promise<string> {
  const expiraEm = conta.token_expira_em ? new Date(conta.token_expira_em).getTime() : 0;
  const folga = 2 * 60 * 1000;
  if (conta.access_token && expiraEm - folga > Date.now()) {
    return conta.access_token;
  }
  if (!conta.refresh_token) {
    throw new Error(`Conta ${conta.email} sem refresh_token — precisa reconectar.`);
  }
  const tokens = await refreshAccessToken(conta.refresh_token);
  const novaExpiracao = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin()
    .from('contas_email_conectadas')
    .update({ access_token: tokens.access_token, token_expira_em: novaExpiracao })
    .eq('id', conta.id);
  return tokens.access_token;
}

type EmailResumo = {
  conta: string;
  id: string;
  assunto: string;
  remetente: string;
  data: string;
  snippet: string;
  tem_anexo_ics: boolean;
};

async function buscarEmailsDeUmaConta(
  accessToken: string,
  contaLabel: string,
  query: string,
  maxResults: number
): Promise<EmailResumo[]> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: auth }
  );
  if (!listRes.ok) return [];
  const listJson = await listRes.json();
  const ids: string[] = (listJson.messages ?? []).map((m: { id: string }) => m.id);

  const resultados = await Promise.allSettled(
    ids.map(id =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: auth }
      ).then(r => (r.ok ? r.json() : null))
    )
  );

  type GmailMessage = {
    id: string;
    snippet?: string;
    payload?: {
      headers?: { name: string; value: string }[];
      parts?: { filename?: string; mimeType: string }[];
    };
  };

  return resultados
    .filter((r): r is PromiseFulfilledResult<GmailMessage> => r.status === 'fulfilled' && Boolean(r.value))
    .map(r => {
      const msg = r.value;
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
      const parts: { filename?: string; mimeType: string }[] = msg.payload?.parts ?? [];
      return {
        conta: contaLabel,
        id: msg.id,
        assunto: get('Subject'),
        remetente: get('From'),
        data: get('Date'),
        snippet: msg.snippet ?? '',
        tem_anexo_ics: parts.some(p => p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'),
      };
    });
}

// Resolve as contas conectadas (todas, ou uma específica por e-mail/apelido).
async function contasConectadas(conta?: string): Promise<ContaEmail[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('contas_email_conectadas')
    .select('id, email, apelido, access_token, refresh_token, token_expira_em')
    .eq('user_id', userId)
    .eq('ativo', true);
  if (conta) q = q.or(`email.eq.${conta},apelido.eq.${conta}`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContaEmail[];
}

// Busca em uma conta específica (por e-mail ou apelido) ou em todas as contas
// conectadas do usuário, em paralelo.
export async function buscarEmailsMultiConta(
  query: string,
  maxResults: number,
  conta?: string
): Promise<EmailResumo[]> {
  const contas = await contasConectadas(conta);
  if (!contas.length) return [];

  const porConta = await Promise.all(
    contas.map(async c => {
      try {
        const token = await tokenValido(c);
        return buscarEmailsDeUmaConta(token, c.apelido || c.email, query, maxResults);
      } catch (e) {
        return [{ conta: c.apelido || c.email, id: '', assunto: `Erro: ${String(e)}`, remetente: '', data: '', snippet: '', tem_anexo_ics: false }];
      }
    })
  );
  return porConta.flat();
}

type EventoAgenda = {
  conta: string;
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  local: string;
  convidados: string[];
  link_meet: string;
};

async function buscarEventosDeUmaConta(
  accessToken: string,
  contaLabel: string,
  timeMin: string,
  timeMax: string,
  maxResults: number
): Promise<EventoAgenda[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const json = await res.json();

  type CalendarEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    location?: string;
    attendees?: { email: string }[];
    hangoutLink?: string;
  };

  return ((json.items ?? []) as CalendarEvent[]).map(ev => ({
    conta: contaLabel,
    id: ev.id,
    titulo: ev.summary ?? '(sem título)',
    inicio: ev.start?.dateTime ?? ev.start?.date ?? '',
    fim: ev.end?.dateTime ?? ev.end?.date ?? '',
    local: ev.location ?? '',
    convidados: (ev.attendees ?? []).map(a => a.email),
    link_meet: ev.hangoutLink ?? '',
  }));
}

// Busca eventos de agenda (Google Calendar) em uma conta específica ou em
// todas as contas conectadas, em paralelo. Só leitura.
export async function buscarAgendaMultiConta(
  timeMin: string,
  timeMax: string,
  maxResults: number,
  conta?: string
): Promise<EventoAgenda[]> {
  const contas = await contasConectadas(conta);
  if (!contas.length) return [];

  const porConta = await Promise.all(
    contas.map(async c => {
      try {
        const token = await tokenValido(c);
        return buscarEventosDeUmaConta(token, c.apelido || c.email, timeMin, timeMax, maxResults);
      } catch (e) {
        return [{ conta: c.apelido || c.email, id: '', titulo: `Erro: ${String(e)}`, inicio: '', fim: '', local: '', convidados: [], link_meet: '' }];
      }
    })
  );
  return porConta.flat();
}
