'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

type Estado = 'carregando' | 'sem_instancia' | 'aguardando_qr' | 'conectado'

export default function ConectarPage() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [perfilPhone, setPerfilPhone] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [criando, setCriando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [erro, setErro] = useState('')

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  const verificarStatus = useCallback(async (isPolling = false) => {
    const token = await getToken()
    try {
      const res = await fetch('/api/whatsapp', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        if (!isPolling) setEstado('sem_instancia')
        return
      }
      const data = await res.json()
      if (data.connected) {
        setEstado('conectado')
        setPhone(data.phone)
      } else if (data.instance) {
        setEstado('aguardando_qr')
        if (data.qrcode) setQrcode(data.qrcode)
      } else {
        if (!isPolling) setEstado('sem_instancia')
      }
    } catch {
      if (!isPolling) setEstado('sem_instancia')
    }
  }, [])

  useEffect(() => {
    async function init() {
      const token = await getToken()
      // Carrega o número salvo no perfil
      const res = await fetch('/api/perfil', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setPerfilPhone(d.whatsapp || null)
      // Verifica status da instância
      await verificarStatus(false)
    }
    init()
  }, [verificarStatus])

  useEffect(() => {
    if (estado !== 'aguardando_qr') return
    const interval = setInterval(() => verificarStatus(true), 5000)
    return () => clearInterval(interval)
  }, [estado, verificarStatus])

  async function criarInstancia() {
    setCriando(true)
    setErro('')
    const token = await getToken()
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.error) { setErro(data.error); setCriando(false); return }
    if (data.connected) {
      setPhone(data.phone)
      setEstado('conectado')
      setCriando(false)
      return
    }
    setQrcode(data.qrcode)
    setEstado('aguardando_qr')
    setCriando(false)
    setTimeout(() => verificarStatus(true), 6000)
  }

  async function desconectar() {
    setDesconectando(true)
    const token = await getToken()
    await fetch('/api/whatsapp', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setEstado('sem_instancia')
    setQrcode(null)
    setPhone(null)
    setConfirmado(false)
    setDesconectando(false)
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
    return p
  }

  return (
    <div className="max-w-md mx-auto space-y-4">

      {estado === 'carregando' && (
        <div className="text-sm text-gray-400">Verificando conexão…</div>
      )}

      {estado === 'conectado' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">WhatsApp conectado</p>
              <p className="text-xs text-gray-500">{phone ? formatPhone(phone) : '—'}</p>
            </div>
          </div>
          <button
            onClick={desconectar}
            disabled={desconectando}
            className="w-full border border-red-200 text-red-600 text-sm font-medium rounded-xl py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {desconectando ? 'Desconectando…' : 'Desconectar WhatsApp'}
          </button>
        </div>
      )}

      {estado === 'sem_instancia' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Conectar WhatsApp</h2>
            <p className="text-xs text-gray-500">
              Vamos conectar seu WhatsApp para a BIA começar a gerenciar suas mensagens.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Antes de conectar:</p>
            <p>O número conectado aqui será gerenciado pela IA. Recomendamos ter um <strong>segundo número</strong> para uso pessoal e chamadas de voz.</p>
          </div>

          {/* Confirmação do número */}
          {perfilPhone ? (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-600">
                O QR Code será vinculado ao número salvo no seu perfil:
              </p>
              <p className="text-sm font-bold text-gray-900">{formatPhone(perfilPhone)}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={e => setConfirmado(e.target.checked)}
                  className="mt-0.5 accent-teal-700"
                />
                <span className="text-xs text-gray-600">
                  Confirmo que vou escanear o QR com este número
                </span>
              </label>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
              Nenhum número salvo no perfil.{' '}
              <a href="/dashboard" onClick={() => {}} className="font-medium underline" style={{ color: PRIMARY }}>
                Edite seu perfil
              </a>{' '}
              antes de conectar.
            </div>
          )}

          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}

          <button
            onClick={criarInstancia}
            disabled={criando || !confirmado || !perfilPhone}
            className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            {criando ? 'Preparando…' : 'Gerar QR Code'}
          </button>
        </div>
      )}

      {estado === 'aguardando_qr' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Escaneie o QR Code</h2>
            <p className="text-xs text-gray-500">
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo → aponte a câmera para o código abaixo.
            </p>
            {perfilPhone && (
              <p className="text-xs text-gray-400 mt-1">
                Use o número <strong>{formatPhone(perfilPhone)}</strong>
              </p>
            )}
          </div>

          {qrcode ? (
            <div className="flex justify-center">
              <div className="border-2 border-gray-100 rounded-2xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrcode} alt="QR Code WhatsApp" width={220} height={220} style={{ width: 220, height: 220 }} />
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          )}

          <p className="text-xs text-center text-gray-400">Atualizando automaticamente a cada 5 segundos…</p>

          <button
            onClick={() => verificarStatus(false)}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
          >
            Atualizar agora
          </button>
        </div>
      )}

    </div>
  )
}
