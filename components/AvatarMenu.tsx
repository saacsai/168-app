'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  nomeExibido: string
  email: string
  initials: string
  dark?: boolean
  onEditarPerfil: () => void
  onGerenciarPlano: () => void
  onUsoCredits: () => void
  onSair: () => void
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function IconPlan() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )
}

function IconCredits() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function IconChevron({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
    </svg>
  )
}

export default function AvatarMenu({ nomeExibido, email, initials, dark, onEditarPerfil, onGerenciarPlano, onUsoCredits, onSair }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 mx-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          <div className="px-3 py-2.5">
            <div className="text-sm font-semibold text-gray-900 truncate">{nomeExibido}</div>
            <div className="text-xs text-gray-500 truncate">{email}</div>
          </div>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { setOpen(false); onEditarPerfil() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
          >
            <span className="text-gray-400"><IconEdit /></span>
            Editar perfil
          </button>
          <button
            onClick={() => { setOpen(false); onGerenciarPlano() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
          >
            <span className="text-gray-400"><IconPlan /></span>
            Gerenciar plano
          </button>
          <button
            onClick={() => { setOpen(false); onUsoCredits() }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
          >
            <span className="text-gray-400"><IconCredits /></span>
            Uso e créditos
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { setOpen(false); onSair() }}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2.5"
          >
            <span className="text-red-400"><IconLogout /></span>
            Sair
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left"
        style={{ background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : '#f9fafb')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-semibold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: dark ? '#ffffff' : '#1f2937' }}>{nomeExibido}</div>
          <div className="text-xs truncate" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}>{email}</div>
        </div>
        <span style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}><IconChevron up={open} /></span>
      </button>
    </div>
  )
}
