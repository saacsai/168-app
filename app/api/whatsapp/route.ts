import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = 'https://evolution.saacs.com.br'
const EVO_KEY = '28bad1a004a318d3f7ba983f466b7168'
const N8N_WEBHOOK = 'http://n8n_webhook:5678/webhook/chama_seu_dia'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 12) return digits  // já tem DDI
  if (digits.length >= 10) return '55' + digits  // número BR sem DDI
  return digits
}

async function evo(method: string, path: string, body?: object) {
  const res = await fetch(`${EVO_URL}${path}`, {
    method,
    headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// GET — status + QR code
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('instance_name, status, phone_number')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ connected: false, instance: null })

  const state = await evo('GET', `/instance/connectionState/${inst.instance_name}`)

  if (state?.status === 404 || state?.response?.message?.[0]?.includes('does not exist')) {
    return NextResponse.json({ connected: false, instance: null })
  }

  const stateValue = (state?.instance?.state ?? state?.state ?? '').toLowerCase()
  const connected = stateValue === 'open' || stateValue === 'authenticated' || stateValue === 'connected'

  if (connected) {
    if (!inst.phone_number) {
      // 1) tenta users.whatsapp
      const { data: userData } = await supabaseAdmin()
        .from('users').select('whatsapp').eq('id', user.id).single()
      let phone = userData?.whatsapp ? normalizePhone(userData.whatsapp) : null

      // 2) se vazio, extrai ownerJid do EVO (ex: "5511999999999@s.whatsapp.net")
      if (!phone) {
        const ownerJid: string = state?.instance?.ownerJid ?? state?.ownerJid ?? ''
        if (ownerJid) phone = ownerJid.split('@')[0]
      }

      if (phone) {
        await Promise.all([
          supabaseAdmin().from('instances').update({ phone_number: phone }).eq('instance_name', inst.instance_name),
          supabaseAdmin().from('users').update({ whatsapp: phone }).eq('id', user.id),
        ])
        return NextResponse.json({ connected: true, phone, instance: inst.instance_name })
      }
    }
    return NextResponse.json({ connected: true, phone: inst.phone_number, instance: inst.instance_name })
  }

  const qr = await evo('GET', `/instance/connect/${inst.instance_name}`)
  const qrcode = qr?.qrcode?.base64 || qr?.base64 || null

  return NextResponse.json({ connected: false, instance: inst.instance_name, qrcode })
}

// POST — criar instância
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = `meudia_${user.id.replace(/-/g, '').substring(0, 16)}`

  const created = await evo('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  })

  if (created?.status === 401 || created?.error === 'Unauthorized') {
    return NextResponse.json({ error: 'Evolution API: chave inválida' }, { status: 500 })
  }

  // Verifica se já está conectada
  const state = await evo('GET', `/instance/connectionState/${instanceName}`)
  const stateValue = (state?.instance?.state ?? state?.state ?? '').toLowerCase()
  const alreadyConnected = stateValue === 'open' || stateValue === 'authenticated' || stateValue === 'connected'

  let qrcode: string | null = created?.qrcode?.base64 || null

  if (!alreadyConnected && !qrcode) {
    await new Promise(r => setTimeout(r, 1500))
    const qr = await evo('GET', `/instance/connect/${instanceName}`)
    qrcode = qr?.qrcode?.base64 || qr?.base64 || null
  }

  // Configura webhook → n8n, rejeitar chamadas e UPSERT
  await Promise.all([
    evo('POST', `/webhook/set/${instanceName}`, {
      url: N8N_WEBHOOK,
      webhook_by_events: false,
      webhook_base64: true,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
    }),
    evo('POST', `/settings/set/${instanceName}`, {
      rejectCall: true,
      msgCall: 'No momento não estou disponível para chamadas de voz.',
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    }),
  ])

  // Limpa qualquer linha existente para este user e insere nova
  await supabaseAdmin().from('instances').delete().eq('user_id', user.id)
  const { error: insertError } = await supabaseAdmin().from('instances').insert({
    user_id: user.id,
    instance_name: instanceName,
    status: alreadyConnected ? 'connected' : 'disconnected',
    active: true,
    paused: false,
    persona_name: 'MAIA',
  })

  if (insertError) console.log('[whatsapp POST] insert error:', insertError.message)

  // Puxar phone de users.whatsapp e salvar em instances
  const { data: userData } = await supabaseAdmin()
    .from('users').select('whatsapp').eq('id', user.id).single()
  const phone = userData?.whatsapp ? normalizePhone(userData.whatsapp) : null
  if (phone) {
    await supabaseAdmin().from('instances').update({ phone_number: phone }).eq('instance_name', instanceName)
  }

  if (alreadyConnected) {
    return NextResponse.json({ instance: instanceName, connected: true, phone })
  }

  return NextResponse.json({ instance: instanceName, qrcode })
}

// DELETE — desconectar
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: delRows } = await supabaseAdmin()
    .from('instances')
    .select('instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const delInst = delRows?.[0] ?? null
  if (delInst) await evo('DELETE', `/instance/logout/${delInst.instance_name}`)

  return NextResponse.json({ ok: true })
}
