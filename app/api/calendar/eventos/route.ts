import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const providerToken = req.headers.get('x-provider-token')
  if (!providerToken) {
    return NextResponse.json({ error: 'sem token' }, { status: 401 })
  }

  // Usa o offset enviado pelo cliente para garantir o dia certo no fuso do usuário
  const offsetMin = parseInt(req.headers.get('x-tz-offset') ?? '180', 10) // Brasil = 180 (UTC-3)
  const agora = new Date()
  const localMs = agora.getTime() - offsetMin * 60_000
  const local = new Date(localMs)
  const timeMin = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0) + offsetMin * 60_000).toISOString()
  const timeMax = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23, 59, 59) + offsetMin * 60_000).toISOString()

  const auth = { Authorization: `Bearer ${providerToken}` }

  try {
    // 1. Lista todos os calendários visíveis
    const listRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: auth }
    )
    if (!listRes.ok) {
      const txt = await listRes.text()
      return NextResponse.json({ error: `calendarList ${listRes.status}`, detail: txt.slice(0, 200) }, { status: 502 })
    }
    const listJson = await listRes.json()
    const calIds: string[] = (listJson.items ?? [])
      .map((c: { id: string }) => c.id)

    // 2. Busca eventos de cada calendário em paralelo
    const resultados = await Promise.allSettled(
      calIds.map(calId =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
          `?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
          { headers: auth }
        ).then(r => r.ok ? r.json() : { items: [] })
      )
    )

    // 3. Mescla e deduplica por id (inclui eventos de dia inteiro)
    const vistos = new Set<string>()
    const eventos: Array<{ id: string; titulo: string; hora_inicio: string; hora_fim: string; dia_inteiro?: boolean }> = []

    for (const r of resultados) {
      if (r.status !== 'fulfilled') continue
      for (const e of (r.value.items ?? [])) {
        if (vistos.has(e.id)) continue
        vistos.add(e.id)

        if (e.start?.dateTime) {
          const ini = new Date(e.start.dateTime)
          const fim = new Date(e.end.dateTime)
          eventos.push({
            id: e.id,
            titulo: e.summary || '(sem título)',
            hora_inicio: `${String(ini.getHours()).padStart(2, '0')}:${String(ini.getMinutes()).padStart(2, '0')}`,
            hora_fim: `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`,
          })
        } else if (e.start?.date) {
          // Evento de dia inteiro
          eventos.push({
            id: e.id,
            titulo: e.summary || '(sem título)',
            hora_inicio: '00:00',
            hora_fim: '23:59',
            dia_inteiro: true,
          })
        }
      }
    }

    return NextResponse.json({ calendarios: calIds.length, eventos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
