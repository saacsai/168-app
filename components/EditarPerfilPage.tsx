'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Props {
  onVoltar: () => void
  onSaved: (nome: string) => void
}

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

const inputClass = (readOnly: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
    readOnly ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'
  }`

export default function EditarPerfilPage({ onVoltar, onSaved }: Props) {
  const [form, setForm] = useState({ full_name: '', whatsapp: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/perfil', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setForm({ full_name: d.full_name || '', whatsapp: d.whatsapp || '', email: d.email || '' })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSalvar() {
    setSaving(true)
    setErro('')
    setSucesso(false)
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }
    const res = await fetch('/api/perfil', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: form.full_name, whatsapp: form.whatsapp }),
    })
    const d = await res.json()
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); setSaving(false); return }
    setSucesso(true)
    onSaved(form.full_name)
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <IconBack /> Voltar
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <h1 className="text-xl font-bold text-gray-900">Editar perfil</h1>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className={inputClass(false)}
              onFocus={e => (e.target.style.borderColor = PRIMARY)}
              onBlur={e => (e.target.style.borderColor = '')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input
              type="text"
              value={form.email}
              readOnly
              className={inputClass(true)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp pessoal</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              className={inputClass(false)}
              onFocus={e => (e.target.style.borderColor = PRIMARY)}
              onBlur={e => (e.target.style.borderColor = '')}
            />
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}
          {sucesso && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">✓ Perfil atualizado com sucesso.</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onVoltar} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex-1 text-sm font-medium text-white rounded-xl py-2.5 disabled:opacity-50 transition-colors"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
