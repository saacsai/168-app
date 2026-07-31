'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'

const PRIMARY = '#2A5F6B'

interface DigestSchedule {
  id: string
  window_times: string[] | null
  morning_time: string | null
  afternoon_time: string | null
  active: boolean
  email_notify: boolean
  email_notify_scope: 'all' | 'priority'
}

interface QueueMessage {
  id: string
  contact_name: string | null
  contact_remote_jid: string
  contact_priority: string
  original_message: string | null
  message_summary: string | null
  received_at: string
}

const PRIORITY_COLOR: Record<string, string> = {
  priority: '#2A5F6B',
  normal: '#6b7280',
  muted: '#d1d5db',
}

function normalizeTimes(sched: DigestSchedule): string[] {
  if (sched.window_times?.length) return sched.window_times
  // fallback para colunas antigas
  const times: string[] = []
  if (sched.morning_time) times.push(sched.morning_time.slice(0, 5))
  if (sched.afternoon_time) times.push(sched.afternoon_time.slice(0, 5))
  return times.length ? times : ['08:00', '17:00']
}

export default function DigestPage() {
  const [schedule, setSchedule] = useState<DigestSchedule | null>(null)
  const [queue, setQueue] = useState<QueueMessage[]>([])
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [windowTimes, setWindowTimes] = useState<string[]>(['08:00', '17:00'])
  const [active, setActive] = useState(true)
  const [emailNotify, setEmailNotify] = useState(false)
  const [emailScope, setEmailScope] = useState<'all' | 'priority'>('priority')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: inst } = await supabase
      .from('instances')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()
    if (!inst) { setLoading(false); return }
    setInstanceId(inst.id)
    const { data: sched } = await supabase
      .from('digest_schedule')
      .select('*')
      .eq('instance_id', inst.id)
      .single()
    if (sched) {
      setSchedule(sched)
      setWindowTimes(normalizeTimes(sched))
      setActive(sched.active)
      setEmailNotify(sched.email_notify ?? false)
      setEmailScope(sched.email_notify_scope ?? 'priority')
    }
    const { data: msgs } = await supabase
      .from('message_queue')
      .select('id, contact_name, contact_remote_jid, contact_priority, original_message, message_summary, received_at')
      .eq('instance_id', inst.id)
      .eq('included_in_digest', false)
      .eq('replied', false)
      .order('received_at', { ascending: false })
      .limit(50)
    setQueue(msgs || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instanceId) return
    setSaving(true)
    const supabase = getSupabase()
    const payload = {
      window_times: windowTimes,
      active,
      email_notify: emailNotify,
      email_notify_scope: emailScope,
    }
    if (schedule) {
      await supabase.from('digest_schedule').update(payload).eq('id', schedule.id)
    } else {
      await supabase.from('digest_schedule').insert({ ...payload, instance_id: instanceId })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addWindow() {
    if (windowTimes.length >= 6) return
    setWindowTimes(prev => [...prev, '12:00'])
  }

  function removeWindow(i: number) {
    if (windowTimes.length <= 2) return
    setWindowTimes(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateWindow(i: number, value: string) {
    setWindowTimes(prev => prev.map((t, idx) => idx === i ? value : t))
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Horários */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Janelas de resposta</h2>
        <p className="text-xs text-gray-500 mb-5">
          Momentos em que você revisa e responde as mensagens acumuladas. Mínimo 2, máximo 6.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Lista de janelas */}
          <div className="space-y-2">
            {windowTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">Janela {i + 1}</span>
                <input
                  type="time"
                  value={t}
                  onChange={e => updateWindow(i, e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
                  onFocus={e => e.target.style.borderColor = PRIMARY}
                  onBlur={e => e.target.style.borderColor = ''}
                />
                {windowTimes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeWindow(i)}
                    className="text-gray-400 hover:text-red-400 text-lg leading-none"
                    title="Remover janela"
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {windowTimes.length < 6 && (
            <button
              type="button"
              onClick={addWindow}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Adicionar janela
            </button>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Toggle
              value={active}
              onToggle={() => setActive(v => !v)}
              color={PRIMARY}
              size="sm"
            />
            <span className="text-xs text-gray-600">
              {active ? 'Digest ativo' : 'Digest desativado'}
            </span>
          </div>

          {/* Notificações por email */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <Toggle
                value={emailNotify}
                onToggle={() => setEmailNotify(v => !v)}
                color={PRIMARY}
                size="sm"
              />
              <span className="text-xs text-gray-700 font-medium">Notificações por email</span>
            </div>

            {emailNotify && (
              <div className="ml-11 space-y-2">
                <p className="text-xs text-gray-500">Quais mensagens disparam o email?</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="email_scope"
                    value="priority"
                    checked={emailScope === 'priority'}
                    onChange={() => setEmailScope('priority')}
                    className="accent-teal-700"
                  />
                  <span className="text-xs text-gray-700">Somente contatos prioritários</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="email_scope"
                    value="all"
                    checked={emailScope === 'all'}
                    onChange={() => setEmailScope('all')}
                    className="accent-teal-700"
                  />
                  <span className="text-xs text-gray-700">Todas as mensagens da fila</span>
                </label>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}
          >
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar configurações'}
          </button>
        </form>
      </div>

      {/* Fila de mensagens */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Fila de mensagens</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PRIMARY }}>
            {queue.length}
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma mensagem na fila.</p>
        ) : (
          <div className="space-y-3">
            {queue.map(msg => (
              <div key={msg.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div
                  className="w-2 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: PRIORITY_COLOR[msg.contact_priority] || '#d1d5db', minHeight: '16px' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {msg.contact_name || msg.contact_remote_jid}
                    </p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.received_at)}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {msg.message_summary || msg.original_message || '…'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
