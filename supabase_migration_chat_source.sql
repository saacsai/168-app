-- Sprint A: separação de histórico BIA vs assistente pessoal
ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS chat_source text DEFAULT 'bia';
CREATE INDEX IF NOT EXISTS idx_assistant_messages_source
  ON assistant_messages(instance_id, chat_source, created_at DESC);
