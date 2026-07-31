'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Props {
  onVoltar: () => void
}

const CICLOS: Record<string, Array<{ id: string; label: string; valor: string; valorTotal: string; equivalente: string; creditos: string; detalhe: string }>> = {
  essencial: [
    { id: 'essencial_mensal',      label: 'Mensal',      valor: 'R$ 97/mês',     valorTotal: 'R$ 97,00',     equivalente: 'R$ 97/mês',   creditos: '3.000 créditos/mês',  detalhe: 'Cancele quando quiser' },
    { id: 'essencial_trimestral',  label: 'Trimestral',  valor: 'R$ 247/trim',   valorTotal: 'R$ 247,00',    equivalente: 'R$ 82/mês',   creditos: '3.000 créditos/mês',  detalhe: 'Cobrado a cada 3 meses' },
    { id: 'essencial_anual',       label: 'Anual',       valor: 'R$ 870/ano',    valorTotal: 'R$ 870,00',    equivalente: 'R$ 72/mês',   creditos: '3.000 créditos/mês',  detalhe: 'Cobrado uma vez por ano' },
  ],
  profissional: [
    { id: 'profissional_mensal',   label: 'Mensal',      valor: 'R$ 197/mês',    valorTotal: 'R$ 197,00',    equivalente: 'R$ 197/mês',  creditos: '8.000 créditos/mês',  detalhe: 'Cancele quando quiser' },
    { id: 'profissional_trimestral', label: 'Trimestral', valor: 'R$ 497/trim',  valorTotal: 'R$ 497,00',    equivalente: 'R$ 166/mês',  creditos: '8.000 créditos/mês',  detalhe: 'Cobrado a cada 3 meses' },
    { id: 'profissional_anual',    label: 'Anual',       valor: 'R$ 1.770/ano',  valorTotal: 'R$ 1.770,00',  equivalente: 'R$ 148/mês',  creditos: '8.000 créditos/mês',  detalhe: 'Cobrado uma vez por ano' },
  ],
  executivo: [
    { id: 'executivo_mensal',      label: 'Mensal',      valor: 'R$ 397/mês',    valorTotal: 'R$ 397,00',    equivalente: 'R$ 397/mês',  creditos: '20.000 créditos/mês', detalhe: 'Cancele quando quiser' },
    { id: 'executivo_trimestral',  label: 'Trimestral',  valor: 'R$ 997/trim',   valorTotal: 'R$ 997,00',    equivalente: 'R$ 332/mês',  creditos: '20.000 créditos/mês', detalhe: 'Cobrado a cada 3 meses' },
    { id: 'executivo_anual',       label: 'Anual',       valor: 'R$ 3.570/ano',  valorTotal: 'R$ 3.570,00',  equivalente: 'R$ 298/mês',  creditos: '20.000 créditos/mês', detalhe: 'Cobrado uma vez por ano' },
  ],
}

const AVULSO = [
  { id: 'avulso_1000', creditos: '1.000 créditos', valor: 'R$ 47,00',  detalhe: 'R$ 47 por 1.000 créditos' },
  { id: 'avulso_3000', creditos: '3.000 créditos', valor: 'R$ 127,00', detalhe: 'R$ 42 por 1.000 créditos' },
  { id: 'avulso_5000', creditos: '5.000 créditos', valor: 'R$ 197,00', detalhe: 'R$ 39 por 1.000 créditos' },
]

const INCLUSOS = [
  'Assistente IA com nome e personalidade customizáveis',
  'Prioridade de contatos com score automático',
  'Digest diário de mensagens acumuladas',
  'PAUSE MODE para silenciar respostas',
]

type Plano = 'essencial' | 'profissional' | 'executivo'
type Etapa = 'plano' | 'ciclo' | 'confirmar' | 'avulso'

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

function PortalButton({ accessToken }: { accessToken: string }) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handlePortal() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || `Erro ${res.status}`); return }
      if (json.url) window.location.href = json.url
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePortal}
        disabled={loading}
        className="w-full text-center text-sm font-medium border border-gray-300 text-gray-700 rounded-xl py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Aguarde…' : 'Gerenciar assinatura →'}
      </button>
      {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
    </div>
  )
}

