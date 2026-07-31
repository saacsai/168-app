-- Adiciona due_date (prazo) à tabela tasks
-- date = quando entra no quadro (dia de criação)
-- due_date = prazo final (opcional)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date date;
