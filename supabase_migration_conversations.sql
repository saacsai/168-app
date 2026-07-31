-- Sprint: histórico de conversas com sidebar
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  chat_source text NOT NULL DEFAULT 'bia',
  title       text NOT NULL DEFAULT 'Nova conversa',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_instance
  ON conversations(instance_id, chat_source, updated_at DESC);

ALTER TABLE assistant_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_messages(conversation_id, created_at ASC);

-- Agrupa mensagens existentes em uma "Conversa inicial" por instância/source
INSERT INTO conversations (instance_id, chat_source, title, created_at, updated_at)
SELECT DISTINCT ON (instance_id, chat_source)
  instance_id,
  chat_source,
  'Conversa inicial',
  MIN(created_at) OVER (PARTITION BY instance_id, chat_source),
  MAX(created_at) OVER (PARTITION BY instance_id, chat_source)
FROM assistant_messages
WHERE conversation_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE assistant_messages am
SET conversation_id = c.id
FROM conversations c
WHERE am.instance_id = c.instance_id
  AND am.chat_source = c.chat_source
  AND am.conversation_id IS NULL
  AND c.title = 'Conversa inicial';
