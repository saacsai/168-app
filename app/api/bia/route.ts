import { streamText, type ModelMessage, type ToolSet } from 'ai'
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
- Buscar emails e convites de reunião no Gmail do usuário

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
- Se encontrar convite de reunião (.ics), mostre: título, data, horário e link se houver`

type GmailAuth = { Authorization: string }

async function gmailFetch(url: string, auth: GmailAuth) {
  const res = await fetch(url, { headers: auth })
  if (!res.ok) return null
  return res.json()
}

function buildGmailTools(auth: GmailAuth): ToolSet {
  return {
    buscar_emails: {
      description: 'Busca emails no Gmail do usuário. Use para encontrar convites de reunião, emails com anexo .ics, ou qualquer email relevante para a agenda.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query Gmail (ex: "has:attachment filename:.ics", "from:fulano@empresa.com", "subject:reunião")' },
          max: { type: 'number', description: 'Máximo de emails a retornar (padrão: 10)' },
        },
        required: ['query'],
      } as unknown as ToolSet[string]['inputSchema'],
      execute: async ({ query, max = 10 }: { query: string; max?: number }) => {
        const listJson = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
          auth
        )
        if (!listJson?.messages?.length) return { emails: [], total: 0 }

        const resultados = await Promise.allSettled(
          listJson.messages.map((m: { id: string }) =>
            gmailFetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              auth
            )
          )
        )

        const emails = resultados
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => {
            const msg = (r as PromiseFulfilledResult<{ id: string; payload: { headers: { name: string; value: string }[]; parts?: { filename?: string; mimeType: string }[] }; snippet: string }>).value
            const h = msg.payload?.headers ?? []
            const get = (n: string) => h.find((x: { name: string; value: string }) => x.name === n)?.value ?? ''
            const partes = msg.payload?.parts ?? []
            const tem_ics = partes.some((p: { filename?: string; mimeType: string }) =>
              p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'
            )
            return { id: msg.id, assunto: get('Subject'), remetente: get('From'), data: get('Date'), snippet: msg.snippet, tem_ics }
          })

        return { emails, total: emails.length }
      },
    },

    ler_email: {
      description: 'Lê o conteúdo completo de um email. Se houver anexo .ics (convite de reunião Teams/Zoom/Meet), extrai título, data, horário e link automaticamente.',
      inputSchema: {
        type: 'object',
        properties: {
          email_id: { type: 'string', description: 'ID do email retornado por buscar_emails' },
        },
        required: ['email_id'],
      } as unknown as ToolSet[string]['inputSchema'],
      execute: async ({ email_id }: { email_id: string }) => {
        const msg = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email_id}?format=full`,
          auth
        )
        if (!msg) return { erro: 'email não encontrado' }

        const h = msg.payload?.headers ?? []
        const get = (n: string) => h.find((x: { name: string; value: string }) => x.name === n)?.value ?? ''

        type Part = { mimeType: string; filename?: string; body?: { data?: string; attachmentId?: string }; parts?: Part[] }
        const getParts = (p: Part): Part[] => p.parts ? p.parts.flatMap(getParts) : [p]
        const partes = getParts(msg.payload)

        const textPart = partes.find((p: Part) => p.mimeType === 'text/plain')
        const corpo = textPart?.body?.data
          ? Buffer.from(textPart.body.data, 'base64').toString('utf-8').slice(0, 1500)
          : ''

        const icsPart = partes.find((p: Part) =>
          p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'
        )

        let reuniao = null
        if (icsPart) {
          let icsText = ''
          if (icsPart.body?.data) {
            icsText = Buffer.from(icsPart.body.data, 'base64').toString('utf-8')
          } else if (icsPart.body?.attachmentId) {
            const att = await gmailFetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email_id}/attachments/${icsPart.body.attachmentId}`,
              auth
            )
            if (att?.data) icsText = Buffer.from(att.data, 'base64url').toString('utf-8')
          }
          if (icsText) {
            const getIcs = (key: string) => {
              const m = icsText.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'))
              return m ? m[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : ''
            }
            const dtToIso = (dt: string) => {
              const d = dt.replace('Z', '')
              return d.length === 8
                ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
                : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}`
            }
            reuniao = {
              titulo: getIcs('SUMMARY'),
              inicio: dtToIso(getIcs('DTSTART')),
              fim: dtToIso(getIcs('DTEND')),
              local: getIcs('LOCATION'),
              descricao: getIcs('DESCRIPTION').slice(0, 500),
            }
          }
        }

        return { assunto: get('Subject'), remetente: get('From'), data: get('Date'), corpo, reuniao }
      },
    },
  }
}

export async function POST(req: Request) {
  const { messages, provider_token }: { messages: ModelMessage[]; provider_token?: string } = await req.json()

  const auth: GmailAuth | null = provider_token
    ? { Authorization: `Bearer ${provider_token}` }
    : null

  const result = streamText({
    model: modeloAcao,
    system: SYSTEM_PROMPT,
    messages,
    ...(auth ? { tools: buildGmailTools(auth), maxSteps: 5 } : {}),
  })

  return result.toTextStreamResponse()
}
