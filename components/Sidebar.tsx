'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AvatarMenu from './AvatarMenu'

export interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const UNLOCK_AT: Record<string, number> = {
  '/dashboard/chat':          -1,
  '/dashboard/contatos':       1,
  '/dashboard':                2,
  '/dashboard/assistente':     3,
  '/dashboard/configuracoes':  4,
}

interface Props {
  logoSrc: string
  productName: string
  navItems: NavItem[]
  userName: string
  userEmail: string
  primaryColor?: string
  onLogout: () => void
  onEditarPerfil: () => void
  onGerenciarPlano: () => void
  onUsoCredits: () => void
  onboardingStep?: number
  onboardingCompleted?: boolean
  unreadCount?: number
}

function initials(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

export default function Sidebar({
  logoSrc,
  productName,
  navItems,
  userName,
  userEmail,
  primaryColor = '#2A5F6B',
  onLogout,
  onEditarPerfil,
  onGerenciarPlano,
  onUsoCredits,
  onboardingStep = 4,
  onboardingCompleted = true,
  unreadCount = 0,
}: Props) {
  const pathname = usePathname()

  return (
    <aside
      style={{ position: 'fixed', top: 0, left: 0, width: '256px', height: '100vh', zIndex: 10, background: primaryColor }}
      className="flex flex-col"
    >
      {/* Logo */}
      <div className="flex justify-center pt-6 pb-5 px-4">
        <Image
          src={logoSrc}
          alt={productName}
          width={162}
          height={61}
          className="object-contain"
          priority
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          const unlockAt = UNLOCK_AT[item.href] ?? 4
          const locked = !onboardingCompleted && onboardingStep < unlockAt

          if (locked) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm select-none"
                style={{ color: 'rgba(255,255,255,0.25)', cursor: 'default' }}
              >
                <span className="opacity-40 flex-shrink-0">{item.icon}</span>
                <span className="opacity-40">{item.label}</span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === '/dashboard/contatos' && unreadCount > 0 && (
                <span
                  className="text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#ef4444', minWidth: '18px', height: '18px', padding: '0 5px' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

      {/* Rodapé: avatar + SAACS */}
      <div className="px-2 py-2">
        <AvatarMenu
          nomeExibido={userName || userEmail}
          email={userEmail}
          initials={initials(userName || userEmail)}
          dark
          onEditarPerfil={onEditarPerfil}
          onGerenciarPlano={onGerenciarPlano}
          onUsoCredits={onUsoCredits}
          onSair={onLogout}
        />
      </div>

      <div className="flex flex-col items-center gap-1 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Image src="/logo_saacs_sem_slogan.png" alt="SAACS" width={90} height={24} className="object-contain" style={{ opacity: 0.5 }} />
      </div>
    </aside>
  )
}
