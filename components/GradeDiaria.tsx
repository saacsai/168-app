'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type BlocoFixo = {
  id: string
  label: string
  esfera: string
  hora_inicio: string
  hora_fim: string
  inegociavel: boolean
}

const ESFERA: Record<string, { cor: string; nome: string }> = {
  sono:           { cor: '#374151', nome: 'SONO' },
  cuidar_mim:     { cor: '#15803d', nome: 'CUIDAR DE MIM' },
  cuidar_familia: { cor: '#1d4ed8', nome: 'FAMÍLIA' },
  trabalho:       { cor: '#c2410c', nome: 'TRABALHO' },
  patrimonio:     { cor: '#a16207', nome: 'PATRIMÔNIO' },
  ocio_criativo:  { cor: '#7e22ce', nome: 'ÓCIO CRIATIVO' },
}

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

export default function GradeDiaria() {
  const [blocos, setBlocos] = useState<BlocoFixo[]>([])
  const [loading, setLoading] = useState(true)
  const horaAtual = new Date().getHours()

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
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
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">Carregando grade…</p>
      </div>
    )
  }

  const totalBlocos = blocos.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">Grade do dia</h2>
        <span className="text-xs text-gray-400">
          {totalBlocos === 0 ? 'sem blocos fixos' : `${totalBlocos} bloco${totalBlocos > 1 ? 's' : ''} fixo${totalBlocos > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {Array.from({ length: 24 }, (_, h) => {
          const bloco = blocoParaHora(blocos, h)
          const cfg = bloco ? (ESFERA[bloco.esfera] ?? null) : null
          const isNow = h === horaAtual

          return (
            <div
              key={h}
              className="flex items-stretch"
              style={{
                minHeight: '40px',
                borderLeft: isNow ? '3px solid #1B2A4A' : '3px solid transparent',
                background: isNow && !bloco ? 'rgba(27,42,74,0.03)' : undefined,
              }}
            >
              {/* Hora */}
              <div className="flex items-center w-12 flex-shrink-0 px-3">
                <span
                  className="text-xs font-mono"
                  style={{ color: isNow ? '#1B2A4A' : '#d1d5db', fontWeight: isNow ? 700 : 400 }}
                >
                  {String(h).padStart(2, '0')}h
                </span>
              </div>

              {/* Conteúdo */}
              {cfg && bloco ? (
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2"
                  style={{
                    backgroundColor: cfg.cor + '18',
                    borderLeft: `3px solid ${cfg.cor}`,
                  }}
                >
                  <span className="text-[10px] font-bold tracking-wide" style={{ color: cfg.cor }}>
                    {cfg.nome}
                  </span>
                  <span className="text-xs text-gray-700 truncate">{bloco.label}</span>
                  {bloco.inegociavel && (
                    <span className="ml-auto flex-shrink-0 text-[9px] text-gray-300 font-medium tracking-wide">
                      FIXO
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center px-3 py-2" style={{ borderLeft: '3px solid transparent' }}>
                  <span className="text-xs" style={{ color: '#e5e7eb' }}>livre</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
