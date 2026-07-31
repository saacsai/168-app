-- Sprint B: memória persistente da assistente
CREATE TABLE IF NOT EXISTS assistant_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('contact_note', 'agenda', 'instruction')),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assistant_memory_instance
  ON assistant_memory(instance_id, created_at DESC);
