'use client'

import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function CallbackPage() {
  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const supabase = getSupabase()

    // Recovery de senha — redireciona para a tela de nova senha
    if (hash.includes('type=recovery')) {
      window.location.href = '/reset-password' + hash
      return
    }

    async function resolve() {
      let session = (await supabase.auth.getSession()).data.session

      if (!session) {
        const code = params.get('code')
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code)
          if (err) { window.location.href = '/login?erro=link-invalido'; return }
          session = (await supabase.auth.getSession()).data.session
        }
      }

      if (!session) { window.location.href = '/login?erro=link-invalido'; return }

      const whatsapp = session.user.user_metadata?.whatsapp
      const provider = session.user.app_metadata?.provider
      window.location.href = (!whatsapp && provider === 'google') ? '/complete-perfil' : '/dashboard'
    }

    resolve()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F5F6' }}>
      <p className="text-sm text-gray-400">Verificando acesso…</p>
    </div>
  )
}
