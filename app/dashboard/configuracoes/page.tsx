'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'
import EditarPerfilPage from '@/components/EditarPerfilPage'
import GerenciarPlanoPage from '@/components/GerenciarPlanoPage'

const PRIMARY = '#2A5F6B'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Instance {
  id: string
  persona_name: string
  persona_tone: string
  persona_response_size: string
  persona_description: string | null
  response_hint: string | null
}

interface DigestSchedule {
  id: string
  window_times: string[] | null
  morning_time: string | null
  afternoon_time: string | null
  timezone: string
  active: boolean
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

function normalizeTimes(sched: DigestSchedule): string[] {
  if (sched.window_times?.length) return sched.window_times
  const times: string[] = []
  if (sched.morning_time) times.push(sched.morning_time.slice(0, 5))
  if (sched.afternoon_time) times.push(sched.afternoon_time.slice(0, 5))
  return times.length ? times : ['08:00', '17:00']
}

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"

// ─── WhatsApp Section ─────────────────────────────────────────────────────────

type WaEstado = 'carregando' | 'sem_instancia' | 'aguardando_qr' | 'conectado'

function WhatsAppSection() {
  const [estado, setEstado] = useState<WaEstado>('carregando')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [perfilPhone, setPerfilPhone] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [criando, setCriando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [erro, setErro] = useState('')

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  const verificarStatus = useCallback(async (isPolling = false) => {
    const token = await getToken()
    try {
      const res = await fetch('/api/whatsapp', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (!isPolling) setEstado('sem_instancia'); return }
      const data = await res.json()
      if (data.connected) { setEstado('conectado'); setPhone(data.phone) }
      else if (data.instance) { setEstado('aguardando_qr'); if (data.qrcode) setQrcode(data.qrcode) }
      else { if (!isPolling) setEstado('sem_instancia') }
    } catch { if (!isPolling) setEstado('sem_instancia') }
  }, [])

  useEffect(() => {
    async function init() {
      const token = await getToken()
      const res = await fetch('/api/perfil', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setPerfilPhone(d.whatsapp || null)
      await verificarStatus(false)
    }
    init()
  }, [verificarStatus])

  useEffect(() => {
    if (estado !== 'aguardando_qr') return
    const interval = setInterval(() => verificarStatus(true), 5000)
    return () => clearInterval(interval)
  }, [estado, verificarStatus])

  async function criarInstancia() {
    setCriando(true); setErro('')
    const token = await getToken()
    const res = await fetch('/api/whatsapp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.error) { setErro(data.error); setCriando(false); return }
    if (data.connected) { setPhone(data.phone); setEstado('conectado'); setCriando(false); return }
    setQrcode(data.qrcode); setEstado('aguardando_qr'); setCriando(false)
    setTimeout(() => verificarStatus(true), 6000)
  }

  async function desconectar() {
    setDesconectando(true)
    const token = await getToken()
    await fetch('/api/whatsapp', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setEstado('sem_instancia'); setQrcode(null); setPhone(null); setConfirmado(false); setDesconectando(false)
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
    return p
  }

  if (estado === 'carregando') return <p className="text-sm text-gray-400">Verificando conexão…</p>

  return (
    <div className="space-y-3">
      {estado === 'conectado' && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#dcfce7' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">WhatsApp conectado</p>
              <p className="text-xs text-gray-500">{phone ? formatPhone(phone) : '—'}</p>
            </div>
          </div>
          <button onClick={desconectar} disabled={desconectando} className="w-full border border-red-200 text-red-600 text-sm font-medium rounded-xl py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
            {desconectando ? 'Desconectando…' : 'Desconectar WhatsApp'}
          </button>
        </>
      )}

      {estado === 'sem_instancia' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">Antes de conectar:</p>
            <p>O número conectado aqui será gerenciado pela IA. Recomendamos ter um <strong>segundo número</strong> para uso pessoal.</p>
          </div>
          {perfilPhone ? (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-600">QR Code vinculado ao número do seu perfil:</p>
              <p className="text-sm font-bold text-gray-900">{formatPhone(perfilPhone)}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-0.5 accent-teal-700" />
                <span className="text-xs text-gray-600">Confirmo que vou escanear o QR com este número</span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nenhum número salvo no perfil. Edite seu perfil antes de conectar.</p>
          )}
          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}
          <button onClick={criarInstancia} disabled={criando || !confirmado || !perfilPhone} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors" style={{ backgroundColor: PRIMARY }}>
            {criando ? 'Preparando…' : 'Gerar QR Code'}
          </button>
        </>
      )}

      {estado === 'aguardando_qr' && (
        <>
          <p className="text-xs text-gray-500">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
          {qrcode ? (
            <div className="flex justify-center">
              <div className="border-2 border-gray-100 rounded-2xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrcode} alt="QR Code" width={200} height={200} style={{ width: 200, height: 200 }} />
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-6">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          )}
          <p className="text-xs text-center text-gray-400">Atualizando a cada 5 segundos…</p>
          <button onClick={() => verificarStatus(false)} className="w-full border border-gray-200 text-gray-600 text-sm font-medium rounded-xl py-2 hover:bg-gray-50 transition-colors">
            Atualizar agora
          </button>
        </>
      )}
    </div>
  )
}

// ─── Assistente Section ───────────────────────────────────────────────────────

function AssistenteSection() {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ persona_name: '', persona_tone: 'profissional', persona_response_size: 'curto', persona_description: '', response_hint: '' })

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('instances').select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint').eq('user_id', session.user.id).eq('active', true).single()
      if (data) {
        setInstance(data)
        setForm({ persona_name: data.persona_name || '', persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instance) return
    setSaving(true)
    const supabase = getSupabase()
    await supabase.from('instances').update(form).eq('id', instance.id)
    if (form.persona_name) {
      window.dispatchEvent(new CustomEvent('assistantNameChanged', { detail: form.persona_name }))
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>
  if (!instance) return <p className="text-sm text-gray-500">Nenhuma instância encontrada.</p>

  const nameIsBia = form.persona_name.trim().toUpperCase() === 'BIA'

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome da assistente</label>
        <input
          type="text"
          value={form.persona_name}
          onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))}
          placeholder="Ex: MAIA, LARA, ZEUS, NINA…"
          className={inputClass}
          onFocus={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : PRIMARY}
          onBlur={e => e.target.style.borderColor = ''}
          style={{ borderColor: nameIsBia ? '#f59e0b' : '' }}
        />
        {nameIsBia && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            BIA é o nome da assistente oficial do MeuDIA. Escolha outro nome para evitar confusões — sua assistente pessoal deve ter uma identidade própria.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tom</label>
          <select value={form.persona_tone} onChange={e => setForm(f => ({ ...f, persona_tone: e.target.value }))} className={inputClass + ' cursor-pointer'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''}>
            <option value="formal">Formal</option>
            <option value="profissional">Profissional</option>
            <option value="descontraido">Descontraído</option>
            <option value="amigavel">Amigável</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Respostas</label>
          <select value={form.persona_response_size} onChange={e => setForm(f => ({ ...f, persona_response_size: e.target.value }))} className={inputClass + ' cursor-pointer'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''}>
            <option value="curto">Curtas</option>
            <option value="detalhado">Detalhadas</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Personalidade</label>
        <textarea value={form.persona_description} onChange={e => setForm(f => ({ ...f, persona_description: e.target.value }))} placeholder="Como a assistente se apresenta…" rows={3} className={inputClass + ' resize-none'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Previsão de retorno</label>
        <input type="text" value={form.response_hint} onChange={e => setForm(f => ({ ...f, response_hint: e.target.value }))} placeholder="Ex: Retorno ainda hoje, até as 17h…" className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
      </div>
      <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
      </button>
    </form>
  )
}

// ─── Digest Section ───────────────────────────────────────────────────────────

function DigestSection() {
  const [schedule, setSchedule] = useState<DigestSchedule | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [windowTimes, setWindowTimes] = useState<string[]>(['08:00', '17:00'])
  const [active, setActive] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: inst } = await supabase.from('instances').select('id').eq('user_id', session.user.id).eq('active', true).single()
      if (!inst) { setLoading(false); return }
      setInstanceId(inst.id)
      const { data: sched } = await supabase.from('digest_schedule').select('*').eq('instance_id', inst.id).single()
      if (sched) { setSchedule(sched); setWindowTimes(normalizeTimes(sched)); setActive(sched.active) }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instanceId) return
    setSaving(true)
    const supabase = getSupabase()
    const payload = { window_times: windowTimes, active }
    if (schedule) { await supabase.from('digest_schedule').update(payload).eq('id', schedule.id) }
    else { await supabase.from('digest_schedule').insert({ ...payload, instance_id: instanceId }) }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-xs text-gray-500">Momentos em que você revisa e responde as mensagens acumuladas. Mínimo 2, máximo 6.</p>
      <div className="space-y-2">
        {windowTimes.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">Horário {i + 1}</span>
            <select
              value={t}
              onChange={e => setWindowTimes(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              onFocus={e => e.target.style.borderColor = PRIMARY}
              onBlur={e => e.target.style.borderColor = ''}
            >
              {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {windowTimes.length > 2 && (
              <button
                type="button"
                onClick={() => setWindowTimes(prev => prev.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-400 text-lg leading-none px-1"
              >×</button>
            )}
          </div>
        ))}
      </div>
      {windowTimes.length < 6 && (
        <button
          type="button"
          onClick={() => setWindowTimes(prev => [...prev, '12:00'])}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + Adicionar horário
        </button>
      )}
      <div className="flex items-center gap-3">
        <Toggle value={active} onToggle={() => setActive(v => !v)} color={PRIMARY} size="sm" />
        <span className="text-xs text-gray-600">{active ? 'Resumos ativos' : 'Resumos desativados'}</span>
      </div>
      <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar horários'}
      </button>
    </form>
  )
}

// ─── Memórias Section ─────────────────────────────────────────────────────────

interface Memory {
  id: string
  type: string
  content: string
  created_at: string
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  contact_note: 'Contato',
  agenda: 'Agenda',
  instruction: 'Instrução',
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  contact_note: '#7C3AED',
  agenda: '#059669',
  instruction: '#2A5F6B',
}

function MemoriasSection() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    async function load() {
      const token = await getToken()
      const res = await fetch('/api/assistente/memorias', { headers: { authorization: `Bearer ${token}` } })
      if (res.ok) setMemories(await res.json())
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function deleteMemory(id: string) {
    setDeletingId(id)
    const token = await getToken()
    await fetch('/api/assistente/memorias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    })
    setMemories(prev => prev.filter(m => m.id !== id))
    setDeletingId(null)
  }

  function startEdit(m: Memory) {
    setEditingId(m.id)
    setEditDraft(m.content)
  }

  async function saveEdit(id: string) {
    const content = editDraft.trim()
    if (!content) return
    setSavingId(id)
    const token = await getToken()
    const res = await fetch('/api/assistente/memorias', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, content })
    })
    if (res.ok) setMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m))
    setEditingId(null)
    setSavingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>

