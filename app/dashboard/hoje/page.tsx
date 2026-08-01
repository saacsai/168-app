'use client'

export default function HojePage() {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 capitalize">{hoje}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Grade 24h em construção — Fase 2</p>
      </div>

      {/* Timer placeholder */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
        <div className="text-4xl font-bold text-gray-200 mb-2">⏱</div>
        <p className="text-sm font-semibold text-gray-400">Timer de execução</p>
        <p className="text-xs text-gray-300 mt-1">Iniciar / Finalizar blocos — Fase 3</p>
      </div>

      {/* Grade placeholder */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Grade do dia</h2>
          <span className="text-xs text-gray-400">24 horas</span>
        </div>
        <div className="p-5 space-y-1">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className="text-xs text-gray-300 w-10 flex-shrink-0 font-mono">
                {String(i).padStart(2, '0')}h
              </span>
              <div className="flex-1 h-6 rounded bg-gray-50 border border-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
