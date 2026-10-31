import { createClient } from '@supabase/supabase-js';

// TODO (incremento de billing/conta): hoje é single-user, fixado no e-mail do
// Luciano — ainda não existe OAuth/conta própria do MCP pra resolver "quem
// está chamando" por usuário real. Ver docs/adr_mcp_first_desvinculacao_unisol.md.
export const OWNER_EMAIL = 'luciano.maeda@saacs.com.br';

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

let cachedUserId: string | null = null;
export async function resolveOwnerUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`Falha ao resolver usuário: ${error.message}`);
  const user = data.users.find(u => u.email === OWNER_EMAIL);
  if (!user) throw new Error(`Usuário ${OWNER_EMAIL} não encontrado em auth.users.`);
  cachedUserId = user.id;
  return user.id;
}
