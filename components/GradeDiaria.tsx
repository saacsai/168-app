'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { type BlocoParaModal } from './BlocoModal'

type BlocoFixo = {
  id: string
  label: string
  esfera: string
  hora_inicio: string
  hora_fim: string
  inegociavel: boolean
}

type CalendarEvento = {
  id: string
  titulo: string
  hora_inicio: string
  hora_fim: string
}

function eventosParaHora(eventos: CalendarEvento[], h: number): CalendarEvento[] {
  return eventos.filter(e => {
    const ini = minutos(e.hora_inicio)
    const fim = minutos(e.hora_fim)
    return ini <= h * 60 + 59 && fim > h * 60
  })
}

function duracaoMin(horaInicio: string, horaFim: string): number {
  const [hi, mi] = horaInicio.split(':').map(Number)
  const [hf, mf] = horaFim.split(':').map(Number)
  return (hf * 60 + mf) - (hi * 60 + mi)
}

const ESFERA: Record<string, { cor: string; nome: string }> = {
  sono:           { cor: '#374151', nome: 'SONO' },
  cuidar_mim:     { cor: '#15803d', nome: 'CUIDAR DE MIM' },
  cuidar_familia: { cor: '#1d4ed8', nome: 'FAMÍLIA' },
  trabalho:       { cor: '#c2410c', nome: 'TRABALHO' },
  patrimonio:     { cor: '#a16207', nome: 'PATRIMÔNIO' },
  ocio_criativo:  { cor: '#7e22ce', nome: 'ÓCIO CRIATIVO' },
}

const LEGENDA_ESFERAS = [
  'cuidar_mim', 'trabalho', 'cuidar_familia', 'patrimonio', 'ocio_criativo',
]

