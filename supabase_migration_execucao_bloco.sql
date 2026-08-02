-- ============================================================
-- 168 App — Migration: execucao_bloco + expansões
-- Rodar após supabase_migration_168_core.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXPANDIR esfera para incluir ocio_criativo
--    (blocos_fixos, metas_168, sugestoes_bloco, action_items)
-- ------------------------------------------------------------

ALTER TABLE blocos_fixos DROP CONSTRAINT IF EXISTS blocos_fixos_esfera_check;
ALTER TABLE blocos_fixos ADD CONSTRAINT blocos_fixos_esfera_check
  CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono', 'ocio_criativo'));

ALTER TABLE metas_168 DROP CONSTRAINT IF EXISTS metas_168_esfera_check;
ALTER TABLE metas_168 ADD CONSTRAINT metas_168_esfera_check
  CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'ocio_criativo'));

ALTER TABLE sugestoes_bloco DROP CONSTRAINT IF EXISTS sugestoes_bloco_esfera_check;
ALTER TABLE sugestoes_bloco ADD CONSTRAINT sugestoes_bloco_esfera_check
  CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono', 'ocio_criativo'));

ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_esfera_impactada_check;
ALTER TABLE action_items ADD CONSTRAINT action_items_esfera_impactada_check
  CHECK (esfera_impactada IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'ocio_criativo'));

-- ------------------------------------------------------------
-- 2. NOVA TABELA: execucao_bloco
--
--    Template (blocos_fixos) = "Academia toda seg/qua/sex às 16h"
--    Instância (execucao_bloco) = "O que aconteceu na academia de 2026-08-01"
--
--    Todo bloco que entra no timer gera um execucao_bloco.
--    Resumo + encaminhamentos ficam aqui — não no template.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS execucao_bloco (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Referência ao template (null para eventos ad-hoc: reuniões, imprevistos)
  bloco_fixo_id UUID REFERENCES blocos_fixos(id) ON DELETE SET NULL,
  reuniao_id    UUID REFERENCES reunioes(id)     ON DELETE SET NULL,

  -- Quando aconteceu
  data            DATE NOT NULL,
  iniciado_em     TIMESTAMPTZ,
  finalizado_em   TIMESTAMPTZ,
  duracao_real_min INTEGER,  -- calculado ao finalizar (finalizado_em - iniciado_em)

  -- Snapshot do bloco (preserva histórico mesmo se o template mudar)
  label TEXT NOT NULL,
  esfera TEXT NOT NULL CHECK (esfera IN (
    'cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono', 'ocio_criativo'
  )),

  -- Conteúdo capturado pela BIA pós-execução
  resumo TEXT,   -- "treinei bíceps e tríceps, pesados, boa recuperação"
  notas  TEXT,   -- observações livres, insights, humor, energia

  -- Estado do timer
  status TEXT DEFAULT 'planejado' CHECK (
    status IN ('planejado', 'em_andamento', 'concluido', 'cancelado', 'pulado')
  ),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE execucao_bloco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON execucao_bloco FOR ALL USING (auth.uid() = user_id);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_execucao_bloco_user_data ON execucao_bloco (user_id, data);
CREATE INDEX IF NOT EXISTS idx_execucao_bloco_bloco_fixo ON execucao_bloco (bloco_fixo_id);

-- ------------------------------------------------------------
-- 3. EXPANDIR action_items
--
--    Antes: só reunioes podiam gerar action items.
--    Agora: qualquer execucao_bloco gera action items.
--    Exemplos:
--      - Academia → "treinar bíceps/tríceps em no máximo 3 dias"
--      - Inglês   → "revisar vocabulário de negociação até sexta"
--      - Ócio Criativo → "validar ideia de parceria com Sandro"
-- ------------------------------------------------------------

-- Expandir origem para incluir 'bloco'
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_origem_check;
ALTER TABLE action_items ADD CONSTRAINT action_items_origem_check
  CHECK (origem IN ('reuniao', 'whatsapp', 'email', 'manual', 'bloco'));

-- Rastreabilidade: onde o encaminhamento foi criado
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS execucao_origem_id UUID REFERENCES execucao_bloco(id) ON DELETE SET NULL;

-- Rastreabilidade: onde foi/será executado
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS execucao_destino_id UUID REFERENCES execucao_bloco(id) ON DELETE SET NULL;

-- Janela de prazo em dias (para encaminhamentos baseados em padrão)
-- ex: 3 = "treinar esse grupo muscular em no máximo 3 dias"
-- A BIA monitora e alerta quando a janela está prestes a fechar
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS janela_dias INTEGER;

-- Esfera sugerida para alocação (a BIA usa para propor onde encaixar)
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS bloco_sugerido_esfera TEXT;
