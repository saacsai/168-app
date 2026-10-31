import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { supabaseAdmin, resolveOwnerUserId } from '@/lib/owner';
import { buscarEmailsMultiConta, buscarAgendaMultiConta } from '@/lib/gmail-accounts';
import { buscarMensagensWhatsapp, excluirContatoWhatsapp, listarContatosExcluidosWhatsapp } from '@/lib/whatsapp';
import { verPerfil168, atualizarPacto168, listarMetas168, salvarMeta168, listarBlocosFixos, salvarBlocoFixo, prepararPlanejamento, marcarRitualFeito } from '@/lib/metodo168';

const METODO_168 =
  'MÉTODO 168: as 168h da semana são o recurso fixo. Regra de ouro — nunca pergunte "onde cabe?", ' +
  'pergunte "o que cede?": toda demanda nova compete por tempo que já está (ou deveria estar) ' +
  'alocado, nunca cai em espaço vazio. Matriz T×D: Sono (padrão 56h, inegociável) + esfera TEMPO ' +
  '(Cuidar de Mim, Cuidar da Família) + esfera DINHEIRO (Trabalho, Patrimônio/Obrigações). Uma ' +
  'semana sem CUIDAR visível não é ocupada, é furada. Blocos marcados inegociável=true não cedem ' +
  'pra demanda externa sem negociação explícita com o usuário.';

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
          'institucional, etc). Só leitura — nunca envia nem responde email. Calibração do usuário: ' +
          'cerca de 95% do volume é ruído (newsletter, marketing, notificação automática) e só ~5% ' +
          'é sinal real — priorize reuniões (convite/.ics), datas de evento e prazos de entrega ao ' +
          'triar, não liste tudo indiscriminadamente. Use query no formato de busca do Gmail: ' +
          '"newer_than:3d", "from:fulano@email.com", "subject:reunião", "has:attachment ' +
          'filename:.ics", "is:unread". Combine termos se precisar.',
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
    server.registerTool(
      'buscar_whatsapp',
      {
        description:
          'Lê mensagens de WhatsApp já recebidas (ingeridas em segundo plano via webhook). Só ' +
          'leitura — nunca envia ou responde mensagem, essa ferramenta não tem essa capacidade. ' +
          'Calibração do usuário sobre onde está o sinal: em conversas 1:1, ~20% das mensagens ' +
          'respondem por ~80% do que importa pra gestão de tempo dele (regra 80/20) — o resto é ' +
          'conversa social. Em grupos, a proporção é mais extrema: ~95% é ruído, só ~5% é sinal ' +
          'real (normalmente reuniões marcadas, datas de evento, prazo de entrega, material/anexo ' +
          'relevante). Use isso pra triar com peso adequado, não liste tudo com a mesma prioridade ' +
          '— classifique sempre relativo à grade de compromissos do usuário (ver ver_metodo_168), ' +
          'não isoladamente.',
        inputSchema: z.object({
          desde: z.string().optional().describe('ISO 8601 — só mensagens a partir desse momento.'),
          contato: z.string().optional().describe('Filtra por nome de contato/grupo ou número (busca parcial).'),
          apenasGrupos: z.boolean().optional().describe('Se true, só mensagens de grupos.'),
          apenasRecebidas: z.boolean().optional().describe('Se true, exclui mensagens enviadas pelo próprio usuário.'),
          busca: z.string().optional().describe('Busca parcial no texto da mensagem.'),
          maxResults: z.number().int().min(1).max(100).optional().default(30),
        }),
      },
      async ({ desde, contato, apenasGrupos, apenasRecebidas, busca, maxResults }) => {
        try {
          const msgs = await buscarMensagensWhatsapp({ desde, contato, apenasGrupos, apenasRecebidas, busca, maxResults });
          if (!msgs.length) {
            return { content: [{ type: 'text', text: 'Nenhuma mensagem encontrada (ou WhatsApp ainda não conectado/sincronizando).' }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify(msgs, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro ao buscar mensagens: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'excluir_contato_whatsapp',
      {
        description:
          'Marca um contato ou grupo do WhatsApp como excluído — nenhuma mensagem dele entra no ' +
          'banco a partir de agora (nem temporariamente), nunca mais aparece em buscar_whatsapp. ' +
          'Use quando o usuário pedir pra nunca mais ler conversas com alguém específico (ex: ' +
          '"não leia minhas conversas com a Fulana"). Descubra o remoteJid chamando buscar_whatsapp ' +
          'primeiro, filtrando por contato, e usando o remote_jid retornado. Não apaga mensagens já ' +
          'gravadas antes da exclusão.',
        inputSchema: z.object({
          remoteJid: z.string().describe('O remote_jid exato do contato/grupo (ex: "5511999999999@s.whatsapp.net" ou "...@g.us").'),
          apelido: z.string().optional().describe('Nome pra lembrar quem é, opcional.'),
        }),
      },
      async ({ remoteJid, apelido }) => {
        try {
          await excluirContatoWhatsapp(remoteJid, apelido);
          return { content: [{ type: 'text', text: `Contato ${apelido ?? remoteJid} excluído — mensagens dele não serão mais gravadas.` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro ao excluir contato: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'listar_contatos_excluidos_whatsapp',
      {
        description: 'Lista os contatos/grupos de WhatsApp atualmente excluídos da ingestão.',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const contatos = await listarContatosExcluidosWhatsapp();
          if (!contatos.length) return { content: [{ type: 'text', text: 'Nenhum contato excluído.' }] };
          return { content: [{ type: 'text', text: JSON.stringify(contatos, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'ver_metodo_168',
      {
        description:
          METODO_168 +
          ' Esta ferramenta devolve o estado atual do método pro usuário: o Pacto (briefing, ' +
          'distribuição das 168h), as metas ativas por esfera/horizonte, e os blocos fixos ' +
          '(inegociáveis). Chame isso no início de qualquer conversa onde o usuário mencione agenda, ' +
          'tempo, prioridade ou equilíbrio de vida — é o contexto que faltava pra decisões serem ' +
          'relativas à grade real dele, não genéricas. Se pacto_aceito vier false ou o perfil vier ' +
          'nulo, o usuário ainda não passou pelo Pacto — conduza a conversa de onboarding (pergunte ' +
          'o que travou, o que mudou, como quer distribuir as 168h) e registre com atualizar_pacto_168. ' +
          'IMPORTANTE — autoverificação de ritual: o 168 nunca inicia conversa sozinho (só lê, nunca ' +
          'envia mensagem), então é no INÍCIO de uma conversa nova que você checa isso. Se ' +
          'ritual_diario_pendente vier true, proponha fazer o planejamento do dia (preparar_planejamento ' +
          'tipo "dia") antes de seguir pro resto do pedido do usuário — a não ser que o pedido seja ' +
          'claramente urgente/pontual, caso em que resolve isso primeiro e propõe o ritual depois. Mesma ' +
          'lógica pra ritual_semanal_pendente, mas sem insistir todo dia — uma vez por semana basta.',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const [perfil, metas, blocos] = await Promise.all([
            verPerfil168(),
            listarMetas168('ativa'),
            listarBlocosFixos(true),
          ]);
          return { content: [{ type: 'text', text: JSON.stringify({ perfil, metas, blocos }, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'atualizar_pacto_168',
      {
        description:
          'Atualiza o Pacto do usuário (briefing de vida + distribuição das 168h por esfera). Use ' +
          'de forma incremental, campo a campo, conforme a conversa for revelando — nunca peça tudo ' +
          'de uma vez como formulário. horas_cuidar_mim + horas_cuidar_familia + horas_trabalho + ' +
          'horas_sono não precisa somar exatamente 168 (sobra é tempo ainda não decidido), mas ' +
          'avise o usuário se a soma de Trabalho estiver consumindo quase tudo que sobra do Sono — ' +
          'isso é o sintoma da "Armadilha das Obrigações" que o método descreve.',
        inputSchema: z.object({
          pacto_aceito: z.boolean().optional().describe('true quando o usuário aceitar explicitamente a premissa filosófica do método.'),
          o_que_travou: z.string().optional().describe('Resposta à pergunta "o que travou nos últimos anos apesar do esforço?"'),
          o_que_mudou: z.string().optional().describe('Resposta à pergunta "o que mudou que te trouxe até aqui?"'),
          horas_sono: z.number().optional(),
          horas_cuidar_mim: z.number().optional(),
          horas_cuidar_familia: z.number().optional(),
          horas_trabalho: z.number().optional(),
        }),
      },
      async (campos) => {
        try {
          await atualizarPacto168(campos);
          return { content: [{ type: 'text', text: 'Pacto atualizado.' }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'salvar_meta_168',
      {
        description:
          'Registra ou atualiza uma meta do usuário, sempre classificada por esfera × horizonte ' +
          '(Matriz T×D). Ao criar, traduza o objetivo genérico do usuário pro formato SMART e ' +
          'identifique o custo de oportunidade — pergunte "o que cede pra abrir espaço pra isso?" ' +
          'e registre em o_que_eliminar. Ex: "quero emagrecer" → meta_smart: "perder 10kg em 1 ano" ' +
          '→ o_que_eliminar: "3h/semana que hoje vão pra Netflix viram treino".',
        inputSchema: z.object({
          id: z.string().optional().describe('Omitir pra criar nova; informar pra atualizar uma existente.'),
          esfera: z.enum(['cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio']),
          horizonte: z.enum(['1_ano', '5_anos', '10_anos']),
          titulo: z.string(),
          descricao: z.string().optional(),
          meta_smart: z.string().optional().describe('Versão estruturada e mensurável da meta.'),
          o_que_eliminar: z.string().optional().describe('Custo de oportunidade identificado — o que cede pra essa meta existir.'),
          status: z.enum(['ativa', 'pausada', 'concluida']).optional(),
        }),
      },
      async (meta) => {
        try {
          const salva = await salvarMeta168(meta);
          return { content: [{ type: 'text', text: JSON.stringify(salva, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'listar_metas_168',
      {
        description: 'Lista as metas do usuário, opcionalmente filtradas por status (padrão: só ativas).',
        inputSchema: z.object({
          status: z.enum(['ativa', 'pausada', 'concluida', 'todas']).optional().default('ativa'),
        }),
      },
      async ({ status }) => {
        try {
          const metas = await listarMetas168(status);
          return { content: [{ type: 'text', text: JSON.stringify(metas, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'salvar_bloco_fixo',
      {
        description:
          'Registra ou atualiza um bloco fixo (inegociável) da rotina — ex: academia, sono, estudo, ' +
          'família. Um bloco inegociável não cede pra demanda externa sem negociação explícita com ' +
          'o usuário (regra de ouro do método). hora_inicio/hora_fim devem incluir o "tempo satélite" ' +
          '(deslocamento ida/volta, banho, preparação) — não só a atividade pura.',
        inputSchema: z.object({
          id: z.string().optional().describe('Omitir pra criar novo; informar pra atualizar um existente.'),
          label: z.string().describe('Ex: "Academia", "Inglês", "Direito".'),
          esfera: z.enum(['cuidar_mim', 'cuidar_familia', 'trabalho', 'patrimonio', 'sono']),
          dias_semana: z.array(z.number().int().min(0).max(6)).describe('0=domingo ... 6=sábado.'),
          hora_inicio: z.string().describe('HH:MM, horário real de início (inclui deslocamento).'),
          hora_fim: z.string().describe('HH:MM, horário real de fim (inclui complementares).'),
          inegociavel: z.boolean().optional().default(true),
          tempo_atividade_min: z.number().optional(),
          tempo_deslocamento_ida_min: z.number().optional(),
          tempo_deslocamento_volta_min: z.number().optional(),
          tempo_complementar_min: z.number().optional(),
        }),
      },
      async (bloco) => {
        try {
          const salvo = await salvarBlocoFixo(bloco);
          return { content: [{ type: 'text', text: JSON.stringify(salvo, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'listar_blocos_fixos',
      {
        description: 'Lista os blocos fixos (inegociáveis) do usuário.',
        inputSchema: z.object({
          apenasAtivos: z.boolean().optional().default(true),
        }),
      },
      async ({ apenasAtivos }) => {
        try {
          const blocos = await listarBlocosFixos(apenasAtivos);
          return { content: [{ type: 'text', text: JSON.stringify(blocos, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'preparar_planejamento',
      {
        description:
          'Junta tudo que o Ritual de Planejamento precisa num só lugar: Pacto, metas ativas, ' +
          'blocos fixos do período, e os compromissos reais de agenda. Use isso quando o usuário ' +
          'pedir pra planejar a semana (ritual semanal, idealmente num dia fixo escolhido por ele) ' +
          'ou planejar o dia (ritual diário — a primeira coisa a fazer de manhã). Depois de chamar, ' +
          'conduza a conversa de planejamento com o usuário (não é formulário, é diálogo) e monte um ' +
          'Artifact com o resultado se a superfície suportar — a grade fixa no dashboard foi cortada ' +
          'de propósito, o plano nasce sob demanda. Pra enriquecer com sinal externo (reuniões ' +
          'marcadas por terceiros, prazos, entregas), complemente chamando buscar_emails/' +
          'buscar_whatsapp/buscar_agenda à parte. Ao terminar a conversa de planejamento com o ' +
          'usuário, chame marcar_ritual_168 com o mesmo tipo — é o que faz ritual_diario_pendente/' +
          'ritual_semanal_pendente (ver ver_metodo_168) pararem de pedir repetição no mesmo dia/semana.',
        inputSchema: z.object({
          tipo: z.enum(['semana', 'dia']),
          data: z.string().optional().describe('ISO 8601 — data de referência. Omitir pra usar hoje.'),
        }),
      },
      async ({ tipo, data }) => {
        try {
          const plano = await prepararPlanejamento(tipo, data);
          return { content: [{ type: 'text', text: JSON.stringify(plano, null, 2) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );

    server.registerTool(
      'marcar_ritual_168',
      {
        description:
          'Registra que o ritual de planejamento (diário ou semanal) foi concluído com o usuário ' +
          'hoje. Chame isso ao FINAL da conversa de planejamento conduzida via preparar_planejamento ' +
          '— nunca antes, só depois que o usuário de fato passou pelo ritual.',
        inputSchema: z.object({
          tipo: z.enum(['dia', 'semana']),
        }),
      },
      async ({ tipo }) => {
        try {
          await marcarRitualFeito(tipo);
          return { content: [{ type: 'text', text: `Ritual de ${tipo === 'dia' ? 'planejamento diário' : 'planejamento semanal'} registrado como concluído hoje.` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Erro: ${String(e)}` }], isError: true };
        }
      }
    );
  },
  {
    verboseLogs: true,
  }
);

export { handler as GET, handler as POST };