  if (!memories.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Nenhuma memória salva ainda.<br />
        <span className="text-xs">Diga para a assistente &ldquo;lembra que o Anderson é sócio&rdquo; para ela começar a guardar contexto.</span>
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {memories.map(m => (
        <div key={m.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ backgroundColor: MEMORY_TYPE_COLORS[m.type] || '#6b7280' }}
            >
              {MEMORY_TYPE_LABELS[m.type] || m.type}
            </span>
            <span className="text-[10px] text-gray-400 ml-auto">
              {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          </div>

          {editingId === m.id ? (
            <div className="space-y-1.5">
              <textarea
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                rows={2}
                autoFocus
                className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none resize-none"
                onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                style={{ borderColor: PRIMARY }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(m.id)}
                  disabled={savingId === m.id}
                  className="text-[11px] font-medium px-3 py-1 rounded-lg text-white disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {savingId === m.id ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p
                className="flex-1 text-xs text-gray-700 leading-relaxed cursor-pointer hover:text-gray-900"
                onClick={() => startEdit(m)}
                title="Clique para editar"
              >
                {m.content}
              </p>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(m)}
                  className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
                  title="Editar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => deleteMemory(m.id)}
                  disabled={deletingId === m.id}
                  className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5"
                  title="Apagar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Segundo Número Section ───────────────────────────────────────────────────

function SegundoNumeroSection() {
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [phone, setPhone] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('instances')
        .select('id, personal_channel')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .single()
      if (data) {
        setInstanceId(data.id)
        setPhone(data.personal_channel || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instanceId) return
    setSaving(true)
    const supabase = getSupabase()
    const digits = phone.replace(/\D/g, '')
    await supabase.from('instances').update({ personal_channel: digits || null }).eq('id', instanceId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <p className="text-xs text-gray-500">
        Se você tem um segundo número, o resumo de mensagens será enviado para ele via WhatsApp.
        Ideal ter apenas um contato neste número: o seu número principal (onde a Olivia responde).
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Número (com DDD e código do país)</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="5511999990000"
          className={inputClass}
          onFocus={e => e.target.style.borderColor = PRIMARY}
          onBlur={e => e.target.style.borderColor = ''}
        />
      </div>
      <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar número'}
      </button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [section, setSection] = useState<'main' | 'perfil' | 'plano'>('main')

  if (section === 'perfil') {
    return (
      <EditarPerfilPage
        onVoltar={() => setSection('main')}
        onSaved={nome => {
          window.dispatchEvent(new CustomEvent('userNameChanged', { detail: nome }))
          setSection('main')
        }}
      />
    )
  }

  if (section === 'plano') {
    return <GerenciarPlanoPage onVoltar={() => setSection('main')} />
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Conta — apenas mobile, no desktop o acesso é pelo menu do avatar na sidebar */}
      <div className="md:hidden">
        <Section title="Conta">
          <div className="space-y-2">
            <button
              onClick={() => setSection('perfil')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">Editar perfil</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button
              onClick={() => setSection('plano')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">Gerenciar plano</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </Section>
      </div>

      <Section title="WhatsApp">
        <WhatsAppSection />
      </Section>
      <Section title="Assistente">
        <AssistenteSection />
      </Section>
      <Section title="Horários do Resumo">
        <DigestSection />
      </Section>
      <Section title="Segundo número" subtitle="Receba o resumo de mensagens no seu número pessoal via WhatsApp.">
        <SegundoNumeroSection />
      </Section>
      <Section title="Memórias" subtitle="O que a assistente lembra entre conversas. Você pode apagar qualquer item.">
        <MemoriasSection />
      </Section>
    </div>
  )
}
