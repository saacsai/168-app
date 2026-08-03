import { anthropic } from '@ai-sdk/anthropic'

// Ações estruturadas: reorganizar grade, criar blocos, extrair action items
export const modeloAcao = anthropic('claude-haiku-4-5-20251001')

// Conversas nuançadas: auditoria noturna, briefing do pacto, reorganização complexa
export const modeloConversa = anthropic('claude-sonnet-4-6')
