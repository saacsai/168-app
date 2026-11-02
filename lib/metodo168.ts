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
  hora_dormir: string | null;
  hora_acordar: string | null;
  modo_trabalho: 'presencial' | 'home_office' | 'hibrido' | null;
  dias_trabalho_presencial: number[] | null;
  tempo_deslocamento_trabalho_min: number | null;
  horario_cafe: string | null;
  horario_almoco: string | null;
  horario_janta: string | null;
};

const CAMPOS_PERFIL =
  'pacto_aceito, o_que_travou, o_que_mudou, horas_sono, horas_cuidar_mim, horas_cuidar_familia, ' +
  'horas_trabalho, ultimo_ritual_diario, ultimo_ritual_semanal, hora_dormir, hora_acordar, ' +
  'modo_trabalho, dias_trabalho_presencial, tempo_deslocamento_trabalho_min, horario_cafe, ' +
  'horario_almoco, horario_janta';

function segundaFeiraDe(data: Date): string {
  const d = new Date(data);
  const diasAteSegunda = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasAteSegunda);
  return d.toISOString().slice(0, 10);
}

export async function verPerfil168(): Promise<(Perfil168 & {
  ritual_diario_pendente: boolean;
  ritual_semanal_pendente: boolean;
  onboarding_essencial_completo: boolean;
  onboarding_essencial_faltando: string[];
}) | null> {
  const userId = await resolveOwnerUserId();
  const { data, error } = await supabaseAdmin()
    .from('perfil_168')
    .select(CAMPOS_PERFIL)
    .eq('user_id', userId)
    .maybeSingle<Perfil168>();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const segundaAtual = segundaFeiraDe(new Date());

  const essenciais: [string, unknown][] = [
    ['hora_dormir', data.hora_dormir],
    ['hora_acordar', data.hora_acordar],
    ['modo_trabalho', data.modo_trabalho],
    ['tempo_deslocamento_trabalho_min', data.tempo_deslocamento_trabalho_min],
    ['horario_cafe', data.horario_cafe],
    ['horario_almoco', data.horario_almoco],
    ['horario_janta', data.horario_janta],
  ];
  const faltando = essenciais.filter(([, v]) => v === null || v === undefined).map(([k]) => k);

  return {
    ...data,
    ritual_diario_pendente: data.ultimo_ritual_diario !== hoje,
    ritual_semanal_pendente: !data.ultimo_ritual_semanal || data.ultimo_ritual_semanal < segundaAtual,
    onboarding_essencial_completo: faltando.length === 0,
    onboarding_essencial_faltando: faltando,
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
  hora_dormir: string;
  hora_acordar: string;
  modo_trabalho: string;
  dias_trabalho_presencial: number[];
  tempo_deslocamento_trabalho_min: number;
  horario_cafe: string;
  horario_almoco: string;
  horario_janta: string;
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
  horizonte: 'semana' | '1_ano' | '5_anos' | '10_anos';
  titulo: string;
  descricao: string | null;
  meta_smart: string | null;
  o_que_eliminar: string | null;
  status: 'ativa' | 'pausada' | 'concluida';
  semana_referencia: string | null;
};

export async function listarMetas168(status: string = 'ativa', semanaReferencia?: string): Promise<Meta168[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('metas_168')
    .select('id, esfera, horizonte, titulo, descricao, meta_smart, o_que_eliminar, status, semana_referencia')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (status !== 'todas') q = q.eq('status', status);
  if (semanaReferencia) q = q.eq('semana_referencia', semanaReferencia);
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
  semana_referencia?: string;
}): Promise<Meta168> {
  const userId = await resolveOwnerUserId();
  const dados = { ...meta };
  if (dados.horizonte === 'semana' && !dados.semana_referencia) {
    dados.semana_referencia = segundaFeiraDe(new Date());
  }
  const row = { user_id: userId, ...dados, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin()
    .from('metas_168')
    .upsert(row, { onConflict: 'id' })
    .select('id, esfera, horizonte, titulo, descricao, meta_smart, o_que_eliminar, status, semana_referencia')
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

  const segundaDoRecorte = segundaFeiraDe(inicio);

  const [perfil, todasMetas, blocos, agenda, reunioes] = await Promise.all([
    verPerfil168(),
    listarMetas168('ativa'),
    listarBlocosFixos(true),
    buscarAgendaMultiConta(inicio.toISOString(), fim.toISOString(), 50).catch(() => []),
    listarReunioes({ desde: inicio.toISOString(), ate: fim.toISOString() }),
  ]);

  const metasLongoPrazo = todasMetas.filter(m => m.horizonte !== 'semana');
  const metasSemana = todasMetas.filter(m => m.horizonte === 'semana' && m.semana_referencia === segundaDoRecorte);

  const blocosDoRecorte = tipo === 'dia'
    ? blocos.filter(b => b.dias_semana.includes(diaSemana))
    : blocos;

  return {
    periodo: { tipo, inicio: inicio.toISOString(), fim: fim.toISOString(), semana_referencia: segundaDoRecorte },
    perfil,
    metasSemana,
    metasLongoPrazo,
    blocos: blocosDoRecorte,
    agenda,
    reunioes,
  };
}

// Reuniões pontuais (não-recorrentes) — registradas pelo Claude em conversa
// ("marca uma reunião com fulano dia X às Yh") ou detectadas de outras
// fontes no futuro (whatsapp, calendar). Distinto de blocos_fixos (que é
// recorrência semanal) e de buscarAgendaMultiConta (que lê o Google Calendar
// real, só leitura — isso aqui é o que o PRÓPRIO 168 registra).
export type Reuniao = {
  id: string;
  titulo: string;
  projeto: string | null;
  convocado_por: string | null;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  duracao_minutos: number | null;
  local: string | null;
  meet_url: string | null;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
};

export async function salvarReuniao(reuniao: {
  id?: string;
  titulo: string;
  projeto?: string;
  convocado_por?: string;
  data_hora_inicio: string;
  data_hora_fim?: string;
  duracao_minutos?: number;
  local?: string;
  meet_url?: string;
  status?: string;
}): Promise<Reuniao> {
  const userId = await resolveOwnerUserId();
  let data_hora_fim = reuniao.data_hora_fim;
  let duracao_minutos = reuniao.duracao_minutos;
  if (!data_hora_fim && duracao_minutos) {
    data_hora_fim = new Date(new Date(reuniao.data_hora_inicio).getTime() + duracao_minutos * 60000).toISOString();
  } else if (data_hora_fim && !duracao_minutos) {
    duracao_minutos = Math.round((new Date(data_hora_fim).getTime() - new Date(reuniao.data_hora_inicio).getTime()) / 60000);
  }
  const row = { user_id: userId, origem: 'manual', ...reuniao, data_hora_fim, duracao_minutos };
  const { data, error } = await supabaseAdmin()
    .from('reunioes')
    .upsert(row, { onConflict: 'id' })
    .select('id, titulo, projeto, convocado_por, data_hora_inicio, data_hora_fim, duracao_minutos, local, meet_url, status')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listarReunioes(opts: { desde?: string; ate?: string; status?: string } = {}): Promise<Reuniao[]> {
  const userId = await resolveOwnerUserId();
  let q = supabaseAdmin()
    .from('reunioes')
    .select('id, titulo, projeto, convocado_por, data_hora_inicio, data_hora_fim, duracao_minutos, local, meet_url, status')
    .eq('user_id', userId)
    .order('data_hora_inicio');
  if (opts.desde) q = q.gte('data_hora_inicio', opts.desde);
  if (opts.ate) q = q.lte('data_hora_inicio', opts.ate);
  if (opts.status) q = q.eq('status', opts.status);
  else q = q.neq('status', 'cancelada');
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Auditoria Noturna: confronta plano vs. realizado. Peça 1 (confirmarPlanoDia)
// tira a "foto" do que foi combinado na conversa de planejamento da manhã;
// peça 2 (registrarAuditoriaDiaria) compara no dia seguinte, calcula o que
// ficou pra trás, e devolve as metas da semana junto — pra quem for decidir
// a realocação (o Claude, em conversa) não esquecer de checar se isso
// compromete a meta semanal. A ferramenta não decide nada sozinha; só junta
// os dados pra confrontação acontecer de verdade, não virar formulário.

export type ItemPlanoDia = { label: string; esfera?: string; inicio?: string; fim?: string };
export type ItemRealizado = ItemPlanoDia & { realizado: boolean };

export async function confirmarPlanoDia(data: string, blocosPlanejados: ItemPlanoDia[]): Promise<void> {
  const userId = await resolveOwnerUserId();
  const { error } = await supabaseAdmin()
    .from('auditoria_diaria')
    .upsert({ user_id: userId, data, blocos_planejados: blocosPlanejados }, { onConflict: 'user_id,data' });
  if (error) throw new Error(error.message);
}

export async function registrarAuditoriaDiaria(opts: {
  data: string;
  blocosRealizados: ItemRealizado[];
  motivoDeclarado?: string;
  avaliacaoIa?: string;
  servicosPagosNaoUsados?: string[];
}) {
  const userId = await resolveOwnerUserId();
  const sb = supabaseAdmin();

  const { data: existente } = await sb
    .from('auditoria_diaria')
    .select('blocos_planejados')
    .eq('user_id', userId)
    .eq('data', opts.data)
    .maybeSingle();

  const planejados: ItemPlanoDia[] = existente?.blocos_planejados ?? [];
  const labelsRealizados = new Set(opts.blocosRealizados.filter(b => b.realizado).map(b => b.label));
  const blocosPerdidos = planejados.filter(p => !labelsRealizados.has(p.label)).map(p => p.label);

  const row = {
    user_id: userId,
    data: opts.data,
    blocos_planejados: planejados,
    blocos_realizados: opts.blocosRealizados,
    blocos_perdidos: blocosPerdidos,
    motivo_declarado: opts.motivoDeclarado ?? null,
    avaliacao_ia: opts.avaliacaoIa ?? null,
    servicos_pagos_nao_usados: opts.servicosPagosNaoUsados ?? [],
  };
  const { error } = await sb.from('auditoria_diaria').upsert(row, { onConflict: 'user_id,data' });
  if (error) throw new Error(error.message);

  const segunda = segundaFeiraDe(new Date(opts.data));
  const metasSemana = await listarMetas168('ativa', segunda);

  return { blocos_perdidos: blocosPerdidos, metas_semana_em_risco: metasSemana };
}

// Espelho pra trás do preparar_planejamento: junta tudo que aconteceu num
// período (auditorias diárias, reuniões, dados soltos criados/resolvidos,
// metas semanais do período) pro Claude montar um relatório narrativo —
// mesma lógica da Skill relatorio-periodico, mas como ferramenta MCP,
// alcançando qualquer superfície (não só Claude Code). Generaliza pra
// qualquer aspecto da vida do usuário, não só prestação de contas
// institucional.
export async function gerarRelatorioPeriodico(desde: string, ate: string) {
  const userId = await resolveOwnerUserId();
  const sb = supabaseAdmin();

  const [auditoriasRes, reunioesPeriodo, dadosRes] = await Promise.all([
    sb
      .from('auditoria_diaria')
      .select('data, blocos_planejados, blocos_realizados, blocos_perdidos, motivo_declarado, avaliacao_ia, servicos_pagos_nao_usados')
      .eq('user_id', userId)
      .gte('data', desde)
      .lte('data', ate)
      .order('data'),
    listarReunioes({ desde, ate }),
    sb
      .from('campos_customizados')
      .select('id, categoria, nome, valor, status, created_at, resolvido_em')
      .eq('user_id', userId)
      .or(`and(created_at.gte.${desde},created_at.lte.${ate}),and(resolvido_em.gte.${desde},resolvido_em.lte.${ate})`)
      .order('created_at'),
  ]);

  if (auditoriasRes.error) throw new Error(auditoriasRes.error.message);
  if (dadosRes.error) throw new Error(dadosRes.error.message);

  // metas semanais de toda semana que o período tocar (pode cruzar mais de uma)
  const segundaInicio = segundaFeiraDe(new Date(desde));
  const segundaFim = segundaFeiraDe(new Date(ate));
  const { data: metasPeriodo, error: metasError } = await sb
    .from('metas_168')
    .select('id, esfera, horizonte, titulo, meta_smart, status, semana_referencia')
    .eq('user_id', userId)
    .eq('horizonte', 'semana')
    .gte('semana_referencia', segundaInicio)
    .lte('semana_referencia', segundaFim);
  if (metasError) throw new Error(metasError.message);

  return {
    periodo: { desde, ate },
    auditorias: auditoriasRes.data ?? [],
    reunioes: reunioesPeriodo,
    metasSemana: metasPeriodo ?? [],
    dadosRegistrados: dadosRes.data ?? [],
  };
}
