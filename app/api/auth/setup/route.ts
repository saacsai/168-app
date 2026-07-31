import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Se tiver service key, bypassa RLS. Senão, usa o JWT do usuário para que
// as políticas RLS reconheçam auth.uid() corretamente.
function db(userToken: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (serviceKey) return createClient(URL, serviceKey)
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${userToken}` } }
  })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Valida o token e extrai o usuário
  const { data: { user } } = await createClient(URL, ANON).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = db(token)

  // Upsert na tabela pública users
  await supabase.from('users').upsert({
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name ?? '',
  }, { onConflict: 'id' })

  // Guarda contra race condition: verifica se já existe
  const { data: existing } = await supabase
    .from('instances')
    .select('id, onboarding_completed, onboarding_step')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(existing[0])
  }

  // Cria instância com defaults de onboarding
  const { data: instance, error } = await supabase
    .from('instances')
    .insert({
      user_id: user.id,
      active: true,
      onboarding_completed: false,
      onboarding_step: 0,
    })
    .select('id, onboarding_completed, onboarding_step')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(instance)
}
