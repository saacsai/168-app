'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

export default function ResetPasswordPage() {
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [sessaoOk, setSessaoOk] = useState(false)

  useEffect(() => {
    // Supabase detecta o token de recovery no hash automaticamente
    const supabase = getSupabase()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessaoOk(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== senhaConfirm) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) { setErro(error.message); setLoading(false); return }
    setPronto(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0F5F6' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">

        <div className="flex justify-center mb-8">
          <Image src="/meudia_logo.jpg" alt="MeuDIA" width={120} height={120} className="rounded-xl" priority />
        </div>

        {pronto ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Senha atualizada!</p>
            <p className="text-xs text-gray-500">Redirecionando para o dashboard…</p>
          </div>
        ) : !sessaoOk ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-500">Verificando link de recuperação…</p>
            <p className="text-xs text-gray-400">Se demorar, solicite um novo link no login.</p>
            <a href="/login" className="text-xs font-medium hover:underline block" style={{ color: PRIMARY }}>
              Voltar ao login
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 mb-1">Nova senha</h1>
            <p className="text-sm text-gray-500 mb-6">Digite sua nova senha de acesso.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nova senha</label>
                <input
                  type="password" value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  onFocus={e => e.target.style.borderColor = PRIMARY}
                  onBlur={e => e.target.style.borderColor = ''}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar senha</label>
                <input
                  type="password" value={senhaConfirm}
                  onChange={e => setSenhaConfirm(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  onFocus={e => e.target.style.borderColor = PRIMARY}
                  onBlur={e => e.target.style.borderColor = ''}
                />
              </div>
              {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                {loading ? 'Salvando…' : 'Definir nova senha'}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 flex justify-center">
          <Image src="/logo_saacs.png" alt="SAACS" width={80} height={25} className="object-contain opacity-40" />
        </div>
      </div>
    </div>
  )
}
