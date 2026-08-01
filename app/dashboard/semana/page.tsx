'use client'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function SemanaPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Semana</h1>
        <p className="text-xs text-gray-400 mt-0.5">Grade 168h — Fase 6</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-8 border-b border-gray-100">
          <div className="px-3 py-3" />
          {DIAS.map(d => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>
        <div className="p-4 text-center text-sm text-gray-300 py-16">
          Grade semanal de 168h com ritual de planejamento — em breve
        </div>
      </div>
    </div>
  )
}
