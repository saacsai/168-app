import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const providerToken = req.headers.get('x-provider-token')
  if (!providerToken) {
    return NextResponse.json({ error: 'sem token' }, { status: 401 })
  }
  // debug — remover depois
  const tokenInfo = `len:${providerToken.length} prefix:${providerToken.slice(0, 8)}`

  const hoje = new Date()
  const timeMin = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString()
  const timeMax = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()
  const auth = { Authorization: `Bearer ${providerToken}` }

  try {
    // 1. Lista todos os calendários visíveis
    const listRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendarList?minAccessRole=reader',
      { headers: auth }
    )
    if (!listRes.ok) {
      const txt = await listRes.text()
      return NextResponse.json({ error: `calendarList ${listRes.status}`, detail: txt, tokenInfo }, { status: 502 })
    }
    const listJson = await listRes.json()
    const calIds: string[] = (listJson.items ?? [])
      .filter((c: { selected?: boolean }) => c.selected !== false)
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

    // 3. Mescla e deduplica por id
    const vistos = new Set<string>()
    const eventos: Array<{ id: string; titulo: string; hora_inicio: string; hora_fim: string }> = []

    for (const r of resultados) {
      if (r.status !== 'fulfilled') continue
      for (const e of (r.value.items ?? [])) {
        if (!e.start?.dateTime || vistos.has(e.id)) continue
        vistos.add(e.id)
        const ini = new Date(e.start.dateTime)
        const fim = new Date(e.end.dateTime)
        eventos.push({
          id: e.id,
          titulo: e.summary || '(sem título)',
          hora_inicio: `${String(ini.getHours()).padStart(2, '0')}:${String(ini.getMinutes()).padStart(2, '0')}`,
          hora_fim: `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`,
        })
      }
    }

    return NextResponse.json({ calendarios: calIds.length, eventos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
