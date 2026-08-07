import { streamText, tool, isStepCount, type ModelMessage } from 'ai'
import { z } from 'zod'
import { modeloAcao } from '@/lib/ai'
import { getSupabaseWithToken } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Você é a BIA, assistente pessoal do método 168.

O método 168 parte de uma premissa: disciplina é a espinha dorsal de tudo.
168 horas semanais = sono (56h) + ESFERA DO TEMPO (cuidar de mim, família, ócio criativo) + ESFERA DO DINHEIRO (trabalho, patrimônio).

Sua função principal: ajudar o usuário a gerir as 168h semanais com disciplina real — não motivação vazia.

VOCÊ PODE:
- Reorganizar a agenda quando o usuário informa mudanças (compromisso novo, imprevisto)
- Registrar encaminhamentos e action items com clareza
- Cobrar blocos não cumpridos com firmeza — sem aceitar desculpa abstrata
- Sugerir alocação de blocos baseada nos encaminhamentos abertos
- Identificar quando a esfera CUIDAR está sendo sacrificada pela esfera DINHEIRO
- Buscar emails e convites no Gmail do usuário com a ferramenta buscar_gmail
- Criar compromissos na agenda 168 com a ferramenta criar_compromisso

VOCÊ NÃO FAZ:
- Aceita "não deu tempo" sem perguntar o que cedeu lugar
- Trata compromisso consigo mesmo como menos importante que compromisso com outros
- Sugere mais de 3 mudanças de grade de uma vez
- Usa linguagem corporativa ou motivacional genérica
- Afirma que adicionou algo à agenda sem ter chamado criar_compromisso com sucesso

REGRAS DE RESPOSTA:
- Português direto, sem enrolação
- Máximo 3 parágrafos por mensagem
- Se o usuário pedir reorganização de agenda, confirme o que mudou antes de propor
- Se o usuário mencionar encaminhamento, registre com "📌 Encaminhamento anotado:" antes do item
- Se encontrar convite de reunião (.ics), mostre: título, data, horário e link se houver

AGENDA — REGRA INEGOCIÁVEL:
- NUNCA crie um compromisso sem ter data_hora_inicio E data_hora_fim confirmados
- Se o usuário informar só o início, SEMPRE pergunte: "Qual é o horário de término?"
- Sem horário de fim, não há bloco. Bloco sem fim não existe na grade 168h.

GMAIL:
- Você TEM acesso ao Gmail do usuário via ferramentas buscar_gmail e responder_email
- Use buscar_gmail SEMPRE que o usuário mencionar um email, convite ou reunião específica
- Use responder_email quando o usuário pedir para responder um email — APENAS quando ele confirmar explicitamente o que enviar
- Não diga que não tem acesso — você tem. Use as ferramentas.
- Nunca simule ou afirme que enviou um email sem ter chamado a ferramenta responder_email com sucesso`

type GmailPart = {
  mimeType: string
  filename?: string
  body?: { data?: string; attachmentId?: string }
  parts?: GmailPart[]
}

function getParts(p: GmailPart): GmailPart[] {
  return p.parts ? p.parts.flatMap(getParts) : [p]
}

function parseIcsPart(icsText: string) {
  const getIcs = (key: string) => {
    const match = icsText.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'))
    return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : ''
  }
  const dtToIso = (dt: string) => {
    const d = dt.replace('Z', '')
    return d.length === 8
      ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
      : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}`
  }
  return {
    titulo: getIcs('SUMMARY'),
    inicio: dtToIso(getIcs('DTSTART')),
    fim: dtToIso(getIcs('DTEND')),
    local: getIcs('LOCATION'),
  }
}

