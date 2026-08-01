# 168 — Plano de Desenvolvimento e Implementação
**Criado:** 2026-08-01  
**Base:** spec_produto.md (ler antes deste documento)

---

## Princípios do Plano

1. **Dogfooding primeiro** — cada fase deve ser utilizável por Luciano antes de avançar
2. **Core antes de integrações** — a grade + timer funcionam sem Calendar ou WhatsApp
3. **Não quebrar o que existe** — o código base do MeuDIA ainda roda; limpar progressivamente
4. **Uma fase por vez** — não iniciar fase N+1 antes de N estar no ar e testado

---

## Estado Atual

```
✅ Repo: github.com/saacsai/168-app
✅ Deploy: 168.saacs.com.br (Vercel CI/CD)
✅ Supabase: 9 tabelas no ar
✅ Código base: herdado do MeuDIA (auth, sidebar, chat, contatos)
⚠️  Home atual: ainda mostra dashboard do MeuDIA
⚠️  Onboarding: ainda é o do MeuDIA
```

---

## Fase 1 — Limpeza e Estrutura (1-2 dias)

**Objetivo:** o 168 para de parecer o MeuDIA e ganha sua própria identidade de navegação.

### Tarefas
- [ ] Remover páginas do MeuDIA que não se aplicam:
  - `app/dashboard/digest/` → deletar
  - `app/dashboard/conectar/` → mover para AJUSTES futuramente
  - `app/dashboard/assistente/` → renomear para `assistente`
- [ ] Criar estrutura de menu do 168:
  - `app/dashboard/hoje/` → nova home
  - `app/dashboard/semana/` → nova página
  - `app/dashboard/assistente/` → manter
  - `app/dashboard/ajustes/` → nova página (substitui configuracoes)
- [ ] Atualizar `components/Sidebar.tsx` com os 4 novos itens
- [ ] Redirecionar `/dashboard` → `/dashboard/hoje`

### Entregável
Navegação com 4 itens funcionando. Páginas vazias com placeholder. Deploy no ar.

---

## Fase 2 — Home: Grade 24h (3-4 dias)

**Objetivo:** a view principal do produto — a agenda real do dia em formato de grade.

### Layout da grade
```
HOJE — Sábado, 1 de agosto
┌──────┬─────────────────────────────────────────┐
│ 00h  │ ████ SONO                               │
│ 01h  │ ████ SONO                               │
│ ...  │                                          │
│ 07h  │ ████ SONO                               │
│ 08h  │                                [livre]  │
│ 09h  │                                [livre]  │
│ 10h  │ ████ TRABALHO — CooperaMais call        │
│ 11h  │ ████ TRABALHO — CooperaMais call        │
│ 12h  │ ████ ALMOÇO                             │
│ 13h  │                                [livre]  │
│ 14h  │                                [livre]  │
│ 15h  │ ████ TRABALHO — Reunião USP             │
│ 16h  │ ████ CUIDAR — Academia         [▶ INICIAR] │
│ 17h  │ ████ CUIDAR — Pós-academia              │
│ 18h  │ ████ SONO/FAMÍLIA — Jantar              │
│ ...  │                                          │
└──────┴─────────────────────────────────────────┘
```

### Cores por esfera
- SONO → cinza escuro
- CUIDAR DE MIM → verde
- CUIDAR DA FAMÍLIA → azul
- ÓCIO CRIATIVO → roxo
- TRABALHO → laranja
- PATRIMÔNIO → amarelo
- Livre → branco/cinza claro

### Componentes a criar
- `components/GradeDiaria.tsx` — grade scrollável 24h
- `components/BlocoAgenda.tsx` — bloco colorido clicável
- `components/TimerAtivo.tsx` — timer fixo no topo (sempre visível)
- `components/BlocoLivre.tsx` — slot vazio com opção de adicionar

### Fontes de dados (nesta fase: apenas blocos_fixos)
Ainda sem Calendar — a grade mostra só os blocos declarados no onboarding.

### Entregável
Grade visual do dia com blocos coloridos. Scroll 24h. Sem timer ainda.

---

## Fase 3 — Timer de Execução (2-3 dias)

**Objetivo:** transformar atividades pessoais em compromissos com peso real.

