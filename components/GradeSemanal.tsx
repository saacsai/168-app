'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

// ─── tipos ───────────────────────────────────────────────────────────────────

type BlocoFixo = {
  id: string
  label: string
  esfera: string
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
  inegociavel: boolean
}

type Compromisso = {
  id: string
  titulo: string
  tipo: string
  data_hora_inicio: string
  data_hora_fim: string
  link?: string
  // derivado
  diaSemana: number
  hora_inicio: string
  hora_fim: string
}

// ─── constantes ──────────────────────────────────────────────────────────────

const HORA_INI = 0
const HORAS = Array.from({ length: 24 }, (_, i) => i) // 0 → 23
const ROW_H = 36 // px por hora
const COL_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ESFERA_COR: Record<string, string> = {
  sono:           '#374151',
  cuidar_mim:     '#15803d',
  cuidar_familia: '#1d4ed8',
  trabalho:       '#c2410c',
  patrimonio:     '#a16207',
  ocio_criativo:  '#7e22ce',
}

const LEGENDA = [
  { key: 'sono',           label: 'SONO' },
  { key: 'cuidar_mim',     label: 'CUIDAR MIM' },
  { key: 'trabalho',       label: 'TRABALHO' },
  { key: 'cuidar_familia', label: 'FAMÍLIA' },
  { key: 'patrimonio',     label: 'PATRIMÔNIO' },
  { key: 'ocio_criativo',  label: 'ÓCIO' },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function min(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function isoParaHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Domingo da semana que contém `ref`, deslocado por `offset` semanas
function inicioSemana(ref: Date, offset: number): Date {
  const d = new Date(ref)
  d.setDate(d.getDate() - d.getDay() + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function diasDaSemana(ini: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ini)
    d.setDate(d.getDate() + i)
    return d
  })
}

function blocoNaHoraH(b: BlocoFixo, h: number): boolean {
  const ini = min(b.hora_inicio)
  const fim = min(b.hora_fim)
  if (fim > ini) {
    return ini <= h * 60 + 59 && fim > h * 60
  } else {
    // overnight (ex: 22h→06h)
    return h * 60 >= ini || (h + 1) * 60 <= fim
  }
}

function blocoNaHora(blocos: BlocoFixo[], diaSemana: number, h: number): BlocoFixo | null {
  return blocos.find(b => {
    if (!b.dias_semana.includes(diaSemana)) return false
    return blocoNaHoraH(b, h)
  }) ?? null
}

function compromissosNaHora(comps: Compromisso[], diaSemana: number, h: number): Compromisso[] {
  return comps.filter(c => {
    if (c.diaSemana !== diaSemana) return false
    const ini = min(c.hora_inicio)
    const fim = min(c.hora_fim)
    return ini <= h * 60 + 59 && fim > h * 60
  })
}

// ─── componente ──────────────────────────────────────────────────────────────

export default function GradeSemanal() {
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [blocos, setBlocos] = useState<BlocoFixo[]>([])
  const [compromissos, setCompromissos] = useState<Compromisso[]>([])
  const [loading, setLoading] = useState(true)
  const [agora] = useState(() => new Date())

  const iniSemana = inicioSemana(agora, semanaOffset)
  const dias = diasDaSemana(iniSemana)
  const fimSemana = new Date(iniSemana)
  fimSemana.setDate(fimSemana.getDate() + 7)

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      // Blocos fixos — todos os dias da semana
      const { data: bData } = await supabase
        .from('blocos_fixos')
        .select('id, label, esfera, hora_inicio, hora_fim, dias_semana, inegociavel')
        .eq('user_id', session.user.id)
        .eq('ativo', true)
        .order('hora_inicio')

      if (bData) setBlocos(bData)

      // Compromissos da semana
      const { data: cData } = await supabase
        .from('compromissos')
        .select('id, titulo, tipo, data_hora_inicio, data_hora_fim, link')
        .eq('user_id', session.user.id)
        .gte('data_hora_inicio', iniSemana.toISOString())
        .lt('data_hora_inicio', fimSemana.toISOString())
        .neq('status', 'cancelado')
        .order('data_hora_inicio')

      if (cData) {
        setCompromissos(cData.map(c => ({
          ...c,
          diaSemana: new Date(c.data_hora_inicio).getDay(),
          hora_inicio: isoParaHHMM(c.data_hora_inicio),
          hora_fim:    isoParaHHMM(c.data_hora_fim),
        })))
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaOffset])

  // Label da semana no header
  const mesRef = iniSemana.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function diaStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

      {/* ── Header de navegação ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button
          onClick={() => setSemanaOffset(o => o - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
        >
          ‹
        </button>

        <div className="text-center">
          <p className="text-sm font-bold text-gray-900 capitalize">{mesRef}</p>
          <p className="text-[10px] text-gray-400">
            {dias[0].getDate()}/{String(dias[0].getMonth()+1).padStart(2,'0')} → {dias[6].getDate()}/{String(dias[6].getMonth()+1).padStart(2,'0')}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {semanaOffset !== 0 && (
            <button
              onClick={() => setSemanaOffset(0)}
              className="text-[10px] px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 font-medium"
            >
              Hoje
            </button>
          )}
          <button
            onClick={() => setSemanaOffset(o => o + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Carregando grade…</div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 560 }}>

            {/* ── Cabeçalho dos dias ── */}
            <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
              <div />
              {dias.map((d, i) => {
                const isHoje = diaStr(d) === hojeStr
                return (
                  <div
                    key={i}
                    className="py-2 text-center border-l border-gray-100"
                    style={{ background: isHoje ? '#1B2A4A08' : undefined }}
                  >
                    <p
                      className="text-[10px] font-bold tracking-wide"
                      style={{ color: isHoje ? '#1B2A4A' : '#9ca3af' }}
                    >
                      {COL_DIA[i]}
                    </p>
                    <p
                      className="text-sm font-bold mt-0.5"
                      style={{ color: isHoje ? '#1B2A4A' : '#374151' }}
                    >
                      {d.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* ── Grade horária ── */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              {HORAS.map(h => {
                const isHoraAtual = semanaOffset === 0 && h === hoje.getHours()
                return (
                  <div
                    key={h}
                    className="grid border-b border-gray-50"
                    style={{
                      gridTemplateColumns: '40px repeat(7, 1fr)',
                      height: ROW_H,
                      background: isHoraAtual ? 'rgba(27,42,74,0.025)' : undefined,
                    }}
                  >
                    {/* Hora */}
                    <div className="flex items-center justify-end pr-2">
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: isHoraAtual ? '#1B2A4A' : '#d1d5db', fontWeight: isHoraAtual ? 700 : 400 }}
                      >
                        {String(h).padStart(2, '0')}h
                      </span>
                    </div>

                    {/* 7 colunas de dias */}
                    {dias.map((d, di) => {
                      const diaSemana = d.getDay()
                      const isHoje = diaStr(d) === hojeStr
                      const bloco = blocoNaHora(blocos, diaSemana, h)
                      const comps = compromissosNaHora(compromissos, diaSemana, h)
                      const cor = bloco ? (ESFERA_COR[bloco.esfera] ?? '#6b7280') : null

                      return (
                        <div
                          key={di}
                          className="border-l border-gray-100 relative overflow-hidden flex items-center px-1"
                          style={{ background: isHoje && !bloco && comps.length === 0 ? '#1B2A4A05' : undefined }}
                        >
                          {bloco && cor ? (
                            <div
                              className="absolute inset-0 flex items-center px-1.5"
                              style={{ background: cor + '18', borderLeft: `2px solid ${cor}` }}
                            >
                              <span
                                className="text-[9px] font-bold truncate leading-tight"
                                style={{ color: cor }}
                                title={bloco.label}
                              >
                                {bloco.label.length > 10 ? bloco.label.slice(0, 10) + '…' : bloco.label}
                              </span>
                              {comps.length > 0 && (
                                <span
                                  className="ml-auto flex-shrink-0 text-[8px] font-bold px-1 rounded"
                                  style={{ background: '#ea580c20', color: '#ea580c' }}
                                  title={comps[0].titulo}
                                >
                                  🗓
                                </span>
                              )}
                            </div>
                          ) : comps.length > 0 ? (
                            <div
                              className="absolute inset-0 flex items-center px-1.5"
                              style={{ background: '#ea580c10', borderLeft: '2px solid #ea580c' }}
                            >
                              <span
                                className="text-[9px] font-bold truncate"
                                style={{ color: '#ea580c' }}
                                title={comps[0].titulo}
                              >
                                {comps[0].titulo.length > 10 ? comps[0].titulo.slice(0, 10) + '…' : comps[0].titulo}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      )}

      {/* ── Legenda ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 border-t border-gray-100">
        {LEGENDA.map(e => (
          <span key={e.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESFERA_COR[e.key] }} />
            <span className="text-[10px] text-gray-400">{e.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ea580c' }} />
          <span className="text-[10px] text-gray-400">COMPROMISSO</span>
        </span>
      </div>
    </div>
  )
}
