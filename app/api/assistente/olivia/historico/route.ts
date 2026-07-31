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

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  const supabase = db()

  const { data: instances } = await supabase
    .from('instances')
    .select('id, persona_name, persona_tone, persona_response_size')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = instances?.[0] ?? null
  if (!inst) return NextResponse.json({ messages: [], persona: null })

  let query = supabase
    .from('assistant_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('instance_id', inst.id)
    .eq('chat_source', 'olivia')
    .order('created_at', { ascending: true })
    .limit(100)

  if (conversationId) {
    query = query.eq('conversation_id', conversationId)
  }

  const { data } = await query

  return NextResponse.json({
    messages: data || [],
    persona: {
      name: inst.persona_name,
      tone: inst.persona_tone,
      responseSize: inst.persona_response_size,
    }
  })
}