async function fetchEmails(providerToken: string, query: string, maxResults: number) {
  const auth = { Authorization: `Bearer ${providerToken}` }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: auth }
  )
  if (!listRes.ok) {
    const err = await listRes.text().catch(() => '')
    throw new Error(`Gmail ${listRes.status}: ${err.slice(0, 150)}`)
  }
  const listJson = await listRes.json()
  if (!listJson.messages?.length) return []

  const settled = await Promise.allSettled(
    (listJson.messages as { id: string }[]).map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: auth }
      )
      if (!msgRes.ok) return null
      const msg = await msgRes.json()

      const h: { name: string; value: string }[] = msg.payload?.headers ?? []
      const get = (n: string) => h.find(x => x.name === n)?.value ?? ''
      const partes = getParts(msg.payload ?? {})

      const icsPart = partes.find(p => p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar')

      let reuniao = null
      if (icsPart) {
        let icsText = ''
        if (icsPart.body?.data) {
          icsText = Buffer.from(icsPart.body.data, 'base64').toString('utf-8')
        } else if (icsPart.body?.attachmentId) {
          const attRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${icsPart.body.attachmentId}`,
            { headers: auth }
          )
          if (attRes.ok) {
            const att = await attRes.json()
            icsText = Buffer.from(att.data as string, 'base64url').toString('utf-8')
          }
        }
        if (icsText) reuniao = parseIcsPart(icsText)
      }

      return {
        id: m.id,
        assunto: get('Subject'),
        remetente: get('From'),
        data: get('Date'),
        snippet: (msg.snippet as string | undefined)?.slice(0, 150) ?? '',
        reuniao,
      }
    })
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer V> ? V : never>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value)
}

export async function POST(req: Request) {
  const { messages, provider_token }: { messages: ModelMessage[]; provider_token?: string } = await req.json()
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''

  const result = streamText({
    model: modeloAcao,
    system: SYSTEM_PROMPT,
    messages,
    stopWhen: isStepCount(3),
    tools: {
      buscar_gmail: tool({
        description: 'Busca emails do Gmail do usuário. Use para encontrar emails específicos, convites de reunião (.ics) ou mensagens recentes.',
        inputSchema: z.object({
          query: z.string().describe('Query Gmail. Ex: "newer_than:3d", "from:fulano@email.com", "subject:reunião", "has:attachment filename:.ics"'),
          maxResults: z.number().optional().describe('Máximo de emails (padrão: 10)'),
        }),
        execute: async ({ query, maxResults = 10 }) => {
          if (!provider_token) return { erro: 'Gmail não conectado — faça login com Google' }
          try {
            const emails = await fetchEmails(provider_token, query, maxResults)
            if (!emails.length) return { encontrados: 0, emails: [], mensagem: 'Nenhum email encontrado para esta busca.' }
            return { encontrados: emails.length, emails }
          } catch (e) {
            return { erro: String(e) }
          }
        },
      }),
      responder_email: tool({
        description: 'Responde a um email no Gmail. Só use após o usuário confirmar explicitamente o texto a enviar.',
        inputSchema: z.object({
          gmail_message_id: z.string().describe('ID do email retornado por buscar_gmail'),
          resposta: z.string().describe('Texto exato da resposta a enviar'),
        }),
        execute: async ({ gmail_message_id, resposta }) => {
          if (!provider_token) return { erro: 'Gmail não conectado — faça login com Google' }
          try {
            const auth = { Authorization: `Bearer ${provider_token}` }

            // Busca headers do email original
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`,
              { headers: auth }
            )
            if (!msgRes.ok) return { erro: `Não consegui buscar o email original: ${msgRes.status}` }
            const msg = await msgRes.json()

            const h: { name: string; value: string }[] = msg.payload?.headers ?? []
            const get = (n: string) => h.find(x => x.name === n)?.value ?? ''
            const subject = get('Subject')
            const from = get('From')
            const messageId = get('Message-ID')
            const threadId = msg.threadId as string

            const reSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
            const rawEmail = [
              `To: ${from}`,
              `Subject: ${reSubject}`,
              ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${messageId}`] : []),
              `Content-Type: text/plain; charset=utf-8`,
              ``,
              resposta,
            ].join('\r\n')

            const raw = Buffer.from(rawEmail).toString('base64url')

            const sendRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
              {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw, threadId }),
              }
            )
            if (!sendRes.ok) {
              const err = await sendRes.text().catch(() => '')
              return { erro: `Falha ao enviar: ${sendRes.status} — ${err.slice(0, 150)}` }
            }
            return { enviado: true, para: from, assunto: reSubject, texto: resposta }
          } catch (e) {
            return { erro: String(e) }
          }
        },
      }),
      criar_compromisso: tool({
        description: 'Cria um compromisso avulso na agenda 168h (reunião, consulta, viagem, etc.). Só use quando data_hora_inicio E data_hora_fim estiverem confirmados pelo usuário.',
        inputSchema: z.object({
          titulo: z.string().describe('Nome do compromisso'),
          tipo: z.enum(['reuniao', 'consulta', 'compromisso', 'tarefa', 'deslocamento', 'outro']).describe('Tipo do compromisso'),
          data_hora_inicio: z.string().describe('ISO 8601 com timezone. Ex: 2026-08-10T14:00:00-03:00'),
          data_hora_fim: z.string().describe('ISO 8601 com timezone. Ex: 2026-08-10T15:00:00-03:00'),
          descricao: z.string().optional().describe('Detalhes adicionais'),
          local: z.string().optional().describe('Local ou "online"'),
          link: z.string().optional().describe('URL da reunião se online'),
          contatos: z.array(z.string()).optional().describe('Participantes (nomes ou emails)'),
          origem: z.enum(['bia', 'gmail', 'whatsapp', 'manual']).optional().describe('Como chegou ao 168'),
          email_thread_id: z.string().optional().describe('ID do email de origem se vier do Gmail'),
        }),
        execute: async (dados) => {
          if (!accessToken) return { erro: 'Usuário não autenticado' }
          try {
            const supabase = getSupabaseWithToken(accessToken)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return { erro: 'Sessão expirada' }

            const { data, error } = await supabase
              .from('compromissos')
              .insert({
                user_id: user.id,
                tipo: dados.tipo,
                titulo: dados.titulo,
                descricao: dados.descricao,
                data_hora_inicio: dados.data_hora_inicio,
                data_hora_fim: dados.data_hora_fim,
                local: dados.local,
                link: dados.link,
                contatos: dados.contatos,
                origem: dados.origem ?? 'bia',
                email_thread_id: dados.email_thread_id,
                status: 'agendado',
              })
              .select('id')
              .single()

            if (error) return { erro: error.message }
            return { criado: true, id: data.id, titulo: dados.titulo, inicio: dados.data_hora_inicio, fim: dados.data_hora_fim }
          } catch (e) {
            return { erro: String(e) }
          }
        },
      }),
    },
  })

  return result.toTextStreamResponse()
}
