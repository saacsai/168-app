import { supabaseAdmin, resolveOwnerUserId } from './owner';

export type MensagemWhatsapp = {
  id: string;
  remote_jid: string;
  grupo: boolean;
  nome_contato: string | null;
  de_mim: boolean;
  tipo: string | null;
  conteudo: string | null;
  timestamp_msg: string;
};

// Lê mensagens já ingeridas (mecanicamente, via webhook) da tabela
// whatsapp_mensagens. Só leitura — não envia nada. Filtros combináveis.
export async function buscarMensagensWhatsapp(opts: {
  desde?: string;
  contato?: string;
  apenasGrupos?: boolean;
  apenasRecebidas?: boolean;
  busca?: string;
  maxResults: number;
}): Promise<MensagemWhatsapp[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('whatsapp_mensagens')
    .select('id, remote_jid, grupo, nome_contato, de_mim, tipo, conteudo, timestamp_msg')
    .eq('user_id', userId)
    .order('timestamp_msg', { ascending: false })
    .limit(opts.maxResults);

  if (opts.desde) q = q.gte('timestamp_msg', opts.desde);
  if (opts.contato) q = q.or(`nome_contato.ilike.%${opts.contato}%,remote_jid.ilike.%${opts.contato}%`);
  if (opts.apenasGrupos) q = q.eq('grupo', true);
  if (opts.apenasRecebidas) q = q.eq('de_mim', false);
  if (opts.busca) q = q.ilike('conteudo', `%${opts.busca}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
