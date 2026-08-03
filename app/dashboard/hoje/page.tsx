'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import GradeDiaria from '@/components/GradeDiaria'
import PainelBIA from '@/components/PainelBIA'
import TimerAtivo, { type TimerState } from '@/components/TimerAtivo'
import BlocoModal, { type BlocoParaModal } from '@/components/BlocoModal'
import NovoBlocoModal from '@/components/NovoBlocoModal'

type ModalOvertime = {
  label: string
  minutos: number
}

export default function HojePage() {
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [modalBloco, setModalBloco] = useState<BlocoParaModal | null>(null)
  const [overtimeModal, setOvertimeModal] = useState<ModalOvertime | null>(null)
  const [novoBloco, setNovoBloco] = useState<number | null>(null)
  const [gradeKey, setGradeKey] = useState(0)

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function handleIniciar(bloco: BlocoParaModal) {
    setTimer({
      blocoId: bloco.id,
      label: bloco.label,
      esfera: bloco.esfera,
      horaInicio: bloco.hora_inicio,
      horaFim: bloco.hora_fim,
      duracaoMin: bloco.duracaoMin,
      iniciadoEm: new Date(),
    })
  }

  async function handleFinalizar() {
    if (!timer) return

    const finalizadoEm = new Date()
    const duracaoRealMin = Math.round((finalizadoEm.getTime() - timer.iniciadoEm.getTime()) / 60000)
    const overtimeMin = duracaoRealMin - timer.duracaoMin

    // Salvar execucao_bloco no Supabase
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('execucao_bloco').insert({
          user_id: session.user.id,
          bloco_fixo_id: timer.blocoId,
          data: new Date().toISOString().slice(0, 10),
          iniciado_em: timer.iniciadoEm.toISOString(),
          finalizado_em: finalizadoEm.toISOString(),
          duracao_real_min: duracaoRealMin,
          label: timer.label,
          esfera: timer.esfera,
          status: 'concluido',
        })
      }
    } catch {
      // silencioso — não bloqueia o fluxo
    }

    setTimer(null)

    if (overtimeMin > 0) {
      setOvertimeModal({ label: timer.label, minutos: overtimeMin })
    }
  }

  return (
    <>
      <div className="flex gap-4 items-start">

        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-4">

          <div>
            <h1 className="text-xl font-bold text-gray-900 capitalize">{hoje}</h1>
            <p className="text-xs text-gray-400 mt-0.5">168 horas semanais</p>
          </div>

          <TimerAtivo timer={timer} onFinalizar={handleFinalizar} />

          <GradeDiaria
            timerBlocoId={timer?.blocoId}
            onBlocoClick={setModalBloco}
            onSlotClick={setNovoBloco}
            refreshKey={gradeKey}
          />
        </div>

        {/* Painel BIA — desktop only, sticky */}
        <div
          className="hidden md:flex flex-col w-[340px] flex-shrink-0 sticky top-6"
          style={{ height: 'calc(100vh - 48px)' }}
        >
          <PainelBIA />
        </div>
      </div>

      <NovoBlocoModal
        hora={novoBloco}
        onClose={() => setNovoBloco(null)}
        onSaved={() => { setGradeKey(k => k + 1); setNovoBloco(null) }}
      />

      {/* Modal de bloco */}
      <BlocoModal
        bloco={modalBloco}
        timer={timer}
        onIniciar={handleIniciar}
        onFinalizar={handleFinalizar}
        onClose={() => setModalBloco(null)}
      />

      {/* Modal de overtime */}
      {overtimeModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-red-100">
            <div className="px-5 py-4 bg-red-50 border-b border-red-100">
              <p className="text-sm font-bold text-red-700">Bloco finalizado com atraso</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{overtimeModal.label}</span> durou{' '}
                <span className="font-semibold text-red-600">{overtimeModal.minutos} min a mais</span>{' '}
                do que o previsto.
              </p>
              <p className="text-xs text-gray-400">
                Verifique os próximos blocos da grade — eles podem precisar de ajuste.
              </p>
              <button
                onClick={() => setOvertimeModal(null)}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#1B2A4A' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
