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

async function getInstance(userId: string) {
  const { data } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
  return data?.[0] ?? null
}

// GET — lista grupos com contagem de membros
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const inst = await getInstance(user.id)
  if (!inst) return NextResponse.json([])

  const { data, error } = await supabaseAdmin()
    .from('contact_groups')
    .select('id, name, color, description, contact_group_members(id)')
    .eq('instance_id', inst.id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const groups = (data ?? []).map((g: { id: string; name: string; color: string; description: string | null; contact_group_members: { id: string }[] }) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    description: g.description,
    member_count: g.contact_group_members?.length ?? 0,
  }))

  return NextResponse.json(groups)
}

// POST — criar grupo
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const inst = await getInstance(user.id)
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  const { name, color, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('contact_groups')
    .insert({ instance_id: inst.id, name: name.trim(), color: color || '#6b7280', description: description || null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Já existe um grupo com este nome' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, member_count: 0 })
}