function minutos(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function blocoParaHora(blocos: BlocoFixo[], h: number): BlocoFixo | null {
  return (
    blocos.find(b => {
      const ini = minutos(b.hora_inicio)
      const fim = minutos(b.hora_fim)
      return ini <= h * 60 + 59 && fim > h * 60
    }) ?? null
  )
}

// Horas visíveis: 06h-23h (são é mostrado colapsado no topo)
const HORA_INICIO_GRADE = 6
const HORAS_GRADE = Array.from({ length: 24 - HORA_INICIO_GRADE }, (_, i) => i + HORA_INICIO_GRADE)

interface Props {
  timerBlocoId?: string
  onBlocoClick?: (bloco: BlocoParaModal) => void
  onSlotClick?: (hora: number) => void
  refreshKey?: number
}

const ROW_HEIGHT = 44

export default function GradeDiaria({ timerBlocoId, onBlocoClick, onSlotClick, refreshKey }: Props) {
  const [blocos, setBlocos] = useState<BlocoFixo[]>([])
  const [eventosCalendar, setEventosCalendar] = useState<CalendarEvento[]>([])
  const [debugCal, setDebugCal] = useState<string>('aguardando...')
  const [sonoExpanded, setSonoExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const horaAtual = agora.getHours()
  const minutoAtual = agora.getMinutes()

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      setDebugCal(`session: ${session ? session.user.email + ' | token: ' + (session.provider_token ? 'sim' : 'nao') : 'null'}`)
      if (!session) { setLoading(false); return }

      const hoje = new Date().getDay()
      const { data } = await supabase
        .from('blocos_fixos')
        .select('id, label, esfera, hora_inicio, hora_fim, inegociavel')
        .eq('user_id', session.user.id)
        .eq('ativo', true)
        .contains('dias_semana', [hoje])
        .order('hora_inicio')

      if (data) setBlocos(data)

      // Busca eventos de TODOS os calendários do usuário (primary + secundários)
      const providerToken = session?.provider_token
      if (!providerToken) {
        setDebugCal('sem provider_token — login Google necessário')
      } else {
        try {
          const res = await fetch('/api/calendar/eventos', {
            headers: { 'x-provider-token': providerToken },
          })
          const json = await res.json()
          if (!res.ok) {
            setDebugCal(`erro API: ${json.error ?? res.status} | ${json.detail ?? ''}`.slice(0, 120))
          } else {
            setDebugCal(`${json.calendarios} cals · ${json.eventos.length} eventos`)
            setEventosCalendar(json.eventos)
          }
        } catch (err) {
          setDebugCal(`erro fetch: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      setLoading(false)
    }
    load()
  }, [refreshKey])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">Carregando grade…</p>
      </div>
    )
  }

  const blocosSono = blocos.filter(b => b.esfera === 'sono')
  const totalBlocos = blocos.filter(b => b.esfera !== 'sono').length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Grade do dia</h2>
          <span className="text-xs text-gray-400">
            {totalBlocos === 0
              ? 'sem blocos fixos'
              : `${totalBlocos} bloco${totalBlocos !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Debug Calendar — remover depois */}
        {debugCal && (
          <div className="mt-1 text-[10px] text-gray-400 font-mono truncate" title={debugCal}>
            📅 {debugCal}
          </div>
        )}

        {/* Legenda de esferas */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
          {LEGENDA_ESFERAS.map(e => (
            <span key={e} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: ESFERA[e].cor }}
              />
              <span className="text-[10px] text-gray-400">{ESFERA[e].nome}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bloco SONO colapsado (00h → 06h) */}
      <button
        onClick={() => setSonoExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
        style={{ borderLeft: '3px solid #37415140', borderBottom: '1px solid #f3f4f6' }}
      >
        <span className="text-xs font-mono text-gray-300 w-8">00h</span>
        <span
          className="text-[10px] font-bold tracking-wide"
          style={{ color: '#374151' }}
        >
          SONO
        </span>
        <span className="text-xs text-gray-400">
          {blocosSono.length > 0
            ? `${blocosSono[0].label} · 8h`
            : '22h → 06h · 8 horas'}
        </span>
        <span className="ml-auto text-gray-300 text-xs">
          {sonoExpanded ? '▴' : '▾'}
        </span>
      </button>

      {/* Horas de sono expandidas */}
      {sonoExpanded && (
        <div className="divide-y divide-gray-50">
          {Array.from({ length: HORA_INICIO_GRADE }, (_, h) => {
            const bloco = blocoParaHora(blocos, h)
            const cfg = bloco ? (ESFERA[bloco.esfera] ?? null) : null
            return (
              <div key={h} className="flex items-stretch" style={{ minHeight: '36px' }}>
                <div className="flex items-center w-12 flex-shrink-0 px-3">
                  <span className="text-xs font-mono text-gray-200">
                    {String(h).padStart(2, '0')}h
                  </span>
                </div>
                {cfg && bloco ? (
                  <div
                    className="flex-1 flex items-center gap-2 px-3 py-1.5"
                    style={{ backgroundColor: cfg.cor + '12', borderLeft: `3px solid ${cfg.cor}` }}
                  >
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: cfg.cor }}>
                      {cfg.nome}
                    </span>
                    <span className="text-xs text-gray-500 truncate">{bloco.label}</span>
                  </div>
                ) : (
                  <div className="flex-1 px-3 py-1.5" style={{ borderLeft: '3px solid transparent' }}>
                    <span className="text-xs" style={{ color: '#e5e7eb' }}>sono</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Grade principal: 06h → 23h */}
      <div className="divide-y divide-gray-50 relative">

        {/* Indicador de hora atual */}
        {horaAtual >= HORA_INICIO_GRADE && horaAtual < 24 && (
          <div
            className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
            style={{ top: `${(horaAtual - HORA_INICIO_GRADE) * ROW_HEIGHT + (minutoAtual / 60) * ROW_HEIGHT}px` }}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0 ml-1" style={{ background: '#ef4444' }} />
            <div className="flex-1 h-px" style={{ background: '#ef4444' }} />
          </div>
        )}

        {HORAS_GRADE.map(h => {
          const bloco = blocoParaHora(blocos, h)
          const cfg = bloco ? (ESFERA[bloco.esfera] ?? null) : null
          const isNow = h === horaAtual
          const isAtivo = bloco?.id === timerBlocoId
          const eventos = eventosParaHora(eventosCalendar, h)
          const temCalendar = eventos.length > 0

          function handleClick() {
            if (!bloco || bloco.esfera === 'sono') {
              if (!bloco) onSlotClick?.(h)
              return
            }
            onBlocoClick?.({
              id: bloco.id,
              label: bloco.label,
              esfera: bloco.esfera,
              hora_inicio: bloco.hora_inicio,
              hora_fim: bloco.hora_fim,
              inegociavel: bloco.inegociavel,
              duracaoMin: duracaoMin(bloco.hora_inicio, bloco.hora_fim),
            })
          }

          return (
            <div
              key={h}
              className="group flex items-stretch cursor-pointer"
              style={{
                height: `${ROW_HEIGHT}px`,
                borderLeft: isNow ? '3px solid #1B2A4A' : '3px solid transparent',
                background: isNow && !bloco ? 'rgba(27,42,74,0.025)' : undefined,
              }}
              onClick={handleClick}
            >
              {/* Hora */}
              <div className="flex items-center w-12 flex-shrink-0 px-3">
                <span
                  className="text-xs font-mono"
                  style={{
                    color: isNow ? '#1B2A4A' : '#d1d5db',
                    fontWeight: isNow ? 700 : 400,
                  }}
                >
                  {String(h).padStart(2, '0')}h
                </span>
              </div>

              {/* Conteúdo */}
              {cfg && bloco ? (
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2 transition-opacity"
                  style={{
                    backgroundColor: isAtivo ? cfg.cor + '28' : cfg.cor + '18',
                    borderLeft: `3px solid ${cfg.cor}`,
                  }}
                >
                  {isAtivo && (
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: cfg.cor }} />
                  )}
                  <span className="text-[10px] font-bold tracking-wide flex-shrink-0" style={{ color: cfg.cor }}>
                    {cfg.nome}
                  </span>
                  <span className="text-xs text-gray-700 truncate">{bloco.label}</span>
                  {temCalendar && (
                    <span
                      className="ml-auto flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: '#1a73e815', color: '#1a73e8' }}
                      title={eventos.map(e => e.titulo).join(', ')}
                    >
                      📅 {eventos[0].titulo.length > 14 ? eventos[0].titulo.slice(0, 14) + '…' : eventos[0].titulo}
                    </span>
                  )}
                  {bloco.inegociavel && !temCalendar && (
                    <span className="ml-auto flex-shrink-0 text-[9px] text-gray-300 font-medium tracking-wide">
                      FIXO
                    </span>
                  )}
                </div>
              ) : temCalendar ? (
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2"
                  style={{ backgroundColor: '#1a73e812', borderLeft: '3px solid #1a73e8' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#1a73e8" className="flex-shrink-0">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                  </svg>
                  <span className="text-xs font-medium truncate" style={{ color: '#1a73e8' }}>
                    {eventos[0].titulo}
                  </span>
                  {eventos.length > 1 && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: '#1a73e880' }}>
                      +{eventos.length - 1}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className="flex-1 flex items-center justify-between px-3 py-2"
                  style={{ borderLeft: '3px solid transparent' }}
                >
                  <span className="text-xs" style={{ color: '#e5e7eb' }}>livre</span>
                  <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    + adicionar
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
