'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: Array<{ tool: string; args: Record<string, unknown> }>
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatWithSidebarProps {
  chatSource: 'bia' | 'olivia'
  sendPath: string
  historyPath: string
  conversasPath: string
  headerName: string
  headerSubtitle: string
  welcomeMessage: string
  configLink?: string
  toolLabels?: Record<string, string>
}

const DEFAULT_TOOL_LABELS: Record<string, string> = {
  listar_contatos: 'Listou contatos',
  buscar_contatos: 'Buscou contatos',
  definir_prioridade: 'Ajustou prioridade',
  consultar_fila: 'Consultou fila',
  criar_grupo: 'Criou grupo',
  adicionar_ao_grupo: 'Adicionou ao grupo',
  listar_grupos: 'Listou grupos',
  criar_contato: 'Cadastrou contato',
  salvar_memoria: 'Salvou memória',
  apagar_memoria: 'Apagou memória',
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ConversationItem({
  conv,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  conv: Conversation
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conv.title)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 50)
  }, [editing])

  function commitRename() {
    const t = draft.trim()
    if (t && t !== conv.title) onRename(t)
    setEditing(false)
  }

  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm"
      style={{ backgroundColor: active ? `${PRIMARY}14` : hovered ? '#f3f4f6' : 'transparent' }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false) }}
          onClick={e => e.stopPropagation()}
          className="flex-1 text-xs bg-white border border-gray-300 rounded px-1.5 py-0.5 outline-none"
          style={{ color: '#1f2937' }}
        />
      ) : (
        <span
          className="flex-1 text-xs truncate"
          style={{ color: active ? PRIMARY : '#374151' }}
          onClick={e => { e.stopPropagation(); onSelect(); setDraft(conv.title); setEditing(true) }}
        >
          {conv.title}
        </span>
      )}
      {!editing && (hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Excluir conversa"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatWithSidebar({
  chatSource,
  sendPath,
  historyPath,
  conversasPath,
  headerName,
  headerSubtitle,
  welcomeMessage,
  configLink,
  toolLabels = {},
}: ChatWithSidebarProps) {
  const labels = { ...DEFAULT_TOOL_LABELS, ...toolLabels }

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [currentConvTitle, setCurrentConvTitle] = useState<string | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Messages
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // Input extras
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<unknown>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  // Load conversations list
  const loadConversations = useCallback(async () => {
    const token = await getToken()
    const res = await fetch(`${conversasPath}?source=${chatSource}`, {
      headers: { authorization: `Bearer ${token}` }
    })
    if (!res.ok) { setLoadingConvs(false); return }
    const data: Conversation[] = await res.json()
    setConversations(data)
    setLoadingConvs(false)
    // Auto-select most recent
    if (data.length > 0 && currentConvId === null) {
      selectConversation(data[0].id, data[0].title)
    } else if (data.length === 0) {
      setMessages([{ role: 'assistant', content: welcomeMessage }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSource, conversasPath])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function selectConversation(id: string, title?: string) {
    setSidebarOpen(false)
    setCurrentConvId(id)
    setCurrentConvTitle(title ?? conversations.find(c => c.id === id)?.title ?? null)
    setLoadingMessages(true)
    setMessages([])
    const token = await getToken()
    const res = await fetch(`${historyPath}?conversation_id=${id}`, {
      headers: { authorization: `Bearer ${token}` }
    })
    if (!res.ok) { setLoadingMessages(false); return }
    const raw = await res.json()
    // historico BIA returns array; olivia returns { messages, persona }
    const msgs: Message[] = Array.isArray(raw) ? raw : (raw.messages || [])
    setMessages(msgs.length ? msgs : [{ role: 'assistant', content: welcomeMessage }])
    setLoadingMessages(false)
  }

  function newConversation() {
    setSidebarOpen(false)
    setCurrentConvId(null)
    setCurrentConvTitle(null)
    setInput('')
    setLoadingMessages(false)
    setMessages([])
    setTimeout(() => {
      setMessages([{ role: 'assistant', content: welcomeMessage }])
      inputRef.current?.focus()
    }, 120)
  }

  async function deleteConversation(id: string) {
    const token = await getToken()
    await fetch(`${conversasPath}/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` }
    })
    const updated = conversations.filter(c => c.id !== id)
    setConversations(updated)
    if (currentConvId === id) {
      if (updated.length > 0) {
        selectConversation(updated[0].id)
      } else {
        setCurrentConvId(null)
        setMessages([{ role: 'assistant', content: welcomeMessage }])
      }
    }
  }

  async function renameConversation(id: string, title: string) {
    const token = await getToken()
    await fetch(`${conversasPath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ title })
    })
    if (id === currentConvId) setCurrentConvTitle(title)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setMessages(prev => [...prev.filter(m => !(m.role === 'assistant' && m.content === welcomeMessage && prev.length === 1)), { role: 'user', content: text }])
    setSending(true)

    try {
      const token = await getToken()
      const res = await fetch(sendPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversation_id: currentConvId })
      })
      const data = await res.json()

      // If new conversation was created, add it to the list and set as current
      if (data.conversation_id && data.conversation_id !== currentConvId) {
        const newConv: Conversation = {
          id: data.conversation_id,
          title: text.slice(0, 60),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setConversations(prev => [newConv, ...prev])
        setCurrentConvId(data.conversation_id)
        setCurrentConvTitle(text.slice(0, 60))
      } else if (data.conversation_id) {
        // Update updated_at for sorting
        setConversations(prev => {
          const updated = prev.map(c => c.id === data.conversation_id ? { ...c, updated_at: new Date().toISOString() } : c)
          return [...updated].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        })
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || 'Não consegui processar. Tente novamente.',
          toolsUsed: data.toolsUsed
        }
      ])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Verifique sua conexão e tente novamente.' }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function handleMic() {
    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(recognitionRef.current as any)?.stop()
      setIsListening(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Seu navegador não suporta reconhecimento de voz.'); return }
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setIsListening(true)
    rec.onend   = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      setInput(prev => prev ? `${prev} ${transcript}` : transcript)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    recognitionRef.current = rec
    rec.start()
  }

  function groupConversations(convs: Conversation[]) {
    const now = new Date()
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const week7     = new Date(today); week7.setDate(today.getDate() - 7)
    const month30   = new Date(today); month30.setDate(today.getDate() - 30)

    const groups: { label: string; items: Conversation[] }[] = [
      { label: 'Hoje',            items: [] },
      { label: 'Ontem',           items: [] },
      { label: 'Últimos 7 dias',  items: [] },
      { label: 'Últimos 30 dias', items: [] },
      { label: 'Mais antigas',    items: [] },
    ]

    for (const conv of convs) {
      const d = new Date(conv.updated_at)
      if      (d >= today)     groups[0].items.push(conv)
      else if (d >= yesterday) groups[1].items.push(conv)
      else if (d >= week7)     groups[2].items.push(conv)
      else if (d >= month30)   groups[3].items.push(conv)
      else                     groups[4].items.push(conv)
    }

    return groups.filter(g => g.items.length > 0)
  }

  return (
    <div className="flex relative" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Backdrop mobile ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div
        className={`flex flex-col flex-shrink-0 border-r border-gray-200 absolute inset-y-0 left-0 z-30 transition-transform duration-200 md:relative md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: '220px', background: '#fafafa' }}
      >
        {/* Header */}
        <div className="px-3 pt-4 pb-3">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: PRIMARY, color: 'white' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova conversa
          </button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loadingConvs ? (
            <p className="text-xs text-gray-400 px-3 py-2">Carregando…</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">Nenhuma conversa ainda.</p>
          ) : (
            groupConversations(conversations).map(group => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      active={conv.id === currentConvId}
                      onSelect={() => selectConversation(conv.id)}
                      onDelete={() => deleteConversation(conv.id)}
                      onRename={title => renameConversation(conv.id, title)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 pl-5">

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
          {/* Botão histórico — apenas mobile */}
          <button
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            title="Conversas"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>
            </svg>
          </button>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: PRIMARY }}
          >
            {headerName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{headerName}</p>
            {/* Desktop: subtítulo fixo */}
            <p className="text-xs text-gray-400 hidden md:block">{headerSubtitle}</p>
            {/* Mobile: título da conversa atual, abre drawer ao tocar */}
            <button
              className="md:hidden text-left flex items-center gap-0.5 mt-0.5"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="text-[11px] truncate max-w-[140px]" style={{ color: '#2A5F6B' }}>
                {currentConvTitle ?? 'Nova conversa'}
              </span>
              <span className="text-[11px] text-gray-400">›</span>
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Botão nova conversa — apenas mobile */}
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{ background: PRIMARY }}
              onClick={newConversation}
              title="Nova conversa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            {configLink && (
              <a href={configLink} className="text-xs hover:underline hidden md:block" style={{ color: PRIMARY }}>
                Configurar →
              </a>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Carregando…</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.toolsUsed.map((t, ti) => (
                        <span
                          key={ti}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ background: `${PRIMARY}18`, color: PRIMARY }}
                        >
                          ✓ {labels[t.tool] || t.tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      msg.role === 'user'
                        ? { background: PRIMARY, color: 'white', borderBottomRightRadius: '4px' }
                        : { background: 'white', color: '#1f2937', border: '1px solid #e5e7eb', borderBottomLeftRadius: '4px' }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: PRIMARY, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input — card style */}
        <div className="pt-3">
          {/* Backdrop para fechar menu de anexo */}
          {showAttachMenu && (
            <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
          )}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Mensagem para ${headerName}…`}
              rows={1}
              className="w-full resize-none px-4 pt-3 pb-1 text-sm focus:outline-none bg-transparent"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <div className="flex items-center gap-1 px-3 pb-3 pt-1">
              {/* + anexo */}
              <div className="relative">
                <button
                  onClick={() => setShowAttachMenu(v => !v)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  title="Anexar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-10 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[168px] z-20">
                    {[
                      { label: 'Foto / Câmera', icon: '📷' },
                      { label: 'Arquivo', icon: '📎' },
                    ].map(opt => (
                      <div key={opt.label} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                        <span className="ml-auto text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">Em breve</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* Microfone */}
              <button
                onClick={handleMic}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={isListening ? { background: '#ef4444' } : undefined}
                title={isListening ? 'Parar gravação' : 'Falar'}
              >
                {isListening ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>

              {/* Enviar */}
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: PRIMARY }}
                title="Enviar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center hidden md:block">
            Shift+Enter para nova linha · Enter para enviar
          </p>
        </div>
      </div>
    </div>
  )
}
