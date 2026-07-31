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

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits
  let clean = digits
  if (clean.startsWith('0') && !clean.startsWith('00')) {
    if (clean.length >= 13) clean = clean.slice(3)
    else if (clean.length >= 11) clean = clean.slice(1)
  }
  if (clean.length === 10 || clean.length === 11) return '55' + clean
  return null
}

// POST — inserir contato manualmente
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  const { name, phone } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })

  const normalized = normalizePhone(phone)
  if (!normalized) return NextResponse.json({ error: 'Telefone inválido. Use formato: (11) 91234-5678 ou 5511912345678' }, { status: 400 })

  const remote_jid = `${normalized}@s.whatsapp.net`

  const { data, error } = await supabaseAdmin()
    .from('contacts')
    .insert({
      instance_id: inst.id,
      remote_jid,
      name: name.trim(),
      name_locked: true,
      priority: 'normal',
      auto_score: 0,
      msg_count_30d: 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Este número já existe na sua lista de contatos' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, groups: [] })
}
