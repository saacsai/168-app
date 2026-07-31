import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Assinaturas recorrentes
const SUBSCRIPTION_PRICES: Record<string, string> = {
  essencial_mensal:          'price_1TawcWFJk3hY5VQ68RvBzWO3',
  essencial_trimestral:      'price_1TawfdFJk3hY5VQ6DqYAIpOr',
  essencial_anual:           'price_1TawgGFJk3hY5VQ6OfxrQLjv',
  profissional_mensal:       'price_1TawkFFJk3hY5VQ66kLEFCFX',
  profissional_trimestral:   'price_1TawmQFJk3hY5VQ6U5ZMYMYh',
  profissional_anual:        'price_1TawnAFJk3hY5VQ6xBxD4w5U',
  executivo_mensal:          'price_1TawoKFJk3hY5VQ6AwW9QulH',
  executivo_trimestral:      'price_1TawpeFJk3hY5VQ6BWPPtLb0',
  executivo_anual:           'price_1Tawq7FJk3hY5VQ6l6KRi3Dg',
}

// Créditos avulsos (pagamento único)
const AVULSO_PRICES: Record<string, string> = {
  avulso_1000: 'price_1Tax1wFJk3hY5VQ6u3AYe2Ip',
  avulso_3000: 'price_1Tax3rFJk3hY5VQ6NmWpM5Vj',
  avulso_5000: 'price_1Tax4dFJk3hY5VQ6yOT3cIoF',
}

async function getUserInfo(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  return { userId: user.id, email: user.email || '' }
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: 'STRIPE_SECRET_KEY não configurada' }, { status: 500 })

    const { plano } = await req.json()
    if (!plano) return NextResponse.json({ error: 'plano é obrigatório' }, { status: 400 })

    const isAvulso = plano.startsWith('avulso_')
    const priceId = isAvulso ? AVULSO_PRICES[plano] : SUBSCRIPTION_PRICES[plano]
    if (!priceId) return NextResponse.json({ error: `Plano inválido: ${plano}` }, { status: 400 })

    const info = await getUserInfo(req)
    if (!info) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const origin = req.headers.get('origin') || 'https://meudia.saacs.com.br'
    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      mode: isAvulso ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: info.email,
      client_reference_id: info.userId,
      success_url: `${origin}/dashboard/configuracoes?upgrade=success`,
      cancel_url: `${origin}/dashboard/configuracoes?upgrade=cancelled`,
      locale: 'pt-BR',
      payment_method_types: ['card'],
      ...(isAvulso ? {} : {
        discounts: [],
        allow_promotion_codes: true,
      }),
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
