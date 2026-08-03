'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const ESFERAS = [
  { id: 'trabalho',       nome: 'Trabalho',      cor: '#c2410c' },
  { id: 'cuidar_mim',     nome: 'Cuidar de mim', cor: '#15803d' },
  { id: 'cuidar_familia', nome: 'Família',        cor: '#1d4ed8' },
  { id: 'patrimonio',     nome: 'Patrimônio',     cor: '#a16207' },
  { id: 'ocio_criativo',  nome: 'Ócio criativo',  cor: '#7e22ce' },
  { id: 'sono',           nome: 'Sono',           cor: '#374151' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function padHora(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

interface Props {
  hora: number | null
  onClose: () => void
  onSaved: () => void
}

export default function NovoBlocoModal({ hora, onClose, onSaved }: Props) {
  const [label, setLabel] = useState('')
  const [esfera, setEsfera] = useState('trabalho')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [inegociavel, setInegociavel] = useState(false)
  const [dias, setDias] = useState<number[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (hora === null) return
    setLabel('')
    setEsfera('trabalho')
    setHoraInicio(padHora(hora))
    setHoraFim(padHora(Math.min(hora + 1, 23)))
    setInegociavel(false)
    setDias([new Date().getDay()])
    setErro('')
  }, [hora])

  if (hora === null) return null

  function toggleDia(d: number) {
    setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const esfCfg = ESFERAS.find(e => e.id === esfera)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { setErro('Dê um nome ao bloco.'); return }
    if (dias.length === 0) { setErro('Selecione pelo menos um dia.'); return }

    setSalvando(true)
    setErro('')

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('sem sessão')

      const { error } = await supabase.from('blocos_fixos').insert({
        user_id: session.user.id,
        label: label.trim(),
        esfera,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        inegociavel,
        dias_semana: [...dias].sort(),
        ativo: true,
      })

      if (error) throw error
      onSaved()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-white rounded-2xl shadow-xl overflow-hidden">

        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: '#1B2A4A' }}>
          <span className="text-sm font-bold text-white">Novo bloco</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={salvar} className="px-5 py-4 space-y-4">

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nome do bloco</label>
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Reunião com cliente"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Esfera</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ESFERAS.map(ef => (
                <button
                  key={ef.id}
                  type="button"
                  onClick={() => setEsfera(ef.id)}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all"
                  style={esfera === ef.id
                    ? { background: ef.cor + '20', color: ef.cor, border: `1.5px solid ${ef.cor}` }
                    : { background: '#f9fafb', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                  }
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ef.cor }} />
                  {ef.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Início</label>
              <input
                type="time"
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fim</label>
              <input
                type="time"
                value={horaFim}
                onChange={e => setHoraFim(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Dias da semana</label>
            <div className="flex gap-1">
              {DIAS_SEMANA.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all"
                  style={dias.includes(i)
                    ? { background: (esfCfg?.cor ?? '#1B2A4A') + '20', color: esfCfg?.cor ?? '#1B2A4A', border: `1.5px solid ${esfCfg?.cor ?? '#1B2A4A'}` }
                    : { background: '#f9fafb', color: '#9ca3af', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setInegociavel(v => !v)}>
            <div
              className="w-9 h-5 rounded-full transition-colors flex-shrink-0 relative"
              style={{ background: inegociavel ? '#1B2A4A' : '#e5e7eb' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: inegociavel ? 'translateX(16px)' : 'translateX(2px)' }}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Inegociável</p>
              <p className="text-xs text-gray-400">Não pode ser movido da grade</p>
            </div>
          </label>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#1B2A4A' }}
            >
              {salvando ? 'Salvando…' : 'Salvar bloco'}
            </button>
          </div>

        </form>
      </div>
    </>
  )
}
