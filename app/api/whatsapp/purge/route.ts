import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/owner';

// Disparado pelo Vercel Cron (ver vercel.json). Apaga mensagens de WhatsApp
// com mais de 24h — "guardar só o necessário": o que valer a pena manter,
// Claude já deve ter promovido pra campos_customizados antes disso (ver
// ferramenta salvar_dado_customizado). Conteúdo bruto é efêmero por padrão.
const JANELA_HORAS = 24;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const limite = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabaseAdmin()
    .from('whatsapp_mensagens')
    .delete({ count: 'exact' })
    .lt('timestamp_msg', limite);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, apagadas: count ?? 0, antes_de: limite });
}
