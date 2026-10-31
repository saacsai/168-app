import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// TODO (próximo incremento, junto com o billing): isso hoje é single-user,
// fixado no e-mail do Luciano — ainda não existe fluxo de OAuth no MCP pra
// resolver "quem está chamando" por token. Ver docs/adr_mcp_first_desvinculacao_unisol.md.
const OWNER_EMAIL = 'luciano.maeda@saacs.com.br';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

let cachedUserId: string | null = null;
async function resolveOwnerUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const sb = supabaseAdmin();
  // auth.admin.listUsers pagina — 168 tem poucos usuários hoje (fase dogfood),
  // então a primeira página já basta.
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(`Falha ao resolver usuário: ${error.message}`);
  const user = data.users.find(u => u.email === OWNER_EMAIL);
  if (!user) throw new Error(`Usuário ${OWNER_EMAIL} não encontrado em auth.users.`);
  cachedUserId = user.id;
  return user.id;
}

const handler = createMcpHandler(
  server => {
    server.registerTool(
      'salvar_dado_customizado',
      {
        description:
          'Registra um dado solto da vida/rotina do usuário que não tem um lugar fixo no sistema ' +
          '(ex: conta a pagar, lembrete, nota livre). Use quando o usuário mencionar algo que vale ' +
          'acompanhar mas que não é um bloco de agenda nem uma meta formal — ex: "tenho que pagar a ' +
          'conta de luz dia 5", "preciso revisar aquele contrato semana que vem".',
        inputSchema: z.object({
          categoria: z
            .string()
            .describe('Classificação livre decidida por você, ex: "conta_a_pagar", "lembrete", "nota_livre".'),
          nome: z.string().describe('Nome curto do que está sendo registrado, ex: "Conta de luz".'),
          valor: z
            .record(z.string(), z.any())
            .describe(
              'Conteúdo livre em formato objeto, ex: {"vencimento": "2026-11-05", "valor_reais": 320}. ' +
                'Inclua só os campos que fizerem sentido pro dado em questão.'
            ),
        }),
      },
      async ({ categoria, nome, valor }) => {
        const sb = supabaseAdmin();
        const userId = await resolveOwnerUserId();
        const { data, error } = await sb
          .from('campos_customizados')
          .insert({ user_id: userId, categoria, nome, valor })
          .select('id, categoria, nome, valor, status, created_at')
          .single();
        if (error) {
          return { content: [{ type: 'text', text: `Erro ao salvar: ${error.message}` }], isError: true };
        }
        return {
          content: [
            { type: 'text', text: `Registrado: "${data.nome}" (${data.categoria}), id ${data.id}.` },
          ],
        };
      }
    );

    server.registerTool(
      'listar_dados_customizados',
      {
        description:
          'Lista os dados soltos já registrados pelo usuário (contas a pagar, lembretes, notas), ' +
          'opcionalmente filtrados por categoria ou status. Use pra responder "o que tenho pendente", ' +
          '"quais contas estão por vencer", etc.',
        inputSchema: z.object({
          categoria: z.string().optional().describe('Filtra por categoria exata, se informado.'),
          status: z
            .enum(['ativo', 'resolvido', 'arquivado'])
            .optional()
            .default('ativo')
            .describe('Filtra por status. Padrão: só os ativos.'),
        }),
      },
      async ({ categoria, status }) => {
        const sb = supabaseAdmin();
        const userId = await resolveOwnerUserId();
        let query = sb
          .from('campos_customizados')
          .select('id, categoria, nome, valor, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (status) query = query.eq('status', status);
        if (categoria) query = query.eq('categoria', categoria);
        const { data, error } = await query;
        if (error) {
          return { content: [{ type: 'text', text: `Erro ao listar: ${error.message}` }], isError: true };
        }
        if (!data?.length) {
          return { content: [{ type: 'text', text: 'Nenhum dado registrado com esse filtro.' }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.registerTool(
      'marcar_dado_resolvido',
      {
        description:
          'Marca um dado customizado (ex: uma conta a pagar) como resolvido, pra sair da lista de ' +
          'pendências ativas. Use quando o usuário confirmar que já cuidou de algo.',
        inputSchema: z.object({
          id: z.string().describe('ID do registro (retornado por listar_dados_customizados).'),
        }),
      },
      async ({ id }) => {
        const sb = supabaseAdmin();
        const userId = await resolveOwnerUserId();
        const { error } = await sb
          .from('campos_customizados')
          .update({ status: 'resolvido', resolvido_em: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Marcado como resolvido.' }] };
      }
    );
  },
  {
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };
