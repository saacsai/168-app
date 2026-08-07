import { streamText, tool, isStepCount, type ModelMessage } from 'ai'
import { z } from 'zod'
import { modeloAcao } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Você é a BIA, assistente pessoal do método 168.

O método 168 parte de uma premissa: disciplina é a espinha dorsal de tudo.
168 horas semanais = sono (56h) + ESFERA DO TEMPO (cuidar de mim, família, ócio criativo) + ESFERA DO DINHEIRO (trabalho, patrimônio).

Sua função principal: ajudar o usuário a gerir as 168h semanais com disciplina real — não motivação vazia.

VOCÊ PODE:
- Reorganizar a agenda quando o usuário informa mudanças (reunião nova, imprevisto)
- Registrar encaminhamentos e action items com clareza
- Cobrar blocos não cumpridos com firmeza — sem aceitar desculpa abstrata
- Sugerir alocação de blocos baseada nos encaminhamentos abertos
- Identificar quando a esfera CUIDAR está sendo sacrificada pela esfera DINHEIRO
- Buscar emails e convites de reunião no Gmail do usuário com a ferramenta buscar_gmail

VOCÊ NÃO FAZ:
- Aceita "não deu tempo" sem perguntar o que cedeu lugar
- Trata compromisso consigo mesmo como menos importante que compromisso com outros
- Sugere mais de 3 mudanças de grade de uma vez
- Usa linguagem corporativa ou motivacional genérica

REGRAS DE RESPOSTA:
- Português direto, sem enrolação
- Máximo 3 parágrafos por mensagem
- Se o usuário pedir reorganização de agenda, confirme o que mudou antes de propor
- Se o usuário mencionar encaminhamento, registre com "📌 Encaminhamento anotado:" antes do item
- Se encontrar convite de reunião (.ics), mostre: título, data, horário e link se houver

GMAIL:
- Você TEM acesso ao Gmail do usuário via ferramenta buscar_gmail
- Use a ferramenta SEMPRE que o usuário mencionar um email, convite ou reunião específica
- Não diga que não tem acesso — você tem. Use a ferramenta.`

type GmailPart = {
  mimeType: string
  filename?: string
  body?: { data?: string; attachmentId?: string }
  parts?: GmailPart[]
}

function getParts(p: GmailPart): GmailPart[] {
  return p.parts ? p.parts.flatMap(getParts) : [p]
}

function parseIcsPart(icsText: string) {
  const getIcs = (key: string) => {
    const match = icsText.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'))
    return match ? match[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : ''
  }
  const dtToIso = (dt: string) => {
    const d = dt.replace('Z', '')
    return d.length === 8
      ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
      : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}`
  }
  return {
    titulo: getIcs('SUMMARY'),
    inicio: dtToIso(getIcs('DTSTART')),
    fim: dtToIso(getIcs('DTEND')),
    local: getIcs('LOCATION'),
  }
}

async function fetchEmails(providerToken: string, query: string, maxResults: number) {
  const auth = { Authorization: `Bearer ${providerToken}` }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: auth }
  )
  if (!listRes.ok) {
    const err = await listRes.text().catch(() => '')
    throw new Error(`Gmail ${listRes.status}: ${err.slice(0, 150)}`)
  }
  const listJson = await listRes.json()
  if (!listJson.messages?.length) return []

  const settled = await Promise.allSettled(
    (listJson.messages as { id: string }[]).map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: auth }
      )
      if (!msgRes.ok) return null
      const msg = await msgRes.json()

      const h: { name: string; value: string }[] = msg.payload?.headers ?? []
      const get = (n: string) => h.find(x => x.name === n)?.value ?? ''
      const partes = getParts(msg.payload ?? {})

      const icsPart = partes.find(p => p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar')

      let reuniao = null
      if (icsPart) {
        let icsText = ''
        if (icsPart.body?.data) {
          icsText = Buffer.from(icsPart.body.data, 'base64').toString('utf-8')
        } else if (icsPart.body?.attachmentId) {
          const attRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${icsPart.body.attachmentId}`,
            { headers: auth }
          )
          if (attRes.ok) {
            const att = await attRes.json()
            icsText = Buffer.from(att.data as string, 'base64url').toString('utf-8')
          }
        }
        if (icsText) reuniao = parseIcsPart(icsText)
      }

      return {
        id: m.id,
        assunto: get('Subject'),
        remetente: get('From'),
        data: get('Date'),
        snippet: (msg.snippet as string | undefined)?.slice(0, 150) ?? '',
        reuniao,
      }
    })
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof r extends PromiseFulfilledResult<infer V> ? V : never>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value)
}

export async function POST(req: Request) {
  const { messages, provider_token }: { messages: ModelMessage[]; provider_token?: string } = await req.json()

  const result = streamText({
    model: modeloAcao,
    system: SYSTEM_PROMPT,
    messages,
    stopWhen: isStepCount(3),
    tools: provider_token ? {
      buscar_gmail: tool({
        description: 'Busca emails do Gmail do usuário. Use para encontrar emails específicos, convites de reunião (.ics) ou mensagens recentes.',
        inputSchema: z.object({
          query: z.string().describe('Query Gmail. Ex: "newer_than:3d", "from:fulano@email.com", "subject:reunião", "has:attachment filename:.ics"'),
          maxResults: z.number().optional().describe('Máximo de emails (padrão: 10)'),
        }),
        execute: async ({ query, maxResults = 10 }) => {
          try {
            const emails = await fetchEmails(provider_token, query, maxResults)
            if (!emails.length) return { encontrados: 0, emails: [], mensagem: 'Nenhum email encontrado para esta busca.' }
            return { encontrados: emails.length, emails }
          } catch (e) {
            return { erro: String(e) }
          }
        },
      }),
    } : undefined,
  })

  return result.toTextStreamResponse()
}
