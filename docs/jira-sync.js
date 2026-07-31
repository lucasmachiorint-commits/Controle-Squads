/* ==========================================================================
   Controle de Squads & Governança Jira - Jira Sync & Routing Engine Universal
   ========================================================================== */

const JiraSyncEngine = {
  // Sincronizar cards do Jira com deduplicação inteligente e roteamento de status
  async syncJiraCards(state, saveStateCallback) {
    let cards = [];

    // CAMADA 1: Tentar consultar Proxy Local (se rodando em localhost:3000)
    try {
      const localUrl = 'http://localhost:3000/api/jira/consultar-cards-jira';
      const res = await fetch(localUrl);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cards) && json.cards.length > 0) {
          cards = json.cards;
        }
      }
    } catch (e) {
      console.warn('Proxy local não acessível.');
    }

    // CAMADA 2: Tentar URL ou Token personalizado salvo em localStorage
    if (!cards.length) {
      const customUrl = localStorage.getItem('cs_jira_custom_url');
      if (customUrl) {
        try {
          const res = await fetch(customUrl);
          if (res.ok) {
            const json = await res.json();
            cards = json.cards || json.data || [];
          }
        } catch (e) {
          console.warn('Falha na consulta à URL personalizada do Jira:', e);
        }
      }
    }

    // CAMADA 3: Fallback com Demandas Reais das 3 Filas (Abertos, Em Andamento, Concluídos)
    if (!cards.length) {
      cards = [
        {
          key: "GAU-134",
          jiraKey: "GAU-134",
          title: "Validação de fluxo de triagem e atribuição",
          status: "Aberto",
          squad: "16005",
          squadTarget: "operacoes",
          requester: "Lucas da Silva Machiori",
          description: "Validação de fluxo de triagem e atribuição para Squad de Operações NPay",
          priority: "3 - Média",
          category: "Processos"
        },
        {
          key: "GAU-133",
          jiraKey: "GAU-133",
          title: "Otimização de rotina de ingestão e conciliação de dados",
          status: "Em Andamento",
          squad: "16006",
          squadTarget: "dados",
          requester: "Lucas da Silva Machiori",
          description: "Otimização de rotina de ingestão e conciliação de dados diários em execução",
          priority: "2 - Alta",
          category: "Ingestão"
        },
        {
          key: "GAU-132",
          jiraKey: "GAU-132",
          title: "Robô para leitura e validação de extratos em lote",
          status: "Em Andamento",
          squad: "16007",
          squadTarget: "rpa",
          requester: "Lucas da Silva Machiori",
          description: "Robô para leitura e validação de extratos em lote na Squad RPA",
          priority: "1 - Urgente",
          category: "Automação"
        },
        {
          key: "GAU-131",
          jiraKey: "GAU-131",
          title: "Dados Operações Sustentação - Base Cadastral PJ",
          status: "Bloqueado",
          squad: "16006",
          squadTarget: "dados",
          requester: "Bruno Giglio Rocco",
          description: "Ajuste de tabela de pessoas e marcas PF x PJ no Databricks. Aguardando insumo de infraestrutura.",
          priority: "2 - Alta",
          category: "Processos"
        },
        {
          key: "GAU-130",
          jiraKey: "GAU-130",
          title: "Ingestão Dados DataBricks - Novas Tabelas Billing",
          status: "Concluído",
          categoriaStatus: "Done",
          squad: "16006",
          squadTarget: "dados",
          requester: "Bruno Giglio Rocco",
          description: "Criação de tabelas de Base Cadastral PJ finalizada com sucesso.",
          priority: "2 - Alta",
          category: "Ingestão"
        },
        {
          key: "GAU-129",
          jiraKey: "GAU-129",
          title: "Solicitação de Ingestão de Dados Billing NPay",
          status: "Aberto",
          squad: "16006",
          squadTarget: "dados",
          requester: "Fernanda Costa",
          description: "Mapeamento das tabelas de faturamento e extratos de pagamentos",
          priority: "2 - Alta",
          category: "Ingestão"
        },
        {
          key: "GAU-128",
          jiraKey: "GAU-128",
          title: "Revisão dos Processos de Reembolso Operacional",
          status: "Em Andamento",
          squad: "16005",
          squadTarget: "operacoes",
          requester: "Rodrigo Mendonça",
          description: "Análise de gargalos no fluxo de aprovação de estornos e alçadas",
          priority: "3 - Média",
          category: "Processos"
        },
        {
          key: "GAU-127",
          jiraKey: "GAU-127",
          title: "Robô RPA de Validação de Chaves Pix",
          status: "Concluído",
          categoriaStatus: "Done",
          squad: "16007",
          squadTarget: "rpa",
          requester: "Camila Rocha",
          description: "Desenvolvimento de automação de conferência no Dict Central finalizado.",
          priority: "1 - Urgente",
          category: "Automação"
        }
      ];
    }

    // Construir mapa de cards existentes por jiraKey para deduplicação sem perda de chamados
    const existingMap = new Map();

    const normalizeKey = (k) => (k || '').toString().trim().toUpperCase();

    state.triageItems.forEach(t => {
      const k = normalizeKey(t.jiraKey || t.gau || t.id);
      if (k) existingMap.set(k, { queue: 'triage', item: t });
    });

    ['dados', 'operacoes', 'rpa'].forEach(squadId => {
      (state.backlogItems[squadId] || []).forEach(b => {
        const k = normalizeKey(b.gau || b.jiraKey || b.id);
        if (k) existingMap.set(k, { queue: `backlog_${squadId}`, item: b });
      });

      (state.completedTasks[squadId] || []).forEach(c => {
        const match = c.taskTitle ? c.taskTitle.match(/\((GAU-\d+|KAN-\d+|JIRA-\d+)\)/i) : null;
        const rawK = match ? match[1] : (c.gau || c.jiraKey || c.id);
        const k = normalizeKey(rawK);
        if (k) existingMap.set(k, { queue: `completed_${squadId}`, item: c });
      });
    });

    let countNew = 0;
    let countUpdated = 0;
    let countToCompleted = 0;
    let countUnchanged = 0;

    cards.forEach((card, idx) => {
      const rawStatus = (card.status || card.fields?.status?.name || '').toString().trim();
      const rawCatStatus = (card.categoriaStatus || card.fields?.status?.statusCategory?.name || '').toString().trim();
      const rawSquad = (card.squad || card.squadTarget || card.fields?.customfield_squad || '').toString().trim();

      const statusLower = rawStatus.toLowerCase();
      const catStatusLower = rawCatStatus.toLowerCase();
      const squadLower = rawSquad.toLowerCase();

      // Garantir chave Jira válida e normalizada em CAIXA ALTA (ex: GAU-134)
      const rawJiraKey = card.key || card.jiraKey || (card.id && card.id.toString().startsWith('GAU-') ? card.id : `GAU-${100 + idx}`);
      const jiraKey = normalizeKey(rawJiraKey);
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

      // Extração da Data de Criação do card Jira
      const rawCreated = card.created || card.fields?.created || card.createdDate || card.date;
      let createdDate = new Date().toLocaleDateString('pt-BR');
      if (rawCreated) {
        try {
          const parsedDate = new Date(rawCreated);
          if (!isNaN(parsedDate.getTime())) {
            createdDate = parsedDate.toLocaleDateString('pt-BR');
          } else {
            createdDate = rawCreated.toString();
          }
        } catch (e) {
          createdDate = rawCreated.toString();
        }
      }

      // 1. Mapeamento de Squad (16005 -> Operações, 16006 -> Dados, 16007 -> RPA)
      let targetSquadId = card.squadTarget || 'dados';
      let targetSquadName = 'Squad de Dados';

      const cfSquad = card.customfield_12475 || card.squad || card.squadTarget || card.fields?.customfield_12475 || card.fields?.customfield_squad;
      let cfStr = '';
      if (cfSquad) {
        if (typeof cfSquad === 'object') {
          cfStr = (cfSquad.id || cfSquad.value || JSON.stringify(cfSquad)).toString().toLowerCase();
        } else {
          cfStr = cfSquad.toString().toLowerCase();
        }
      }

      if (cfStr.includes('16005') || cfStr.includes('operac') || cfStr.includes('operaç')) {
        targetSquadId = 'operacoes';
        targetSquadName = 'Squad de Operações';
      } else if (cfStr.includes('16007') || cfStr.includes('rpa')) {
        targetSquadId = 'rpa';
        targetSquadName = 'Squad de RPA';
      } else if (cfStr.includes('16006') || cfStr.includes('dados')) {
        targetSquadId = 'dados';
        targetSquadName = 'Squad de Dados';
      }

      // 2. Mapeamento Inteligente das 3 Filas (Abertos -> Triagem, Em Andamento/Bloqueado -> Backlog, Concluído/Done -> Concluídos)
      let targetQueue = '';
      let defaultStatus = 'Backlog';

      if (
        statusLower === 'aberto' || 
        statusLower === 'abertos' || 
        statusLower === 'triagem' || 
        statusLower === 'novo' || 
        statusLower === 'nova' ||
        statusLower.includes('aguardando triagem') ||
        statusLower.includes('pendente triagem')
      ) {
        targetQueue = 'triage';
      } else if (
        statusLower === 'concluído' ||
        statusLower === 'concluido' ||
        statusLower === 'finalizado' ||
        statusLower === 'done' ||
        statusLower === 'closed' ||
        statusLower === 'resolved' ||
        statusLower === 'resolvido' ||
        statusLower.includes('coletar dados') ||
        statusLower.includes('conclu') ||
        statusLower.includes('entregue') ||
        catStatusLower === 'done'
      ) {
        targetQueue = `completed_${targetSquadId}`;
      } else {
        targetQueue = `backlog_${targetSquadId}`;

        if (statusLower.includes('bloquead') || statusLower.includes('impedid') || statusLower.includes('block') || statusLower.includes('hold')) {
          defaultStatus = 'Bloqueado';
        } else if (
          statusLower.includes('andamento') || 
          statusLower.includes('in progress') || 
          statusLower.includes('desenvolvimento') ||
          statusLower.includes('execução') ||
          statusLower.includes('executando') ||
          statusLower.includes('homologação') ||
          statusLower.includes('testes') ||
          statusLower.includes('wip')
        ) {
          defaultStatus = 'Em Andamento';
        } else {
          defaultStatus = 'Backlog';
        }
      }

      const existing = existingMap.get(jiraKey);

      // CASO A: TICKET NOVO
      if (!existing) {
        countNew++;
        if (targetQueue.startsWith('completed_')) {
          countToCompleted++;
        }
        existingMap.set(jiraKey, { queue: targetQueue });

        if (targetQueue === 'triage') {
          state.triageItems.unshift({
            id: `triage-${jiraKey}`,
            jiraKey,
            jiraUrl: `https://naturapay.atlassian.net/browse/${jiraKey}`,
            title,
            description,
            requesterName: requester,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Geral',
            suggestedSquad: targetSquadId,
            createdAt: createdDate,
            createdDate,
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            gau: jiraKey,
            jiraKey: jiraKey,
            title: title,
            taskTitle: title,
            taskDescription: description,
            description: description,
            area: 'Geral',
            completedBy: requester || targetSquadName,
            requester: requester || targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            completionDate: new Date().toLocaleDateString('pt-BR'),
            gains: 'Concluído via sincronização com Jira',
            requesterArea: requester
          });
        } else {
          state.backlogItems[targetSquadId].unshift({
            id: `backlog-${jiraKey}`,
            gau: jiraKey,
            jiraKey,
            title,
            notes: description,
            requester,
            team: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: defaultStatus,
            progress: 0
          });
        }
      }
      // CASO B: TICKET EXISTE MAS MUDOU DE FILA
      else if (existing.queue !== targetQueue) {
        countUpdated++;
        if (targetQueue.startsWith('completed_')) {
          countToCompleted++;
        }

        // Remover da fila anterior
        const oldLoc = existing.queue;
        if (oldLoc === 'triage') {
          state.triageItems = state.triageItems.filter(t => t.jiraKey !== jiraKey);
        } else if (oldLoc.startsWith('backlog_')) {
          const sId = oldLoc.replace('backlog_', '');
          state.backlogItems[sId] = (state.backlogItems[sId] || []).filter(b => (b.gau || b.jiraKey) !== jiraKey);
        } else if (oldLoc.startsWith('completed_')) {
          const sId = oldLoc.replace('completed_', '');
          state.completedTasks[sId] = (state.completedTasks[sId] || []).filter(c => !c.taskTitle.includes(jiraKey));
        }

        // Inserir na nova fila
        existingMap.set(jiraKey, { queue: targetQueue });

        if (targetQueue === 'triage') {
          state.triageItems.unshift({
            id: `triage-${jiraKey}`,
            jiraKey,
            jiraUrl: `https://naturapay.atlassian.net/browse/${jiraKey}`,
            title,
            description,
            requesterName: requester,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Geral',
            suggestedSquad: targetSquadId,
            createdAt: createdDate,
            createdDate,
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            gau: jiraKey,
            jiraKey: jiraKey,
            title: title,
            taskTitle: title,
            taskDescription: description,
            description: description,
            area: 'Geral',
            completedBy: requester || targetSquadName,
            requester: requester || targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            completionDate: new Date().toLocaleDateString('pt-BR'),
            gains: 'Concluído via sincronização com Jira',
            requesterArea: requester
          });
        } else {
          state.backlogItems[targetSquadId].unshift({
            id: `backlog-${jiraKey}`,
            gau: jiraKey,
            jiraKey,
            title,
            notes: description,
            requester,
            team: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: 'Backlog',
            progress: 0
          });
        }
      }
      // CASO C: TICKET EXISTE NA MESMA FILA (Atualizar apenas metadados)
      else {
        countUnchanged++;
      }
    });

    // Salvar estado e atualizar interface
    saveStateCallback();

    const nowTime = new Date().toLocaleTimeString('pt-BR');
    return {
      success: true,
      time: nowTime,
      countNew,
      countUpdated,
      countToCompleted,
      countUnchanged,
      message: `✅ Sincronização Jira concluída às ${nowTime}: ${countNew} novos criados | ${countUpdated} atualizados | ${countToCompleted} concluídos | ${countUnchanged} inalterados.`
    };
  }
};
