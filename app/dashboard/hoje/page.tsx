'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import GradeDiaria from '@/components/GradeDiaria'
import PainelBIA from '@/components/PainelBIA'
import TimerAtivo, { type TimerState } from '@/components/TimerAtivo'
import BlocoModal, { type BlocoParaModal } from '@/components/BlocoModal'
import NovoBlocoModal from '@/components/NovoBlocoModal'
import ResumoModal, { type ExecucaoFinalizada } from '@/components/ResumoModal'
import CompromissoModal, { type CompromissoInfo } from '@/components/CompromissoModal'

const SONO_KEY = 'sono_ativo_168'

type SonoPersistido = {
  blocoId: string
  label: string
  horaInicio: string
  horaFim: string
  duracaoMin: number
  iniciadoEm: string // ISO string
}

type ModalOvertime = {
  label: string
  minutos: number
}

function agendarNotificacaoSono(wakeMs: number) {
  if (typeof window === 'undefined') return
  const delay = wakeMs - Date.now()
  if (delay <= 0 || delay > 14 * 60 * 60 * 1000) return // só agenda se < 14h
  if (!('Notification' in window)) return
  Notification.requestPermission().then(perm => {
    if (perm !== 'granted') return
    setTimeout(() => {
      new Notification('168 · Sono', {
        body: 'Bom dia! Hora de registrar como foi seu sono.',
        icon: '/icone_meu_dia.png',
      })
    }, delay)
  })
}

export default function HojePage() {
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [modalBloco, setModalBloco] = useState<BlocoParaModal | null>(null)
  const [overtimeModal, setOvertimeModal] = useState<ModalOvertime | null>(null)
  const [execucaoFinalizada, setExecucaoFinalizada] = useState<ExecucaoFinalizada | null>(null)
  const [novoBloco, setNovoBloco] = useState<number | null>(null)
  const [gradeKey, setGradeKey] = useState(0)
  const [compromissoModal, setCompromissoModal] = useState<CompromissoInfo | null>(null)

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // Detecta sono interrompido ou já finalizado ao abrir o app
  useEffect(() => {
    const raw = localStorage.getItem(SONO_KEY)
    if (!raw) return
    try {
      const sono: SonoPersistido = JSON.parse(raw)
      const iniciadoEm = new Date(sono.iniciadoEm)
      const wakeMs = iniciadoEm.getTime() + sono.duracaoMin * 60 * 1000

      if (Date.now() >= wakeMs) {
        // Sono já deveria ter acabado — mostrar ResumoModal direto
        localStorage.removeItem(SONO_KEY)
        const duracaoRealMin = Math.round((Date.now() - iniciadoEm.getTime()) / 60000)
        setExecucaoFinalizada({
          id: '',
          label: sono.label,
          esfera: 'sono',
          duracaoRealMin,
          overtimeMin: 0,
        })
      } else {
        // Ainda dentro do horário de sono — restaurar timer
        setTimer({
          blocoId: sono.blocoId,
          label: sono.label,
          esfera: 'sono',
          horaInicio: sono.horaInicio,
          horaFim: sono.horaFim,
          duracaoMin: sono.duracaoMin,
          iniciadoEm,
          tipo: 'sono',
        })
      }
    } catch {
      localStorage.removeItem(SONO_KEY)
    }
  }, [])

  function handleIniciar(bloco: BlocoParaModal) {
    const iniciadoEm = new Date()

    if (bloco.esfera === 'sono') {
      const wakeMs = iniciadoEm.getTime() + bloco.duracaoMin * 60 * 1000
      const persistido: SonoPersistido = {
        blocoId: bloco.id,
        label: bloco.label,
        horaInicio: bloco.hora_inicio,
        horaFim: bloco.hora_fim,
        duracaoMin: bloco.duracaoMin,
        iniciadoEm: iniciadoEm.toISOString(),
      }
      localStorage.setItem(SONO_KEY, JSON.stringify(persistido))
      agendarNotificacaoSono(wakeMs)
    }

    setTimer({
      blocoId: bloco.id,
      label: bloco.label,
      esfera: bloco.esfera,
      horaInicio: bloco.hora_inicio,
      horaFim: bloco.hora_fim,
      duracaoMin: bloco.duracaoMin,
      iniciadoEm,
      tipo: bloco.esfera === 'sono' ? 'sono' : undefined,
    })
  }

  function handleIniciarCompromisso(c: CompromissoInfo) {
    const [hi, mi] = c.hora_inicio.split(':').map(Number)
    const [hf, mf] = c.hora_fim.split(':').map(Number)
    const duracaoMin = (hf * 60 + mf) - (hi * 60 + mi)
    setTimer({
      blocoId: c.id,
      label: c.titulo,
      esfera: 'trabalho',
      horaInicio: c.hora_inicio,
      horaFim: c.hora_fim,
      duracaoMin,
      iniciadoEm: new Date(),
      tipo: 'compromisso',
    })
  }

  async function handleFinalizar() {
    if (!timer) return

    if (timer.tipo === 'sono') {
      localStorage.removeItem(SONO_KEY)
    }

    const finalizadoEm = new Date()
    const duracaoRealMin = Math.round((finalizadoEm.getTime() - timer.iniciadoEm.getTime()) / 60000)
    const overtimeMin = timer.tipo === 'sono' ? 0 : Math.max(0, duracaoRealMin - timer.duracaoMin)

    let execucaoId = ''
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase.from('execucao_bloco').insert({
          user_id: session.user.id,
          bloco_fixo_id: (timer.tipo === 'compromisso' || timer.tipo === 'sono') ? null : timer.blocoId,
          data: new Date().toISOString().slice(0, 10),
          iniciado_em: timer.iniciadoEm.toISOString(),
          finalizado_em: finalizadoEm.toISOString(),
          duracao_real_min: duracaoRealMin,
          label: timer.label,
          esfera: timer.esfera,
          status: 'concluido',
        }).select('id').single()
        if (data) execucaoId = data.id
      }
    } catch {
      // silencioso
    }

    const timerLabel = timer.label
    const timerEsfera = timer.esfera
    setTimer(null)
    setExecucaoFinalizada({ id: execucaoId, label: timerLabel, esfera: timerEsfera, duracaoRealMin, overtimeMin })
  }

  function handleResumoClose() {
    const overtime = execucaoFinalizada?.overtimeMin ?? 0
    const label = execucaoFinalizada?.label ?? ''
    const ehSono = execucaoFinalizada?.esfera === 'sono'
    setExecucaoFinalizada(null)
    if (!ehSono && overtime > 0) setOvertimeModal({ label, minutos: overtime })
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
            onCompromissoClick={setCompromissoModal}
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

      <ResumoModal
        execucao={execucaoFinalizada}
        onClose={handleResumoClose}
      />

      <CompromissoModal
        compromisso={compromissoModal}
        onClose={() => setCompromissoModal(null)}
        onIniciarTimer={handleIniciarCompromisso}
        timerAtivo={!!timer}
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
