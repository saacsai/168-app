-- Lógica de "guardar só o necessário" pro WhatsApp — ver conversa de privacidade
-- 2026-10-31 (LGPD, retenção mínima, não é urgente mas já planejando).

-- Contatos/grupos que o usuário nunca quer que entrem no banco, nem
-- transitoriamente. Checado na ingestão, antes de qualquer insert.
create table if not exists whatsapp_contatos_excluidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  remote_jid text not null,
  apelido text,
  created_at timestamptz not null default now(),
  unique (user_id, remote_jid)
);

alter table whatsapp_contatos_excluidos enable row level security;

create policy user_own_data on whatsapp_contatos_excluidos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
