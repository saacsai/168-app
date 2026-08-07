-- ============================================================
-- TABELA: compromissos
-- Blocos avulsos não-recorrentes: reuniões, consultas, viagens, etc.
-- Complementa blocos_fixos (recorrentes) e reunioes (com transcrição).
-- ============================================================

CREATE TABLE IF NOT EXISTS compromissos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Classificação
  tipo TEXT DEFAULT 'compromisso'
    CHECK (tipo IN ('reuniao', 'consulta', 'compromisso', 'tarefa', 'deslocamento', 'outro')),

  -- Dados principais
  titulo TEXT NOT NULL,
  descricao TEXT,
  projeto TEXT,

  -- Temporalidade
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim    TIMESTAMPTZ NOT NULL,

  -- Local / link
  local TEXT,
  link  TEXT,

  -- Participantes (nomes ou emails)
  contatos TEXT[],

  -- Status
  status TEXT DEFAULT 'agendado'
    CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),

  -- Origem (como chegou ao 168)
  origem TEXT DEFAULT 'bia'
    CHECK (origem IN ('bia', 'gmail', 'whatsapp', 'manual', 'google_calendar')),
  email_thread_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE compromissos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_data" ON compromissos
  FOR ALL USING (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS compromissos_user_inicio
  ON compromissos (user_id, data_hora_inicio);
