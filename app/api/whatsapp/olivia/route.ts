import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGemini, loadMemoryBlock, hasCredits, debitCredits } from '@/lib/assistant-tools'
import type { GeminiContent } from '@/lib/assistant-tools'
import { sendMessageAlert } from '@/lib/email'

function db() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

const toneMap: Record<string, string> = {
  formal:       'formal e preciso, usa linguagem corporativa',
  profissional: 'profissional e eficiente, direto ao ponto',
  descontraido: 'descontraído e próximo, comunicação leve',
  amigavel:     'amigável e caloroso, cria conexão',
}

const sizeMap: Record<string, string> = {
  curto:     'respostas curtas e objetivas',
  detalhado: 'respostas completas e detalhadas',
}

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key')
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { instance_name, message, contact_name, contact_jid } = await req.json()
  if (!instance_name || !message?.trim()) {
    return NextResponse.json({ error: 'instance_name e message são obrigatórios' }, { status: 400 })
  }

  const supabase = db()

  const { data: instances } = await supabase
    .from('instances')
    .select('id, user_id, persona_name, persona_tone, persona_response_size, persona_description, paused')
    .eq('instance_name', instance_name)
    .eq('active', true)
    .limit(1)

  const inst = instances?.[0]
  if (!inst) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  // Agente pausado — Olivia não responde
  if (inst.paused) return NextResponse.json({ response: null, paused: true })

  // Saldo de créditos insuficiente
  if (!(await hasCredits(inst.user_id, supabase))) {
    return NextResponse.json({ response: null, no_credits: true })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', inst.user_id)
    .single()

  const fullName = profile?.full_name || 'usuário'
  const userName = fullName.split(' ')[0]
  const assistantName = inst.persona_name || 'Assistente'
  const tone = toneMap[inst.persona_tone] || 'profissional e eficiente'
  const size = sizeMap[inst.persona_response_size] || 'respostas curtas'

  const [historyResult, memoryBlock, scheduleResult, contactResult] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('instance_id', inst.id)
      .eq('chat_source', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(10),
    loadMemoryBlock(inst.id, supabase),
    supabase
      .from('digest_schedule')
      .select('email_notify, email_notify_scope')
      .eq('instance_id', inst.id)
      .single(),
    contact_jid
      ? supabase
          .from('contacts')
          .select('priority, first_replied_at')
          .eq('instance_id', inst.id)
          .eq('remote_jid', contact_jid)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const history: GeminiContent[] = (historyResult.data ?? [])
    .reverse()
    .map(r => ({ role: r.role === 'assistant' ? 'model' : 'user', parts: [{ text: r.content }] }))

  const contact = contactResult.data
  const contactFirstName = contact_name ? contact_name.split(' ')[0] : ''

  // Determina tipo de contato para saudação
  const isFirstContact = !contact?.first_replied_at
  const isContinuation = history.length > 0
  const greetingBlock = isContinuation ? '' : isFirstContact
    ? `SAUDAÇÃO (obrigatório nesta primeira mensagem): Comece com "Oi${contactFirstName ? ` ${contactFirstName}` : ''}! Tudo bem? Eu sou a ${assistantName}, assistente do ${userName}." — em seguida responda normalmente.`
    : `SAUDAÇÃO (obrigatório nesta primeira mensagem): Comece com "Oi${contactFirstName ? ` ${contactFirstName}` : ''}! Aqui é a ${assistantName} falando, tudo bem?" — em seguida responda normalmente.`

  const personaBase = inst.persona_description
    ? inst.persona_description
    : `Sou ${assistantName}, assistente pessoal de ${userName}.`

  const senderLabel = contact_name ? `A mensagem veio de: ${contact_name}.` : ''

  const system = `Você é ${assistantName} — assistente pessoal de ${userName} no MeuDIA.

${personaBase}

Tom: ${tone}.
Formato: ${size}.
${memoryBlock}
O MeuDIA está gerenciando o WhatsApp de ${userName} enquanto ele foca no que importa.
Você está respondendo pelo WhatsApp — mantenha mensagens curtas e naturais para o canal.
${senderLabel}
${greetingBlock}

TOM E ESTILO:
- Profissional e humano. Linguagem simples, direta, sem floreios.
- Emojis com moderação — apenas para humanizar, nunca em excesso. Prefira reservar para fechamentos.
- Não use expressões de atendente ("Com certeza!", "Claro!", "Fico feliz em ajudar!").
- Quando o contato se despedir ou agradecer: encerre com algo como "Até mais! Fico à disposição! 😊" — sem usar esse fechamento em toda mensagem.
- Use o nome do contato com naturalidade, não em toda frase.
- Confirme ações de forma natural, nunca mecanicamente.

REGRAS DE MEMÓRIA (crítico):
- Quando o usuário disser "lembra que...", "anota que...", "guarda que..." ou qualquer variação → chame salvar_memoria IMEDIATAMENTE, antes de responder.
- NUNCA diga que salvou algo sem ter chamado salvar_memoria e recebido { sucesso: true }.
- Se salvar_memoria retornar erro, diga ao usuário que não conseguiu salvar e o motivo.
- Uma mensagem pode ter múltiplas ações: execute todas as ferramentas necessárias antes de responder.

O QUE VOCÊ FAZ:
- Criar, listar e concluir tarefas no quadro do Meu Dia (Post-its)
- Buscar, listar e cadastrar contatos
- Definir prioridade de contatos
- Consultar a fila de mensagens
- Criar e gerenciar grupos de contatos com propósito
- Salvar e apagar memórias

TAREFAS (crítico):
- Quando o usuário mencionar algo que precisa fazer, um encaminhamento de reunião ou uma pendência → chame criar_tarefa IMEDIATAMENTE.
- Quando o usuário disser que teve uma reunião com algum grupo → pergunte: "Que tarefa ficou para você?" e crie a tarefa com a resposta.
- Sempre informe o grupo de origem quando a tarefa vier de uma reunião ou contexto de grupo.

PAUSA (crítico):
- Quando o usuário pedir para parar de responder, silenciar, desativar ou pausar → chame pausar_agente.
- Quando o usuário pedir para retomar, ativar de novo ou voltar a responder → chame retomar_agente.

IMAGENS E DOCUMENTOS:
- Quando receber <ContextoImagem> ou <ContextoPDF>, não diga que não consegue ver o conteúdo.
- Responda naturalmente confirmando o recebimento. Exemplo: "Recebi! Vou passar pra ${userName} dar uma olhada."
- Não tente descrever ou analisar o conteúdo.

Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const { text, toolsUsed, tokensIn, tokensOut } = await callGemini(contents, system, inst.id, supabase)

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim(), chat_source: 'whatsapp' },
    { instance_id: inst.id, role: 'assistant', content: text, tool_calls: toolsUsed.length ? toolsUsed : null, chat_source: 'whatsapp' }
  ])

  // Marca primeiro contato respondido
  if (contact_jid && isFirstContact) {
    supabase
      .from('contacts')
      .update({ first_replied_at: new Date().toISOString() })
      .eq('instance_id', inst.id)
      .eq('remote_jid', contact_jid)
      .then(() => {})
  }

  // Débito de créditos (fire-and-forget)
  debitCredits({
    userId: inst.user_id,
    instanceId: inst.id,
    tokensIn,
    tokensOut,
    messageType: 'whatsapp_olivia',
    supabase,
    contactJid: contact_jid,
  }).catch(() => {})

  // Notificação no dashboard para contatos prioritários (fire-and-forget)
  if (contact?.priority === 'priority') {
    supabase.from('notifications').insert({
      instance_id: inst.id,
      type: 'priority_message',
      title: contact_name || 'Contato prioritário',
      body: message.trim().slice(0, 100),
      read: false,
    }).then(() => {})
  }

  // Notificação por email
  const emailSettings = scheduleResult.data
  if (emailSettings?.email_notify && process.env.RESEND_API_KEY) {
    try {
      let shouldNotify = emailSettings.email_notify_scope === 'all'

      if (!shouldNotify && emailSettings.email_notify_scope === 'priority') {
        shouldNotify = contact?.priority === 'priority'
      }

      if (shouldNotify) {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(inst.user_id)
        if (authUser?.email) {
          await sendMessageAlert({
            to: authUser.email,
            userName,
            contactName: contact_name || 'Contato',
            message: message.trim(),
            isPriority: emailSettings.email_notify_scope === 'priority',
          })
        }
      }
    } catch {
      // falha silenciosa — não bloqueia a resposta
    }
  }

  return NextResponse.json({ response: text })
}
