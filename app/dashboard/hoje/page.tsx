'use client'

import GradeDiaria from '@/components/GradeDiaria'
import PainelBIA from '@/components/PainelBIA'

export default function HojePage() {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex gap-4 items-start">

      {/* Coluna principal: cabeçalho + timer + grade */}
      <div className="flex-1 min-w-0 space-y-4">

        <div>
          <h1 className="text-xl font-bold text-gray-900 capitalize">{hoje}</h1>
          <p className="text-xs text-gray-400 mt-0.5">168 horas semanais</p>
        </div>

        {/* Timer — Fase 3 */}
        <div
          className="rounded-2xl border border-dashed border-gray-200 px-5 py-4 flex items-center gap-4"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#f3f4f6' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">Nenhum bloco em andamento</p>
            <p className="text-xs text-gray-300 mt-0.5">Inicie um bloco da grade para ativar o timer</p>
          </div>
        </div>

        <GradeDiaria />
      </div>

      {/* Painel BIA — visível apenas no desktop, sticky */}
      <div
        className="hidden md:flex flex-col w-[340px] flex-shrink-0 sticky top-6"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        <PainelBIA />
      </div>

    </div>
  )
}
