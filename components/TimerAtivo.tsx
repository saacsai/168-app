'use client'

import { useEffect, useState } from 'react'

export type TimerState = {
  blocoId: string
  label: string
  esfera: string
  horaInicio: string   // "HH:MM:SS"
  horaFim: string      // "HH:MM:SS"
  duracaoMin: number   // duração total agendada em minutos
  iniciadoEm: Date     // quando o usuário clicou INICIAR
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

export default function TimerAtivo({ timer, onFinalizar }: Props) {
  const [elapsedMin, setElapsedMin] = useState(0)

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
