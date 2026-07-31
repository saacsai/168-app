import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// Parser CSV simples que respeita campos entre aspas
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = splitCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// Normaliza qualquer formato de telefone BR para 55XXXXXXXXXXX
// Trata: +55, 0XX (operadora), zero inicial, formatos com/sem dígito 9
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits || digits.length < 8) return null

  // Já tem DDI 55 correto (12 ou 13 dígitos)
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits

  let clean = digits

  // Remove código de operadora brasileiro (0 + 2 dígitos de operadora)
  // Ex: 01511964480411 (14d) → remove '015' → 11964480411 (11d)
  // Ex: 01196448411   (11d) → remove '0'   → 1196448411  (10d)
  if (clean.startsWith('0') && !clean.startsWith('00')) {
    if (clean.length >= 13) clean = clean.slice(3)       // 0CC + DDD + número
    else if (clean.length >= 11) clean = clean.slice(1)  // 0 + DDD + número
  }

  // Deve ter 10 ou 11 dígitos (DDD + número)
  if (clean.length === 10 || clean.length === 11) return '55' + clean

  return null
}

// Extrai todos os telefones de uma linha do Google Contacts
function extractPhones(row: Record<string, string>): string[] {
  const phones: string[] = []
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue
    // Google Contacts usa "Phone X - Value" ou "Phone" ou "Mobile"
    if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile') || key.toLowerCase().includes('tel')) {
      const normalized = normalizePhone(value)
      if (normalized) phones.push(normalized)
    }
  }
  return phones
}

// Extrai nome da linha do Google Contacts
function extractName(row: Record<string, string>): string {
  if (row['Name'] && row['Name'].trim()) return row['Name'].trim()
  const first = (row['First Name'] || row['Given Name'] || '').trim()
  const last = (row['Last Name'] || row['Family Name'] || '').trim()
  return [first, last].filter(Boolean).join(' ')
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV vazio ou inválido' }, { status: 400 })

  // Busca instância ativa
  const { data: instRows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = instRows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  // Busca TODOS os contatos para matching de telefone
  const { data: contacts } = await supabaseAdmin()
    .from('contacts')
    .select('id, remote_jid, name, name_locked')
    .eq('instance_id', inst.id)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'Nenhum contato para atualizar. Sincronize primeiro.' }, { status: 400 })
  }

  // Mapa: número → { id, locked } — inclui variações com/sem dígito 9
  const jidMap = new Map<string, { id: string; locked: boolean }>()
  for (const c of contacts) {
    const digits = c.remote_jid.replace('@s.whatsapp.net', '')
    const entry = { id: c.id, locked: c.name_locked === true }
    jidMap.set(digits, entry)
    // Variação sem dígito 9 (fixos migrados): 5511 9 XXXX-XXXX ↔ 5511 XXXX-XXXX
    if (digits.length === 13 && digits.slice(4, 5) === '9') {
      jidMap.set(digits.slice(0, 4) + digits.slice(5), entry) // remove o 9
    } else if (digits.length === 12) {
      jidMap.set(digits.slice(0, 4) + '9' + digits.slice(4), entry) // adiciona o 9
    }
  }

  // Processa CSV e monta updates (ignora name_locked)
  const updates: { id: string; name: string }[] = []
  for (const row of rows) {
    const name = extractName(row)
    if (!name) continue
    const phones = extractPhones(row)
    for (const phone of phones) {
      const entry = jidMap.get(phone)
      if (entry && !entry.locked) {
        updates.push({ id: entry.id, name })
        break
      }
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      csv_rows: rows.length,
      message: 'Nenhum número do CSV coincidiu com os contatos. Verifique se sincronizou os contatos primeiro.',
    })
  }

  // Atualiza em lotes
  const BATCH = 100
  let updated = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await Promise.all(
      batch.map(u =>
        supabaseAdmin().from('contacts').update({ name: u.name }).eq('id', u.id)
      )
    )
    updated += batch.length
  }

  return NextResponse.json({
    ok: true,
    updated,
    csv_rows: rows.length,
    not_matched: rows.length - updated,
  })
}