### Componente TimerAtivo (fixo no topo)
```
┌─────────────────────────────────────────┐
│ ▶ Academia          16:00 → 17:00       │
│ ████████████░░░░░░  43 min restantes    │
│                    [FINALIZAR]          │
└─────────────────────────────────────────┘
```

### Fluxo
1. Usuário clica **[INICIAR]** no bloco da grade
2. Timer começa — componente fixo aparece no topo
3. Alertas: notificação aos -10min e -5min
4. Usuário clica **[FINALIZAR]**
   - Dentro do tempo → toast de conclusão + próximo bloco em destaque
   - Fora do tempo → modal de readequação

### Modal de readequação
```
⚠️ Academia durou 1h23 (23min a mais)

Blocos afetados:
  Inglês    17:00 → agora 17:23
  Dropship  17:35 → agora 17:58
  Jantar    18:00 → agora 18:23 ← conflito com jejum!

[Aceitar readequação]  [Ajustar manualmente]  [Cancelar restantes]
```

### Notificações (PWA básico já nesta fase)
- `public/manifest.json` — já existe (herdado)
- `app/sw.js` — service worker para push notifications
- Alertas locais (sem servidor) suficientes para esta fase

### Entregável
Timer funcional com alertas e readequação automática. Dogfooding possível.

---

## Fase 4 — Onboarding: O Pacto (3-4 dias)

**Objetivo:** substituir o onboarding do MeuDIA pelo Pacto filosófico do 168.

### Telas do onboarding (sequência)

**Tela 0 — O Pacto**
```
"O 168 parte de uma premissa:
 uma vida mais disciplinada muda o patamar do jogo.

 Se você concorda com isso, continue.
 Se está buscando motivação ou propósito,
 esta não é a ferramenta certa para agora."

[CONCORDO E QUERO CONTINUAR]
```

**Tela 1 — Distribuição das 168h**
Sliders visuais: quanto para sono / CUIDAR / TRABALHO por semana.

**Tela 2 — Briefing (conversacional)**
IA faz perguntas uma a uma. Máximo 5-7 blocos declarados.
Pergunta explícita de tempo satélite: *"Quanto tempo total você reserva para a academia, incluindo deslocamento e banho?"*

**Tela 3 — Confirmação do Pacto**
Mostra o perfil construído. *"Esse é o seu pacto. Confirma?"*

### Entregável
Onboarding completo substituindo o do MeuDIA. Perfil salvo em `perfil_168` + `blocos_fixos` + `metas_168`.

---

## Fase 5 — Google Calendar (4-5 dias)

**Objetivo:** importar reuniões reais para a grade.

### OAuth Google (múltiplas contas)
- Biblioteca: `googleapis` (Node.js)
- Scopes: `calendar.readonly` (e futuramente `gmail.readonly`)
- Salvar tokens por conta em tabela `google_accounts`

### Tabela nova: google_accounts
```sql
CREATE TABLE google_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token text,
  refresh_token text,
  calendars jsonb,  -- [{id, name, ativo: bool}]
  created_at timestamptz DEFAULT now()
);
```

### Fluxo de sincronização
1. AJUSTES → Contas Google → + Adicionar conta → OAuth
2. Selecionar quais calendários de cada conta importar
3. Webhook ou polling a cada 15min → atualiza `reunioes` no Supabase
4. Grade do dia mostra reuniões do Calendar junto com blocos fixos

### Conflitos Calendar vs blocos_fixos
Se reunião do Calendar sobrepõe bloco fixo inegociável → alerta imediato:
*"Reunião CooperaMais (Isnaldo) conflita com Academia. Aceitar ou recusar convite?"*

### Entregável
Grade do dia com reuniões reais do Calendar. Multi-conta funcionando.

---

## Fase 6 — Semana e Ritual Semanal (2-3 dias)

**Objetivo:** view de 168h + ritual guiado todo domingo.

### View da semana
Grade 7 dias × 24h. Mesma lógica da grade diária, condensada.
Permite visualizar equilíbrio T×D da semana toda.

### Ritual semanal (domingo ou segunda)
IA conduz sessão de 15-30min:
1. Exibe semana atual pré-preenchida (sono + Calendar + blocos fixos)
2. *"Você tem Xh de CUIDAR esta semana. Seu pacto pede Y. Quer ajustar?"*
3. Slots livres → sugestão de atividades pendentes da fila
4. Confirmação: semana planejada e travada

### Entregável
View semanal + modal do ritual com guia da IA.

---

