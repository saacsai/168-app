'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
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
  navItems: NavItem[]
  primaryColor: string
  accentColor?: string
  onboardingStep?: number
  onboardingCompleted?: boolean
}

export default function BottomNav({
  navItems,
  primaryColor,
  accentColor = '#8FC8D4',
  onboardingStep = 4,
  onboardingCompleted = true,
}: Props) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch md:hidden"
      style={{ background: primaryColor, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {navItems.map(item => {
        const unlockAt = UNLOCK_AT[item.href] ?? 4
        const isLocked = !onboardingCompleted && onboardingStep < unlockAt && unlockAt !== -1
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        const color = isActive ? accentColor : 'rgba(255,255,255,0.5)'

        if (isLocked) {
          return (
            <div key={item.href} className="flex-1 flex flex-col items-center justify-center py-7 gap-1 opacity-25">
              <span className="leading-none" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.icon}</span>
              <span className="text-[10px] leading-none truncate w-full text-center px-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
            </div>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-7 gap-1 transition-colors"
          >
            <span className="leading-none" style={{ color }}>{item.icon}</span>
            <span className="text-[10px] leading-none truncate w-full text-center px-1 font-medium" style={{ color }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
