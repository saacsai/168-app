# ADR: 168 vira MCP-first — desvincula do sequenciamento UNISOL, derruba BIA/dashboard-primário

**Data:** 2026-10-31
**Status:** Decidido (direção de produto), implementação ainda não iniciada
**Supersede parcialmente:** `adr_whatsapp_first_e_motor_unisol.md` (29/09/2026) — ver seção
"O que muda em relação ao ADR anterior" abaixo. O motor de push construído na UNISOL (Fase 0)
continua válido e tem valor próprio lá (prestação de contas dos técnicos de campo); o que cai é
o **sequenciamento** ("168 só mexe depois de provado na UNISOL").

---

## Contexto

Sessão de brainstorming longa (31/10/2026), puxada por uma reflexão sobre padrões cíclicos na
vida/carreira do Luciano e por uma lembrança direta do desenvolvimento do MCP SAACS: naquele
projeto, o erro foi deixar o MCP absorver responsabilidades de sistema (login, controle de
conta) que não eram dele — "estava transformando ele num sistema, perdendo a essência de um MCP
em si" (palavras dele). Ao revisar o 168 sob essa lente, percebeu o mesmo padrão se repetindo:
BIA (assistente interno do 168) é uma versão mais pobre do Claude — menos contexto, prompt
estático, sem acesso ao resto da vida/trabalho dele que o Claude (via Code/Desktop/Cowork) já
tem. Treinar um assistente novo dentro do 168 não faz sentido quando o assistente que ele já usa
pra quase tudo é o Claude.

## Decisão

### 1. Arquitetura: MCP como núcleo do método, dashboard como camada fina de conta/input

- **MCP** = o núcleo do método 168 (regras, metodologia, acesso aos dados da semana). É isso que
  dá ao Claude — de qualquer superfície onde o Luciano (ou qualquer usuário do 168) já estiver
  conversando — "percepção total da semana" pra virar "lembrador, cobrador, conselheiro".
- **Dashboard** = só controla login, conta, billing, e input sistematizado onde fizer sentido
  (não é mais a interface primária de uso). Mesmo padrão já usado por MCPs pagos oficiais
  (Stripe, Vercel): auth/conta no produto de sempre, MCP como casca fina de protocolo por cima
  do mesmo backend.
- **BIA (assistente interno, prompt estático) é eliminada.** A personalidade/filosofia do método
  ("não pergunta onde cabe, pergunta o que cede", o Pacto) migra pra dentro das instruções das
  ferramentas MCP (ou de uma Skill), não pra um system prompt de chatbot separado.

### 2. Onboarding e captura de dados: conversacional, sem formulário

- **Schema flexível desde o início** — não "Claude gera CREATE TABLE ao vivo por usuário" (risco
  de estabilidade/segurança equivalente ao erro do MCP SAACS, só que em DDL). Em vez disso: uma
  estrutura fixa tipo `campos_customizados` (user_id, nome do campo, tipo, valor) ou coluna
  JSONB no perfil do usuário. O Claude decide **o que** registrar (via uma ferramenta MCP tipo
  `definir_campo`/`salvar_resposta`), nunca **como** o banco é estruturado.
- **Sem tela de formulário.** Claude pergunta, usuário responde em conversa normal, Claude
  registra — mesmo mecanismo orgânico que já constrói memória sobre o Luciano nas sessões de
  Claude Code, generalizado via MCP pra qualquer superfície. Onboarding inicial (denso: perfil,
  metas, blocos inegociáveis) pode precisar de um ritmo diferente (blocos maiores de pergunta, não
  campo a campo) pra não virar "20 perguntas" cansativo — ongoing/incremental é onde o modelo
  pergunta-resposta brilha mais.
