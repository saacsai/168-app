-- Ingestão mecânica de mensagens do WhatsApp (via webhook da Evolution API).
-- Só leitura pro resto do sistema: nada aqui envia ou responde mensagem.
-- Ver docs/adr_mcp_first_desvinculacao_unisol.md — WhatsApp é read-only.

create table if not exists whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_name text not null,
  message_id text not null,
  remote_jid text not null,
  grupo boolean not null default false,
  nome_contato text,
  de_mim boolean not null default false,
  tipo text,
  conteudo text,
  timestamp_msg timestamptz not null,
  created_at timestamptz not null default now(),
  unique (instance_name, message_id)
);

create index if not exists whatsapp_mensagens_user_tempo_idx
  on whatsapp_mensagens (user_id, timestamp_msg desc);

create index if not exists whatsapp_mensagens_remote_jid_idx
  on whatsapp_mensagens (remote_jid);

alter table whatsapp_mensagens enable row level security;

create policy user_own_data on whatsapp_mensagens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
