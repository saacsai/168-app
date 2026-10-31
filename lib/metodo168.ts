import { supabaseAdmin, resolveOwnerUserId } from './owner';
import { buscarAgendaMultiConta } from './gmail-accounts';

// Camada de acesso ao método 168 em si (Pacto, Matriz T×D, blocos
// inegociáveis) — schema já existia (supabase_migration_168_core.sql),
// nunca tinha sido ligado a nenhuma ferramenta MCP até agora. Ver
// docs/adr_mcp_first_desvinculacao_unisol.md.

export type Perfil168 = {
  pacto_aceito: boolean;
  o_que_travou: string | null;
  o_que_mudou: string | null;
  horas_sono: number;
  horas_cuidar_mim: number | null;
  horas_cuidar_familia: number | null;
  horas_trabalho: number | null;
  ultimo_ritual_diario: string | null;
  ultimo_ritual_semanal: string | null;
};

function segundaFeiraDe(data: Date): string {
  const d = new Date(data);
  const diasAteSegunda = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasAteSegunda);
  return d.toISOString().slice(0, 10);
}

export async function verPerfil168(): Promise<(Perfil168 & { ritual_diario_pendente: boolean; ritual_semanal_pendente: boolean }) | null> {
  const userId = await resolveOwnerUserId();
  const { data, error } = await supabaseAdmin()
    .from('perfil_168')
    .select('pacto_aceito, o_que_travou, o_que_mudou, horas_sono, horas_cuidar_mim, horas_cuidar_familia, horas_trabalho, ultimo_ritual_diario, ultimo_ritual_semanal')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const segundaAtual = segundaFeiraDe(new Date());

  return {
    ...data,
    ritual_diario_pendente: data.ultimo_ritual_diario !== hoje,
    ritual_semanal_pendente: !data.ultimo_ritual_semanal || data.ultimo_ritual_semanal < segundaAtual,
  };
}

export async function marcarRitualFeito(tipo: 'dia' | 'semana'): Promise<void> {
  const userId = await resolveOwnerUserId();
  const hoje = new Date().toISOString().slice(0, 10);
  const campo = tipo === 'dia' ? 'ultimo_ritual_diario' : 'ultimo_ritual_semanal';
  const { error } = await supabaseAdmin()
    .from('perfil_168')
    .upsert({ user_id: userId, [campo]: hoje }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function atualizarPacto168(campos: Partial<{
  pacto_aceito: boolean;
  o_que_travou: string;
  o_que_mudou: string;
  horas_sono: number;
  horas_cuidar_mim: number;
  horas_cuidar_familia: number;
  horas_trabalho: number;
}>): Promise<void> {
  const userId = await resolveOwnerUserId();
  const patch: Record<string, unknown> = { ...campos, updated_at: new Date().toISOString() };
  if (campos.pacto_aceito && !('pacto_aceito_em' in campos)) {
    patch.pacto_aceito_em = new Date().toISOString();
  }
  const { error } = await supabaseAdmin()
    .from('perfil_168')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export type Meta168 = {
  id: string;
  esfera: 'cuidar_mim' | 'cuidar_familia' | 'trabalho' | 'patrimonio';
  horizonte: '1_ano' | '5_anos' | '10_anos';
  titulo: string;
  descricao: string | null;
  meta_smart: string | null;
  o_que_eliminar: string | null;
  status: 'ativa' | 'pausada' | 'concluida';
};

export async function listarMetas168(status: string = 'ativa'): Promise<Meta168[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('metas_168')
    .select('id, esfera, horizonte, titulo, descricao, meta_smart, o_que_eliminar, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (status !== 'todas') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function salvarMeta168(meta: {
  id?: string;
  esfera: string;
  horizonte: string;
  titulo: string;
  descricao?: string;
  meta_smart?: string;
  o_que_eliminar?: string;
  status?: string;
}): Promise<Meta168> {
  const userId = await resolveOwnerUserId();
  const row = { user_id: userId, ...meta, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin()
    .from('metas_168')
    .upsert(row, { onConflict: 'id' })
    .select('id, esfera, horizonte, titulo, descricao, meta_smart, o_que_eliminar, status')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type BlocoFixo = {
  id: string;
  label: string;
  esfera: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  inegociavel: boolean;
  tempo_atividade_min: number | null;
  tempo_deslocamento_ida_min: number | null;
  tempo_deslocamento_volta_min: number | null;
  tempo_complementar_min: number | null;
};

export async function listarBlocosFixos(apenasAtivos = true): Promise<BlocoFixo[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('blocos_fixos')
    .select('id, label, esfera, dias_semana, hora_inicio, hora_fim, inegociavel, tempo_atividade_min, tempo_deslocamento_ida_min, tempo_deslocamento_volta_min, tempo_complementar_min')
    .eq('user_id', userId)
    .order('hora_inicio');
  if (apenasAtivos) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function salvarBlocoFixo(bloco: {
  id?: string;
  label: string;
  esfera: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  inegociavel?: boolean;
  tempo_atividade_min?: number;
  tempo_deslocamento_ida_min?: number;
  tempo_deslocamento_volta_min?: number;
  tempo_complementar_min?: number;
  meta_id?: string;
}): Promise<BlocoFixo> {
  const userId = await resolveOwnerUserId();
  const row = { user_id: userId, ...bloco };
  const { data, error } = await supabaseAdmin()
    .from('blocos_fixos')
    .upsert(row, { onConflict: 'id' })
    .select('id, label, esfera, dias_semana, hora_inicio, hora_fim, inegociavel, tempo_atividade_min, tempo_deslocamento_ida_min, tempo_deslocamento_volta_min, tempo_complementar_min')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Junta tudo que o ritual de planejamento (semanal ou diário) precisa: Pacto,
// metas ativas, blocos do período, e os compromissos de agenda real do
// período. Claude usa isso pra conduzir a conversa de planejamento — e pode
// gerar um Artifact com o resultado, já que a grade fixa foi cortada do
// dashboard (ver ADR MCP-first, seção 3).
export async function prepararPlanejamento(tipo: 'semana' | 'dia', dataRef?: string) {
  const base = dataRef ? new Date(dataRef) : new Date();
  const diaSemana = base.getDay(); // 0=dom ... 6=sab, mesma convenção do schema

  let inicio: Date, fim: Date;
  if (tipo === 'dia') {
    inicio = new Date(base);
    inicio.setHours(0, 0, 0, 0);
    fim = new Date(base);
    fim.setHours(23, 59, 59, 999);
  } else {
    const diasAteSegunda = (diaSemana + 6) % 7;
    inicio = new Date(base);
    inicio.setDate(base.getDate() - diasAteSegunda);
    inicio.setHours(0, 0, 0, 0);
    fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    fim.setHours(23, 59, 59, 999);
  }

  const [perfil, metas, blocos, agenda] = await Promise.all([
    verPerfil168(),
    listarMetas168('ativa'),
    listarBlocosFixos(true),
    buscarAgendaMultiConta(inicio.toISOString(), fim.toISOString(), 50).catch(() => []),
  ]);

  const blocosDoRecorte = tipo === 'dia'
    ? blocos.filter(b => b.dias_semana.includes(diaSemana))
    : blocos;

  return {
    periodo: { tipo, inicio: inicio.toISOString(), fim: fim.toISOString() },
    perfil,
    metas,
    blocos: blocosDoRecorte,
    agenda,
  };
}
