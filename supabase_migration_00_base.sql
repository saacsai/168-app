-- ============================================================
-- 168 App — Schema Base (rodar PRIMEIRO)
-- Tabelas fundacionais herdadas da arquitetura MeuDIA
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TABELA: instances
-- Uma por usuário — representa a instância WhatsApp + perfil
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  instance_name       text,
  phone_number        text,
  persona_name        text DEFAULT 'Olivia',
  persona_style       text DEFAULT 'direto',
  personal_channel    text,   -- número do WhatsApp do próprio usuário para alertas
  plan                text DEFAULT 'free',
  credits             int DEFAULT 100,
  onboarding_step     int NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ------------------------------------------------------------
-- TABELA: contacts
-- Contatos do WhatsApp do usuário
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  name         text,
  name_locked  bool DEFAULT false,
  relevante    bool DEFAULT false,   -- marcado pelo usuário como relevante para agenda
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(instance_id, phone)
);

-- ------------------------------------------------------------
-- TABELA: assistant_messages
-- Histórico de mensagens com a assistente pessoal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistant_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  chat_source text DEFAULT 'bia',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_instance
  ON assistant_messages(instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_source
  ON assistant_messages(instance_id, chat_source, created_at DESC);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_instance" ON instances
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_own_contacts" ON contacts
  FOR ALL USING (
    instance_id IN (SELECT id FROM instances WHERE user_id = auth.uid())
  );

CREATE POLICY "user_own_messages" ON assistant_messages
  FOR ALL USING (
    instance_id IN (SELECT id FROM instances WHERE user_id = auth.uid())
  );
