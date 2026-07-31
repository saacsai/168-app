'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

const GROUP_COLORS = [
  '#2A5F6B', '#7C3AED', '#1E40AF', '#059669',
  '#B45309', '#BE185D', '#9ca3af', '#374151',
]

interface ContactGroup {
  id: string
  name: string
  color: string
  description?: string | null
  member_count: number
}

interface Contact {
  id: string
  name: string | null
  remote_jid: string
  priority: string
  auto_score: number
  msg_count_30d: number
  last_interaction: string | null
  classified_manually: boolean
  groups: { id: string; name: string; color: string }[]
}

const PRIORITY_LABEL: Record<string, string> = {
  priority: 'Prioridade',
  normal: 'Normal',
  muted: 'Silenciado',
}

const PRIORITY_COLOR: Record<string, string> = {
  priority: '#2A5F6B',
  normal: '#6b7280',
  muted: '#d1d5db',
}

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token || ''
}

function formatJid(jid: string): string {
  const digits = jid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length === 13)
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  if (digits.startsWith('55') && digits.length === 12)
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  return `+${digits}`
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'priority' | 'normal' | 'muted'>('all')
  const [filterGroup, setFilterGroup] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkPriority, setBulkPriority] = useState('normal')
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [addingToGroup, setAddingToGroup] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ total: number; priority: number; normal: number; muted: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ updated: number; csv_rows: number; not_matched: number } | null>(null)

  // painel de grupos
  const [showGroups, setShowGroups] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)

  // inserção manual
  const [showInsert, setShowInsert] = useState(false)
  const [insertName, setInsertName] = useState('')
  const [insertPhone, setInsertPhone] = useState('')
  const [inserting, setInserting] = useState(false)
  const [insertError, setInsertError] = useState<string | null>(null)

  const insertNameRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    const token = await getToken()
    const [contactsRes, groupsRes] = await Promise.all([
      fetch('/api/contatos', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/contatos/grupos', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const [contactsData, groupsData] = await Promise.all([contactsRes.json(), groupsRes.json()])
    setContacts(Array.isArray(contactsData) ? contactsData : [])
    setGroups(Array.isArray(groupsData) ? groupsData : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (showInsert) setTimeout(() => insertNameRef.current?.focus(), 50)
  }, [showInsert])

  // --- Sync ---
  async function syncContacts() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    const token = await getToken()
    const res = await fetch('/api/contatos/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.ok) { setSyncResult(data); await loadData() }
    else setSyncError(data.error + (data.debug ? ` | ${JSON.stringify(data.debug)}` : ''))
    setSyncing(false)
  }

  // --- Import CSV ---
  async function importCSV(file: File) {
    setImporting(true)
    setImportResult(null)
    const token = await getToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/contatos/import-csv', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
    })
    const data = await res.json()
    if (data.ok) { setImportResult(data); await loadData() }
    else setSyncError(data.error || 'Erro ao importar CSV')
    setImporting(false)
  }

  // --- Inserção manual ---
  async function insertContact() {
    if (!insertName.trim() || !insertPhone.trim()) return
    setInserting(true)
    setInsertError(null)
    const token = await getToken()
    const res = await fetch('/api/contatos/inserir', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: insertName.trim(), phone: insertPhone.trim() }),
    })
    const data = await res.json()
    if (data.id) {
      setContacts(prev => [data, ...prev])
      setInsertName('')
      setInsertPhone('')
      setShowInsert(false)
    } else {
      setInsertError(data.error || 'Erro ao inserir contato')
    }
    setInserting(false)
  }

  // --- Seleção ---
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.id)))
  }

  // --- Bulk priority ---
  async function applyBulk() {
    if (!selected.size) return
    setBulkSaving(true)
    const token = await getToken()
    const res = await fetch('/api/contatos', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), priority: bulkPriority }),
    })
    const data = await res.json()
    if (data.ok) {
      setContacts(prev => prev.map(c =>
        selected.has(c.id) ? { ...c, priority: bulkPriority, classified_manually: true } : c
      ))
      setSelected(new Set())
    }
    setBulkSaving(false)
  }

  // --- Bulk add to group ---
  async function addBulkToGroup() {
    if (!selected.size || !bulkGroupId) return
    setAddingToGroup(true)
    const token = await getToken()
    const res = await fetch(`/api/contatos/grupos/${bulkGroupId}/membros`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: Array.from(selected) }),
    })
    const data = await res.json()
    if (data.ok) {
      const grp = groups.find(g => g.id === bulkGroupId)
      if (grp) {
        setContacts(prev => prev.map(c => {
          if (!selected.has(c.id)) return c
          const already = c.groups.some(g => g.id === bulkGroupId)
          if (already) return c
          return { ...c, groups: [...c.groups, { id: grp.id, name: grp.name, color: grp.color }] }
        }))
        setGroups(prev => prev.map(g =>
          g.id === bulkGroupId ? { ...g, member_count: g.member_count + data.added } : g
        ))
      }
      setSelected(new Set())
    }
    setAddingToGroup(false)
  }

  // --- Remove from group ---
  async function removeFromGroup(contactId: string, groupId: string) {
    const token = await getToken()
    const res = await fetch(`/api/contatos/grupos/${groupId}/membros`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId }),
    })
    if ((await res.json()).ok) {
      setContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, groups: c.groups.filter(g => g.id !== groupId) } : c
      ))
    }
  }

  // --- Inline name edit ---
  async function saveName(contactId: string, name: string) {
    const trimmed = name.trim()
    setEditingName(null)
    if (!trimmed) return
    const token = await getToken()
    const res = await fetch('/api/contatos', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contactId, name: trimmed }),
    })
    const data = await res.json()
    if (data.id) setContacts(prev => prev.map(c => c.id === contactId ? { ...c, name: trimmed } : c))
  }

  // --- Priority single ---
  async function setPriority(contactId: string, priority: string) {
    setSaving(contactId)
    const token = await getToken()
    const res = await fetch('/api/contatos', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contactId, priority }),
    })
    const data = await res.json()
    if (data.id) setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data } : c))
    setSaving(null)
  }

  // --- Groups CRUD ---
  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    setGroupError(null)
    const token = await getToken()
    const res = await fetch('/api/contatos/grupos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor, description: newGroupDescription.trim() || null }),
    })
    const data = await res.json()
    if (data.id) {
      setGroups(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGroupName('')
      setNewGroupDescription('')
    } else {
      setGroupError(data.error || 'Erro ao criar grupo')
    }
    setCreatingGroup(false)
  }

  async function deleteGroup(id: string) {
    const token = await getToken()
    const res = await fetch(`/api/contatos/grupos/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    if ((await res.json()).ok) {
      setGroups(prev => prev.filter(g => g.id !== id))
      setContacts(prev => prev.map(c => ({ ...c, groups: c.groups.filter(g => g.id !== id) })))
      if (filterGroup === id) setFilterGroup('')
    }
  }

  // --- Filter ---
  const filtered = contacts.filter(c => {
    const matchSearch = (c.name || c.remote_jid).toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.priority === filter
    const matchGroup = !filterGroup || c.groups.some(g => g.id === filterGroup)
    return matchSearch && matchFilter && matchGroup
  })

  const counts = {
    all: contacts.length,
    priority: contacts.filter(c => c.priority === 'priority').length,
    normal: contacts.filter(c => c.priority === 'normal').length,
    muted: contacts.filter(c => c.priority === 'muted').length,
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={syncContacts}
          disabled={syncing || importing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: PRIMARY }}
        >
          {syncing
            ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Sincronizando…</>
            : 'Sincronizar contatos'}
        </button>

        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 bg-white cursor-pointer hover:bg-gray-50 ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
          <input type="file" accept=".csv" className="hidden"
            onChange={e => { if (e.target.files?.[0]) importCSV(e.target.files[0]) }} />
          {importing
            ? <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />Importando…</>
            : 'Importar Google Contatos (.csv)'}
        </label>

        <button
          onClick={() => { setShowInsert(v => !v); setInsertError(null) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50"
        >
          <span className="text-lg leading-none">+</span> Novo contato
        </button>

        {syncResult && (
          <p className="text-xs text-gray-500 w-full">
            Sync: {syncResult.total} contatos — <span style={{ color: PRIMARY }}>{syncResult.priority} prioridade</span> · {syncResult.normal} normal · {syncResult.muted} silenciado
          </p>
        )}
        {importResult && (
          <p className="text-xs text-gray-500 w-full">
            CSV: <span style={{ color: PRIMARY }}>{importResult.updated} nomes atualizados</span> de {importResult.csv_rows} contatos ({importResult.not_matched} sem match)
          </p>
        )}
        {syncError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-full break-all">{syncError}</p>
        )}
      </div>

      {/* Formulário inserção manual */}
      {showInsert && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-800">Novo contato</p>
          <div className="flex gap-2">
            <input
              ref={insertNameRef}
              type="text"
              placeholder="Nome"
              value={insertName}
              onChange={e => setInsertName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
              onFocus={e => (e.target.style.borderColor = PRIMARY)}
              onBlur={e => (e.target.style.borderColor = '')}
              onKeyDown={e => e.key === 'Enter' && insertContact()}
            />
            <input
              type="text"
              placeholder="Telefone (+55 11 9...)"
              value={insertPhone}
              onChange={e => setInsertPhone(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
              onFocus={e => (e.target.style.borderColor = PRIMARY)}
              onBlur={e => (e.target.style.borderColor = '')}
              onKeyDown={e => e.key === 'Enter' && insertContact()}
            />
            <button
              onClick={insertContact}
              disabled={inserting || !insertName.trim() || !insertPhone.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              {inserting ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => { setShowInsert(false); setInsertName(''); setInsertPhone(''); setInsertError(null) }}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          {insertError && <p className="text-xs text-red-600">{insertError}</p>}
        </div>
      )}

      {/* Painel de grupos */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGroups(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Grupos de contatos ({groups.length})</span>
          <span className="text-gray-400 text-xs">{showGroups ? '▲' : '▼'}</span>
        </button>

        {showGroups && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Grupos existentes */}
            {groups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {groups.map(g => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white cursor-pointer hover:opacity-90"
                    style={{ backgroundColor: g.color }}
                    onClick={() => setFilterGroup(prev => prev === g.id ? '' : g.id)}
                    title={`${g.member_count} membro${g.member_count !== 1 ? 's' : ''}${filterGroup === g.id ? ' — clique para remover filtro' : ' — clique para filtrar'}`}
                  >
                    {filterGroup === g.id && <span>✓</span>}
                    {g.name}
                    <span className="opacity-70">({g.member_count})</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteGroup(g.id) }}
                      className="ml-0.5 hover:opacity-70 leading-none"
                      title="Apagar grupo"
                    >×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Nenhum grupo ainda. Crie um abaixo.</p>
            )}

            {/* Criar novo grupo */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do grupo (ex: REDE BIOSOL)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createGroup()}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none"
                  onFocus={e => (e.target.style.borderColor = PRIMARY)}
                  onBlur={e => (e.target.style.borderColor = '')}
                />
                <div className="flex gap-1">
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewGroupColor(c)}
                      className="w-5 h-5 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: newGroupColor === c ? '#111' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={createGroup}
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {creatingGroup ? '…' : 'Criar'}
                </button>
              </div>
              <textarea
                placeholder="Objetivo do grupo (opcional) — ex: Fornecedores da obra do galpão central, previsão até agosto"
                value={newGroupDescription}
                onChange={e => setNewGroupDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-700 outline-none resize-none"
                onFocus={e => (e.target.style.borderColor = PRIMARY)}
                onBlur={e => (e.target.style.borderColor = '')}
              />
            </div>
            {groupError && <p className="text-xs text-red-600">{groupError}</p>}
          </div>
        )}
      </div>

      {/* Barra de ação bulk */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-teal-800 flex-shrink-0">
            {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </span>

          {/* Prioridade */}
          <select
            value={bulkPriority}
            onChange={e => setBulkPriority(e.target.value)}
            className="border border-teal-300 rounded-lg px-2 py-1.5 text-xs font-medium outline-none bg-white"
            style={{ color: PRIORITY_COLOR[bulkPriority] }}
          >
            <option value="priority">Prioridade</option>
            <option value="normal">Normal</option>
            <option value="muted">Silenciado</option>
          </select>
          <button
            onClick={applyBulk}
            disabled={bulkSaving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {bulkSaving ? 'Salvando…' : 'Aplicar'}
          </button>

          {/* Grupos */}
          {groups.length > 0 && (
            <>
              <span className="text-teal-300 text-xs">|</span>
              <select
                value={bulkGroupId}
                onChange={e => setBulkGroupId(e.target.value)}
                className="border border-teal-300 rounded-lg px-2 py-1.5 text-xs font-medium outline-none bg-white text-gray-700"
              >
                <option value="">Adicionar ao grupo…</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={addBulkToGroup}
                disabled={addingToGroup || !bulkGroupId}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
              >
                {addingToGroup ? '…' : 'Adicionar'}
              </button>
            </>
          )}

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-teal-600 hover:text-teal-800"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Filtros de prioridade + grupo */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['all', 'priority', 'normal', 'muted'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={filter === f
              ? { backgroundColor: PRIMARY, color: '#fff', borderColor: PRIMARY }
              : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            {f === 'all' ? 'Todos' : PRIORITY_LABEL[f]} ({counts[f]})
          </button>
        ))}

        {groups.length > 0 && (
          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 outline-none bg-white"
          >
            <option value="">Todos os grupos</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>
            ))}
          </select>
        )}
      </div>

      {/* Busca */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar contato…"
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
        onFocus={e => (e.target.style.borderColor = PRIMARY)}
        onBlur={e => (e.target.style.borderColor = '')}
      />

      {/* Lista */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-gray-700">Nenhum contato ainda</p>
          <p className="text-xs text-gray-400">Sincronize ou adicione um contato manualmente acima.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 rounded-t-2xl">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-teal-700 flex-shrink-0"
            />
            <span className="text-xs text-gray-400">
              {selected.size > 0 ? `${selected.size} de ${filtered.length} selecionados` : `${filtered.length} contatos`}
            </span>
          </div>

          {filtered.map(contact => {
            const displayName = contact.name || formatJid(contact.remote_jid)
            const initials = displayName[0].toUpperCase()
            const color = PRIORITY_COLOR[contact.priority] || '#9ca3af'
            const isSelected = selected.has(contact.id)

            return (
              <div
                key={contact.id}
                className="flex items-start gap-4 px-5 py-4 transition-colors"
                style={isSelected ? { backgroundColor: '#f0fdfa' } : {}}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(contact.id)}
                  className="w-4 h-4 rounded accent-teal-700 flex-shrink-0 mt-1"
                />

                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {editingName === contact.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => saveName(contact.id, editingValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveName(contact.id, editingValue)
                          if (e.key === 'Escape') setEditingName(null)
                        }}
                        className="text-sm font-medium text-gray-900 border-b border-teal-400 outline-none bg-transparent w-full"
                      />
                    ) : (
                      <p
                        className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-teal-700"
                        title="Clique para editar o nome"
                        onClick={() => { setEditingName(contact.id); setEditingValue(contact.name || '') }}
                      >
                        {displayName}
                      </p>
                    )}
                    {contact.classified_manually && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 font-medium flex-shrink-0">manual</span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 truncate">
                    {contact.remote_jid.replace('@s.whatsapp.net', '')}
                  </p>

                  {/* Chips de grupo */}
                  {contact.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {contact.groups.map(g => (
                        <span
                          key={g.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                          style={{ backgroundColor: g.color }}
                        >
                          {g.name}
                          <button
                            onClick={() => removeFromGroup(contact.id, g.id)}
                            className="hover:opacity-70 leading-none ml-0.5"
                            title="Remover do grupo"
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center hidden sm:block flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">{contact.msg_count_30d ?? 0}</p>
                  <p className="text-xs text-gray-400">msgs/30d</p>
                </div>

                <select
                  value={contact.priority}
                  onChange={e => setPriority(contact.id, e.target.value)}
                  disabled={saving === contact.id}
                  className="border rounded-lg px-2 py-1.5 text-xs font-medium outline-none disabled:opacity-50 flex-shrink-0"
                  style={{
                    color,
                    borderColor: contact.classified_manually ? PRIMARY : '#e5e7eb',
                  }}
                >
                  <option value="priority">Prioridade</option>
                  <option value="normal">Normal</option>
                  <option value="muted">Silenciado</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
