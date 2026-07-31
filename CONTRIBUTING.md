# Guia do Colaborador — MeuDIA Dashboard

Para quem entra no projeto usando Claude Code.

---

## Repos necessários

Clone os dois — eles trabalham juntos:

```bash
git clone https://github.com/saacsai/meudia-dashboard
git clone https://github.com/saacsai/saacs-brain
```

Coloque ambos na mesma pasta pai. O `CLAUDE.md` deste repo referencia `saacs-brain/` por caminho relativo.

---

## Como o Claude Code funciona aqui

1. **`CLAUDE.md`** (este repo) — lido automaticamente pelo Claude Code em toda sessão. Contém stack, credenciais de infra, regras de deploy e estado atual. **Leia antes de qualquer sessão.**

2. **`saacs-brain/sessions/SESSAO_ATUAL.md`** — estado atual de todos os produtos SAACS. Ler no início de sessões que envolvam decisões de produto ou arquitetura.

3. **`saacs-brain/CLAUDE.md`** — contexto estratégico: o que é SAACS, os produtos, os princípios. Ler uma vez para ter o panorama.

---

## Variáveis de ambiente

Peça ao Luciano o arquivo `.env.local` — não está no git. Copie para a raiz do projeto.

As mesmas variáveis precisam estar no Vercel Settings → Environment Variables para produção.

---

## Deploy

```bash
git push origin main   # Vercel faz o resto automaticamente
```

Nunca usar Vercel CLI ou upload manual de arquivos.

---

## Banco de dados

Supabase projeto: `umlmqjkahrobfnigltil`  
SQL Editor: https://app.supabase.com/project/umlmqjkahrobfnigltil/sql

Migrations estão listadas em ordem no `README.md`. Se o banco local estiver desatualizado, rode as migrations pendentes no SQL Editor.

---

## Convenções

- **Sem comentários no código** exceto quando o "porquê" é não-óbvio
- **Sem `any` TypeScript** sem `// eslint-disable` explícito
- **Supabase client**: sempre via `getSupabase()` de `@/lib/supabase` — nunca instanciar direto
- **Cores**: `PRIMARY = '#2A5F6B'`, `ACCENT = '#8FC8D4'` — não hardcodar outros valores
- **Deploy = push no main** — o CI/CD cuida do resto

---

## Contexto que não está no git

- **Templates SAACS** (`MCP_SAACS/Templates/`) — ficam na máquina do Luciano. Para padrões de componentes, consultar `saacs-brain/platform/` ou perguntar ao Luciano.
- **Memória do Claude Code** (`~/.claude/projects/`) — cada máquina tem a sua. O contexto acumulado de sessões anteriores não é compartilhado. O `CLAUDE.md` + `SESSAO_ATUAL.md` compensam isso.
- **Fluxos n8n** — JSONs em `MCP_SAACS/Projeto MeuDIA/`. Acesso via Luciano ou diretamente em https://n8n.saacs.com.br

---

## Antes da primeira sessão de trabalho

```
1. git clone dos dois repos
2. .env.local configurado
3. Ler CLAUDE.md (este repo)
4. Ler saacs-brain/sessions/SESSAO_ATUAL.md
5. npm install && npm run dev
```
