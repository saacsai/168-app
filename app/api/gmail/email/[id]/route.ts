import { NextRequest, NextResponse } from 'next/server'

function parseIcs(icsText: string): { titulo: string; inicio: string; fim: string; local: string; descricao: string } | null {
  const get = (key: string) => {
    const match = icsText.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'))
    return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : ''
  }

  const dtstart = get('DTSTART')
  const dtend = get('DTEND')
  if (!dtstart) return null

  function isoFromDt(dt: string): string {
    // Formato: 20260807T140000Z ou 20260807T140000 ou 20260807
    if (dt.length === 8) return `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}T00:00:00`
    const d = dt.replace('Z', '')
    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}:${d.slice(13,15)}`
  }

  return {
    titulo: get('SUMMARY'),
    inicio: isoFromDt(dtstart),
    fim: isoFromDt(dtend),
    local: get('LOCATION'),
    descricao: get('DESCRIPTION'),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const providerToken = req.headers.get('x-provider-token')
  if (!providerToken) {
    return NextResponse.json({ error: 'sem token' }, { status: 401 })
  }

  const { id } = await params
  const auth = { Authorization: `Bearer ${providerToken}` }

  try {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: auth }
    )
    if (!msgRes.ok) {
      return NextResponse.json({ error: `gmail message ${msgRes.status}` }, { status: 502 })
    }
    const msg = await msgRes.json()

    const headers = msg.payload?.headers ?? []
    const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value ?? ''

    // Extrai partes recursivamente
    type Part = { mimeType: string; filename?: string; body?: { data?: string; attachmentId?: string }; parts?: Part[] }
    function getParts(payload: Part): Part[] {
      if (!payload.parts) return [payload]
      return payload.parts.flatMap(getParts)
    }
    const parts = getParts(msg.payload)

    // Extrai corpo texto/html
    const textPart = parts.find(p => p.mimeType === 'text/plain')
    const corpo = textPart?.body?.data
      ? Buffer.from(textPart.body.data, 'base64').toString('utf-8')
      : ''

    // Procura .ics
    const icsPart = parts.find(p =>
      p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'
    )

    let reuniao = null
    if (icsPart) {
      let icsText = ''
      if (icsPart.body?.data) {
        icsText = Buffer.from(icsPart.body.data, 'base64').toString('utf-8')
      } else if (icsPart.body?.attachmentId) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${icsPart.body.attachmentId}`,
          { headers: auth }
        )
        if (attRes.ok) {
          const att = await attRes.json()
          icsText = Buffer.from(att.data, 'base64url').toString('utf-8')
        }
      }
      if (icsText) reuniao = parseIcs(icsText)
    }

    return NextResponse.json({
      id: msg.id,
      assunto: get('Subject'),
      remetente: get('From'),
      data: get('Date'),
      corpo: corpo.slice(0, 2000),
      reuniao,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
