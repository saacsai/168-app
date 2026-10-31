import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/owner';

// Webhook da Evolution API — SÓ ingestão mecânica. Nunca responde, nunca
// envia mensagem. Classificação/uso do conteúdo acontece depois, sob
// demanda, via MCP (ferramenta buscar_whatsapp). Ver ADR MCP-first.

type EvolutionPayload = {
  event?: string;
  instance?: string;
  data?: EvolutionMessageData | EvolutionMessageData[];
};

type EvolutionMessageData = {
  key?: { remoteJid?: string; id?: string; fromMe?: boolean };
  pushName?: string;
  messageType?: string;
  messageTimestamp?: number | string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string; fileName?: string };
  };
};

function extrairConteudo(data: EvolutionMessageData): string {
  const m = data.message;
  return (
    m?.conversation ??
    m?.extendedTextMessage?.text ??
    m?.imageMessage?.caption ??
    m?.videoMessage?.caption ??
    m?.documentMessage?.caption ??
    m?.documentMessage?.fileName ??
    ''
  );
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as EvolutionPayload;

  // webhook_by_events=false manda tudo pra mesma URL — só nos interessa
  // mensagem nova chegando, o resto (update, connection) a gente ignora aqui.
  const evento = (payload.event ?? '').toLowerCase();
  if (!evento.includes('messages.upsert') && !evento.includes('messages_upsert')) {
    return NextResponse.json({ ok: true, ignorado: payload.event });
  }

  const instanceName = payload.instance;
  if (!instanceName) return NextResponse.json({ ok: true, ignorado: 'sem instance' });

  const sb = supabaseAdmin();
  const { data: inst, error: instError } = await sb
    .from('instances')
    .select('user_id')
    .eq('instance_name', instanceName)
    .single();
  if (!inst) return NextResponse.json({ ok: true, ignorado: 'instância sem owner', debug: instError?.message });

  const mensagens = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  if (!mensagens.length) return NextResponse.json({ ok: true, ignorado: 'sem data' });

  const linhas = mensagens
    .filter(m => m.key?.id && m.key?.remoteJid)
    .map(m => ({
      user_id: inst.user_id,
      instance_name: instanceName,
      message_id: m.key!.id!,
      remote_jid: m.key!.remoteJid!,
      grupo: m.key!.remoteJid!.endsWith('@g.us'),
      nome_contato: m.pushName ?? null,
      de_mim: Boolean(m.key?.fromMe),
      tipo: m.messageType ?? Object.keys(m.message ?? {})[0] ?? 'desconhecido',
      conteudo: extrairConteudo(m),
      timestamp_msg: m.messageTimestamp
        ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString(),
    }));

  if (!linhas.length) return NextResponse.json({ ok: true, ignorado: 'nenhuma linha válida' });

  const { error } = await sb.from('whatsapp_mensagens').upsert(linhas, { onConflict: 'instance_name,message_id' });
  if (error) console.error('[whatsapp/ingest] erro ao salvar:', error.message);

  return NextResponse.json({ ok: true, salvas: linhas.length });
}
