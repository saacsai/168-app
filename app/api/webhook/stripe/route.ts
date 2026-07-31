import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Mapeamento completo price_id → plano + créditos + meses
const PRICE_INFO: Record<string, { plan: string; monthly_credits: number; months: number }> = {
  price_1TawcWFJk3hY5VQ68RvBzWO3: { plan: 'essencial',     monthly_credits: 3000,  months: 1  },
  price_1TawfdFJk3hY5VQ6DqYAIpOr: { plan: 'essencial',     monthly_credits: 3000,  months: 3  },
  price_1TawgGFJk3hY5VQ6OfxrQLjv: { plan: 'essencial',     monthly_credits: 3000,  months: 12 },
  price_1TawkFFJk3hY5VQ66kLEFCFX: { plan: 'profissional',  monthly_credits: 8000,  months: 1  },
  price_1TawmQFJk3hY5VQ6U5ZMYMYh: { plan: 'profissional',  monthly_credits: 8000,  months: 3  },
  price_1TawnAFJk3hY5VQ6xBxD4w5U: { plan: 'profissional',  monthly_credits: 8000,  months: 12 },
  price_1TawoKFJk3hY5VQ6AwW9QulH: { plan: 'executivo',     monthly_credits: 20000, months: 1  },
  price_1TawpeFJk3hY5VQ6BWPPtLb0: { plan: 'executivo',     monthly_credits: 20000, months: 3  },
  price_1Tawq7FJk3hY5VQ6l6KRi3Dg: { plan: 'executivo',     monthly_credits: 20000, months: 12 },
}

const AVULSO_CREDITS: Record<string, number> = {
  price_1Tax1wFJk3hY5VQ6u3AYe2Ip: 1000,
  price_1Tax3rFJk3hY5VQ6NmWpM5Vj: 3000,
  price_1Tax4dFJk3hY5VQ6yOT3cIoF: 5000,
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function getUserIdByCustomer(stripe: Stripe, customerId: string, supabase: ReturnType<typeof supabaseAdmin>): Promise<string | null> {
  // 1. Busca pelo customer_id já salvo
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .limit(1)
  if (data?.[0]?.user_id) return data[0].user_id

  // 2. Fallback: busca pelo email do customer no Stripe
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    if (customer.email) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer.email)
        .single()
      return user?.id ?? null
    }
  } catch { /* ignorar */ }
  return null
}

async function addCredits(supabase: ReturnType<typeof supabaseAdmin>, userId: string, credits: number, description: string, resetAt?: string) {
  await Promise.all([
    supabase.rpc('add_credits', { p_user_id: userId, p_credits: credits, p_reset_at: resetAt ?? null }),
    supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'credit',
      amount: credits,
      description,
    }),
  ])
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe não configurado' }, { status: 500 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = new Stripe(secretKey).webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const stripe = new Stripe(secretKey)

  try {
    switch (event.type) {

      // Nova assinatura criada via checkout
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        if (!userId) break

        // Créditos avulsos (pagamento único)
        if (session.mode === 'payment') {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
          const priceId = lineItems.data[0]?.price?.id
          const credits = priceId ? (AVULSO_CREDITS[priceId] ?? 0) : 0
          if (credits > 0) {
            await addCredits(supabase, userId, credits, `Créditos avulsos — ${credits} créditos`)
          }
          break
        }

        // Nova assinatura
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as Stripe.Subscription
          const priceId = sub.items.data[0].price.id
          const info = PRICE_INFO[priceId]
          if (!info) break

          const credits = info.monthly_credits * info.months
          const item = sub.items.data[0]
          const periodEnd = new Date(item.current_period_end * 1000).toISOString()

          await Promise.all([
            supabase.from('subscriptions').upsert({
              user_id: userId,
              stripe_subscription_id: sub.id,
              stripe_customer_id: session.customer as string,
              plan: info.plan,
              monthly_credits: info.monthly_credits,
              status: 'active',
              current_period_start: new Date(item.current_period_start * 1000).toISOString(),
              current_period_end: periodEnd,
            }, { onConflict: 'user_id' }),
            addCredits(supabase, userId, credits, `Assinatura ${info.plan} — ${credits} créditos`, periodEnd),
          ])
        }
        break
      }

      // Renovação (mensal, trimestral ou anual)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.billing_reason === 'subscription_create') break // já tratado no checkout.session.completed

        const customerId = invoice.customer as string
        const priceField = invoice.lines.data[0]?.pricing?.price_details?.price
        const priceId = typeof priceField === 'string' ? priceField : priceField?.id
        if (!priceId) break

        const info = PRICE_INFO[priceId]
        if (!info) break

        const userId = await getUserIdByCustomer(stripe, customerId, supabase)
        if (!userId) break

        const credits = info.monthly_credits * info.months
        const subParent = invoice.parent?.subscription_details?.subscription
        const subId = typeof subParent === 'string' ? subParent : subParent?.id
        const sub = subId ? await stripe.subscriptions.retrieve(subId) as Stripe.Subscription : null
        const periodEnd = sub ? new Date(sub.items.data[0].current_period_end * 1000).toISOString() : undefined

        await Promise.all([
          supabase.from('subscriptions')
            .update({
              plan: info.plan,
              monthly_credits: info.monthly_credits,
              status: 'active',
              current_period_end: periodEnd,
            })
            .eq('stripe_customer_id', customerId),
          addCredits(supabase, userId, credits, `Renovação ${info.plan} — ${credits} créditos`, periodEnd),
        ])
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled'
        const periodEnd = sub.items.data[0]?.current_period_end
        await supabase.from('subscriptions')
          .update({ status, ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}) })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase.from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)
        break
      }
    }
  } catch (e) {
    console.error('Webhook error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
