-- Metas semanais: compromisso com data, concreto e verificável, em vez de
-- forçar todo mundo a pensar em horizonte de 1/5/10 anos logo no onboarding
-- (decisão de brainstorming 2026-10-31 — "muito exercício elucubratório pra
-- 95% da humanidade"). 1/5/10 anos continua existindo, só deixa de ser
-- obrigatório.

ALTER TABLE metas_168 DROP CONSTRAINT IF EXISTS metas_168_horizonte_check;
ALTER TABLE metas_168 ADD CONSTRAINT metas_168_horizonte_check
  CHECK (horizonte IN ('semana', '1_ano', '5_anos', '10_anos'));

ALTER TABLE metas_168 ADD COLUMN IF NOT EXISTS semana_referencia DATE;
-- segunda-feira da semana a que a meta pertence, só relevante quando horizonte='semana'
