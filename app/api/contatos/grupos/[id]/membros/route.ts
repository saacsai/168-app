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

// POST — adicionar contatos ao grupo
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { contact_ids } = await req.json()
  if (!Array.isArray(contact_ids) || contact_ids.length === 0)
    return NextResponse.json({ error: 'contact_ids obrigatório' }, { status: 400 })

  const rows = contact_ids.map((id: string) => ({ group_id: params.id, contact_id: id }))

  const { error } = await supabaseAdmin()
    .from('contact_group_members')
    .upsert(rows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, added: contact_ids.length })
}

// DELETE — remover um contato do grupo
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { contact_id } = await req.json()
  if (!contact_id) return NextResponse.json({ error: 'contact_id obrigatório' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('contact_group_members')
    .delete()
    .eq('group_id', params.id)
    .eq('contact_id', contact_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
