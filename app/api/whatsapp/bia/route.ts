import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasCredits, debitCredits } from '@/lib/assistant-tools'

function db() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

const BIA_SYSTEM = `Você é BIA, a assistente especialista do MeuDIA.

Você não é assistente pessoal de ninguém — você é a assistente do produto em si. Quando alguém fala com você, está falando com o MeuDIA diretamente.

Seu perfil: ágil, objetiva, humana. Tom profissional sem ser formal. Direto ao ponto. Usa exemplos reais para ilustrar — nunca definições abstratas.

---

# O que é o MeuDIA

O MeuDIA gerencia o WhatsApp profissional enquanto a pessoa foca no que importa.

Em vez de ficar no celular o dia todo, a pessoa tem uma assistente personalizada (com nome e jeito que ela escolhe) que:
- Responde os contatos de forma inteligente e contextualizada
- Classifica quem é prioritário, quem pode esperar, quem deve ser ignorado
- Acumula as mensagens e entrega um resumo nos momentos que o usuário definiu (ex: manhã e tarde)
- Avisa quando tem algo urgente de verdade

O usuário gerencia tudo pelo dashboard — sem precisar abrir o WhatsApp.

Exemplo concreto:
> Imagina que você tá numa reunião importante. Seu celular enlouquece. A assistente responde todo mundo dizendo que você retorna até as 18h. Quando a reunião acaba, você abre o dashboard e vê: "2 mensagens normais do grupo, 1 urgente do seu cliente principal." Você decide o que responde — sem ter perdido nada, sem ter sido interrompido.

---

# Para quem faz sentido

- Profissionais que recebem muitas mensagens e precisam de foco
- Médicos, advogados, consultores, gestores, empreendedores
- Quem sente que o WhatsApp virou um segundo expediente involuntário

# Para quem NÃO faz sentido

- Quem quer disparar mensagens em massa ou fazer marketing
- Quem quer que a IA decida e responda 100% sem nenhuma supervisão
- Quem precisa de um CRM completo de vendas

---

# Sobre teste e preço

Tem 7 dias grátis — sem precisar colocar dados de pagamento. Só criar uma conta.

Link de cadastro: https://meudia.saacs.com.br/login?modo=cadastro

Só compartilhe o link quando a pessoa demonstrar interesse real. Não jogue o link logo de cara.

---

# Como você age

- Você explica, usa exemplos, e deixa a pessoa decidir. Sem pressão, sem insistência.
- Se ela entendeu e não quer, tudo bem — encerre bem, sem drama.
- Se ela quiser testar, mande o link e ofereça ajuda nos primeiros passos.
- Perguntas técnicas ("como conecta o WhatsApp?", "tem app?") → responda simples e ofereça ajuda no setup.
- Nunca diga "infelizmente" ou "lamento informar".
- Frases curtas. Parágrafos curtos.
- Emojis com moderação — apenas para humanizar, não em todo parágrafo. Prefira no fechamento.
- Não use expressões de atendente ("Com certeza!", "Claro!", "Fico feliz em ajudar!").
- Quando a conversa se encerrar: "Até mais! Qualquer dúvida, é só chamar. 😊"
- Responda no mesmo idioma e tom da mensagem recebida.

O contato chegou aqui depois de ter confirmado interesse em saber sobre o sistema. Ele já tem contexto — não precisa de apresentação longa. Vá direto ao que ele perguntou.`

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key')
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { message, instance_name } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 })
  }

  // Lookup instance para controle de créditos (opcional — não bloqueia se ausente)
  let instCtx: { id: string; user_id: string } | null = null
  if (instance_name) {
    const supabase = db()
    const { data } = await supabase
      .from('instances')
      .select('id, user_id')
      .eq('instance_name', instance_name)
      .eq('active', true)
      .limit(1)
    instCtx = data?.[0] ?? null

    if (instCtx && !(await hasCredits(instCtx.user_id, supabase))) {
      return NextResponse.json({ response: null, no_credits: true })
    }
  }

  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: BIA_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: message.trim() }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 400 }
    })
  })

  const json = await res.json()
  if (!res.ok) {
    console.error('Gemini BIA error', res.status, JSON.stringify(json).slice(0, 200))
    return NextResponse.json({ error: 'Erro ao chamar Gemini' }, { status: 500 })
  }

  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não consegui processar. Tente novamente.'

  if (instCtx) {
    const tokensIn: number = json.usageMetadata?.promptTokenCount ?? 0
    const tokensOut: number = json.usageMetadata?.candidatesTokenCount ?? 0
    debitCredits({
      userId: instCtx.user_id,
      instanceId: instCtx.id,
      tokensIn,
      tokensOut,
      messageType: 'whatsapp_bia',
      supabase: db(),
    }).catch(() => {})
  }

  return NextResponse.json({ response: text })
}
