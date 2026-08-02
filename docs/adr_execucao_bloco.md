# ADR: execucao_bloco — Template vs Instância

**Data:** 2026-08-02  
**Status:** Decidido

---

## Contexto

Todo bloco na grade tem um template (`blocos_fixos`: "Academia, seg/qua/sex, 16h-17h") mas não tinha registro do que aconteceu dentro dele. O timer iria gravar início/fim, mas onde ficaria o resumo? Os encaminhamentos?

A discussão que gerou essa decisão: academias, inglês, ócio criativo e reuniões **todos** produzem contexto que a BIA precisa para gerir a grade. Não é só reunião que tem encaminhamentos.

Exemplos concretos:
- **Academia:** "treinei bíceps e tríceps → encaminhamento: treinar esse grupo em no máximo 3 dias"
- **Inglês:** "cobri vocabulário de negociação → encaminhamento: revisar em 48h (repetição espaçada)"
- **Ócio Criativo:** "conversa com Sandro → insight: posicionar o 168 como antídoto para dispersão gerencial"
- **Reunião:** "decisão: lançar no estado X antes do federal → quem decide o quê e quando?"

Sem esse registro, a BIA opera no escuro. Com ele, a BIA **sabe o que você fez, quando foi e o que está pendente**.

---

## Decisão

### Separar template de instância

```
blocos_fixos (template)
  "Academia, seg/qua/sex, 16h-17h, inegociavel"
        ↓  1 para N
execucao_bloco (instância)
  "Academia de 2026-08-01: treinei bíceps e tríceps, 16h02-17h14"
  resumo, notas, status, duracao_real_min
        ↓  1 para N
action_items (encaminhamentos)
  "Treinar bíceps/tríceps em no máximo 3 dias"
  execucao_origem_id → rastreia onde foi decidido
  janela_dias = 3    → BIA alerta quando fechar
```

### execucao_bloco é universal

Qualquer bloco que entra no timer gera um `execucao_bloco`. Não importa se é rotina (academia) ou evento (reunião). A distinção deixou de fazer sentido quando ficou claro que qualquer atividade produz contexto.

Eventos ad-hoc (reunião do Isnaldo confirmada às 22h, imprevistos) também geram `execucao_bloco` — com `bloco_fixo_id = null`.

### Snapshot no momento da execução

`execucao_bloco` copia `label` e `esfera` do template no momento da criação. Se o usuário renomear o bloco depois, o histórico fica íntegro.

---

## Por que isso alimenta a BIA

A BIA tem acesso a:

1. **O que foi planejado** (`blocos_fixos` — o template recorrente)
2. **O que realmente aconteceu** (`execucao_bloco` — com horário real, resumo, notas)
3. **O que ficou em aberto** (`action_items` — com `execucao_origem_id` rastreando a fonte)
4. **Janelas de prazo** (`action_items.janela_dias` — "academia foi há 4 dias, janela de 3 dias fechou")

Com isso a BIA pode:
- Propor blocos baseados em padrão real ("você treina bíceps a cada 3-4 dias — amanhã seria ideal")
- Cobrar encaminhamentos abertos ("você tinha 2 encaminhamentos do ócio criativo de segunda, nenhum alocado ainda")
- Reorganizar a grade quando chega uma reunião de última hora ("Isnaldo confirmou às 22h, refaço sua tarde?")
- Gerar o resumo semanal com fatos, não estimativas

---

## O que mudou no schema

| Mudança | Motivo |
|---|---|
| Nova tabela `execucao_bloco` | Template ≠ instância |
| `ocio_criativo` adicionado ao CHECK de `esfera` | Faltava em todas as tabelas |
| `action_items.execucao_origem_id` | Rastreabilidade: onde foi decidido |
| `action_items.execucao_destino_id` | Rastreabilidade: onde será executado |
| `action_items.janela_dias` | Encaminhamentos com prazo por padrão (não só data) |
| `action_items.origem` expandido para incluir `'bloco'` | Qualquer bloco pode gerar encaminhamento |

---

## Migration

`supabase_migration_execucao_bloco.sql` — rodar após `supabase_migration_168_core.sql`.
