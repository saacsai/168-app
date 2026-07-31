-- ============================================================
-- 168 App — Schema Core
-- Rodar no Supabase SQL Editor do projeto 168-app
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TABELA: perfil_168
-- Dados do pacto e configurações do usuário
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfil_168 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Pacto filosófico
  pacto_aceito BOOLEAN DEFAULT FALSE,
  pacto_aceito_em TIMESTAMPTZ,

  -- Briefing de vida
  o_que_travou TEXT,
  o_que_mudou TEXT,

  -- Distribuição das 168h (em horas/semana)
  horas_sono NUMERIC DEFAULT 56,
  horas_cuidar_mim NUMERIC,
  horas_cuidar_familia NUMERIC,
  horas_trabalho NUMERIC,

  -- Configurações
  assistant_name TEXT DEFAULT 'Olivia',
  whatsapp_number TEXT,
  personal_channel_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABELA: metas_168
-- Metas por esfera de vida × horizonte de tempo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_168 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classificação
  esfera TEXT NOT NULL CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio')),
  horizonte TEXT NOT NULL CHECK (horizonte IN ('1_ano', '5_anos', '10_anos')),

  -- Conteúdo
  titulo TEXT NOT NULL,
  descricao TEXT,
  meta_smart TEXT,         -- versão estruturada gerada pela IA
  o_que_eliminar TEXT,     -- custo de oportunidade identificado no briefing

  -- Estado
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABELA: blocos_fixos
-- Blocos inegociáveis da rotina semanal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocos_fixos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação
  label TEXT NOT NULL,          -- ex: "Academia", "Inglês", "Direito"
  esfera TEXT NOT NULL CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono')),
  meta_id UUID REFERENCES metas_168(id) ON DELETE SET NULL,

  -- Recorrência
  dias_semana INTEGER[] NOT NULL,  -- [1,2,3,4,5] = seg a sex (0=dom, 6=sab)
  hora_inicio TIME NOT NULL,       -- início real do bloco (inclui deslocamento)
  hora_fim TIME NOT NULL,          -- fim real do bloco (inclui complementares)

  -- Tempo satelite (o que compõe o bloco além da atividade em si)
  tempo_atividade_min INTEGER,         -- duração pura da atividade
  tempo_deslocamento_ida_min INTEGER DEFAULT 0,
  tempo_deslocamento_volta_min INTEGER DEFAULT 0,
  tempo_complementar_min INTEGER DEFAULT 0,  -- banho, shake, refeição, etc.
  -- total real = soma de todos acima (deve = hora_fim - hora_inicio)

  -- Proteção
  inegociavel BOOLEAN DEFAULT TRUE,  -- true = não cede para demandas externas

  -- Aprendizado progressivo
  origem TEXT DEFAULT 'declarado' CHECK (origem IN ('declarado', 'sugerido', 'descoberto')),
  sugestao_aceita BOOLEAN,
  sugestao_origem TEXT,  -- ex: "auditoria_2026-07-31"

  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABELA: reunioes
-- Reuniões detectadas (Calendar, WhatsApp, Meet)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reunioes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Origem
  origem TEXT NOT NULL CHECK (origem IN ('google_calendar', 'whatsapp', 'manual')),
  google_event_id TEXT,

  -- Dados da reunião
  titulo TEXT,
  projeto TEXT,               -- ex: "CooperaMais", "Terra Mesa", "USP"
  convocado_por TEXT,
  data_hora_inicio TIMESTAMPTZ,
  data_hora_fim TIMESTAMPTZ,
  duracao_minutos INTEGER,
  local TEXT,                 -- 'presencial' | 'google_meet' | url
  meet_url TEXT,

  -- Transcrição e resumo
  transcricao TEXT,
  resumo_ia TEXT,
  decisoes TEXT[],

  -- Status
  status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABELA: action_items