export default function GerenciarPlanoPage({ onVoltar }: Props) {
  const [planoAtivo, setPlanoAtivo] = useState<string>('gratuito')
  const [accessToken, setAccessToken] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('plano')
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano>('essencial')
  const [cicloSelecionado, setCicloSelecionado] = useState('essencial_mensal')
  const [avulsoSelecionado, setAvulsoSelecionado] = useState('avulso_3000')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setAccessToken(session.access_token)
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .single()
      if (data) setPlanoAtivo(data.plan)
    }
    load()
  }, [])

  const isPago = ['essencial', 'profissional', 'executivo'].includes(planoAtivo)
  const cicloAtual = CICLOS[planoSelecionado].find(c => c.id === cicloSelecionado)!

  async function handleUpgrade() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: cicloSelecionado }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || `Erro ${res.status}`); return }
      if (json.url) window.location.href = json.url
      else setErro(json.error || 'URL não retornada.')
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleAvulso() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: avulsoSelecionado }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || `Erro ${res.status}`); return }
      if (json.url) window.location.href = json.url
      else setErro(json.error || 'URL não retornada.')
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  function selecionarPlano(id: Plano) {
    setPlanoSelecionado(id)
    setCicloSelecionado(`${id}_mensal`)
    setEtapa('ciclo')
  }

  function voltarEtapa() {
    if (etapa === 'confirmar') { setEtapa('ciclo'); return }
    if (etapa === 'ciclo') { setEtapa('plano'); return }
    if (etapa === 'avulso') { setEtapa('plano'); return }
    onVoltar()
  }

  const nomeExibicao: Record<Plano, string> = {
    essencial: 'Essencial',
    profissional: 'Profissional',
    executivo: 'Executivo',
  }

  const tituloHeader: Record<Etapa, string> = {
    plano: 'Planos',
    ciclo: `${nomeExibicao[planoSelecionado]} — escolha o ciclo`,
    confirmar: 'Confirmar assinatura',
    avulso: 'Comprar créditos avulsos',
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={voltarEtapa} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <IconBack /> Voltar
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <h1 className="text-xl font-bold text-gray-900">{tituloHeader[etapa]}</h1>
      </div>

      {isPago && etapa === 'plano' && (
        <div className="mb-6 space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
            <span>✓</span>
            <span>Você tem o plano <strong>{planoAtivo}</strong> ativo.</span>
          </div>
          <PortalButton accessToken={accessToken} />
        </div>
      )}

      {/* ETAPA 1 — Escolher plano */}
      {etapa === 'plano' && (
        <>
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Incluso em todos os planos pagos</p>
            <ul className="space-y-1.5">
              {INCLUSOS.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {!isPago && (
              <div className="px-5 py-4 rounded-xl border-2 border-green-400 bg-green-50 relative">
                <span className="absolute top-3 right-3 text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full">✓ seu plano atual</span>
                <div className="font-semibold text-gray-900">Plano Trial</div>
                <div className="text-sm text-gray-500 mt-0.5">1.000 créditos de teste — sem assinatura</div>
              </div>
            )}

            {(['essencial', 'profissional', 'executivo'] as Plano[]).map(plano => {
              const credMap: Record<Plano, string> = {
                essencial: '3.000 créditos/mês · a partir de R$ 97/mês',
                profissional: '8.000 créditos/mês · a partir de R$ 197/mês',
                executivo: '20.000 créditos/mês · a partir de R$ 397/mês',
              }
              const isAtivo = planoAtivo === plano
              return (
                <button
                  key={plano}
                  onClick={() => !isAtivo && selecionarPlano(plano)}
                  disabled={isAtivo}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors relative ${
                    isAtivo
                      ? 'border-green-400 bg-green-50 cursor-default'
                      : 'border-gray-200 cursor-pointer'
                  }`}
                  style={!isAtivo ? { '--primary': PRIMARY } as React.CSSProperties : undefined}
                >
                  {isAtivo && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full">✓ ativo</span>
                  )}
                  {!isPago && plano === 'profissional' && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: PRIMARY }}>mais popular</span>
                  )}
                  <div className="font-semibold text-gray-900">{nomeExibicao[plano]}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{credMap[plano]}</div>
                  {!isAtivo && <div className="text-xs mt-2" style={{ color: PRIMARY }}>Ver opções de pagamento →</div>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Link para créditos avulsos */}
      {etapa === 'plano' && (
        <div className="mt-5 pt-4 border-t border-gray-100 text-center">
          <button
            onClick={() => setEtapa('avulso')}
            className="text-sm hover:underline"
            style={{ color: PRIMARY }}
          >
            Precisa de mais créditos? Comprar créditos avulsos →
          </button>
        </div>
      )}

      {/* ETAPA AVULSO — Créditos avulsos */}
      {etapa === 'avulso' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Créditos avulsos não expiram e são somados ao seu saldo atual.
          </p>
          {AVULSO.map(op => (
            <button
              key={op.id}
              onClick={() => setAvulsoSelecionado(op.id)}
              className="w-full text-left px-5 py-4 rounded-xl border-2 transition-colors"
              style={{
                borderColor: avulsoSelecionado === op.id ? PRIMARY : '#e5e7eb',
                backgroundColor: avulsoSelecionado === op.id ? `${PRIMARY}0d` : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{op.creditos}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{op.detalhe}</div>
                </div>
                <div className="text-base font-bold text-gray-900">{op.valor}</div>
              </div>
            </button>
          ))}

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}

          <button
            onClick={handleAvulso}
            disabled={loading}
            className="w-full text-center text-sm font-medium text-white rounded-xl py-3 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? 'Aguarde…' : 'Comprar agora →'}
          </button>
        </div>
      )}

      {/* ETAPA 2 — Escolher ciclo */}
      {etapa === 'ciclo' && (
        <div className="space-y-3">
          {CICLOS[planoSelecionado].map(op => (
            <button
              key={op.id}
              onClick={() => setCicloSelecionado(op.id)}
              className="w-full text-left px-5 py-4 rounded-xl border-2 transition-colors"
              style={{
                borderColor: cicloSelecionado === op.id ? PRIMARY : '#e5e7eb',
                backgroundColor: cicloSelecionado === op.id ? `${PRIMARY}0d` : 'transparent',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{op.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{op.detalhe}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 text-sm">{op.valor}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{op.equivalente}</div>
                </div>
              </div>
              <div className="mt-2 text-xs font-medium" style={{ color: PRIMARY }}>{op.creditos}</div>
            </button>
          ))}

          <button
            onClick={() => setEtapa('confirmar')}
            className="w-full text-center text-sm font-medium text-white rounded-xl py-3 mt-2 transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ETAPA 3 — Confirmar */}
      {etapa === 'confirmar' && (
        <div className="space-y-5">
          <div className="border border-gray-200 rounded-xl p-5 space-y-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Plano {nomeExibicao[planoSelecionado]} — {cicloAtual.label}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{cicloAtual.detalhe}</div>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Total cobrado agora</span>
              <span className="text-base font-bold text-gray-900">{cicloAtual.valorTotal}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p>Sua assinatura começará imediatamente.</p>
            <p>{cicloAtual.creditos} serão liberados e renovados automaticamente.</p>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Ao clicar em &ldquo;Autorizar e pagar&rdquo;, você autoriza a SAACS a cobrar do seu cartão o valor de{' '}
            <strong>{cicloAtual.valorTotal}</strong> agora e de forma recorrente até que a assinatura seja cancelada.
            Você pode cancelar a qualquer momento.
          </p>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full text-center text-sm font-medium text-white rounded-xl py-3 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? 'Aguarde…' : 'Autorizar e pagar →'}
          </button>
        </div>
      )}
    </div>
  )
}
