import { streamText, type ModelMessage } from 'ai'
import { modeloAcao } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT_BASE = `Você é a BIA, assistente pessoal do método 168.

O método 168 parte de uma premissa: disciplina é a espinha dorsal de tudo.
168 horas semanais = sono (56h) + ESFERA DO TEMPO (cuidar de mim, família, ócio criativo) + ESFERA DO DINHEIRO (trabalho, patrimônio).

Sua função principal: ajudar o usuário a gerir as 168h semanais com disciplina real — não motivação vazia.

VOCÊ PODE:
- Reorganizar a agenda quando o usuário informa mudanças (reunião nova, imprevisto)
- Registrar encaminhamentos e action items com clareza
- Cobrar blocos não cumpridos com firmeza — sem aceitar desculpa abstrata
- Sugerir alocação de blocos baseada nos encaminhamentos abertos
- Identificar quando a esfera CUIDAR está sendo sacrificada pela esfera DINHEIRO
- Informar sobre emails e convites de reunião — você TEM acesso ao Gmail do usuário via contexto injetado no início da conversa. NUNCA diga que não tem acesso ao email.

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

async function fetchGmailContext(providerToken: string): Promise<string> {
  const auth = { Authorization: `Bearer ${providerToken}` }

  try {
    // Busca emails recentes — inclui variações sem acento (reuniao, reunião)
    const query = 'newer_than:7d (has:attachment filename:.ics OR subject:reunião OR subject:reuniao OR subject:meeting OR subject:convite OR subject:invite OR subject:call OR subject:sync OR subject:zoom OR subject:teams OR subject:meet)'
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
      { headers: auth }
    )
    if (!listRes.ok) {
      const errText = await listRes.text().catch(() => '')
      return `\n\n[CONTEXTO GMAIL: Erro ao acessar Gmail — status ${listRes.status}. Detalhe: ${errText.slice(0, 150)}]`
    }
    const listJson = await listRes.json()
    if (!listJson.messages?.length) return '\n\n[CONTEXTO GMAIL: Nenhum convite ou email de reunião encontrado nos últimos 3 dias.]'

    // Pega metadados + ICS dos emails encontrados em paralelo
    const emails = await Promise.allSettled(
      listJson.messages.map(async (m: { id: string }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: auth }
        )
        if (!msgRes.ok) return null
        const msg = await msgRes.json()

        const h = msg.payload?.headers ?? []
        const get = (n: string) => h.find((x: { name: string; value: string }) => x.name === n)?.value ?? ''

        type Part = { mimeType: string; filename?: string; body?: { data?: string; attachmentId?: string }; parts?: Part[] }
        const getParts = (p: Part): Part[] => p.parts ? p.parts.flatMap(getParts) : [p]
        const partes = getParts(msg.payload)

        const icsPart = partes.find((p: Part) =>
          p.filename?.endsWith('.ics') || p.mimeType === 'text/calendar'
        )

        let reuniao = null
        if (icsPart?.body?.data) {
          const icsText = Buffer.from(icsPart.body.data, 'base64').toString('utf-8')
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
          reuniao = {
            titulo: getIcs('SUMMARY'),
            inicio: dtToIso(getIcs('DTSTART')),
            fim: dtToIso(getIcs('DTEND')),
            local: getIcs('LOCATION'),
          }
        } else if (icsPart?.body?.attachmentId) {
          const attRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${icsPart.body.attachmentId}`,
            { headers: auth }
          )
          if (attRes.ok) {
            const att = await attRes.json()
            const icsText = Buffer.from(att.data, 'base64url').toString('utf-8')
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
            reuniao = {
              titulo: getIcs('SUMMARY'),
              inicio: dtToIso(getIcs('DTSTART')),
              fim: dtToIso(getIcs('DTEND')),
              local: getIcs('LOCATION'),
            }
          }
        }

        return {
          assunto: get('Subject'),
          remetente: get('From'),
          data: get('Date'),
          snippet: msg.snippet?.slice(0, 100),
          reuniao,
        }
      })
    )

    const validos = emails
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => (r as PromiseFulfilledResult<{ assunto: string; remetente: string; data: string; snippet: string; reuniao: { titulo: string; inicio: string; fim: string; local: string } | null }>).value)

    if (!validos.length) return '\n\n[CONTEXTO GMAIL: Nenhum email de reunião/convite encontrado nos últimos 7 dias. Se o usuário mencionar um email específico que não apareça aqui, informe que ele não estava nos resultados da busca automática e peça para o usuário colar o conteúdo.]'

    const linhas = validos.map(e => {
      if (e.reuniao) {
        return `- CONVITE: "${e.reuniao.titulo}" | ${e.reuniao.inicio} → ${e.reuniao.fim} | Local: ${e.reuniao.local || 'não informado'} | De: ${e.remetente}`
      }
      return `- EMAIL: "${e.assunto}" | De: ${e.remetente} | Trecho: ${e.snippet}`
    }).join('\n')

    return `\n\n[CONTEXTO GMAIL — últimos 3 dias:\n${linhas}\n]`
  } catch (e) {
    return `\n\n[CONTEXTO GMAIL: Exceção ao buscar emails — ${String(e).slice(0, 150)}]`
  }
}

export async function POST(req: Request) {
  const { messages, provider_token }: { messages: ModelMessage[]; provider_token?: string } = await req.json()

  const gmailContext = provider_token
    ? await fetchGmailContext(provider_token)
    : '\n\n[CONTEXTO GMAIL: provider_token não enviado — usuário não fez login com Google ou token não disponível na sessão.]'

  const systemPrompt = SYSTEM_PROMPT_BASE + gmailContext

  const result = streamText({
    model: modeloAcao,
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
