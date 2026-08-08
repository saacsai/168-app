'use client'

import { useEffect, useRef, useState } from 'react'

export type TimerState = {
  blocoId: string
  label: string
  esfera: string
  horaInicio: string
  horaFim: string
  duracaoMin: number
  iniciadoEm: Date
  tipo?: 'bloco' | 'compromisso'
}

const ESFERA_COR: Record<string, string> = {
  cuidar_mim:     '#15803d',
  cuidar_familia: '#1d4ed8',
  trabalho:       '#c2410c',
  patrimonio:     '#a16207',
  ocio_criativo:  '#7e22ce',
  sono:           '#374151',
}

function formatarTempo(minutos: number): string {
  const abs = Math.abs(minutos)
  const h = Math.floor(abs / 60)
  const m = Math.floor(abs % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min`
}

interface Props {
  timer: TimerState | null
  onFinalizar: () => void
}

function notificar(titulo: string, corpo: string) {
  if (typeof window === 'undefined') return
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(titulo, { body: corpo, icon: '/favicon.ico' })
  }
}

export default function TimerAtivo({ timer, onFinalizar }: Props) {
  const [elapsedMin, setElapsedMin] = useState(0)
  const alertasDisparados = useRef<Set<string>>(new Set())

  // Pede permissão de notificação quando timer começa
  useEffect(() => {
    if (!timer) return
    alertasDisparados.current.clear()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [timer?.blocoId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timer) { setElapsedMin(0); return }
    const tick = () => {
      const ms = Date.now() - timer.iniciadoEm.getTime()
      setElapsedMin(ms / 60000)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timer])

  // Notificações em useEffect — evita disparos no render
  useEffect(() => {
    if (!timer) return
    const restanteMin = timer.duracaoMin - elapsedMin
    const overtime = restanteMin < 0
    const alertaLeve = restanteMin <= 10 && restanteMin > 5 && !overtime
    const alertaForte = restanteMin <= 5 && !overtime

    if (alertaLeve && !alertasDisparados.current.has('10')) {
      alertasDisparados.current.add('10')
      notificar('168 · Timer', `${timer.label} — 10 minutos restantes`)
    }
    if (alertaForte && !alertasDisparados.current.has('5')) {
      alertasDisparados.current.add('5')
      notificar('168 · Timer', `${timer.label} — 5 minutos restantes`)
    }
    if (overtime && !alertasDisparados.current.has('overtime')) {
      alertasDisparados.current.add('overtime')
      notificar('168 · Timer', `${timer.label} — tempo esgotado`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMin])

  // Sem timer ativo — placeholder
  if (!timer) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f3f4f6' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-400">Nenhum bloco em andamento</p>
          <p className="text-xs text-gray-300 mt-0.5">Clique num bloco da grade para iniciar</p>
        </div>
      </div>
    )
  }

  const restanteMin = timer.duracaoMin - elapsedMin
  const progresso = Math.min(elapsedMin / timer.duracaoMin, 1)
  const overtime = restanteMin < 0
  const alertaLeve = restanteMin <= 10 && restanteMin > 5 && !overtime
  const alertaForte = restanteMin <= 5 && !overtime
  const cor = ESFERA_COR[timer.esfera] ?? '#1B2A4A'

  const borderColor = overtime ? '#dc2626' : alertaForte ? '#f59e0b' : cor

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        border: `2px solid ${borderColor}`,
        background: overtime ? '#fef2f2' : alertaForte ? '#fffbeb' : `${cor}08`,
        transition: 'border-color 0.5s, background 0.5s',
      }}
    >
      {/* Linha superior: nome + horário + botão */}
      <div className="flex items-center gap-3">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: overtime ? '#dc2626' : cor }}
        />
        <span className="text-sm font-bold text-gray-900 flex-1 truncate">{timer.label}</span>
        <span className="text-xs text-gray-400 flex-shrink-0 font-mono">
          {timer.horaInicio.slice(0, 5)} → {timer.horaFim.slice(0, 5)}
        </span>
        <button
          onClick={onFinalizar}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: overtime ? '#dc2626' : cor,
            color: '#fff',
          }}
        >
          ■ FINALIZAR
        </button>
      </div>

      {/* Banner de alerta visual — fallback para quando notificação do browser não aparece */}
      {(alertaForte || overtime) && (
        <div
          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold text-center animate-pulse"
          style={{
            background: overtime ? '#dc262620' : '#f59e0b20',
            color: overtime ? '#dc2626' : '#d97706',
          }}
        >
          {overtime ? '⏰ TEMPO ESGOTADO — finalize o bloco' : '⚠️ MENOS DE 5 MINUTOS'}
        </div>
      )}
      {alertaLeve && !alertaForte && (
        <div className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-center" style={{ background: '#fef3c7', color: '#d97706' }}>
          ⏳ 10 minutos restantes
        </div>
      )}

      {/* Barra de progresso */}
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: `${cor}20` }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progresso * 100}%`,
            background: overtime ? '#dc2626' : alertaForte ? '#f59e0b' : cor,
          }}
        />
      </div>

      {/* Tempo restante */}
      <div className="mt-1.5 flex items-center justify-between">
        <span
          className="text-xs font-medium"
          style={{ color: overtime ? '#dc2626' : alertaForte ? '#d97706' : '#9ca3af' }}
        >
          {overtime
            ? `${formatarTempo(restanteMin)} além do previsto`
            : alertaLeve
            ? `⚠ ${formatarTempo(restanteMin)} restantes`
            : alertaForte
            ? `⚠ ${formatarTempo(restanteMin)} restantes`
            : `${formatarTempo(restanteMin)} restantes`}
        </span>
        <span className="text-xs text-gray-300 font-mono">
          {formatarTempo(elapsedMin)} decorridos
        </span>
      </div>
    </div>
  )
}
