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

async function getInstanceId(userId: string) {
  const { data } = await db().from('instances').select('id').eq('user_id', userId).eq('active', true).limit(1)
  return data?.[0]?.id ?? null
}

// GET — list all memories for the authenticated user's instance
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceId = await getInstanceId(user.id)
  if (!instanceId) return NextResponse.json([])

  const { data } = await db()
    .from('assistant_memory')
    .select('id, type, content, created_at')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

// PATCH — edit memory content
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceId = await getInstanceId(user.id)
  if (!instanceId) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  const { id, content } = await req.json()
  if (!id || !content?.trim()) return NextResponse.json({ error: 'id e content são obrigatórios' }, { status: 400 })

  const { error } = await db()
    .from('assistant_memory')
    .update({ content: content.trim() })
    .eq('id', id)
    .eq('instance_id', instanceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sucesso: true })
}

// DELETE — remove a memory
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceId = await getInstanceId(user.id)
  if (!instanceId) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { error } = await db()
    .from('assistant_memory')
    .delete()
    .eq('id', id)
    .eq('instance_id', instanceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sucesso: true })
}
