'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

export default function CompletePerfil() {
  const [whatsapp, setWhatsapp] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      const meta = session.user.user_metadata
      setNome(meta?.full_name || meta?.name || '')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = whatsapp.replace(/\D/g, '')
    if (clean.length < 10) { setErro('Informe um número de WhatsApp válido (mín. 10 dígitos).'); return }
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErro('Sessão expirada.'); setLoading(false); return }

    // Salva na tabela users via API (usa service key, bypassa RLS)
    const res = await fetch('/api/perfil', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ full_name: nome, whatsapp: clean }),
    })
    if (!res.ok) { setErro('Erro ao salvar perfil.'); setLoading(false); return }

    // Salva também no auth metadata
    await supabase.auth.updateUser({ data: { whatsapp: clean } })

    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0F5F6' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">

        <div className="flex justify-center mb-8">
          <Image src="/meudia_logo.jpg" alt="MeuDIA" width={120} height={120} className="rounded-xl" priority />
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-1">Complete seu perfil</h1>
        <p className="text-sm text-gray-500 mb-6">
          {nome ? `Olá, ${nome.split(' ')[0]}! ` : ''}Para usar o MeuDIA precisamos do seu WhatsApp.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
            <input
              type="text"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999"
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              onFocus={e => e.target.style.borderColor = PRIMARY}
              onBlur={e => e.target.style.borderColor = ''}
            />
          </div>

          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? 'Salvando…' : 'Continuar para o dashboard'}
          </button>
        </form>

        <div className="mt-8 flex justify-center">
          <Image src="/logo_saacs.png" alt="SAACS" width={80} height={25} className="object-contain opacity-40" />
        </div>

      </div>
    </div>
  )
}
