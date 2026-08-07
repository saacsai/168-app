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
}

const TIPO_LABEL: Record<string, string> = {
  reuniao:      'REUNIÃO',
  consulta:     'CONSULTA',
  compromisso:  'COMPROMISSO',
  tarefa:       'TAREFA',
  deslocamento: 'DESLOCAMENTO',
  outro:        'COMPROMISSO',
}

export default function CompromissoModal({ compromisso, onClose }: Props) {
  if (!compromisso) return null

  const label = TIPO_LABEL[compromisso.tipo] ?? 'COMPROMISSO'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: '#ea580c30', background: '#ea580c08' }}>
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: '#ea580c' }}>{label}</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{compromisso.titulo}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            {compromisso.hora_inicio} → {compromisso.hora_fim}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {compromisso.link && (
            <a
              href={compromisso.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white justify-center"
              style={{ background: '#ea580c' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
              Entrar na reunião
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}
