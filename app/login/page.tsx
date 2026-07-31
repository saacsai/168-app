'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'
const ACCENT  = '#8FC8D4'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [modo, setModo] = useState<'login' | 'cadastro' | 'recuperar'>('login')
  const [nextUrl, setNextUrl] = useState('/dashboard')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('modo') === 'cadastro') setModo('cadastro')
    setNextUrl(params.get('next') || '/dashboard')
  }, [])

  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha incorretos.')
      setLoading(false)
      return
    }
    window.location.href = nextUrl
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== senhaConfirm) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { full_name: nome, whatsapp } },
    })
    if (error) { setErro(error.message); setLoading(false); return }
    setMensagem('Conta criada! Verifique seu email para confirmar o cadastro.')
    setLoading(false)
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setErro(error.message); setLoading(false); return }
    setMensagem('Se este email estiver cadastrado, você receberá o link em instantes.')
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    setErro('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${nextUrl}` },
    })
    if (error) { setErro(error.message); setLoading(false) }
  }

  if (mensagem) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#E3F0F3' }}>
      <div className="rounded-xl shadow-xl w-full max-w-sm overflow-hidden" style={{ background: PRIMARY }}>
        <div className="px-6 pt-8 pb-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-white">Verifique seu email</p>
          <p className="text-sm" style={{ color: ACCENT }}>{mensagem}</p>
          <button onClick={() => { setMensagem(''); setModo('login') }} className="text-xs hover:underline" style={{ color: ACCENT }}>
            Voltar ao login
          </button>
        </div>
        <div className="flex justify-center pb-5">
          <Image src="/logo_saacs_sem_slogan.png" alt="SAACS" width={74} height={20} className="object-contain" style={{ opacity: 0.7 }} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#E3F0F3' }}>
      <div className="rounded-xl shadow-xl w-full max-w-sm overflow-hidden" style={{ background: PRIMARY }}>

        {/* Logo */}
        <div className="flex justify-center pt-8 pb-5">
          <Image
            src="/meudia_marca.png"
            alt="MeuDIA"
            width={194}
            height={73}
            className="object-contain"
            priority
          />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }} />

        {/* Form */}
        <div className="px-6 py-6">
          <div className="mb-5">
            <p className="text-base font-semibold text-white">
              {modo === 'login' ? 'Acessar dashboard' : modo === 'cadastro' ? 'Criar conta' : 'Recuperar senha'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: ACCENT }}>
              {modo === 'login' ? 'Entre com seu email e senha.' : modo === 'cadastro' ? 'Preencha os dados para criar sua conta.' : 'Informe seu email para receber o link.'}
            </p>
          </div>

          {modo === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Senha</label>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  required
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
                <button
                  type="button"
                  onClick={() => { setModo('recuperar'); setErro('') }}
                  className="mt-1.5 text-xs hover:underline float-right"
                  style={{ color: ACCENT }}
                >
                  Esqueci minha senha
                </button>
              </div>
              {erro && (
                <p className="text-xs rounded-lg p-2 clear-both" style={{ background: 'rgba(255,255,255,0.12)', color: '#fca5a5' }}>
                  {erro}
                </p>
              )}
              <button
                type="submit" disabled={loading}
                className="w-full text-sm font-semibold rounded-lg py-2.5 disabled:opacity-60 transition-all clear-both"
                style={{ background: loading ? 'white' : ACCENT, color: PRIMARY }}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>

              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>ou</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <button
                type="button" onClick={handleGoogle} disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Entrar com Google
              </button>
            </form>
          ) : modo === 'recuperar' ? (
            <form onSubmit={handleRecuperar} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              {erro && (
                <p className="text-xs rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.12)', color: '#fca5a5' }}>
                  {erro}
                </p>
              )}
              <button
                type="submit" disabled={loading}
                className="w-full text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50 transition-opacity"
                style={{ background: 'white', color: PRIMARY }}
              >
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
              <button
                type="button"
                onClick={() => { setModo('login'); setErro('') }}
                className="w-full text-xs hover:underline"
                style={{ color: ACCENT }}
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleCadastro} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Nome</label>
                <input
                  type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required autoFocus
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>WhatsApp</label>
                <input
                  type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Senha</label>
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  required
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Confirmar senha</label>
                <input
                  type="password" value={senhaConfirm} onChange={e => setSenhaConfirm(e.target.value)}
                  required
                  className="w-full bg-white rounded-lg px-3 py-2 text-sm text-gray-900 outline-none border-2 border-transparent focus:border-white/40"
                />
              </div>
              {erro && (
                <p className="text-xs rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.12)', color: '#fca5a5' }}>
                  {erro}
                </p>
              )}
              <button
                type="submit" disabled={loading}
                className="w-full text-sm font-semibold rounded-lg py-2.5 disabled:opacity-60 transition-all"
                style={{ background: loading ? 'white' : ACCENT, color: PRIMARY }}
              >
                {loading ? 'Criando conta…' : 'Criar conta'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            {modo === 'login' ? (
              <button onClick={() => { setModo('cadastro'); setErro('') }} className="text-xs hover:underline" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Não tem conta? <span style={{ color: ACCENT }}>Criar conta</span>
              </button>
            ) : modo === 'cadastro' ? (
              <button onClick={() => { setModo('login'); setErro('') }} className="text-xs hover:underline" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Já tem conta? <span style={{ color: ACCENT }}>Entrar</span>
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }} />

        {/* Footer */}
        <div className="flex justify-center py-4">
          <Image src="/logo_saacs_sem_slogan.png" alt="SAACS" width={74} height={20} className="object-contain" style={{ opacity: 0.7 }} />
        </div>

      </div>
    </div>
  )
}