-- Tarefas extraídas de reuniões, WhatsApp ou criadas manualmente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Origem
  origem TEXT NOT NULL CHECK (origem IN ('reuniao', 'whatsapp', 'email', 'manual')),
  reuniao_id UUID REFERENCES reunioes(id) ON DELETE SET NULL,
  solicitado_por TEXT,
  contato_origem TEXT,

  -- Conteúdo
  descricao TEXT NOT NULL,
  projeto TEXT,
  prazo_solicitado TIMESTAMPTZ,
  prazo_negociado TIMESTAMPTZ,

  -- Alocação na agenda
  bloco_alocado_inicio TIMESTAMPTZ,
  bloco_alocado_fim TIMESTAMPTZ,
  esfera_impactada TEXT CHECK (esfera_impactada IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio')),

  -- Confrontação
  conflito_detectado BOOLEAN DEFAULT FALSE,
  conflito_descricao TEXT,
  alerta_enviado BOOLEAN DEFAULT FALSE,
  alerta_enviado_em TIMESTAMPTZ,
  decisao_usuario TEXT CHECK (decisao_usuario IN ('aceito', 'recusado', 'renegociado', 'pendente')),

  -- Estado
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABELA: alocacao_semanal
-- Snapshot da alocação das 168h por semana
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alocacao_semanal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  semana_inicio DATE NOT NULL,   -- sempre segunda-feira
  semana_fim DATE NOT NULL,      -- sempre domingo

  -- Alocado (planejado)
  horas_sono_alocadas NUMERIC DEFAULT 0,
  horas_cuidar_mim_alocadas NUMERIC DEFAULT 0,
  horas_cuidar_familia_alocadas NUMERIC DEFAULT 0,
  horas_trabalho_alocadas NUMERIC DEFAULT 0,

  -- Realizado (auditoria noturna)
  horas_sono_realizadas NUMERIC DEFAULT 0,
  horas_cuidar_mim_realizadas NUMERIC DEFAULT 0,
  horas_cuidar_familia_realizadas NUMERIC DEFAULT 0,
  horas_trabalho_realizadas NUMERIC DEFAULT 0,

  -- Auditoria
  semana_equilibrada BOOLEAN,    -- cuidar_mim + familia > 0
  observacoes_ia TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, semana_inicio)
);

-- ------------------------------------------------------------
-- TABELA: auditoria_diaria
-- Registro diário da Auditoria Noturna
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_diaria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  data DATE NOT NULL,

  -- Blocos planejados vs realizados
  blocos_planejados JSONB,     -- [{label, esfera, inicio, fim}]
  blocos_realizados JSONB,     -- [{label, esfera, inicio, fim, realizado: bool}]

  -- Confrontação
  blocos_perdidos TEXT[],      -- labels dos blocos não cumpridos
  motivo_declarado TEXT,       -- o usuário explica
  avaliacao_ia TEXT,           -- resposta da IA sem aceitar desculpa abstrata

  -- Vazamentos financeiros detectados
  servicos_pagos_nao_usados TEXT[],  -- ex: ["Academia", "Curso Inglês"]

  -- Aprendizado: atividades não agendadas declaradas na auditoria
  atividades_nao_agendadas JSONB,
  -- [{label, duracao_min, esfera_estimada, vira_bloco_fixo: bool}]

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, data)
);

-- ------------------------------------------------------------
-- TABELA: sugestoes_bloco
-- Sugestões de blocos fixos geradas pela IA via aprendizado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sugestoes_bloco (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  esfera TEXT NOT NULL CHECK (esfera IN ('cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono')),
  hora_inicio TIME,
  hora_fim TIME,
  dias_semana INTEGER[],

  motivo TEXT,    -- por que a IA está sugerindo
  origem TEXT NOT NULL CHECK (origem IN ('auditoria', 'conversa', 'padrao_detectado')),
  origem_ref TEXT, -- ex: auditoria_diaria.id

  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'recusada')),
  respondido_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RLS — Row Level Security
-- ------------------------------------------------------------
ALTER TABLE perfil_168 ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_168 ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alocacao_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_diaria ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuário só vê seus próprios dados
CREATE POLICY "user_own_data" ON perfil_168 FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON metas_168 FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON blocos_fixos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON reunioes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON action_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON alocacao_semanal FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_data" ON auditoria_diaria FOR ALL USING (auth.uid() = user_id);

ALTER TABLE sugestoes_bloco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_data" ON sugestoes_bloco FOR ALL USING (auth.uid() = user_id);
