'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'
const VIDEO_URL = '' // Substituir pela URL do YouTube ou MP4 quando gravar
const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors'

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token || ''
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function BiaAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PRIMARY }}>
      BI
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start items-end gap-2">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PRIMARY }}>BI</div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: PRIMARY, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Video Widget ─────────────────────────────────────────────────────────────

function VideoWidget({ url }: { url: string }) {
  if (!url) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center w-full max-w-sm">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">Vídeo de boas-vindas</p>
        <p className="text-xs text-gray-400 mt-1">Em breve</p>
      </div>
    )
  }
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\n?#]+)/)
  if (ytMatch) {
    return (
      <div className="rounded-xl overflow-hidden w-full max-w-sm" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          className="w-full h-full"
          allowFullScreen
          title="Boas-vindas MeuDIA"
        />
      </div>
    )
  }
  return <video src={url} controls className="w-full max-w-sm rounded-xl" />
}

// ─── Acceptance Widget ────────────────────────────────────────────────────────

function AcceptanceWidget({ onAccepted }: { onAccepted: () => void }) {
  const [checkedTerms, setCheckedTerms] = useState(false)
  const [checkedPrivacy, setCheckedPrivacy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function handleAccept() {
    if (!checkedTerms || !checkedPrivacy || saving) return
    setSaving(true)
    try {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      if (session) {
        const { data: inst } = await sb.from('instances')
          .select('id').eq('user_id', session.user.id).eq('active', true).single()
        if (inst) {
          await sb.from('instances')
            .update({ terms_accepted_at: new Date().toISOString() })
            .eq('id', inst.id)
        }
      }
      setAccepted(true)
      onAccepted()
    } finally {
      setSaving(false)
    }
  }

  if (accepted) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Aceite confirmado
      </div>
    )
  }

  return (
    <div className="space-y-3 w-full max-w-sm">
      {/* Parte 1: Como funciona */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2.5">Como o sistema funciona</p>
        <ul className="space-y-2">
          {[
            'O MeuDIA gerencia suas mensagens, não as decide por você.',
            'Você mantém controle total — desconecte quando quiser, sem perder dados.',
            'Sua assistente gerencia expectativas. Você decide o que responder e quando.',
            'Para funcionar de verdade, confie no sistema. Delegar e continuar checando tudo anula o efeito.',
          ].map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-snug">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">—</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Parte 2: Proteção de dados */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2.5">Seus dados estão protegidos</p>
        <ul className="space-y-2">
          {[
            'Mensagens e contatos ficam no Supabase — infraestrutura enterprise (AWS, SOC 2 Type 2). Mais segura do que qualquer servidor próprio de startup.',
            'A SAACS não lê suas mensagens. Elas são processadas pela IA e armazenadas com criptografia.',
            'Você pode solicitar a exclusão completa dos seus dados a qualquer momento.',
          ].map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-snug">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">—</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Parte 3: Aceite legal */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Aceite</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checkedTerms}
            onChange={e => setCheckedTerms(e.target.checked)}
            className="mt-0.5 flex-shrink-0 accent-teal-700"
          />
          <span className="text-sm text-gray-700">
            Li e concordo com os{' '}
            <a href="https://saacs.com.br/termos-de-uso/" target="_blank" rel="noopener noreferrer"
              className="underline font-medium" style={{ color: PRIMARY }}>Termos de Uso</a>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checkedPrivacy}
            onChange={e => setCheckedPrivacy(e.target.checked)}
            className="mt-0.5 flex-shrink-0 accent-teal-700"
          />
          <span className="text-sm text-gray-700">
            Li e concordo com a{' '}
            <a href="https://saacs.com.br/politica-de-privacidade/" target="_blank" rel="noopener noreferrer"
              className="underline font-medium" style={{ color: PRIMARY }}>Política de Privacidade</a>
          </span>
        </label>
        <button
          onClick={handleAccept}
          disabled={!checkedTerms || !checkedPrivacy || saving}
          className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40 transition-all"
          style={{ backgroundColor: PRIMARY }}
        >
          {saving ? 'Confirmando…' : 'Confirmar e continuar →'}
        </button>
      </div>
    </div>
  )
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

type WaState = 'loading' | 'disconnected' | 'awaiting_qr' | 'connected'

function WhatsAppStep({ onConnected }: { onConnected: () => void }) {
  const [state, setState] = useState<WaState>('loading')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [perfilPhone, setPerfilPhone] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const alreadyNotified = useRef(false)

  const checkStatus = useCallback(async (silent = false) => {
    const token = await getToken()
    try {
      const res = await fetch('/api/whatsapp', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (!silent) setState('disconnected'); return }
      const data = await res.json()
      if (data.connected) {
        setPhone(data.phone)
        setState('connected')
        if (!alreadyNotified.current) { alreadyNotified.current = true; onConnected() }
      } else if (data.instance) {
        setState('awaiting_qr')
        if (data.qrcode) setQrcode(data.qrcode)
      } else {
        if (!silent) setState('disconnected')
      }
    } catch { if (!silent) setState('disconnected') }
  }, [onConnected])

  useEffect(() => {
    async function init() {
      const token = await getToken()
      const res = await fetch('/api/perfil', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setPerfilPhone(d.whatsapp || null)
      await checkStatus(false)
    }
    init()
  }, [checkStatus])

  useEffect(() => {
    if (state !== 'awaiting_qr') return
    const id = setInterval(() => checkStatus(true), 5000)
    return () => clearInterval(id)
  }, [state, checkStatus])

  async function create() {
    setCreating(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/whatsapp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.error) { setError(data.error); setCreating(false); return }
    if (data.connected) {
      setPhone(data.phone); setState('connected')
      if (!alreadyNotified.current) { alreadyNotified.current = true; onConnected() }
      setCreating(false); return
    }
    setQrcode(data.qrcode); setState('awaiting_qr'); setCreating(false)
    setTimeout(() => checkStatus(true), 6000)
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
    return p
  }

  if (state === 'loading') return <p className="text-sm text-gray-400 py-2">Verificando conexão…</p>

  if (state === 'connected') return (
    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">WhatsApp conectado</p>
        {phone && <p className="text-xs text-gray-500">{formatPhone(phone)}</p>}
      </div>
    </div>
  )

  if (state === 'awaiting_qr') return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
      <div className="flex justify-center">
        {qrcode ? (
          <div className="border-2 border-gray-100 rounded-2xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrcode} alt="QR Code" width={180} height={180} style={{ width: 180, height: 180 }} />
          </div>
        ) : (
          <div className="py-8 flex justify-center">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
      <p className="text-xs text-center text-gray-400">Verificando a cada 5 segundos…</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {perfilPhone ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500">Número do seu perfil:</p>
          <p className="text-sm font-bold text-gray-900">{formatPhone(perfilPhone)}</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-teal-700" />
            <span className="text-xs text-gray-600">Confirmo que vou escanear o QR com este número</span>
          </label>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          Use o mesmo número de WhatsApp que deseja conectar ao MeuDIA. Você pode editar seu perfil depois.
        </div>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <button
        onClick={create}
        disabled={creating || (!!perfilPhone && !confirmed)}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        {creating ? 'Preparando…' : 'Conectar WhatsApp'}
      </button>
    </div>
  )
}

// ─── Contatos ─────────────────────────────────────────────────────────────────

function ContactsStep() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 w-full max-w-sm">
      <p className="text-sm text-gray-700">
        Conforme as mensagens chegam, seus contatos aparecem automaticamente na aba <strong>Contatos</strong>. Você também pode importar em lote ou cadastrar manualmente.
      </p>
      <p className="text-sm text-gray-700">Cada contato tem uma <strong>prioridade</strong> que define como sua assistente age:</p>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0 mt-0.5">Prioridade</span>
          <span className="text-xs text-gray-600 leading-relaxed">Você é notificado por email imediatamente. Sua assistente responde com atenção redobrada.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 flex-shrink-0 mt-0.5">Normal</span>
          <span className="text-xs text-gray-600 leading-relaxed">Fluxo padrão. Mensagens acumulam no digest e você decide quando ver.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 flex-shrink-0 mt-0.5">Silenciado</span>
          <span className="text-xs text-gray-600 leading-relaxed">Sua assistente responde, mas você não é notificado. Ideal para grupos de baixa relevância.</span>
        </div>
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          Você também pode criar <strong>grupos de contatos</strong> por contexto — clientes, fornecedores, equipe — e pedir à sua assistente para gerenciar por grupo.
        </p>
      </div>
    </div>
  )
}

// ─── Janelas de resposta ──────────────────────────────────────────────────────

function DigestStep({ onSaved }: { onSaved: () => void }) {
  const [windowTimes, setWindowTimes] = useState<string[]>(['08:00', '17:00'])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data: inst } = await sb.from('instances').select('id').eq('user_id', session.user.id).eq('active', true).single()
      if (!inst) return
      setInstanceId(inst.id)
      const { data: sched } = await sb.from('digest_schedule')
        .select('id, window_times, morning_time, afternoon_time')
        .eq('instance_id', inst.id).single()
      if (sched) {
        setScheduleId(sched.id)
        const times = sched.window_times?.length
          ? sched.window_times
          : [sched.morning_time?.slice(0, 5) || '08:00', sched.afternoon_time?.slice(0, 5) || '17:00']
        setWindowTimes(times)
      }
    }
    load()
  }, [])

  async function save() {
    if (!instanceId) return
    setSaving(true)
    const sb = getSupabase()
    if (scheduleId) {
      await sb.from('digest_schedule').update({ window_times: windowTimes }).eq('id', scheduleId)
    } else {
      const { data } = await sb.from('digest_schedule')
        .insert({ window_times: windowTimes, active: true, instance_id: instanceId })
        .select('id').single()
      if (data?.id) setScheduleId(data.id)
    }
    setSaving(false)
    setSaved(true)
    onSaved()
  }

  return (
    <div className="space-y-3 w-full max-w-sm">
      <p className="text-xs text-gray-500">Horários em que você recebe o resumo das mensagens acumuladas:</p>
      <div className="space-y-2">
        {windowTimes.map((t, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-16 flex-shrink-0">Janela {idx + 1}</span>
            <input
              type="time"
              value={t}
              onChange={e => setWindowTimes(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
              className={inputClass + ' flex-1'}
              onFocus={e => e.target.style.borderColor = PRIMARY}
              onBlur={e => e.target.style.borderColor = ''}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">Você pode adicionar mais janelas depois em Configurações.</p>
      <button
        onClick={save}
        disabled={saving || saved}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}
      >
        {saving ? 'Salvando…' : saved ? '✓ Janelas salvas' : 'Salvar janelas de resposta'}
      </button>
    </div>
  )
}

// ─── Assistente ───────────────────────────────────────────────────────────────

function AssistenteStep({ onComplete }: { onComplete: (name: string) => void }) {
  const [form, setForm] = useState({ persona_name: '', persona_tone: 'profissional', persona_response_size: 'curto', persona_description: '', response_hint: '' })
  const [saving, setSaving] = useState(false)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data } = await sb.from('instances').select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint').eq('user_id', session.user.id).eq('active', true).single()
      if (data) {
        setInstanceId(data.id)
        if (data.persona_name) setForm({ persona_name: data.persona_name, persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
      }
    }
    load()
  }, [])

  async function complete() {
    if (!instanceId || !form.persona_name.trim()) return
    setSaving(true)
    const sb = getSupabase()
    await sb.from('instances').update(form).eq('id', instanceId)
    const token = await getToken()
    await fetch('/api/onboarding/step', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ completed: true })
    })
    window.dispatchEvent(new CustomEvent('assistantNameChanged', { detail: form.persona_name }))
    onComplete(form.persona_name)
  }

  const nameIsBia = form.persona_name.trim().toUpperCase() === 'BIA'
  const canSubmit = form.persona_name.trim().length > 0 && !nameIsBia && !saving

  return (
    <div className="space-y-3 w-full max-w-sm">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome da assistente</label>
        <input
          type="text"
          value={form.persona_name}
          onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))}
          placeholder="Ex: MAIA, LARA, ZEUS, NINA…"
          className={inputClass}
          style={{ borderColor: nameIsBia ? '#f59e0b' : '' }}
          onFocus={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : PRIMARY}
          onBlur={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : ''}
        />
        {nameIsBia && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            BIA é o nome da assistente do produto. Escolha outro nome para a sua assistente pessoal.
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
      <button
        onClick={complete}
        disabled={!canSubmit}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        {saving ? 'Finalizando…' : 'Concluir configuração →'}
      </button>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 0 | 1 | 2 | 3 | 4 | 5

type ChatMsg = {
  id: string
  role: 'bia' | 'user'
  content?: string
  widget?: 'video' | 'acceptance' | 'whatsapp' | 'contacts' | 'digest' | 'assistente'
}

type QuickReply = { label: string; action: () => void }

// ─── Main ─────────────────────────────────────────────────────────────────────

interface OnboardingViewProps {
  userName: string
  initialStep: number
  onComplete: (assistantName: string) => void
}

export default function OnboardingView({ userName, initialStep, onComplete }: OnboardingViewProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [phase, setPhase] = useState<Phase>(0)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mountedRef = useRef(true)
  const conversationId = useRef<string | null>(null)

  // Refs para callbacks dos widgets — evita stale closures
  const onAcceptanceConfirmedRef = useRef<() => void>(() => {})
  const onWhatsAppConnectedRef   = useRef<() => void>(() => {})
  const onDigestSavedRef         = useRef<() => void>(() => {})
  const onAssistanteCompleteRef  = useRef<(name: string) => void>(() => {})

  const stableOnAcceptanceConfirmed = useCallback(() => onAcceptanceConfirmedRef.current(), [])
  const stableOnWhatsAppConnected   = useCallback(() => onWhatsAppConnectedRef.current(), [])
  const stableOnDigestSaved         = useCallback(() => onDigestSavedRef.current(), [])
  const stableOnAssistanteComplete  = useCallback((name: string) => onAssistanteCompleteRef.current(name), [])

  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function userSay(content: string) {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }])
  }

  async function biaSay(content?: string, widget?: ChatMsg['widget'], delay = 900) {
    setTyping(true)
    await new Promise(r => setTimeout(r, delay))
    if (!mountedRef.current) return
    setTyping(false)
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content, widget }])
  }

  async function advanceStep(step: number) {
    try {
      const token = await getToken()
      await fetch('/api/onboarding/step', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ step })
      })
      window.dispatchEvent(new CustomEvent('onboardingStepChanged', { detail: step }))
    } catch { /* non-blocking */ }
  }

  // ─── Fase 0 — Boas-vindas + Q&A ──────────────────────────────────────────────

  async function initPhase0() {
    const firstName = userName?.trim().split(/\s+/)[0] || ''
    await biaSay(
      `Olá${firstName ? `, ${firstName}` : ''}! Tudo bem? Sou a BIA, assistente do MeuDIA.`,
      undefined, 600
    )
    await biaSay(
      'Em poucos minutos seu WhatsApp vai estar organizado e gerenciado — você no controle, sem precisar ficar no celular o dia todo.',
      undefined, 800
    )
    await biaSay(
      'O Luciano gravou uma mensagem rápida pra você antes de começarmos:',
      undefined, 700
    )
    await biaSay(undefined, 'video', 400)
    await biaSay('Tem alguma dúvida antes de começarmos?', undefined, 700)
    setPhase(0)
    setQuickReplies([{ label: 'Pode continuar →', action: goToPhase1 }])
  }

  async function goToPhase1() {
    setQuickReplies([])
    userSay('Pode continuar →')
    await biaSay('Antes de conectar seu WhatsApp, preciso que você leia alguns pontos importantes sobre como o sistema funciona e como seus dados são protegidos.')
    await biaSay(undefined, 'acceptance', 400)
    setPhase(1)
  }

  // ─── Fase 2 — WhatsApp ────────────────────────────────────────────────────────

  async function handleAcceptanceConfirmed() {
    try {
      await advanceStep(1)
      await biaSay('Obrigado! Agora vamos conectar seu WhatsApp.', undefined, 500)
      await biaSay('É por aqui que suas mensagens chegam, sua assistente atua e o digest é montado. Sem isso, o MeuDIA não funciona.')
      await biaSay(undefined, 'whatsapp', 400)
      setPhase(2)
    } catch {
      await biaSay('Algo deu errado. Recarregue a página e tente novamente.')
    }
  }

  // ─── Fase 3 — Contatos ────────────────────────────────────────────────────────

  async function handleWhatsAppConnected() {
    try {
      await advanceStep(2)
      await biaSay('WhatsApp conectado! ✓', undefined, 400)
      await biaSay('Agora, um ponto importante antes de continuar: entender como os contatos funcionam vai fazer diferença no seu dia a dia.')
      await biaSay(undefined, 'contacts', 400)
      setPhase(3)
      setQuickReplies([{ label: 'Entendido →', action: startPhase4 }])
    } catch {
      await biaSay('Algo deu errado. Recarregue a página e tente novamente.')
    }
  }

  // ─── Fase 4 — Digest ─────────────────────────────────────────────────────────

  async function startPhase4() {
    try {
      setQuickReplies([])
      userSay('Entendido →')
      await advanceStep(3)
      await biaSay('Ótimo! Agora configure suas janelas de resposta.', undefined, 500)
      await biaSay('São os momentos do dia em que você "abre" seu WhatsApp. Fora desses horários, tudo acumula em silêncio — você não é interrompido.')
      await biaSay(undefined, 'digest', 400)
      setPhase(4)
    } catch {
      await biaSay('Algo deu errado. Recarregue a página e tente novamente.')
    }
  }

  // ─── Fase 5 — Assistente ──────────────────────────────────────────────────────

  async function handleDigestSaved() {
    try {
      await biaSay('Janelas salvas! ✓', undefined, 400)
      await biaSay('Última etapa — vamos configurar sua assistente pessoal.', undefined, 600)
      await biaSay('Ela é quem vai responder seus contatos pelo WhatsApp, com o nome e o tom que você definir. Eu, BIA, fico aqui no dashboard para qualquer dúvida sobre o produto.', undefined, 700)
      await biaSay(undefined, 'assistente', 400)
      setPhase(5)
    } catch {
      await biaSay('Algo deu errado. Recarregue a página e tente novamente.')
    }
  }

  async function handleAssistanteComplete(name: string) {
    try {
      await biaSay(`Tudo pronto! ${name} está configurada e pronta para trabalhar. Bem-vindo ao MeuDIA! 😊`, undefined, 400)
      onComplete(name)
    } catch {
      onComplete(name)
    }
  }

  // Mantém refs sempre atualizados
  onAcceptanceConfirmedRef.current = handleAcceptanceConfirmed
  onWhatsAppConnectedRef.current   = handleWhatsAppConnected
  onDigestSavedRef.current         = handleDigestSaved
  onAssistanteCompleteRef.current  = handleAssistanteComplete

  // ─── Q&A livre (fase 0) ───────────────────────────────────────────────────────

  async function sendQuestion() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setQuickReplies([])
    userSay(text)
    setTyping(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/assistente/comando', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversation_id: conversationId.current })
      })
      const data = await res.json()
      if (data.conversation_id) conversationId.current = data.conversation_id
      setTyping(false)
      if (!mountedRef.current) return
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content: data.response || 'Desculpe, não consegui processar sua pergunta.' }])
      await biaSay('Mais alguma dúvida?', undefined, 600)
    } catch {
      setTyping(false)
      if (!mountedRef.current) return
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content: 'Ocorreu um erro. Tente novamente.' }])
    } finally {
      setSending(false)
      setQuickReplies([{ label: 'Pode continuar →', action: goToPhase1 }])
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion() }
  }

  // ─── Resume (initialStep > 0) ─────────────────────────────────────────────────

  function buildResumedMessages(step: number): { msgs: ChatMsg[]; resumePhase: Phase } {
    const firstName = userName?.trim().split(/\s+/)[0] || ''
    const msgs: ChatMsg[] = [
      { id: 'r0', role: 'bia', content: `Bem-vindo de volta${firstName ? `, ${firstName}` : ''}! Vamos continuar de onde paramos.` }
    ]
    if (step === 1) {
      msgs.push({ id: 'r1', role: 'bia', content: 'Conecte seu WhatsApp para continuar:', widget: 'whatsapp' })
      return { msgs, resumePhase: 2 }
    }
    msgs.push({ id: 'r2', role: 'bia', content: 'WhatsApp conectado! ✓' })
    if (step === 2) {
      msgs.push({ id: 'r3', role: 'bia', content: 'Sobre seus contatos:', widget: 'contacts' })
      return { msgs, resumePhase: 3 }
    }
    if (step === 3) {
      msgs.push({ id: 'r4', role: 'bia', content: 'Configure suas janelas de resposta:', widget: 'digest' })
      return { msgs, resumePhase: 4 }
    }
    msgs.push({ id: 'r5', role: 'bia', content: 'Configure sua assistente pessoal:', widget: 'assistente' })
    return { msgs, resumePhase: 5 }
  }

  // ─── Mount ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialStep === 0) {
      initPhase0()
    } else {
      const { msgs, resumePhase } = buildResumedMessages(initialStep)
      setMessages(msgs)
      setPhase(resumePhase)
      if (resumePhase === 3) {
        setQuickReplies([{ label: 'Entendido →', action: startPhase4 }])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────────

  function renderMessage(msg: ChatMsg) {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="flex justify-end">
          <div
            className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
            style={{ background: PRIMARY, color: 'white', borderBottomRightRadius: '4px' }}
          >
            {msg.content}
          </div>
        </div>
      )
    }

    return (
      <div key={msg.id} className="flex justify-start items-end gap-2">
        <BiaAvatar />
        <div className="max-w-[85%] flex flex-col gap-2">
          {msg.content && (
            <div
              className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{ background: 'white', border: '1px solid #e5e7eb', color: '#1f2937', borderBottomLeftRadius: msg.widget ? '12px' : '4px' }}
            >
              {msg.content}
            </div>
          )}
          {msg.widget === 'video'      && <VideoWidget url={VIDEO_URL} />}
          {msg.widget === 'acceptance' && <AcceptanceWidget onAccepted={stableOnAcceptanceConfirmed} />}
          {msg.widget === 'whatsapp'   && <div className="w-full max-w-sm"><WhatsAppStep onConnected={stableOnWhatsAppConnected} /></div>}
          {msg.widget === 'contacts'   && <ContactsStep />}
          {msg.widget === 'digest'     && <div className="w-full max-w-sm"><DigestStep onSaved={stableOnDigestSaved} /></div>}
          {msg.widget === 'assistente' && <div className="w-full max-w-sm"><AssistenteStep onComplete={stableOnAssistanteComplete} /></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: PRIMARY }}>BI</div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">BIA</p>
          <p className="text-xs text-gray-400">Configuração inicial · MeuDIA</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map(renderMessage)}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && (
        <div className="flex gap-2 flex-wrap py-3 flex-shrink-0">
          {quickReplies.map(qr => (
            <button
              key={qr.label}
              onClick={qr.action}
              disabled={sending}
              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 hover:opacity-80"
              style={{ borderColor: PRIMARY, color: PRIMARY, background: `${PRIMARY}0D` }}
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {/* Input — só na fase 0 */}
      {phase === 0 && (
        <div className="pt-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tem alguma dúvida? (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={sendQuestion}
              disabled={!input.trim() || sending}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: PRIMARY }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">Shift+Enter para nova linha · Enter para enviar</p>
        </div>
      )}

    </div>
  )
}
