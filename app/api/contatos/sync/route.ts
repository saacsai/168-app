import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = 'https://evolution.saacs.com.br'
const EVO_KEY = '28bad1a004a318d3f7ba983f466b7168'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// Normaliza timestamp: aceita segundos ou milissegundos, retorna segundos
function normalizeTs(ts: unknown): number | null {
  if (!ts || typeof ts !== 'number') return null
  // Se > 1e10, está em milissegundos
  return ts > 1e10 ? Math.floor(ts / 1000) : ts
}

function calcScore(lastTsSec: number | null, unreadCount: number, msgCount30d: number): number {
  const now = Math.floor(Date.now() / 1000)
  const daysSince = lastTsSec ? (now - lastTsSec) / 86400 : 9999

  let recency: number
  if (daysSince < 1) recency = 50
  else if (daysSince < 7) recency = 40
  else if (daysSince < 30) recency = 25
  else if (daysSince < 90) recency = 10
  else recency = 0

  const freq = Math.min(msgCount30d / 20, 1) * 30
  const unread = Math.min(unreadCount / 5, 1) * 20

  return Math.round(recency + freq + unread)
}

function calcPriority(score: number): string {
  // Thresholds calibrados para sync histórico (sem unread, sem msg_count_30d)
  // score 40 = ativo < 7 dias; score 25 = ativo < 30 dias; score 10 = ativo < 90 dias
  if (score >= 38) return 'priority'  // ativo nos últimos 7 dias
  if (score >= 10) return 'normal'    // ativo nos últimos 90 dias
  return 'muted'
}

function extractRaw(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.chats)) return r.chats as Record<string, unknown>[]
    if (Array.isArray(r.data)) return r.data as Record<string, unknown>[]
    if (Array.isArray(r.contacts)) return r.contacts as Record<string, unknown>[]
  }
  return []
}

function getId(c: Record<string, unknown>): string {
  return (c.remoteJid as string) || (c.id as string) || ''
}

function getName(c: Record<string, unknown>): string | null {
  return (c.name as string) || (c.pushName as string) || (c.verifiedName as string) || null
}

async function evoPost(path: string) {
  const res = await fetch(`${EVO_URL}${path}`, {
    method: 'POST',
    headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) return null
  return res.json()
}

// GET — debug: mostra estrutura bruta da Evolution API
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id, instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Sem instância' }, { status: 404 })

  const [chatsRaw, contactsRaw] = await Promise.all([
    evoPost(`/chat/findChats/${inst.instance_name}`),
    evoPost(`/contact/findContacts/${inst.instance_name}`),
  ])

  const chats = extractRaw(chatsRaw)
  const contacts = extractRaw(contactsRaw)

  return NextResponse.json({
    instance: inst.instance_name,
    chats_total: chats.length,
    chats_sample: chats.slice(0, 2),
    contacts_total: contacts.length,
    contacts_sample: contacts.slice(0, 2),
    chats_raw_type: typeof chatsRaw,
    chats_raw_keys: chatsRaw && typeof chatsRaw === 'object' ? Object.keys(chatsRaw as object) : null,
  })
}

// POST — sincroniza contatos do Evolution API → Supabase
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id, instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  // Busca chats e contatos em paralelo
  const [chatsRaw, contactsRaw] = await Promise.all([
    evoPost(`/chat/findChats/${inst.instance_name}`),
    evoPost(`/contact/findContacts/${inst.instance_name}`),
  ])

  const chats = extractRaw(chatsRaw)
  const contacts = extractRaw(contactsRaw)

  if (chats.length === 0) {
    return NextResponse.json({
      error: 'Evolution API não retornou chats',
      debug: {
        chatsType: typeof chatsRaw,
        chatsKeys: chatsRaw && typeof chatsRaw === 'object' ? Object.keys(chatsRaw as object) : null,
        chatsSample: JSON.stringify(chatsRaw).slice(0, 400),
        contactsCount: contacts.length,
      },
    }, { status: 500 })
  }

  // Mapa JID → nome a partir de findContacts (mais confiável para nomes)
  const nameMap = new Map<string, string>()
  for (const c of contacts) {
    const jid = getId(c)
    const name = getName(c)
    if (jid && name) nameMap.set(jid, name)
  }

  // Filtra apenas individuais
  const individual = chats.filter(c => getId(c).endsWith('@s.whatsapp.net'))

  // Contatos com priority manual — não sobrescrever
  const { data: existingManual } = await supabaseAdmin()
    .from('contacts')
    .select('remote_jid')
    .eq('instance_id', inst.id)
    .eq('classified_manually', true)

  const manualJids = new Set((existingManual || []).map((c: { remote_jid: string }) => c.remote_jid))

  // Contatos com nome bloqueado — não sobrescrever
  const { data: lockedNames } = await supabaseAdmin()
    .from('contacts')
    .select('remote_jid')
    .eq('instance_id', inst.id)
    .eq('name_locked', true)

  const lockedJids = new Set((lockedNames || []).map((c: { remote_jid: string }) => c.remote_jid))

  const upserts = individual.map((chat) => {
    const jid = getId(chat)
    // Prefere nome do findContacts, fallback para findChats
    const name = nameMap.get(jid) || getName(chat)

    const lastMsg = chat.lastMessage as Record<string, unknown> | null
    const rawTs = lastMsg?.messageTimestamp ?? chat.updatedAt ?? chat.lastMessageTimestamp
    const lastTs = normalizeTs(rawTs)
    const unread = (chat.unreadCount as number) ?? 0
    const score = calcScore(lastTs, unread, 0)
    const isManual = manualJids.has(jid)

    return {
      instance_id: inst.id,
      remote_jid: jid,
      // Só atualiza nome se: não está bloqueado E o novo nome é não-nulo
      ...(!lockedJids.has(jid) && name ? { name } : {}),
      auto_score: score,
      msg_count_30d: 0,
      last_interaction: lastTs ? new Date(lastTs * 1000).toISOString() : null,
      ...(isManual ? {} : { priority: calcPriority(score) }),
    }
  })

  // Upsert em lotes de 200
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH)
    await supabaseAdmin()
      .from('contacts')
      .upsert(batch, { onConflict: 'instance_id,remote_jid', ignoreDuplicates: false })
    inserted += batch.length
  }

  const counts = upserts.reduce((acc, c) => {
    const p = (c as { priority?: string }).priority || 'manual'
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json({
    ok: true,
    total: inserted,
    priority: counts.priority || 0,
    normal: counts.normal || 0,
    muted: counts.muted || 0,
    manual_preserved: manualJids.size,
    contacts_with_name: upserts.filter(u => u.name).length,
  })
}
