'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function SeedPage() {
  const [status, setStatus] = useState('')

  async function seed() {
    setStatus('Criando tarefas…')
    const { data: { session } } = await getSupabase().auth.getSession()
    if (!session) { setStatus('Não autenticado — faça login primeiro.'); return }

    const res = await fetch('/api/dev/seed-tasks', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json()

    if (json.ok) {
      setStatus(`✓ Criadas: ${json.tasks.map((t: { title: string }) => t.title).join(' · ')}`)
    } else {
      setStatus(`Erro: ${json.error}`)
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h2>Seed — tarefas de teste</h2>
      <button onClick={seed} style={{ padding: '8px 16px', cursor: 'pointer' }}>
        Criar 2 tarefas
      </button>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </div>
  )
}
