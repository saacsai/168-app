-- Rastreia quando foi o último ritual de planejamento (diário/semanal) pra
-- Claude se autoverificar no início de uma conversa nova, sem precisar de
-- push/disparo proativo (o 168 não inicia conversa sozinho, por design).

ALTER TABLE perfil_168
  ADD COLUMN IF NOT EXISTS ultimo_ritual_diario DATE,
  ADD COLUMN IF NOT EXISTS ultimo_ritual_semanal DATE;
