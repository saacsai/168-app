# 168 Dashboard — Regras operacionais para Claude

Leia este arquivo antes de qualquer tarefa neste repo.

---

## O Produto

**168** = app de propósito de vida baseado nas 168 horas semanais.  
Spec completa: `/Users/lucianomaeda/meudia-dashboard/Novo/spec_168_produto_completo.md`

---

## Acesso à infraestrutura

**VPS SAACS** — acessível diretamente via SSH:
```bash
ssh root@82.112.244.174
```
Chave já configurada. Não perguntar credenciais — conectar direto.

**Evolution API key** (global, todas as instâncias):
```
28bad1a004a318d3f7ba983f466b7168
```

**n8n**: https://n8n.saacs.com.br

---

## Deploy

**Deploy = `git push` no branch `main`** → Vercel faz CI/CD automático.

Nunca sugerir deploy manual, upload de arquivos, ou comandos Vercel CLI. Push no git é suficiente.

---

## Variáveis de ambiente

- `.env.local` → desenvolvimento local
- Vercel Settings → Environment Variables → produção
- As duas precisam ser atualizadas quando uma nova variável é criada

---

## Repos

| Repo | Propósito |
|---|---|
| `saacsai/168-app` | Código operacional (este repo) |
| `saacsai/saacs-brain` | Decisões estratégicas, prompts, ADRs |
| `MCP_SAACS/` (local) | Templates, JSONs n8n, arquivos de projeto |
