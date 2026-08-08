'use client'

import { type TimerState } from './TimerAtivo'

export type BlocoParaModal = {
  id: string
  label: string
  esfera: string
  hora_inicio: string
  hora_fim: string
  inegociavel: boolean
  duracaoMin: number
}

const ESFERA: Record<string, { cor: string; nome: string }> = {
  sono:           { cor: '#374151', nome: 'SONO' },
  cuidar_mim:     { cor: '#15803d', nome: 'CUIDAR DE MIM' },
  cuidar_familia: { cor: '#1d4ed8', nome: 'FAMÍLIA' },
  trabalho:       { cor: '#c2410c', nome: 'TRABALHO' },
  patrimonio:     { cor: '#a16207', nome: 'PATRIMÔNIO' },
  ocio_criativo:  { cor: '#7e22ce', nome: 'ÓCIO CRIATIVO' },
}

interface Props {
  bloco: BlocoParaModal | null
  timer: TimerState | null
  onIniciar: (bloco: BlocoParaModal) => void
  onFinalizar: () => void
  onClose: () => void
}

export default function BlocoModal({ bloco, timer, onIniciar, onFinalizar, onClose }: Props) {
  if (!bloco) return null

  const cfg = ESFERA[bloco.esfera] ?? { cor: '#6b7280', nome: bloco.esfera }
  const esteEstaAtivo = timer?.blocoId === bloco.id
  const outroEstaAtivo = timer !== null && !esteEstaAtivo

  const h = Math.floor(bloco.duracaoMin / 60)
  const m = bloco.duracaoMin % 60
  const duracaoLabel = h > 0
    ? `${h}h${m > 0 ? ` ${m}min` : ''}`
    : `${m}min`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-xl overflow-hidden"
        style={{ border: `2px solid ${cfg.cor}30` }}
      >
        {/* Header colorido */}
        <div className="px-5 py-4" style={{ background: cfg.cor + '12', borderBottom: `1px solid ${cfg.cor}20` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span
                className="text-[10px] font-bold tracking-widest"
                style={{ color: cfg.cor }}
              >
                {cfg.nome}
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-0.5 truncate">{bloco.label}</h3>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors mt-0.5"
            >
              ✕
            </button>
          </div>

          {/* Horário + duração */}
          <div className="flex items-center gap-3 mt-3">
            <span
              className="text-xs font-mono font-semibold px-2 py-1 rounded-lg"
              style={{ background: cfg.cor + '20', color: cfg.cor }}
            >
              {bloco.hora_inicio.slice(0, 5)} → {bloco.hora_fim.slice(0, 5)}
            </span>
            <span className="text-xs text-gray-400">{duracaoLabel}</span>
            {bloco.inegociavel && (
              <span className="text-[10px] text-gray-400 font-medium tracking-wide ml-auto">FIXO</span>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-3">

          {bloco.esfera === 'sono' ? (
            /* ── Sono: fluxo específico ── */
            <>
              {!esteEstaAtivo && (
                <p className="text-xs text-gray-500">
                  O sono é um bloco de recuperação. Registrar o início ajuda a calcular suas horas reais de descanso.
                </p>
              )}

              {esteEstaAtivo && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#37415115' }}>
                  <span className="text-base">💤</span>
                  <span className="text-xs font-semibold text-gray-700">Sono em andamento</span>
                </div>
              )}

              {outroEstaAtivo && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-xs text-amber-700">
                    <span className="font-semibold">{timer!.label}</span> está em andamento. Finalize antes de iniciar o sono.
                  </span>
                </div>
              )}

              {esteEstaAtivo ? (
                <button
                  onClick={() => { onFinalizar(); onClose() }}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#374151' }}
                >
                  ☀ Finalizar sono
                </button>
              ) : (
                <button
                  onClick={() => { onIniciar(bloco); onClose() }}
                  disabled={outroEstaAtivo}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: '#374151' }}
                >
                  💤 Iniciar sono
                </button>
              )}
            </>
          ) : (
            /* ── Blocos normais ── */
            <>
              {esteEstaAtivo && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: cfg.cor + '10' }}
                >
                  <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: cfg.cor }} />
                  <span className="text-xs font-semibold" style={{ color: cfg.cor }}>Em andamento</span>
                </div>
              )}

              {outroEstaAtivo && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-xs text-amber-700">
                    <span className="font-semibold">{timer!.label}</span> está em andamento.
                    Finalize antes de iniciar este bloco.
                  </span>
                </div>
              )}

              {esteEstaAtivo ? (
                <button
                  onClick={() => { onFinalizar(); onClose() }}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#dc2626' }}
                >
                  ■ Finalizar bloco
                </button>
              ) : (
                <button
                  onClick={() => { onIniciar(bloco); onClose() }}
                  disabled={outroEstaAtivo}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: cfg.cor }}
                >
                  ▶ Iniciar bloco
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
