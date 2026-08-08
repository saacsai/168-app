'use client'

import GradeSemanal from '@/components/GradeSemanal'

export default function SemanaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Semana</h1>
        <p className="text-xs text-gray-400 mt-0.5">Grade 168h semanal</p>
      </div>

      <GradeSemanal />
    </div>
  )
}
