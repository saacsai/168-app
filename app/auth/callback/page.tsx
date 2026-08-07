'use client'

import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function CallbackPage() {
  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const supabase = getSupabase()

    if (hash.includes('type=recovery')) {
      window.location.href = '/reset-password' + hash
      return
    }

    const next = params.get('next') || '/dashboard'

    // Aguarda sessão estabelecida via onAuthStateChange (evita race condition PKCE)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // provider_token só existe neste evento — persistir para uso posterior
        if (session.provider_token) {
          localStorage.setItem('provider_token_168', session.provider_token)
        }
        subscription.unsubscribe()
        window.location.href = next
      }
    })

    // Fallback: se já há sessão ativa, redireciona diretamente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        window.location.href = next
      }
    })

    // Troca o código PKCE se presente
    const code = params.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          subscription.unsubscribe()
          window.location.href = '/login?erro=auth'
        }
      })
    } else if (!hash && !code) {
      // Nenhum código nem hash — redireciona para login
      subscription.unsubscribe()
      window.location.href = '/login'
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F5F6' }}>
      <p className="text-sm text-gray-400">Verificando acesso…</p>
    </div>
  )
}
