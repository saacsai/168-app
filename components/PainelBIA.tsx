'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

export default function PainelBIA() {
  const [nome, setNome] = useState('')
  const [token, setToken] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)
      const primeiroNome = (
        session.user.user_metadata?.full_name ||
        session.user.email ||
        ''
      ).split(' ')[0]
      setNome(primeiroNome)
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || streaming) return

    const msgUser: Msg = { id: `u-${Date.now()}`, role: 'user', content: texto }
    const histAtualizado = [...messages, msgUser]
    setMessages(histAtualizado)
    setInput('')
    setStreaming(true)

    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/bia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: histAtualizado.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: acc } : m)
        )
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: 'Erro ao conectar com a BIA. Tente novamente.' }
          : m
        )
      )
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ background: '#1B2A4A' }}>
        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <span className="text-white font-bold text-sm tracking-wide">BIA</span>
        <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
          168 · Assistente
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Saudação estática */}
        <div className="flex justify-start">
          <div className="max-w-[88%] text-sm px-3 py-2 leading-relaxed"
            style={{ background: '#f3f4f6', color: '#111827', borderRadius: '12px 12px 12px 3px' }}>
            {saudacao}{nome ? `, ${nome}` : ''}. Estou aqui para ajudar a gerir suas 168h.
            Me conte sobre reuniões de última hora, encaminhamentos ou mudanças na agenda.
          </div>
        </div>

        {/* Conversa */}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[88%] text-sm px-3 py-2 leading-relaxed whitespace-pre-wrap"
              style={m.role === 'assistant'
                ? { background: '#f3f4f6', color: '#111827', borderRadius: '12px 12px 12px 3px' }
                : { background: '#1B2A4A', color: '#fff', borderRadius: '12px 12px 3px 12px' }
              }
            >
              {m.content || <span className="animate-pulse text-gray-400">···</span>}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
        <form
          onSubmit={enviar}
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Fale com a BIA…"
            disabled={streaming}
            className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: input.trim() && !streaming ? '#1B2A4A' : '#e5e7eb' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
