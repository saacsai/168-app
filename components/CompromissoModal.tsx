'use client'

export type CompromissoInfo = {
  id: string
  titulo: string
  tipo: string
  hora_inicio: string
  hora_fim: string
  link?: string
}

interface Props {
  compromisso: CompromissoInfo | null
  onClose: () => void
  onIniciarTimer?: (c: CompromissoInfo) => void
  timerAtivo?: boolean
}

const TIPO_LABEL: Record<string, string> = {
  reuniao:      'REUNIÃO',
  consulta:     'CONSULTA',
  compromisso:  'COMPROMISSO',
  tarefa:       'TAREFA',
  deslocamento: 'DESLOCAMENTO',
  outro:        'COMPROMISSO',
}

function minutos(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export default function CompromissoModal({ compromisso, onClose, onIniciarTimer, timerAtivo }: Props) {
  if (!compromisso) return null

  const label = TIPO_LABEL[compromisso.tipo] ?? 'COMPROMISSO'
  const duracaoMin = minutos(compromisso.hora_fim) - minutos(compromisso.hora_inicio)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: '#ea580c30', background: '#ea580c08' }}>
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: '#ea580c' }}>{label}</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{compromisso.titulo}</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {compromisso.hora_inicio} → {compromisso.hora_fim}
            <span className="ml-2 not-italic">· {duracaoMin}min</span>
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2.5">

          {/* Iniciar timer */}
          {onIniciarTimer && !timerAtivo && (
            <button
              onClick={() => { onIniciarTimer(compromisso); onClose() }}
              className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white justify-center"
              style={{ background: '#1B2A4A' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Iniciar timer
            </button>
          )}

          {timerAtivo && (
            <div className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 justify-center">
              Timer em andamento — veja o painel acima
            </div>
          )}

          {/* Entrar na reunião */}
          {compromisso.link && (
            <a
              href={compromisso.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold justify-center border"
              style={{ borderColor: '#ea580c40', color: '#ea580c', background: '#ea580c08' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
              Entrar na reunião
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}
