import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  return user ?? null
}

function db() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

async function getInstance(userId: string, supabase: ReturnType<typeof db>) {
  const { data } = await supabase
    .from('instances')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
  return data?.[0] ?? null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = db()
  const inst = await getInstance(user.id, supabase)
  if (!inst) return NextResponse.json({ error: 'Sem instância' }, { status: 404 })

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('instance_id', inst.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sucesso: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { title } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Título vazio' }, { status: 400 })

  const supabase = db()
  const inst = await getInstance(user.id, supabase)
  if (!inst) return NextResponse.json({ error: 'Sem instância' }, { status: 404 })

  const { error } = await supabase
    .from('conversations')
    .update({ title: title.trim() })
    .eq('id', id)
    .eq('instance_id', inst.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sucesso: true })
}
