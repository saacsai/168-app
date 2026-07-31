# MeuDIA Dashboard

> Organizado e priorizado. Todo dia.  
> Secretaria virtual por WhatsApp para profissionais que não podem parar para responder tudo.

Produto SAACS.AI · [meudia.saacs.com.br](https://meudia.saacs.com.br)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 App Router + TypeScript + Tailwind |
| Auth + DB | Supabase |
| LLM | Google Gemini 2.5 Flash (REST API v1beta) |
| WhatsApp | Evolution API V2 (self-hosted na VPS) |
| Orquestração | n8n (self-hosted na VPS) |
| Deploy | Vercel (CI/CD automático via push no `main`) |

---

## Infraestrutura

| Serviço | Endereço |
|---|---|
| Dashboard produção | https://meudia.saacs.com.br |
| Cadastro (deep-link) | https://meudia.saacs.com.br/login?modo=cadastro |
| Evolution API (interno Docker) | http://evolution:8080 |
| VPS SAACS | `82.112.244.174` — SSH: `root@82.112.244.174` |
| Supabase projeto | `umlmqjkahrobfnigltil` |
| Supabase SQL Editor | https://app.supabase.com/project/umlmqjkahrobfnigltil/sql |

---

## Credenciais n8n (salvas no painel do n8n)

| Credential | Nome no n8n | ID |
|---|---|---|
| Redis | Redis SeuDIA | `sAdBQbnEV9z1O6ed` |
| Supabase | Supabase FILE | `qVDAhgdwZVcAEKd3` |
| Gemini | Google Gemini SeuDIA | `fpHeWD7qrWyARptC` |
| Evolution API key | — | `CA03A237-2DCC-4684-8989-0E615AE6220B` |

---

## Variáveis de ambiente (Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
EVOLUTION_API_URL=https://evolution.saacs.com.br
EVOLUTION_API_KEY=CA03A237-2DCC-4684-8989-0E615AE6220B
INTERNAL_API_KEY=     # autenticação n8n → Next.js
RESEND_API_KEY=       # notificações por email (domínio meudia.saacs.com.br verificado)
CRON_SECRET=          # header de autenticação para endpoints de cron
```

---

## Estrutura de pastas

```
app/
  api/
    assistente/       # BIA + Olivia (chat, histórico, memórias, comando)
    whatsapp/         # webhook EVO + Olivia/BIA incoming (n8n chama aqui)
    contatos/         # CRUD contatos
    notificacoes/     # notificações do dashboard
    onboarding/       # steps de onboarding
    perfil/           # perfil do usuário
  dashboard/          # páginas do dashboard (Meu Dia, Chat, Contatos, etc.)
  login/              # auth (login + cadastro + recuperar senha)
components/
  ChatWithSidebar.tsx # componente reutilizável — base de todos os produtos SAACS.AI
  OnboardingView.tsx  # onboarding conversacional (BIA guia o primeiro acesso)
  Sidebar.tsx         # nav com desbloqueio progressivo
lib/
  assistant-tools.ts  # TOOL_DECLARATIONS + executeTool + callGemini
  supabase.ts         # cliente Supabase
```

---

## Migrações Supabase

Executar na ordem no SQL Editor:

1. `supabase_migration_onboarding.sql`
2. `supabase_migration_memory.sql`
3. `supabase_migration_chat_source.sql`
4. `supabase_migration_chat_notificacoes.sql`
5. `supabase_migration_conversations.sql`
6. `supabase_migration_grupos_contatos.sql`
7. `supabase_migration_tasks.sql`
8. `supabase_migration_tasks_duedate.sql`
9. `contact_groups`: adicionar coluna `description text` (campo objetivo do grupo)
10. `digest_schedule`: adicionar `window_times text[]`, `email_notify boolean`, `email_notify_scope text`

```sql
-- Migration 9
ALTER TABLE contact_groups ADD COLUMN IF NOT EXISTS description text;

-- Migration 10
ALTER TABLE digest_schedule
  ADD COLUMN IF NOT EXISTS window_times text[],
  ADD COLUMN IF NOT EXISTS email_notify boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notify_scope text DEFAULT 'priority';
UPDATE digest_schedule
SET window_times = ARRAY[COALESCE(morning_time,'08:00'), COALESCE(afternoon_time,'17:00')]
WHERE window_times IS NULL;
```

---

## n8n — Fluxos

| Fluxo | Arquivo | Status |
|---|---|---|
| Fluxo 1 — Mensagem recebida (Olivia + BIA Vendedora) | `MCP_SAACS/Projeto MeuDIA/MeuDIA - Fluxo1.json` | ✅ implementado |
| Fluxo 2 — Digest cron (janelas configuráveis) | — | ⏳ pendente |

Arquitetura do Fluxo 1:
```
Buffer Redis → Busca Instância → PAUSE MODE → Busca Contato
→ first_response_sent = true  → Olivia direto
→ first_response_sent = false → Redis GET {jid}_bia_pending
    TRUE  → Redis SET (renova TTL 600s) → BIA
    FALSE → Classificador LEAD/NORMAL
              LEAD   → Redis SET TTL 600s → BIA
              NORMAL → Olivia
→ Code node divide resposta ≤240 chars → Loop → EVO send
```

---

## Estado atual (2026-06-09)

### Concluído ✅
- Onboarding conversacional (`OnboardingView.tsx` — chat BIA phases 0–5)
- Quadro de Tarefas Meu Dia (Post-it 2026) com ferramentas Olivia
- n8n Fluxo 1 implementado e validado (texto, áudio, imagem, PDF)
- Endpoints `/api/whatsapp/bia` e `/api/whatsapp/olivia`
- Ferramentas Olivia: `pausar_agente`, `retomar_agente`
- `INTERNAL_API_KEY` e `RESEND_API_KEY` configuradas no Vercel
- Grupos de contatos com campo "Objetivo" (descrição livre)
- Janelas de resposta variáveis (2–6 por dia, configuráveis na tela)
- Notificações por email via Resend: toggle + escopo (prioritários / todas)
- Badge de notificações no Sidebar (contatos prioritários não lidos)
- n8n Fluxo 2 implementado e validado (digest cron multi-instância)
- Campo "Segundo número" em Configurações → salva em `instances.personal_channel`
- Schema Supabase documentado em memória persistente
- **[2026-06-09] Design system mobile completo:**
  - Aplicação negativa: login page + sidebar com fundo verde, logo branca
  - Header mobile sticky (logo + Sair) em todas as abas do dashboard
  - BottomNav: fundo primaryColor, ícones brancos, item ativo em accentColor, `py-7`, sem barra indicadora — **padrão SAACS para todos os produtos**
  - Dot de grupo nas tarefas: fetch separado de `contact_groups` (fix RLS), cor preenchida
  - PWA: `manifest.json` + `apple-touch-icon` + ícone quadrado (`icone_meu_dia.png`)
  - Logo reduzida 10% em sidebar, login e header mobile
- **[2026-06-09] Chat Olivia + BIA — padrão LLM apps:**
  - Histórico agrupado por data (Hoje / Ontem / Últimos 7 dias / Últimos 30 dias / Mais antigas)
  - Input redesenhado em card branco (estilo Claude)
  - Microfone com Web Speech API (`pt-BR`) — transcreve fala para o campo de texto
  - Botão `+` com menu de anexos (Foto / Arquivo — "Em breve")

### Pendente ⏳
- **Testar microfone e chat** no celular (ainda não testado em produção)
- **Fluxo 1 n8n — segundo número**: implementado no n8n, **JSONs não exportados** ainda
- Exportar JSONs atualizados do n8n → `MCP_SAACS/Projeto MeuDIA/MeuDIA - Fluxo1.json` e `Fluxo2.json`
- Ajustar onboarding (DigestStep): explicar canais de entrega do digest
- Revisão e atualização dos 4 prompts Next.js com base no knowledge base
- Onboarding conversacional: revisar UX/textos (fases se misturam)
- Painel visual de consumo de créditos no dashboard
- Controle de créditos no Supabase (modelagem + lógica de bloqueio)
- Email proativo em tentativas de ligação bloqueadas

---

## Desenvolvimento local

```bash
npm install
npm run dev
# http://localhost:3000
```

---

## Deploy

Push no branch `main` → Vercel faz deploy automático.  
Migrations SQL: executar manualmente no Supabase SQL Editor.
