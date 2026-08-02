'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type Msg = { role: 'bia' | 'user'; text: string }

export default function PainelBIA() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [digitando, setDigitando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      const primeiroNome = (
        session?.user?.user_metadata?.full_name ||
        session?.user?.email ||
        ''
      ).split(' ')[0]

      const hora = new Date().getHours()
      const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

      setMsgs([{
        role: 'bia',
        text: `${saudacao}${primeiroNome ? `, ${primeiroNome}` : ''}. Estou aqui para ajudar a organizar suas 168h. Me conte sobre reuniões de última hora, encaminhamentos ou qualquer mudança na agenda — eu cuido do resto.`,
      }])
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, digitando])

  async function enviar() {
    const texto = input.trim()
    if (!texto) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: texto }])
    setDigitando(true)

    // Integração AI — fase futura
    await new Promise(r => setTimeout(r, 1200))
    setDigitando(false)
    setMsgs(m => [...m, {
      role: 'bia',
      text: 'Anotado. A reorganização automática da grade estará disponível em breve.',
    }])
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
        style={{ background: '#1B2A4A' }}
      >
        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <span className="text-white font-bold text-sm tracking-wide">BIA</span>
        <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
          168 · Assistente
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[88%] text-sm px-3 py-2 leading-relaxed"
              style={m.role === 'bia'
                ? { background: '#f3f4f6', color: '#111827', borderRadius: '12px 12px 12px 3px' }
                : { background: '#1B2A4A', color: '#fff', borderRadius: '12px 12px 3px 12px' }
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {digitando && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 text-sm text-gray-400"
              style={{ background: '#f3f4f6', borderRadius: '12px 12px 12px 3px' }}
            >
              digitando…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
        <form
          onSubmit={e => { e.preventDefault(); enviar() }}
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Fale com a BIA…"
            className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity"
            style={{
              background: input.trim() ? '#1B2A4A' : '#e5e7eb',
              opacity: input.trim() ? 1 : 0.5,
            }}
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
