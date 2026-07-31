-- Migration: tabela de tarefas (Post-its do Meu Dia)
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tasks (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id   uuid    NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  title         text    NOT NULL,
  origin_group_id   uuid REFERENCES contact_groups(id) ON DELETE SET NULL,
  origin_contact_id uuid REFERENCES contacts(id)       ON DELETE SET NULL,
  priority      text    NOT NULL DEFAULT 'media'
                        CHECK (priority IN ('alta', 'media', 'baixa')),
  status        text    NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'feito')),
  date          date    NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_instance_date ON tasks (instance_id, date);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: owner via instance" ON tasks
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );
