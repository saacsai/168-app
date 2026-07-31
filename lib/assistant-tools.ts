import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolArgs = Record<string, unknown>
export type ToolResult = Record<string, unknown>
export type ToolUsed = { tool: string; args: ToolArgs }

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: ToolArgs } }
  | { functionResponse: { name: string; response: ToolResult } }

export type GeminiContent = { role: string; parts: GeminiPart[] }

export const MEMORY_TYPE_LABELS: Record<string, string> = {
  contact_note: 'Contato',
  agenda: 'Agenda',
  instruction: 'Instrução',
}

// ─── Tool declarations ────────────────────────────────────────────────────────

export const TOOL_DECLARATIONS = [
  {
    name: 'listar_contatos',
    description: 'Lista contatos com filtro opcional por prioridade.',
    parameters: {
      type: 'OBJECT',
      properties: {
        priority: { type: 'STRING', enum: ['priority', 'normal', 'muted'] },
        limit: { type: 'NUMBER' }
      }
    }
  },
  {
    name: 'buscar_contatos',
    description: 'Busca contatos pelo nome ou trecho do número. Use antes de definir_prioridade ou adicionar_ao_grupo.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING' } },
      required: ['query']
    }
  },
  {
    name: 'definir_prioridade',
    description: 'Define a prioridade de um contato: priority, normal ou muted.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id: { type: 'STRING' },
        priority: { type: 'STRING', enum: ['priority', 'normal', 'muted'] },
        contact_name: { type: 'STRING' }
      },
      required: ['contact_id', 'priority']
    }
  },
  {
    name: 'consultar_fila',
    description: 'Retorna as mensagens pendentes na fila.',
    parameters: {
      type: 'OBJECT',
      properties: { limit: { type: 'NUMBER' } }
    }
  },
  {
    name: 'criar_grupo',
    description: 'Cria um novo grupo de contatos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        description: { type: 'STRING' },
        color: { type: 'STRING' }
      },
      required: ['name']
    }
  },
  {
    name: 'adicionar_ao_grupo',
    description: 'Adiciona um contato a um grupo existente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id: { type: 'STRING' },
        group_id: { type: 'STRING' },
        contact_name: { type: 'STRING' }
      },
      required: ['contact_id', 'group_id']
    }
  },
  {
    name: 'listar_grupos',
    description: 'Lista os grupos de contatos. Use antes de adicionar_ao_grupo para obter o group_id.'
  },
  {
    name: 'criar_contato',
    description: 'Cadastra um novo contato.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        phone: { type: 'STRING' },
        priority: { type: 'STRING', enum: ['priority', 'normal', 'muted'] }
      },
      required: ['name', 'phone']
    }
  },
  {
    name: 'salvar_memoria',
    description: 'Salva uma informação importante para lembrar em conversas futuras. Use quando o usuário mencionar algo relevante sobre contatos, agenda recorrente ou instruções de comportamento.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['contact_note', 'agenda', 'instruction'],
          description: 'contact_note: nota sobre um contato. agenda: compromisso ou rotina recorrente. instruction: instrução de comportamento permanente.'
        },
        content: { type: 'STRING', description: 'O que deve ser lembrado, de forma clara e objetiva.' }
      },
      required: ['type', 'content']
    }
  },
  {
    name: 'apagar_memoria',
    description: 'Apaga uma memória salva anteriormente quando o usuário pedir para esquecer algo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'ID da memória a apagar (visível no contexto persistente)' }
      },
      required: ['id']
    }
  },
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa/Post-it no quadro do Meu Dia. Use quando o usuário mencionar um encaminhamento, algo que precisa fazer, ou quando perguntar sobre tarefas de uma reunião.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title:        { type: 'STRING', description: 'Descrição clara e objetiva da tarefa.' },
        priority:     { type: 'STRING', enum: ['alta', 'media', 'baixa'], description: 'Prioridade. Padrão: media.' },
        group_name:   { type: 'STRING', description: 'Nome do grupo de origem (ex: UNISOL, Família). Opcional.' },
        contact_name: { type: 'STRING', description: 'Nome do contato de origem. Opcional.' },
        due_date:     { type: 'STRING', description: 'Prazo final no formato YYYY-MM-DD. Use quando o usuário mencionar um prazo ou "até dia X". Omitir se não houver prazo.' }
      },
      required: ['title']
    }
  },
  {
    name: 'listar_tarefas',
    description: 'Lista as tarefas do Meu Dia. Por padrão mostra as de hoje.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date:   { type: 'STRING', description: 'Data YYYY-MM-DD. Omitir para hoje.' },
        status: { type: 'STRING', enum: ['pendente', 'feito', 'todas'], description: 'Filtro de status. Padrão: pendente.' }
      }
    }
  },
  {
    name: 'concluir_tarefa',
    description: 'Marca uma tarefa como feita ou pendente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id:     { type: 'STRING', description: 'ID da tarefa.' },
        status: { type: 'STRING', enum: ['feito', 'pendente'], description: 'Novo status. Padrão: feito.' }
      },
      required: ['id']
    }
  },
  {
    name: 'pausar_agente',
    description: 'Para de responder automaticamente no WhatsApp. Use quando o usuário pedir para parar, silenciar, desativar ou pausar o assistente.'
  },
  {
    name: 'retomar_agente',
    description: 'Volta a responder automaticamente no WhatsApp. Use quando o usuário pedir para retomar, ativar de novo ou voltar a responder.'
  }
]

// ─── Memory loading ───────────────────────────────────────────────────────────

export async function loadMemoryBlock(
  instanceId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data } = await supabase
    .from('assistant_memory')
    .select('id, type, content')
    .eq('instance_id', instanceId)
    .order('created_at')

  if (!data?.length) return ''

  const lines = data.map(m => `[${MEMORY_TYPE_LABELS[m.type] || m.type}] (id:${m.id}) ${m.content}`)
  return `\nCONTEXTO PERSISTENTE (lembre sempre):\n${lines.join('\n')}\n`
}

// ─── Tool execution ───────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: ToolArgs,
  instanceId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {

  if (name === 'listar_contatos') {
    const limit = Number(args.limit) || 20
    let query = supabase
      .from('contacts')
      .select('id, name, remote_jid, priority')
      .eq('instance_id', instanceId)
      .order('name')
      .limit(limit)
    if (args.priority) query = query.eq('priority', args.priority as string)
    const { data } = await query
    if (!data?.length) return { total: 0, contatos: [], aviso: 'Nenhum contato encontrado.' }
    return {
      total: data.length,
      contatos: data.map(c => ({
        id: c.id,
        nome: c.name,
        numero: c.remote_jid.replace('@s.whatsapp.net', ''),
        prioridade: c.priority
      }))
    }
  }

  if (name === 'buscar_contatos') {
    const rawQuery = String(args.query).trim()
    const { data: exact } = await supabase
      .from('contacts')
      .select('id, name, remote_jid, priority')
      .eq('instance_id', instanceId)
      .ilike('name', `%${rawQuery}%`)
      .limit(5)
    let data = exact
    if (!data?.length) {
      const words = rawQuery.split(/\s+/).filter(w => w.length >= 3)
      if (words.length > 0) {
        const orFilter = words.map(w => `name.ilike.%${w}%`).join(',')
        const { data: partial } = await supabase
          .from('contacts')
          .select('id, name, remote_jid, priority')
          .eq('instance_id', instanceId)
          .or(orFilter)
          .limit(8)
        data = partial
      }
    }
    if (!data?.length) return { encontrados: [], aviso: 'Nenhum contato encontrado.' }
    return {
      encontrados: data.map(c => ({
        id: c.id,
        nome: c.name,
        numero: c.remote_jid.replace('@s.whatsapp.net', ''),
        prioridade: c.priority
      }))
    }
  }

  if (name === 'definir_prioridade') {
    const { error } = await supabase
      .from('contacts')
      .update({ priority: args.priority, classified_manually: true })
      .eq('id', args.contact_id)
      .eq('instance_id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, nome: args.contact_name ?? args.contact_id, prioridade: args.priority }
  }

  if (name === 'consultar_fila') {
    const limit = Number(args.limit) || 8
    const { data } = await supabase
      .from('message_queue')
      .select('contact_name, message_summary, priority, received_at')
      .eq('instance_id', instanceId)
      .eq('included_in_digest', false)
      .order('received_at', { ascending: false })
      .limit(limit)
    if (!data?.length) return { total: 0, mensagens: [], aviso: 'Fila vazia.' }
    return { total: data.length, mensagens: data }
  }

  if (name === 'criar_grupo') {
    const { data, error } = await supabase
      .from('contact_groups')
      .insert({
        instance_id: instanceId,
        name: String(args.name),
        description: args.description ? String(args.description) : null,
        color: args.color ? String(args.color) : '#6b7280'
      })
      .select('id, name')
      .single()
    if (error) {
      if (error.code === '23505') return { sucesso: false, erro: 'Já existe um grupo com esse nome.' }
      return { sucesso: false, erro: error.message }
    }
    return { sucesso: true, id: data.id, nome: data.name }
  }

  if (name === 'adicionar_ao_grupo') {
    const { error } = await supabase
      .from('contact_group_members')
      .insert({ group_id: String(args.group_id), contact_id: String(args.contact_id) })
    if (error) {
      if (error.code === '23505') return { sucesso: false, erro: 'Contato já está nesse grupo.' }
      return { sucesso: false, erro: error.message }
    }
    return { sucesso: true, nome: args.contact_name ?? args.contact_id }
  }

  if (name === 'listar_grupos') {
    const { data } = await supabase
      .from('contact_groups')
      .select('id, name, description, color')
      .eq('instance_id', instanceId)
      .order('name')
    return { grupos: data ?? [] }
  }

  if (name === 'criar_contato') {
    const phone = String(args.phone).replace(/\D/g, '')
    if (!phone) return { sucesso: false, erro: 'Número inválido.' }
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        instance_id: instanceId,
        name: String(args.name),
        remote_jid: `${phone}@s.whatsapp.net`,
        priority: (args.priority as string) || 'normal',
        classified_manually: true
      })
      .select('id, name, remote_jid, priority')
      .single()
    if (error) {
      if (error.code === '23505') return { sucesso: false, erro: 'Já existe um contato com esse número.' }
      return { sucesso: false, erro: error.message }
    }
    return { sucesso: true, id: data.id, nome: data.name, numero: phone, prioridade: data.priority }
  }

  if (name === 'salvar_memoria') {
    const validTypes = ['contact_note', 'agenda', 'instruction']
    const type = validTypes.includes(String(args.type)) ? String(args.type) : 'instruction'
    const { data, error } = await supabase
      .from('assistant_memory')
      .insert({ instance_id: instanceId, type, content: String(args.content) })
      .select('id')
      .single()
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, id: data.id, tipo: type }
  }

  if (name === 'apagar_memoria') {
    const { error } = await supabase
      .from('assistant_memory')
      .delete()
      .eq('id', String(args.id))
      .eq('instance_id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true }
  }

  if (name === 'criar_tarefa') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const date = String(args.date || today)

    // Resolve group_id from name if provided
    let groupId: string | null = null
    if (args.group_name) {
      const { data: grp } = await supabase
        .from('contact_groups')
        .select('id')
        .eq('instance_id', instanceId)
        .ilike('name', String(args.group_name))
        .limit(1)
        .single()
      groupId = grp?.id ?? null
    }

    // Resolve contact_id from name if provided
    let contactId: string | null = null
    if (args.contact_name) {
      const { data: ct } = await supabase
        .from('contacts')
        .select('id')
        .eq('instance_id', instanceId)
        .ilike('name', `%${String(args.contact_name)}%`)
        .limit(1)
        .single()
      contactId = ct?.id ?? null
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        instance_id: instanceId,
        title: String(args.title),
        priority: String(args.priority || 'media'),
        origin_group_id: groupId,
        origin_contact_id: contactId,
        date,
        due_date: args.due_date ? String(args.due_date) : null,
      })
      .select('id, title, priority, date, due_date')
      .single()

    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, id: data.id, titulo: data.title, prioridade: data.priority, data: data.date, prazo: data.due_date ?? null }
  }

  if (name === 'listar_tarefas') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const date = String(args.date || today)
    const statusFilter = String(args.status || 'pendente')

    let query = supabase
      .from('tasks')
      .select('id, title, priority, status, date, due_date, origin_group_id, contact_groups(name)')
      .eq('instance_id', instanceId)
      .lte('date', date)
      .order('priority', { ascending: true })

    if (statusFilter !== 'todas') query = query.eq('status', statusFilter)

    const { data } = await query
    if (!data?.length) return { total: 0, tarefas: [], aviso: 'Nenhuma tarefa encontrada.' }

    return {
      total: data.length,
      tarefas: data.map(t => ({
        id: t.id,
        titulo: t.title,
        prioridade: t.priority,
        status: t.status,
        grupo: (t.contact_groups as unknown as { name: string } | null)?.name ?? null,
        data: t.date,
        prazo: t.due_date ?? null,
      }))
    }
  }

  if (name === 'concluir_tarefa') {
    const status = String(args.status || 'feito')
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', String(args.id))
      .eq('instance_id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, status }
  }

  if (name === 'pausar_agente') {
    const { error } = await supabase
      .from('instances')
      .update({ paused: true })
      .eq('id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, mensagem: 'Assistente pausado. Você pode retomar quando quiser.' }
  }

  if (name === 'retomar_agente') {
    const { error } = await supabase
      .from('instances')
      .update({ paused: false })
      .eq('id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, mensagem: 'Assistente retomado. Estou de volta!' }
  }

  return { erro: `Ferramenta desconhecida: ${name}` }
}

// ─── Credit helpers ───────────────────────────────────────────────────────────

export async function hasCredits(userId: string, supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from('credit_balance')
    .select('balance')
    .eq('user_id', userId)
    .single()
  return (data?.balance ?? 0) > 0
}

export async function debitCredits({
  userId,
  instanceId,
  tokensIn,
  tokensOut,
  messageType,
  supabase,
  contactJid,
}: {
  userId: string
  instanceId: string
  tokensIn: number
  tokensOut: number
  messageType: string
  supabase: SupabaseClient
  contactJid?: string
}): Promise<void> {
  const credits = Math.max(1, Math.ceil((tokensIn + tokensOut) / 1000))

  await Promise.all([
    supabase.rpc('debit_credits', { p_user_id: userId, p_credits: credits }),
    supabase.from('usage_log').insert({
      user_id: userId,
      instance_id: instanceId,
      contact_remote_jid: contactJid ?? null,
      message_type: messageType,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      gemini_model: 'gemini-2.5-flash',
      credits_debited: credits,
    }),
    supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -credits,
      description: messageType,
    }),
  ])
}

// ─── Gemini multi-turn ────────────────────────────────────────────────────────

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

export async function callGemini(
  contents: GeminiContent[],
  system: string,
  instanceId: string,
  supabase: SupabaseClient,
  depth = 0
): Promise<{ text: string; toolsUsed: ToolUsed[]; tokensIn: number; tokensOut: number }> {
  const toolsUsed: ToolUsed[] = []

  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
    })
  })

  const json = await res.json()
  const tokensIn: number = json.usageMetadata?.promptTokenCount ?? 0
  const tokensOut: number = json.usageMetadata?.candidatesTokenCount ?? 0

  if (!res.ok) {
    console.error('Gemini error', res.status, JSON.stringify(json).slice(0, 200))
    return { text: 'Não consegui processar. Tente novamente.', toolsUsed, tokensIn: 0, tokensOut: 0 }
  }

  const parts: GeminiPart[] = json.candidates?.[0]?.content?.parts ?? []
  const fnCalls = parts.filter(
    (p): p is { functionCall: { name: string; args: ToolArgs } } => 'functionCall' in p
  )

  if (fnCalls.length > 0 && depth < 12) {
    const results = await Promise.all(
      fnCalls.map(fc => executeTool(fc.functionCall.name, fc.functionCall.args, instanceId, supabase))
    )
    fnCalls.forEach((fc, i) => {
      toolsUsed.push({ tool: fc.functionCall.name, args: fc.functionCall.args })
      void results[i]
    })

    const next = await callGemini(
      [
        ...contents,
        { role: 'model', parts: fnCalls.map(fc => ({ functionCall: fc.functionCall })) },
        { role: 'user', parts: fnCalls.map((fc, i) => ({ functionResponse: { name: fc.functionCall.name, response: results[i] } })) }
      ],
      system, instanceId, supabase, depth + 1
    )
    return {
      text: next.text,
      toolsUsed: [...toolsUsed, ...next.toolsUsed],
      tokensIn: tokensIn + next.tokensIn,
      tokensOut: tokensOut + next.tokensOut,
    }
  }

  const textPart = parts.find((p): p is { text: string } => 'text' in p)
  return { text: textPart?.text ?? 'Feito.', toolsUsed, tokensIn, tokensOut }
}