- **Auditoria/revisão**: sem tela fixa de revisão — o usuário pede ("me mostra o que você sabe
  sobre minha semana") e o Claude responde, gerando um Artifact sob demanda se fizer sentido, não
  um dashboard mantido.

### 3. Features cortadas (não entregavam valor, geravam fricção)

- **Grade/calendário como tela fixa do sistema** — o valor nunca foi a tela, foi o assistente
  poder sugerir e cobrar. Cada um usa a superfície que preferir (até um Artifact gerado na hora).
- **Timer de execução de bloco (Iniciar/Finalizar, alertas visuais)** — feature que complicava
  sem entregar valor real; ninguém quer ficar clicando timer pra registrar o que já fez.

### 4. WhatsApp/email: leitura passiva, nunca resposta — reverte decisão de 07/08/2026

A decisão anterior ("BIA NÃO monitora grupos de WhatsApp — usuário é o filtro") existia pra
evitar o risco de a IA responder por engano a alguém que não devia. Com a resposta tirada da
equação (a IA só lê, interpreta, organiza e aconselha — **nunca responde**, só o Luciano
responde), o risco que motivava aquela regra desaparece, então a regra também cai.

Caso de uso real que validou a mudança: grupo de WhatsApp de ~50 colegas de faculdade (Direito),
onde ~95% das mensagens são ruído e ~5% é sinal real (PDFs de professor, avisos de coordenação
compartilhados pelos representantes de turma). Tentativa de resolver pedindo upload em nuvem já
falhou (ninguém faz) — captura passiva pelo próprio número conectado (Evolution) resolve sem
depender de comportamento de terceiros.

**Arquitetura do fluxo**: Evolution (número próprio, já pareado) → n8n faz a ingestão mecânica
(extrai anexos, guarda bruto) → MCP conecta esse material ao Claude, que classifica urgência/
importância **em relação à grade 168** (não isoladamente — "é urgente" é sempre relativo a um
bloco/compromisso real), e aconselha o melhor aproveitamento da semana.

**Pontos ainda em aberto** (não travam a decisão, só não foram fechados nesta sessão):
- Se a classificação de urgência roda dentro do n8n (regra fixa) ou é decidida pelo Claude via
  MCP quando o usuário pergunta (mais flexível, mesma lógica de "schema flexível" acima).
- Se o conteúdo bruto de grupos (os 95% de ruído) é retido indiscriminadamente ou só o que for
  sinalizado como sinal (PDF, aviso) é persistido.

### 5. Monetização: MCP pago, trial de 30 dias

- Autenticação via OAuth no próprio MCP (mesmo padrão de MCPs pagos oficiais).
- Assinatura Stripe com trial — **relógio começa no fim do onboarding (Pacto), não no
  cadastro**, pra não comer dias de trial com tempo de configuração antes da pessoa sentir o
  produto funcionando.
- **Dado nunca é apagado por falta de pagamento** — só o acesso às ferramentas MCP é travado
  (ou vira somente leitura) até reativar. Reduz fricção de retorno e evita o risco ético/de
  confiança de apagar "a base de dados da vida" de alguém.
- Cada chamada de ferramenta MCP confere status de assinatura antes de executar; se expirado,
  devolve mensagem clara (não falha silenciosa) pro Claude repassar ao usuário.

## O que muda em relação ao ADR anterior (29/09/2026)

| Tema | ADR anterior (29/09) | Este ADR (31/10) |
|---|---|---|
| Sequenciamento | 168 só mexe depois do motor provado na UNISOL | Desvinculado — frentes independentes |
| Interface primária | WhatsApp (push), dashboard secundário | MCP (pull, de qualquer superfície Claude) + push via WhatsApp como canal complementar, não substituto |
| Assistente | Motor migra pra dentro do 168 (ainda um "agente" próprio) | BIA eliminada — o assistente é o Claude, via MCP |
| Captura de dado | Check-in/check-out + relato por áudio, schema fixo do domínio | Conversacional livre, schema flexível, Claude decide o que rastrear |
| WhatsApp de terceiros | Usuário é o filtro, decisão de 07/08 mantida implicitamente | Leitura passiva de grupos permitida — resposta nunca acontece, risco original não se aplica mais |

O achado técnico real do ADR anterior (WhatsApp do 168 hoje é modelo conta-pareada,
`instanceName = meudia_${user.id}`, não serve pro padrão de envio em massa) continua válido e
relevante — só que agora o "padrão de envio em massa" não é mais o foco central do pivô, é só
uma peça complementar (push) de uma arquitetura maior (MCP).

## Status de implementação (atualizado 31/10/2026, mesma sessão)

Rebuild iniciado e primeiro recorte do MCP já no ar em produção (`168.lucianomaeda.com.br/api/mcp`),
testado ponta a ponta com dado real. Resolve os 3 pontos de dor pessoais que motivaram o escopo
do MVP (e-mail fragmentado, agenda fora do loop, WhatsApp desconectado).

**Ferramentas MCP registradas:**
- `salvar_dado_customizado` / `listar_dados_customizados` / `marcar_dado_resolvido` — schema
  flexível (tabela `campos_customizados`: categoria/nome/valor JSONB), conforme decidido na
  seção 2. Claude decide o que registrar, nunca altera estrutura de banco.
- `buscar_emails` — multiconta (`contas_email_conectadas`), OAuth próprio por conta (não é o
  login do Supabase Auth), `gmail.readonly`, testado com 3 contas reais (AUA, pessoal, marca).
- `buscar_agenda` — mesmo padrão multiconta, `calendar.readonly`, testado com evento real.
- `buscar_whatsapp` — ver detalhe abaixo.

**WhatsApp — pontos em aberto da seção 4 resolvidos na prática:**
- Classificação de urgência: fica a cargo do Claude **no momento da leitura** via MCP (opção
  "mais flexível"), não como regra fixa na ingestão. A descrição da ferramenta já instrui o
  Claude a classificar relativo à grade/compromissos do usuário.
- Retenção de conteúdo bruto: tudo que chega é persistido (não filtra ruído vs. sinal na
  ingestão) — simplicidade de implementação; pode virar política de retenção/limpeza depois, se o
  volume de grupos grandes justificar.
- **Ingestão simplificada em relação ao desenho original**: o webhook da Evolution aponta direto
  pra uma rota mecânica no próprio Next.js (`/api/whatsapp/ingest`), sem passar por n8n. Mesmo
  resultado (mecânico, sem IA, sem resposta), menos uma peça de infra pra manter — n8n fica livre
  pra outros produtos.
- Reaproveitada a instância Evolution já existente (`teste_seudia`, número pessoal do Luciano, já
  pareado antes) em vez de criar uma nova — só reconfigurado webhook + desligado
  `syncFullHistory` (não precisa reimportar as 100k+ mensagens antigas da instância).

**Achado de schema**: `app/api/whatsapp/route.ts` (herdado do MeuDIA, usado pela UI de conectar
em `/dashboard/conectar`) referencia colunas (`status`, `active`, `paused`) que **não existem**
na tabela `instances` real (ver `supabase_migration_00_base.sql`) — bug pré-existente, nunca
exercitado a sério antes. A nova rota de ingestão foi escrita contra o schema real. A UI antiga
de conectar ainda não foi corrigida (não bloqueou nada porque a conexão foi feita direto via API
da Evolution) — ver pendências no `project_168.md`.

**Pendente (próximos incrementos, não iniciados):**
- Camada de billing/OAuth por usuário real (hoje é single-user/dogfood, `OWNER_EMAIL` fixo em
  `lib/owner.ts`).
- Corrigir ou aposentar `app/api/whatsapp/route.ts` (UI antiga de conectar com bug de schema).
- Política de retenção de WhatsApp de grupo grande (se necessário, depois de uso real).
- Avaliar tabelas ainda não revisadas da auditoria (`execucao_bloco`, `reunioes`, `action_items`).
