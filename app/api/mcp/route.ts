import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { supabaseAdmin, resolveOwnerUserId } from '@/lib/owner';
import { buscarEmailsMultiConta, buscarAgendaMultiConta } from '@/lib/gmail-accounts';

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

    server.registerTool(
      'buscar_emails',
      {
        description:
          'Busca emails nas contas de Gmail conectadas do usuário (podem ser várias — pessoal, ' +
          'institucional, etc). Só leitura — nunca envia nem responde email. Use query no formato de ' +
          'busca do Gmail: "newer_than:3d", "from:fulano@email.com", "subject:reunião", ' +
          '"has:attachment filename:.ics", "is:unread". Combine termos se precisar.',
        inputSchema: z.object({
          query: z.string().describe('Query de busca no formato do Gmail.'),
          conta: z
            .string()
            .optional()
            .describe('E-mail ou apelido de uma conta específica (ex: "AUA"). Omitir pra buscar em todas as contas conectadas.'),
          maxResults: z.number().int().min(1).max(50).optional().default(10).describe('Máximo de emails por conta.'),
        }),
      },
      async ({ query, conta, maxResults }) => {
        try {
          const emails = await buscarEmailsMultiConta(query, maxResults, conta);
          if (!emails.length) {
            return { content: [{ type: 'text', text: 'Nenhum email encontrado (ou nenhuma conta conectada ainda — ver /api/email-accounts/connect).' }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify(emails, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro ao buscar emails: ${String(e)}` }], isError: true };
        }
      }
    );
    server.registerTool(
      'buscar_agenda',
      {
        description:
          'Busca eventos de agenda (Google Calendar) nas contas conectadas do usuário (podem ser ' +
          'várias — pessoal, institucional, etc). Só leitura — nunca cria, edita ou cancela evento. ' +
          'Use pra responder "o que tenho hoje/essa semana", "tenho reunião marcada com X", etc. ' +
          'timeMin e timeMax em ISO 8601 (ex: "2026-11-01T00:00:00-03:00").',
        inputSchema: z.object({
          timeMin: z.string().describe('Início do intervalo de busca, ISO 8601.'),
          timeMax: z.string().describe('Fim do intervalo de busca, ISO 8601.'),
          conta: z
            .string()
            .optional()
            .describe('E-mail ou apelido de uma conta específica (ex: "AUA"). Omitir pra buscar em todas as contas conectadas.'),
          maxResults: z.number().int().min(1).max(50).optional().default(20).describe('Máximo de eventos por conta.'),
        }),
      },
      async ({ timeMin, timeMax, conta, maxResults }) => {
        try {
          const eventos = await buscarAgendaMultiConta(timeMin, timeMax, maxResults, conta);
          if (!eventos.length) {
            return { content: [{ type: 'text', text: 'Nenhum evento encontrado nesse intervalo (ou nenhuma conta com permissão de agenda — pode ser preciso reconectar em /api/email-accounts/connect).' }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify(eventos, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro ao buscar agenda: ${String(e)}` }], isError: true };
        }
      }
    );
  },
  {
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };
