'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import AvatarMenu from './AvatarMenu'

export interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}


interface Props {
  navItems: NavItem[]
  userName: string
  userEmail: string
  primaryColor?: string
  onLogout: () => void
  onEditarPerfil: () => void
  onGerenciarPlano: () => void
  onUsoCredits: () => void
  unreadCount?: number
}

function initials(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

export default function Sidebar({
  navItems,
  userName,
  userEmail,
  primaryColor = '#F5F5F5',
  onLogout,
  onEditarPerfil,
  onGerenciarPlano,
  onUsoCredits,
  unreadCount = 0,
}: Props) {
  const pathname = usePathname()

  return (
    <aside
      style={{ position: 'fixed', top: 0, left: 0, width: '256px', height: '100vh', zIndex: 10, background: primaryColor, borderRight: '1px solid #E5E5E5' }}
      className="flex flex-col"
    >
      {/* Logo */}
      <div className="flex justify-center pt-6 pb-5 px-4">
        <Image src="/168_principal.png" alt="168" width={150} height={60} className="object-contain" priority />
      </div>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: active ? '#E5E5E5' : 'transparent',
                color: active ? '#000000' : 'rgba(0,0,0,0.6)',
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#E5E5E5' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
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

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />

      {/* Rodapé: avatar + SAACS */}
      <div className="px-2 py-2">
        <AvatarMenu
          nomeExibido={userName || userEmail}
          email={userEmail}
          initials={initials(userName || userEmail)}
          onEditarPerfil={onEditarPerfil}
          onGerenciarPlano={onGerenciarPlano}
          onUsoCredits={onUsoCredits}
          onSair={onLogout}
        />
      </div>

      <div className="flex flex-col items-center gap-1 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'rgba(0,0,0,0.35)' }}>SAACS.AI</span>
      </div>
    </aside>
  )
}
