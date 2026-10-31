-- ============================================================
-- 168 — Pivô MCP-first: schema flexível
-- Ver docs/adr_mcp_first_desvinculacao_unisol.md pro contexto completo.
--
-- Não é "Claude gera CREATE TABLE por usuário" (risco de estabilidade/segurança
-- equivalente ao erro já cometido no MCP SAACS, só que em DDL). O Claude decide
-- O QUE rastrear; a estrutura do banco nunca muda — só o conteúdo dentro dela.
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: campos_customizados
-- Qualquer dado que o Claude decida acompanhar pro usuário, fora do domínio
-- já modelado em perfil_168/metas_168/blocos_fixos (ex: "conta de luz vence
-- dia 5", "preciso revisar contrato X"). Schema flexível, sem migration nova
-- a cada tipo de dado.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campos_customizados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Classificação livre, decidida pelo Claude na conversa (ex: "conta_a_pagar",
  -- "lembrete", "nota_livre") — não é enum fixo, de propósito.
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,          -- ex: "Conta de luz", "Revisar contrato X"
  valor JSONB NOT NULL,        -- conteúdo livre: {"vencimento": "2026-11-05", "valor_reais": 320}

  -- Vínculo opcional com a grade (se o dado se relaciona a um bloco/meta específico)
  bloco_id UUID REFERENCES blocos_fixos(id) ON DELETE SET NULL,
  meta_id UUID REFERENCES metas_168(id) ON DELETE SET NULL,

  -- Ciclo de vida simples — a maioria desses dados "resolve" e sai do radar
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'resolvido', 'arquivado')),
  resolvido_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campos_customizados_user ON campos_customizados (user_id, status);
CREATE INDEX IF NOT EXISTS idx_campos_customizados_categoria ON campos_customizados (user_id, categoria);

ALTER TABLE campos_customizados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON campos_customizados FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_campos_customizados()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campos_customizados_updated_at
  BEFORE UPDATE ON campos_customizados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_campos_customizados();

-- ------------------------------------------------------------
-- TABELA: contas_email_conectadas
-- Prepara o terreno pro próximo incremento (leitura de Gmail multi-conta) —
-- criada agora junto por ser parte do mesmo desenho de schema flexível,
-- mas o fluxo de OAuth pra popular essa tabela ainda não foi construído.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas_email_conectadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  email TEXT NOT NULL,
  apelido TEXT,                 -- ex: "AUA", "Pessoal", "lucianomaeda.com.br"
  provedor TEXT NOT NULL DEFAULT 'google' CHECK (provedor IN ('google', 'forward')),

  -- Tokens OAuth (só relevante quando provedor = 'google')
  access_token TEXT,
  refresh_token TEXT,
  token_expira_em TIMESTAMPTZ,

  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, email)
);

ALTER TABLE contas_email_conectadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON contas_email_conectadas FOR ALL USING (auth.uid() = user_id);