## Fase 7 — WhatsApp: Grupos e Intenção (3-4 dias)

**Objetivo:** a IA monitora apenas quem importa, com a intenção certa.

### AJUSTES → WhatsApp
- Conexão via QR (Evolution API — herdado do MeuDIA)
- Lista de contatos importados
- Criação de grupos com membros
- Seleção de intenção por grupo (4 opções)

### Motor de processamento (n8n Fluxo 1 refatorado)
- Remove resposta automática a terceiros
- Mantém captura de mensagens
- Aplica intenção do grupo
- Para mensagens diretas ambíguas: pergunta ao usuário uma vez, aprende

### Entregável
WhatsApp conectado, grupos configurados, IA processando com intenção correta.

---

## Fase 8 — Assistente em Tempo Real (3-4 dias)

**Objetivo:** o companheiro 24x7 — input rápido, captura de contexto, voz.

### Interface
- Chat simples (herdado do MeuDIA, adaptado)
- Input de voz via Web Speech API
- Mensagens curtas durante reuniões ("importante, depois explico")
- IA retém contexto e cobra follow-up

### Integração com agenda
- O assistente sabe o que está na grade do dia
- Pode sugerir readequação quando você reporta atraso
- Captura insights e transforma em action_items

### Entregável
Chat funcional com voz + integração com agenda.

---

## Fase 9 — Auditoria Noturna e Aprendizado (2-3 dias)

**Objetivo:** fechar o ciclo diário e descobrir blocos que faltam.

### Fluxo noturno (horário configurável, ex: 22h)
1. IA analisa: quais blocos foram iniciados/finalizados vs. planejados
2. Identifica gaps não explicados
3. Pergunta sobre atividades não agendadas
4. Confronta quebras do pacto (sem aceitar justificativa abstrata)
5. Sugere novos blocos fixos quando padrão se repete 3x

### Entregável
Auditoria noturna via WhatsApp ou notificação PWA. Sugestões de blocos na tela AJUSTES.

---

## Fase 10 — PWA Completo (1-2 dias)

**Objetivo:** instalar no celular com experiência próxima de app nativo.

### Tarefas
- [ ] `public/manifest.json` — ícones, nome, cores do 168
- [ ] `app/sw.ts` — service worker com push notifications
- [ ] Testar instalação Android + iOS
- [ ] Notificações de timer em background (Android)

---

## Fase 11 — Google Meet (futuro)

Transcrição automática de reuniões via Google Drive API.
Depende da Fase 5 (Calendar) estar estável.

---

## Fase 12 — Gmail (futuro)

Scan de emails de contas conectadas para action items.
Depende da Fase 5 (Calendar/OAuth) estar estável.

---

## Resumo de Fases e Estimativas

| Fase | O que entrega | Dias est. | Dogfooding possível |
|------|---------------|-----------|---------------------|
| 1 | Navegação 168 (limpa MeuDIA) | 1-2 | ❌ |
| 2 | Grade 24h do dia | 3-4 | ⚠️ visual apenas |
| 3 | Timer + readequação | 2-3 | ✅ usa todo dia |
| 4 | Onboarding / Pacto | 3-4 | ✅ configura perfil |
| 5 | Google Calendar | 4-5 | ✅ reuniões reais |
| 6 | View semanal + ritual | 2-3 | ✅ planeja semana |
| 7 | WhatsApp grupos | 3-4 | ✅ filtra ruído |
| 8 | Assistente tempo real | 3-4 | ✅ companheiro |
| 9 | Auditoria noturna | 2-3 | ✅ aprende rotina |
| 10 | PWA completo | 1-2 | ✅ no celular |
| 11 | Google Meet | futuro | — |
| 12 | Gmail | futuro | — |

**Total estimado fases 1-10:** ~30-35 dias de desenvolvimento (não necessariamente consecutivos — respeitando metodologia 2h/dia por projeto)

---

## Ordem de Prioridade para Dogfooding Real

Para que Luciano consiga usar o 168 no dia a dia o mais rápido possível:

```
Fase 1 + 2 + 3 → grade + timer funcionando = produto mínimo utilizável
Fase 4          → onboarding = perfil real configurado
Fase 5          → Calendar = reuniões reais na grade
Fases 6-10      → completam a visão do produto
```

**Meta:** após Fase 3, o 168 já resolve o problema da academia que foi cancelada.
