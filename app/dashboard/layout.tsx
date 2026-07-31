'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import EditarPerfilPage from '@/components/EditarPerfilPage'
import GerenciarPlanoPage from '@/components/GerenciarPlanoPage'
import UsoCreditsPage from '@/components/UsoCreditsPage'
import OnboardingView from '@/components/OnboardingView'

const PRIMARY = '#2A5F6B'

type View = 'main' | 'perfil' | 'plano' | 'uso'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assistantName, setAssistantName] = useState('Assistente')
  const [onboardingCompleted, setOnboardingCompleted] = useState(true) // default true evita flash
  const [onboardingStep, setOnboardingStep] = useState(0)
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
        return
      }
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

      // Novo usuário sem instância: cria via setup e envia direto ao onboarding
      if (!rows || rows.length === 0) {
        await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${session.access_token}` },
        })
        // Independente do retorno do setup, é um novo usuário — onboarding obrigatório
        setOnboardingCompleted(false)
        setOnboardingStep(0)
        setLoading(false)
        return
      }

      if (rows[0].persona_name) setAssistantName(rows[0].persona_name)
      setOnboardingCompleted(rows[0].onboarding_completed ?? false)
      setOnboardingStep(rows[0].onboarding_step ?? 0)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    function onNameChange(e: CustomEvent<string>) {
      setAssistantName(e.detail)
    }
    function onStepChange(e: CustomEvent<number>) {
      setOnboardingStep(e.detail)
    }
    function onUserNameChange(e: CustomEvent<string>) {
      setUserName(e.detail)
    }
    window.addEventListener('assistantNameChanged', onNameChange as EventListener)
    window.addEventListener('onboardingStepChanged', onStepChange as EventListener)
    window.addEventListener('userNameChanged', onUserNameChange as EventListener)
    return () => {
      window.removeEventListener('assistantNameChanged', onNameChange as EventListener)
      window.removeEventListener('onboardingStepChanged', onStepChange as EventListener)
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
    { href: '/dashboard',               label: 'Meu Dia',       icon: <NavIcon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" /> },
    { href: '/dashboard/assistente',    label: assistantName,   icon: <NavIcon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /> },
    { href: '/dashboard/contatos',      label: 'Contatos',      icon: <NavIcon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" d2="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" circle={{ cx: 9, cy: 7, r: 4 }} /> },
    { href: '/dashboard/configuracoes', label: 'Configurações', icon: <NavIcon d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /> },
    { href: '/dashboard/chat',          label: 'Dúvidas',       icon: <NavIcon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" d2="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /> },
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
          logoSrc="/meudia_marca.png"
          productName="MeuDIA"
          navItems={NAV}
          userName={userName}
          userEmail={userEmail}
          primaryColor={PRIMARY}
          onLogout={handleLogout}
          onEditarPerfil={() => setView('perfil')}
          onGerenciarPlano={() => setView('plano')}
          onUsoCredits={() => setView('uso')}
          onboardingStep={onboardingStep}
          onboardingCompleted={onboardingCompleted}
          unreadCount={unreadCount}
        />
      </div>

      {/* Header mobile — logo + sair — todas as abas */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: PRIMARY }}>
        <Image src="/meudia_marca.png" alt="MeuDIA" width={108} height={41} className="object-contain" priority />
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
        onboardingStep={onboardingStep}
        onboardingCompleted={onboardingCompleted}
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
        ) : !onboardingCompleted ? (
          <OnboardingView
            userName={userName}
            initialStep={onboardingStep}
            onComplete={(name) => {
              if (name) setAssistantName(name)
              setOnboardingCompleted(true)
            }}
          />
        ) : (
          children
        )}
      </main>
    </div>
  )
}
