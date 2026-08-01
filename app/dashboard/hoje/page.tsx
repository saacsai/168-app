'use client'

import GradeDiaria from '@/components/GradeDiaria'

export default function HojePage() {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 capitalize">{hoje}</h1>
        <p className="text-xs text-gray-400 mt-0.5">168 horas semanais — grade do dia</p>
      </div>

      {/* Timer — Fase 3 */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-5 flex items-center gap-4">
        <span className="text-2xl text-gray-200">▶</span>
        <div>
          <p className="text-sm font-semibold text-gray-400">Timer de execução</p>
          <p className="text-xs text-gray-300 mt-0.5">Iniciar / Finalizar blocos — Fase 3</p>
        </div>
      </div>

      <GradeDiaria />
    </div>
  )
}
