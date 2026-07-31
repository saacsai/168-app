'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Props {
  onVoltar: () => void
}

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  created_at: string
}

interface UsageDay {
  day: string
  total: number
}

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

function IconCredit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}

export default function UsoCreditsPage({ onVoltar }: Props) {
  const [balance, setBalance] = useState<number | null>(null)
  const [monthlyCredits, setMonthlyCredits] = useState<number | null>(null)
  const [resetAt, setResetAt] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [usageByDay, setUsageByDay] = useState<UsageDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id

      const [balanceRes, subRes, txRes, usageRes] = await Promise.all([
        supabase
          .from('credit_balance')
          .select('balance, reset_at')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('subscriptions')
          .select('monthly_credits')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single(),
        supabase
          .from('credit_transactions')
          .select('id, type, amount, description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('usage_log')
          .select('credits_used, created_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true }),
      ])

      if (balanceRes.data) {
        setBalance(balanceRes.data.balance)
        setResetAt(balanceRes.data.reset_at)
      }

      if (subRes.data) setMonthlyCredits(subRes.data.monthly_credits)

      if (txRes.data) setTransactions(txRes.data)

      if (usageRes.data) {
        const map: Record<string, number> = {}
        for (const row of usageRes.data) {
          const day = row.created_at.slice(0, 10)
          map[day] = (map[day] ?? 0) + (row.credits_used ?? 0)
        }
        const days: UsageDay[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          days.push({ day: key, total: map[key] ?? 0 })
        }
        setUsageByDay(days)
      }

      setLoading(false)
    }
    load()
  }, [])

  const maxDay = Math.max(...usageByDay.map(d => d.total), 1)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <IconBack /> Voltar
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <h1 className="text-xl font-bold text-gray-900">Uso e créditos</h1>
        </div>
        <p className="text-sm text-gray-400">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <IconBack /> Voltar
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <h1 className="text-xl font-bold text-gray-900">Uso e créditos</h1>
      </div>

      {/* Saldo atual */}
      {(() => {
        const pct = (balance !== null && monthlyCredits) ? Math.min(100, Math.round((balance / monthlyCredits) * 100)) : null
        return (
          <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY}, #3d8a9a)` }}>
            <div className="flex items-center gap-2 mb-1 opacity-80">
              <IconCredit />
              <span className="text-sm font-medium">Saldo disponível</span>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold tracking-tight">
                {balance?.toLocaleString('pt-BR') ?? '—'}
              </div>
              {pct !== null && (
                <div className="mb-1 text-lg font-semibold opacity-80">{pct}%</div>
              )}
            </div>
            <div className="text-sm opacity-70 mt-0.5">
              créditos{monthlyCredits ? ` de ${monthlyCredits.toLocaleString('pt-BR')}` : ''}
            </div>
            {pct !== null && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
            {resetAt && (
              <div className="text-xs opacity-60 mt-2">
                Renova em {new Date(resetAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Gráfico de uso — 7 dias */}
      <div className="bg-white rounded-2xl p-5 mb-5 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Uso nos últimos 7 dias</p>
        <div className="flex items-end gap-1.5 h-20">
          {usageByDay.map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(4, (d.total / maxDay) * 72)}px`,
                  backgroundColor: d.total > 0 ? PRIMARY : '#e5e7eb',
                  opacity: d.total > 0 ? 0.85 : 1,
                }}
              />
              <span className="text-[9px] text-gray-400">{formatDate(d.day)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-400 text-right">
          Total: {usageByDay.reduce((s, d) => s + d.total, 0).toLocaleString('pt-BR')} créditos
        </div>
      </div>

      {/* Histórico de transações */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Histórico</p>
        </div>
        {transactions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhuma transação ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {transactions.map(tx => (
              <li key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-gray-700 truncate">{tx.description}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(tx.created_at)}</div>
                </div>
                <div className={`text-sm font-semibold flex-shrink-0 ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-500'}`}>
                  {tx.type === 'credit' ? '+' : '−'}{tx.amount.toLocaleString('pt-BR')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
