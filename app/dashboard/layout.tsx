'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import EditarPerfilPage from '@/components/EditarPerfilPage'
import GerenciarPlanoPage from '@/components/GerenciarPlanoPage'
import UsoCreditsPage from '@/components/UsoCreditsPage'
const PRIMARY = '#1B2A4A'

type View = 'main' | 'perfil' | 'plano' | 'uso'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assistantName, setAssistantName] = useState('Assistente')

  const [view, setView] = useState<View>('main')
  const [token, setToken] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { setView('main') }, [pathname])

  // Poll notificações não lidas a cada 30s
  useEffect(() => {
    if (!token) return
    const fetchUnread = () =>
      fetch('/api/notificacoes', { headers: { authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setUnreadCount(d.unread) })
        .catch(() => {})
    fetchUnread()
    const id = setInterval(fetchUnread, 30_000)
    return () => clearInterval(id)
  }, [token])

  // Marca todas como lidas ao entrar em /dashboard/contatos
  useEffect(() => {
    if (!token || pathname !== '/dashboard/contatos' || unreadCount === 0) return
    fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
    })
      .then(() => setUnreadCount(0))
      .catch(() => {})
  }, [pathname, token, unreadCount])

  useEffect(() => {
    const supabase = getSupabase()

    async function setupSession(session: import('@supabase/supabase-js').Session) {
      setToken(session.access_token)
      setUserEmail(session.user.email || '')
      setUserName(
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        ''
      )
      const { data: rows } = await supabase
        .from('instances')
        .select('persona_name, onboarding_completed, onboarding_step')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .limit(1)

      if (!rows || rows.length === 0) {
        await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${session.access_token}` },
        })
        setLoading(false)
        return
      }

      if (rows[0].persona_name) setAssistantName(rows[0].persona_name)
      setLoading(false)
    }

    // onAuthStateChange aguarda hidratação completa (evita race condition pós-OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session) {
          setupSession(session)
        } else if (event === 'INITIAL_SESSION') {
          window.location.href = '/login'
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function onNameChange(e: CustomEvent<string>) {
      setAssistantName(e.detail)
    }
    function onUserNameChange(e: CustomEvent<string>) {
      setUserName(e.detail)
    }
    window.addEventListener('assistantNameChanged', onNameChange as EventListener)
    window.addEventListener('userNameChanged', onUserNameChange as EventListener)
    return () => {
      window.removeEventListener('assistantNameChanged', onNameChange as EventListener)
      window.removeEventListener('userNameChanged', onUserNameChange as EventListener)
    }
  }, [])

  function NavIcon({ d, d2, circle }: { d: string; d2?: string; circle?: { cx: number; cy: number; r: number } }) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
        {d2 && <path d={d2} />}
        {circle && <circle cx={circle.cx} cy={circle.cy} r={circle.r} />}
      </svg>
    )
  }

  const NAV = [
    { href: '/dashboard/hoje',       label: 'Hoje',       icon: <NavIcon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" /> },
    { href: '/dashboard/semana',     label: 'Semana',     icon: <NavIcon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
    { href: '/dashboard/assistente', label: assistantName, icon: <NavIcon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
    { href: '/dashboard/ajustes',    label: 'Ajustes',   icon: <NavIcon d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /> },
  ]

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F5F6' }}>
      <p className="text-sm text-gray-400">Carregando…</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#F0F5F6' }}>
      {/* Sidebar — apenas desktop */}
      <div className="hidden md:block">
        <Sidebar
          navItems={NAV}
          userName={userName}
          userEmail={userEmail}
          primaryColor={PRIMARY}
          onLogout={handleLogout}
          onEditarPerfil={() => setView('perfil')}
          onGerenciarPlano={() => setView('plano')}
          onUsoCredits={() => setView('uso')}
          unreadCount={unreadCount}
        />
      </div>

      {/* Header mobile — logo + sair — todas as abas */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: PRIMARY }}>
        <span className="text-white font-bold text-2xl tracking-tight">168</span>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >
          Sair
        </button>
      </header>

      {/* Bottom navigation — apenas mobile */}
      <BottomNav
        navItems={NAV}
        primaryColor={PRIMARY}
      />

      <main className="p-4 md:p-6 min-h-screen pb-24 md:pb-6 md:ml-[256px]">
        {view === 'perfil' ? (
          <EditarPerfilPage
            onVoltar={() => setView('main')}
            onSaved={nome => { setUserName(nome); setView('main') }}
          />
        ) : view === 'plano' ? (
          <GerenciarPlanoPage onVoltar={() => setView('main')} />
        ) : view === 'uso' ? (
          <UsoCreditsPage onVoltar={() => setView('main')} />
        ) : (
          children
        )}
      </main>
    </div>
  )
}
