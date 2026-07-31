import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

async function getUserEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.email ?? null
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: 'STRIPE_SECRET_KEY não configurada' }, { status: 500 })

    const email = await getUserEmail(req)
    if (!email) return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 })

    const stripe = new Stripe(secretKey)

    const customers = await stripe.customers.list({ email, limit: 1 })
    if (!customers.data.length) {
      return NextResponse.json({ error: 'Nenhuma assinatura encontrada.' }, { status: 404 })
    }

    const origin = req.headers.get('origin') || 'https://meudia.com.br'
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
