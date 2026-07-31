-- Migration: chat BIA + notificações
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS notifications (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references instances(id) on delete cascade,
  type text not null,        -- 'urgencia' | 'digest' | 'sistema' | 'creditos'
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references instances(id) on delete cascade,
  role text not null,        -- 'user' | 'assistant'
  content text not null,
  tool_calls jsonb,          -- ações executadas: [{tool, args, result}]
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_instance_unread
  ON notifications(instance_id, read) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_assistant_messages_instance_created
  ON assistant_messages(instance_id, created_at DESC);
