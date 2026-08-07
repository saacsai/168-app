import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const providerToken = req.headers.get('x-provider-token')
  if (!providerToken) {
    return NextResponse.json({ error: 'sem token' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? 'is:unread'
  const maxResults = req.nextUrl.searchParams.get('max') ?? '20'
  const auth = { Authorization: `Bearer ${providerToken}` }

  try {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
      { headers: auth }
    )
    if (!listRes.ok) {
      const txt = await listRes.text()
      return NextResponse.json({ error: `gmail list ${listRes.status}`, detail: txt.slice(0, 200) }, { status: 502 })
    }
    const listJson = await listRes.json()
    const messageIds: string[] = (listJson.messages ?? []).map((m: { id: string }) => m.id)

    // Busca metadados de cada email em paralelo (assunto, remetente, data, tem .ics?)
    const resultados = await Promise.allSettled(
      messageIds.map(id =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: auth }
        ).then(r => r.ok ? r.json() : null)
      )
    )

    const emails = resultados
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => {
        const msg = (r as PromiseFulfilledResult<{ id: string; payload: { headers: { name: string; value: string }[]; parts?: { filename?: string; mimeType: string }[] }; snippet: string; internalDate: string }>).value
        const headers = msg.payload?.headers ?? []
        const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value ?? ''
        const parts = msg.payload?.parts ?? []
        const temIcs = parts.some((p: { filename?: string; mimeType: string }) =>
          p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'
        )
        return {
          id: msg.id,
          assunto: get('Subject'),
          remetente: get('From'),
          data: get('Date'),
          snippet: msg.snippet,
          tem_ics: temIcs,
          timestamp: parseInt(msg.internalDate),
        }
      })

    return NextResponse.json({ emails })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
