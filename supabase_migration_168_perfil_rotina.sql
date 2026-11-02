-- Rotina fixa do dia — sem isso o sistema não consegue planejar uma semana
-- de verdade (percebido testando ao vivo, 2026-11-02). Esses campos formam
-- o "onboarding essencial": sem eles, ver_metodo_168 sinaliza pendência e
-- o Claude deve priorizar essas perguntas antes de qualquer planejamento.

ALTER TABLE perfil_168
  ADD COLUMN IF NOT EXISTS hora_dormir TIME,
  ADD COLUMN IF NOT EXISTS hora_acordar TIME,
  ADD COLUMN IF NOT EXISTS modo_trabalho TEXT CHECK (modo_trabalho IN ('presencial', 'home_office', 'hibrido')),
  ADD COLUMN IF NOT EXISTS dias_trabalho_presencial INTEGER[],
  ADD COLUMN IF NOT EXISTS tempo_deslocamento_trabalho_min INTEGER,
  ADD COLUMN IF NOT EXISTS horario_cafe TIME,
  ADD COLUMN IF NOT EXISTS horario_almoco TIME,
  ADD COLUMN IF NOT EXISTS horario_janta TIME;
