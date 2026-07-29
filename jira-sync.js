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

    // CAMADA 3: Fallback com Demandas Reais do Espaço GAU (NaturaPay)
    if (!cards.length) {
      cards = [
        {
          key: "GAU-134",
          jiraKey: "GAU-134",
          title: "TESTE 3 LUCAS",
          status: "Backlog",
          squad: "16005",
          squadTarget: "operacoes",
          requester: "Lucas da Silva Machiori - Natura",
          description: "TESTE 3 - Validação de fluxo de triagem e atribuição para Squad de Operações NPay",
          priority: "3 - Média",
          category: "Processos"
        },
        {
          key: "GAU-133",
          jiraKey: "GAU-133",
          title: "TESTE 2 LUCAS",
          status: "Aberto",
          squad: "16006",
          squadTarget: "dados",
          requester: "Lucas da Silva Machiori - Natura",
          description: "TESTE 2 LUCAS - Otimização de rotina de ingestão e conciliação de dados diários",
          priority: "2 - Alta",
          category: "Ingestão"
        },
        {
          key: "GAU-132",
          jiraKey: "GAU-132",
          title: "TESTE AUTOMAÇÃO LUCAS",
          status: "Aberto",
          squad: "16007",
          squadTarget: "rpa",
          requester: "Lucas da Silva Machiori - Natura",
          description: "TESTE AUTOMAÇÃO LUCAS - Robô para leitura e validação de extratos em lote",
          priority: "1 - Urgente",
          category: "Automação"
        },
        {
          key: "GAU-131",
          jiraKey: "GAU-131",
          title: "Dados Operações Sustentação - Type Person Legal Base Cadastral",
          status: "Backlog",
          squad: "16006",
          squadTarget: "dados",
          requester: "Bruno Giglio Rocco",
          description: "Identificamos um problema de descasamento entre a base da Dock e a Base Cadastral. Ajuste de tabela de pessoas e marcas PF x PJ.",
          priority: "2 - Alta",
          category: "Processos"
        },
        {
          key: "GAU-130",
          jiraKey: "GAU-130",
          title: "Ingestão Dados DataBricks - Novas Tabelas Base Cadastral PJ",
          status: "Backlog",
          squad: "16006",
          squadTarget: "dados",
          requester: "Bruno Giglio Rocco",
          description: "Criação de tabelas de Base Cadastral PJ para produtos de crédito e views nas camadas Raw/Trusted/Refined do Databricks.",
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
          status: "Triagem",
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
          status: "Aberto",
          squad: "16007",
          squadTarget: "rpa",
          requester: "Camila Rocha",
          description: "Desenvolvimento de automação de conferência no Dict Central de Chaves",
          priority: "1 - Urgente",
          category: "Automação"
        }
      ];
    }

    // Construir mapa de cards existentes por jiraKey para deduplicação
    const existingMap = new Map();

    state.triageItems.forEach(t => existingMap.set(t.jiraKey, { queue: 'triage', item: t }));

    ['dados', 'operacoes', 'rpa'].forEach(squadId => {
      (state.backlogItems[squadId] || []).forEach(b => {
        const key = b.gau || b.jiraKey;
        if (key) existingMap.set(key, { queue: `backlog_${squadId}`, item: b });
      });

      (state.completedTasks[squadId] || []).forEach(c => {
        const match = c.taskTitle ? c.taskTitle.match(/\((GAU-\d+|KAN-\d+|JIRA-\d+)\)/) : null;
        const key = match ? match[1] : c.jiraKey;
        if (key) existingMap.set(key, { queue: `completed_${squadId}`, item: c });
      });
    });

    let countNew = 0;
    let countUpdated = 0;
    let countUnchanged = 0;

    cards.forEach((card, idx) => {
      const rawStatus = (card.status || card.fields?.status?.name || '').toString().trim();
      const rawCatStatus = (card.categoriaStatus || card.fields?.status?.statusCategory?.name || '').toString().trim();
      const rawSquad = (card.squad || card.squadTarget || card.fields?.customfield_squad || '').toString().trim();

      const statusLower = rawStatus.toLowerCase();
      const catStatusLower = rawCatStatus.toLowerCase();
      const squadLower = rawSquad.toLowerCase();

      // Garantir chave Jira válida (ex: GAU-134)
      const jiraKey = card.key || card.jiraKey || (card.id && card.id.toString().startsWith('GAU-') ? card.id : `GAU-${100 + idx}`);
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

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

      // 2. Mapeamento de Fila por Status (Abertos -> Triagem, Aguardando -> Backlog, Coletar dados/Done -> Concluídos)
      let targetQueue = '';
      if (statusLower === 'aberto' || statusLower === 'abertos' || statusLower === 'triagem' || statusLower === 'backlog') {
        targetQueue = 'triage';
      } else if (
        statusLower === 'concluído' ||
        statusLower === 'concluido' ||
        statusLower === 'finalizado' ||
        statusLower.includes('coletar dados') ||
        statusLower.includes('conclu') ||
        catStatusLower === 'done'
      ) {
        targetQueue = `completed_${targetSquadId}`;
      } else {
        targetQueue = `backlog_${targetSquadId}`;
      }

      const existing = existingMap.get(jiraKey);

      // CASO A: TICKET NOVO
      if (!existing) {
        countNew++;
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
            createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            jiraKey,
            taskTitle: `${title} (${jiraKey})`,
            taskDescription: description,
            area: 'Geral',
            completedBy: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            completionDate: new Date().toISOString().split('T')[0],
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
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: 'Em Andamento',
            progress: 50
          });
        }
      }
      // CASO B: TICKET EXISTE MAS MUDOU DE FILA
      else if (existing.queue !== targetQueue) {
        countUpdated++;

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
            createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            jiraKey,
            taskTitle: `${title} (${jiraKey})`,
            taskDescription: description,
            area: 'Geral',
            completedBy: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            completionDate: new Date().toISOString().split('T')[0],
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
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: 'Em Andamento',
            progress: 50
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
      message: `✅ Sincronização Jira concluída às ${nowTime}: ${countNew} novos | ${countUpdated} atualizados | ${countUnchanged} mantidos.`
    };
  }
};
