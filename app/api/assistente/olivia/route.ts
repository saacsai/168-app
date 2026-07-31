import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGemini, loadMemoryBlock, hasCredits, debitCredits } from '@/lib/assistant-tools'
import type { GeminiContent } from '@/lib/assistant-tools'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  return user ?? null
}

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
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { message, conversation_id: convId } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = db()

  const { data: instances } = await supabase
    .from('instances')
    .select('id, persona_name, persona_tone, persona_response_size, persona_description')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = instances?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  if (!(await hasCredits(user.id, supabase))) {
    return NextResponse.json({ error: 'Créditos insuficientes', code: 'INSUFFICIENT_CREDITS' }, { status: 402 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name || user.email?.split('@')[0] || 'usuário'
  const userName = fullName.split(' ')[0]
  const assistantName = inst.persona_name || 'Assistente'
  const tone = toneMap[inst.persona_tone] || 'profissional e eficiente'
  const size = sizeMap[inst.persona_response_size] || 'respostas curtas'

  const [historyResult, memoryBlock] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('instance_id', inst.id)
      .eq('chat_source', 'olivia')
      .order('created_at', { ascending: false })
      .limit(10),
    loadMemoryBlock(inst.id, supabase)
  ])

  const history: GeminiContent[] = (historyResult.data ?? [])
    .reverse()
    .map(r => ({ role: r.role === 'assistant' ? 'model' : 'user', parts: [{ text: r.content }] }))

  const personaBase = inst.persona_description
    ? inst.persona_description
    : `Sou ${assistantName}, assistente pessoal de ${userName}.`

  const system = `Você é ${assistantName} — assistente pessoal de ${userName} no MeuDIA.

${personaBase}

Tom: ${tone}.
Formato: ${size}.
${memoryBlock}
O MeuDIA está gerenciando o WhatsApp de ${userName} enquanto ele foca no que importa.

TOM E ESTILO:
- Profissional e humana. Linguagem simples e direta — sem floreios de IA tentando parecer humana.
- Emojis com moderação — apenas para humanizar, nunca em excesso.
- Não use expressões de atendente ("Com certeza!", "Claro!", "Fico feliz em ajudar!").
- Use o nome ${userName} com naturalidade, não em toda frase.
- Confirme ações de forma natural — nunca mecanicamente.
- Nunca termine com "Posso ajudar em mais alguma coisa?" ou similares.
- Quando executar múltiplas ações, confirme todas de uma vez ao final.
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

Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const { text, toolsUsed, tokensIn, tokensOut } = await callGemini(contents, system, inst.id, supabase)

  debitCredits({ userId: user.id, instanceId: inst.id, tokensIn, tokensOut, messageType: 'dashboard_olivia', supabase }).catch(() => {})

  let conversationId = convId ?? null
  if (!conversationId) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ instance_id: inst.id, chat_source: 'olivia', title: message.trim().slice(0, 60), updated_at: new Date().toISOString() })
      .select('id')
      .single()
    conversationId = newConv?.id ?? null
  } else {
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
  }

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim(), chat_source: 'olivia', conversation_id: conversationId },
    { instance_id: inst.id, role: 'assistant', content: text, tool_calls: toolsUsed.length ? toolsUsed : null, chat_source: 'olivia', conversation_id: conversationId }
  ])

  return NextResponse.json({ response: text, toolsUsed, conversation_id: conversationId })
}
