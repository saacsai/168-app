# ADR: 168 vira WhatsApp-first — motor nasce validado na UNISOL primeiro

**Data:** 2026-09-29
**Status:** Decidido (ordem de execução), construção ainda não iniciada

---

## Contexto

168 ficou 36 dias sem uso real do próprio Luciano, apesar de ser "a menina dos olhos" entre os
projetos dele. Não por falta de prioridade — o formato atual (dashboard web, calendário
sincronizado com Google, que nem estava funcionando) não emplacou no uso do dia a dia. Isso é
sinal real de fricção, mais confiável que qualquer spec.

Hipótese levantada: o 168 está seguindo o padrão arquitetural herdado do MeuDIA e reaplicado nos
outros sistemas do ecossistema (Cooperliga, sistema UNISOL) — dashboard-first, gestão ativa numa
tela. Talvez o 168 devesse ser, em vez disso, **um agente operando quase 100% no WhatsApp**, onde
o padrão de interação é: planejamento leve uma vez por semana, agenda do dia entregue toda manhã,
check-in/check-out nos blocos, e interação real só quando algo foge do combinado (cancelamento,
atraso, imprevisto). No caminho normal, a pessoa quase não interage — o sistema só registra.

Discussão completa (incluindo o paralelo com o sistema UNISOL, que precisa de um mecanismo quase
idêntico para técnicos de campo relatarem trabalho) está registrada em
`~/.claude/projects/-Users-lucianomaeda/memory/project_168.md` e
`~/.claude/projects/-Users-lucianomaeda/memory/project_diagnostico_unisol.md`.

## Decisão

### 1. Pivô de arquitetura: WhatsApp como canal primário, dashboard como secundário/opcional

Fluxo alvo:
1. **Segunda de manhã** (ou domingo — ritual semanal já previsto na spec): planejamento leve da
   semana, provavelmente ainda com uma superfície visual leve (distribuir 168h por chat puro texto
   é difícil de visualizar) — mas o resto do fluxo é WhatsApp.
2. **Toda manhã**: agente entrega a agenda do dia via WhatsApp, com prerrogativa de ajustar.
3. **Início/fim de cada bloco**: check-in/check-out (toque mínimo — sem isso o agente não sabe o
   que aconteceu, já que não existe sensor externo pra atividade pessoal).
4. **Relato de atividade — preferencialmente por ÁUDIO do WhatsApp**, não texto digitado. Falando,
   a pessoa naturalmente narra pauta/contexto/encaminhamento; digitando, tende a encurtar pro
   mínimo. Áudio produz matéria-prima melhor pra qualquer geração de relatório por IA depois.
5. **Default = quase zero interação** (só grava no banco). **Exceção** (cancelamento, atraso,
   ultrapassagem de hora) = motor de realocação entra em ação ("o que cede?").

### 2. Ordem de execução: o motor nasce na UNISOL, não no 168

**Não construir isso dentro do 168 primeiro.** Motivo: dogfooding solo do 168 já rodou sem
produzir uso real (os 36 dias são a prova) — repetir "construir e esperar eu mesmo validar sozinho"
tem alta chance de repetir o mesmo resultado. O sistema da UNISOL Brasil
([[project_diagnostico_unisol]]) precisa de um mecanismo quase idêntico pros ~35-40
profissionais de campo relatarem trabalho mensal (prestação de contas de horas pro TransfereGov)
— com peso real (pagamento, cobrança institucional), não dogfooding solo.

**Plano**: construir o motor (agenda diária + relato por áudio + check-in/check-out + realocação
por exceção) como recurso próprio da UNISOL primeiro, escopado de forma bem mais estreita que o
168 completo (só as horas que o contrato de cada técnico prevê pro projeto, não a semana de 168h
inteira da pessoa — sem Matriz T×D, sem esferas de vida pessoal). Uma vez provado com uso real,
**migrar o motor pro 168** — não reconstruir do zero.

### 3. Consequência técnica: motor tem que nascer extraível

O motor (endpoints, lógica de agenda/relato/realocação, transcrição de áudio) deve ser construído
como módulo desacoplado desde o início — não hardcoded dentro do schema/código específico da
UNISOL — justamente para poder migrar pro 168 depois sem reescrever.

### 4. Achado técnico real (não assumido — verificado no código)

O WhatsApp do 168 hoje (`app/api/whatsapp/route.ts`, `app/api/whatsapp/bia/route.ts`) é modelo
**conta-pareada**: cada usuário conecta o PRÓPRIO WhatsApp via QR code (`instances` table,
Evolution API self-hosted em `evolution.saacs.com.br`, herdado do MeuDIA — `instanceName =
meudia_${user.id}...`, prefixo que não pode mudar, já documentado como risco em rebrand anterior),
e o bot responde aos contatos pessoais do usuário (triagem de inbox). **Esse não é o modelo certo
pro motor novo.** O motor precisa do padrão mais simples já usado noutros produtos SAACS (ex:
`lib/evolution.ts` do vaikeuvou, usado pro lembrete de check-in de eventos): 1 instância enviando
mensagem PRA MUITOS números diferentes (outbound), não pareamento pessoal 1:1.

**Nenhuma transcrição de áudio existe hoje em nenhum dos dois repos** (168 ou UNISOL) — é
construção nova, não reaproveitamento de algo que já funciona.

## Próximo passo

Plano de ação formal (fases, schema, endpoints) desenhado em modo de planejamento, com aprovação
explícita antes de qualquer código — a construção em si ainda não começou.
