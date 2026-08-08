'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const ESFERA_COR: Record<string, string> = {
  cuidar_mim:     '#15803d',
  cuidar_familia: '#1d4ed8',
  trabalho:       '#c2410c',
  patrimonio:     '#a16207',
  ocio_criativo:  '#7e22ce',
  sono:           '#374151',
}

export type ExecucaoFinalizada = {
  id: string
  label: string
  esfera: string
  duracaoRealMin: number
  overtimeMin: number
}

interface Props {
  execucao: ExecucaoFinalizada | null
  onClose: () => void
}

const SLEEP_QUALITY = [
  { value: 1, emoji: '😴', label: 'Muito mal' },
  { value: 2, emoji: '😞', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Regular' },
  { value: 4, emoji: '🙂', label: 'Bem' },
  { value: 5, emoji: '🌟', label: 'Excelente' },
]

export default function ResumoModal({ execucao, onClose }: Props) {
  const [resumo, setResumo] = useState('')
  const [sonoQualidade, setSonoQualidade] = useState(0)
  const [encaminhamentos, setEncaminhamentos] = useState<string[]>([])
  const [inputEnc, setInputEnc] = useState('')
  const [salvando, setSalvando] = useState(false)

  if (!execucao) return null

  const ehSono = execucao.esfera === 'sono'
  const cor = ESFERA_COR[execucao.esfera] ?? '#1B2A4A'

  function adicionarEnc() {
    const texto = inputEnc.trim()
    if (!texto) return
    setEncaminhamentos(prev => [...prev, texto])
    setInputEnc('')
  }

  async function salvar() {
    if (!execucao) return
    setSalvando(true)
    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('sem sessão')

      const resumoFinal = ehSono && sonoQualidade > 0
        ? `Qualidade: ${sonoQualidade}/5 — ${SLEEP_QUALITY.find(q => q.value === sonoQualidade)?.label ?? ''}${resumo.trim() ? ` · ${resumo.trim()}` : ''}`
        : resumo.trim()

      if (resumoFinal) {
        await supabase
          .from('execucao_bloco')
          .update({ resumo: resumoFinal })
          .eq('id', execucao.id)
      }

      if (encaminhamentos.length > 0) {
        await supabase.from('action_items').insert(
          encaminhamentos.map(label => ({
            user_id: session.user.id,
            label,
            esfera: execucao.esfera,
            origem: 'bloco',
            execucao_origem_id: execucao.id,
          }))
        )
      }
    } catch {
      // silencioso — não bloqueia o fechamento
    } finally {
      setSalvando(false)
      onClose()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-white rounded-2xl shadow-xl overflow-hidden">

        <div className="px-5 py-4 border-b" style={{ borderColor: cor + '40', background: cor + '10' }}>
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: cor }}>
            {ehSono ? 'Sono registrado' : 'Bloco finalizado'}
          </p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{execucao.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {execucao.duracaoRealMin >= 60
              ? `${Math.floor(execucao.duracaoRealMin / 60)}h${execucao.duracaoRealMin % 60 > 0 ? ` ${execucao.duracaoRealMin % 60}min` : ''} realizados`
              : `${execucao.duracaoRealMin} min realizados`
            }
            {!ehSono && execucao.overtimeMin > 0 && (
              <span className="text-red-500 ml-1.5">· +{execucao.overtimeMin} min além do previsto</span>
            )}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">

          {ehSono ? (
            /* ── Qualidade do sono ── */
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Como você dormiu?</label>
              <div className="flex gap-2">
                {SLEEP_QUALITY.map(q => (
                  <button
                    key={q.value}
                    onClick={() => setSonoQualidade(q.value)}
                    className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-all text-center"
                    style={{
                      borderColor: sonoQualidade === q.value ? cor : '#e5e7eb',
                      background: sonoQualidade === q.value ? cor + '15' : undefined,
                    }}
                    title={q.label}
                  >
                    <span className="text-lg">{q.emoji}</span>
                    <span className="text-[9px] text-gray-400 leading-tight">{q.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={resumo}
                onChange={e => setResumo(e.target.value)}
                placeholder="Observações (opcional)…"
                rows={2}
                className="w-full mt-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder-gray-300 resize-none"
              />
            </div>
          ) : (
            /* ── Resumo bloco normal ── */
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">O que foi feito?</label>
              <textarea
                autoFocus
                value={resumo}
                onChange={e => setResumo(e.target.value)}
                placeholder="Resumo do que aconteceu neste bloco…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder-gray-300 resize-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Encaminhamentos</label>

            {encaminhamentos.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {encaminhamentos.map((enc, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: cor + '12' }}>
                    <span className="text-xs text-gray-700 flex-1">📌 {enc}</span>
                    <button
                      onClick={() => setEncaminhamentos(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-gray-500 text-base leading-none flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={inputEnc}
                onChange={e => setInputEnc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEnc() } }}
                placeholder="Adicionar encaminhamento… (Enter)"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 placeholder-gray-300"
              />
              <button
                onClick={adicionarEnc}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0 transition-colors"
                style={{ background: inputEnc.trim() ? cor : '#e5e7eb' }}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600"
            >
              Pular
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: cor }}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
