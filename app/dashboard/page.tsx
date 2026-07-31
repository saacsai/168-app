'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'
import Link from 'next/link'

const PRIMARY = '#2A5F6B'

interface Instance {
  id: string
  instance_name: string
  phone_number: string
  status: string
  paused: boolean
  persona_name: string
}

interface Task {
  id: string
  title: string
  priority: 'alta' | 'media' | 'baixa'
  status: 'pendente' | 'feito'
  date: string
  due_date: string | null
  origin_group_id: string | null
  contact_groups: { name: string; color: string } | null
}

interface QueueMessage {
  id: string
  contact_name: string | null
  contact_remote_jid: string
  contact_priority: string
  message_summary: string | null
  original_message: string | null
  received_at: string
}

const PRIORITY_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

function dueBadge(due_date: string | null): { label: string; color: string } | null {
  if (!due_date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(due_date + 'T00:00:00')
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0)  return { label: `${Math.abs(diff)}d atrasada`, color: '#ef4444' }
  if (diff === 0) return { label: 'Vence hoje', color: '#f59e0b' }
  if (diff <= 3)  return { label: `${diff}d restantes`, color: '#f59e0b' }
  return { label: `até ${new Date(due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, color: '#6b7280' }
}

const PRIORITY_COLOR: Record<string, { bg: string; border: string; dot: string }> = {
  alta:  { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
  media: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  baixa: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
}
const QUEUE_PRIORITY_COLOR: Record<string, string> = {
  priority: PRIMARY,
  normal: '#6b7280',
  muted: '#d1d5db',
}

const todayLabel = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export default function DashboardPage() {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [pendentes, setPendentes] = useState(0)
  const [queue, setQueue] = useState<QueueMessage[]>([])
  const [togglingTask, setTogglingTask] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: rows } = await supabase
      .from('instances')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .limit(1)
    const inst = rows?.[0] ?? null

    if (inst) {
      setInstance(inst)
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      const [tasksRes, countRes, queueRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, priority, status, date, due_date, origin_group_id')
          .eq('instance_id', inst.id)
          .lte('date', todayDate)
          .order('priority', { ascending: true }),
        supabase
          .from('message_queue')
          .select('*', { count: 'exact', head: true })
          .eq('instance_id', inst.id)
          .eq('included_in_digest', false)
          .eq('replied', false),
        supabase
          .from('message_queue')
          .select('id, contact_name, contact_remote_jid, contact_priority, message_summary, original_message, received_at')
          .eq('instance_id', inst.id)
          .eq('included_in_digest', false)
          .eq('replied', false)
          .order('received_at', { ascending: false })
          .limit(50)
      ])

      const rawTasks = (tasksRes.data || []) as Array<Omit<Task, 'contact_groups'> & { origin_group_id: string | null }>
      const groupIds = Array.from(new Set(rawTasks.map(t => t.origin_group_id).filter(Boolean))) as string[]
      let groupMap: Record<string, { name: string; color: string }> = {}
      if (groupIds.length > 0) {
        const { data: groups } = await supabase
          .from('contact_groups')
          .select('id, name, color')
          .in('id', groupIds)
        if (groups) {
          groupMap = Object.fromEntries(groups.map(g => [g.id, { name: g.name, color: g.color }]))
        }
      }
      const mergedTasks: Task[] = rawTasks.map(t => ({
        ...t,
        contact_groups: t.origin_group_id ? (groupMap[t.origin_group_id] ?? null) : null,
      }))
      setTasks(mergedTasks)
      setPendentes(countRes.count || 0)
      setQueue(queueRes.data || [])
    }
    setLoading(false)
  }

  async function togglePause() {
    if (!instance) return
    setToggling(true)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('instances')
      .update({ paused: !instance.paused })
      .eq('id', instance.id)
      .select()
      .single()
    if (data) setInstance(data)
    setToggling(false)
  }

  async function toggleTask(task: Task) {
    setTogglingTask(task.id)
    const newStatus = task.status === 'pendente' ? 'feito' : 'pendente'
    await getSupabase().from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    setTogglingTask(null)
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  if (!instance) return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500 mb-4">Nenhuma instância configurada.</p>
        <a href="/dashboard/assistente" className="text-sm font-medium" style={{ color: PRIMARY }}>
          Configurar agora →
        </a>
      </div>
    </div>
  )

  const pendingTasks = tasks.filter(t => t.status === 'pendente')
  const doneTasks    = tasks.filter(t => t.status === 'feito')

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header do dia — apenas desktop */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 capitalize">{todayLabel()}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {pendingTasks.length === 0
              ? 'Nenhuma tarefa pendente'
              : `${pendingTasks.length} tarefa${pendingTasks.length > 1 ? 's' : ''} pendente${pendingTasks.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: instance.paused ? '#d1d5db' : '#22c55e' }} />
          <Toggle value={!instance.paused} onToggle={togglePause} loading={toggling} color={PRIMARY} />
        </div>
      </div>

      {/* Quadro de tarefas */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Meu Dia</h2>
          <Link
            href="/dashboard/assistente"
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: PRIMARY, background: `${PRIMARY}12` }}
          >
            + nova tarefa
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400 mb-3">Nenhuma tarefa para hoje.</p>
            <p className="text-xs text-gray-400">
              Diga para <strong>{instance.persona_name}</strong> o que precisa fazer hoje →{' '}
              <Link href="/dashboard/assistente" className="underline" style={{ color: PRIMARY }}>abrir chat</Link>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingTasks.map(task => {
              const colors = PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.media
              const groupColor = task.contact_groups?.color
              return (
                <div key={task.id} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50">
                  {/* Dot grupo */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: groupColor || '#e5e7eb' }}
                  />
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task)}
                    disabled={togglingTask === task.id}
                    className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center flex-shrink-0 transition-colors bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: colors.bg, color: colors.dot, border: `1px solid ${colors.border}` }}
                      >
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {task.contact_groups?.name && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: task.contact_groups.color }}
                        >
                          {task.contact_groups.name}
                        </span>
                      )}
                      {(() => {
                        const badge = dueBadge(task.due_date)
                        return badge ? (
                          <span className="text-[10px] font-medium" style={{ color: badge.color }}>{badge.label}</span>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}

            {doneTasks.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-xs text-gray-400 mb-2">{doneTasks.length} concluída{doneTasks.length > 1 ? 's' : ''}</p>
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.contact_groups?.color || '#e5e7eb' }} />
                    <button
                      onClick={() => toggleTask(task)}
                      disabled={togglingTask === task.id}
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: PRIMARY }}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <polyline points="1.5 6 4.5 9 10.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <p className="text-sm text-gray-400 line-through">{task.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Olivia toggle — apenas mobile (desktop tem no header) */}
      <div className="md:hidden bg-white rounded-2xl border border-gray-200 px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Olivia</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: instance.paused ? '#f59e0b' : '#22c55e' }} />
              <p className="text-sm font-semibold text-gray-900">{instance.paused ? 'Pausada' : 'Ativa'}</p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-4">
              {instance.paused ? 'Não está respondendo mensagens' : 'Respondendo mensagens por você'}
            </p>
          </div>
          <button
            onClick={togglePause}
            disabled={toggling}
            className="text-xs font-semibold px-4 py-2 rounded-xl flex-shrink-0 disabled:opacity-50"
            style={{
              background: instance.paused ? '#dcfce7' : '#fef9c3',
              color: instance.paused ? '#16a34a' : '#92400e',
            }}
          >
            {toggling ? '…' : instance.paused ? 'Retomar' : 'Pausar'}
          </button>
        </div>
      </div>

      {/* Mensagens acumuladas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Mensagens acumuladas</h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: pendentes > 0 ? PRIMARY : '#9ca3af' }}
          >
            {pendentes}
          </span>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma mensagem na fila.</p>
        ) : (
          <div className="space-y-2">
            {queue.map(msg => (
              <div key={msg.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div
                  className="w-1.5 rounded-full flex-shrink-0 mt-1 self-stretch"
                  style={{ backgroundColor: QUEUE_PRIORITY_COLOR[msg.contact_priority] || '#d1d5db' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {msg.contact_name || msg.contact_remote_jid}
                    </p>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(msg.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
