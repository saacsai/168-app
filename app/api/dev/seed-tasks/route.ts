import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'sem token' }, { status: 401 })

  // Cliente autenticado como o próprio usuário — RLS se aplica normalmente
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { data: inst } = await supabase
    .from('instances').select('id').eq('user_id', user.id).eq('active', true).single()
  if (!inst) return NextResponse.json({ error: 'instância não encontrada' }, { status: 404 })

  // Pegar grupos existentes ou criar
  const { data: grupos } = await supabase
    .from('contact_groups').select('id, name, color').eq('instance_id', inst.id).limit(2)

  let group1Id: string | null = grupos?.[0]?.id ?? null
  let group2Id: string | null = grupos?.[1]?.id ?? null

  if (!group1Id) {
    const { data: g } = await supabase
      .from('contact_groups').insert({ instance_id: inst.id, name: 'Trabalho', color: '#2A5F6B' }).select('id').single()
    group1Id = g?.id ?? null
  }
  if (!group2Id) {
    const { data: g } = await supabase
      .from('contact_groups').insert({ instance_id: inst.id, name: 'Pessoal', color: '#7C3AED' }).select('id').single()
    group2Id = g?.id ?? null
  }

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const { data: tasks, error } = await supabase.from('tasks').insert([
    { instance_id: inst.id, title: 'Revisar proposta CooperLiga', date: today, due_date: today, status: 'pendente', origin_group_id: group1Id },
    { instance_id: inst.id, title: 'Ligar para gestora da cooperativa', date: yesterday, due_date: yesterday, status: 'pendente', origin_group_id: group2Id },
  ]).select('id, title')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tasks })
}
