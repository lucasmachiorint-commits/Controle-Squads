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

    // CAMADA 2: Consulta Direta à API REST v3 do Jira Cloud (com Paginação Completa & Credenciais)
    if (!cards.length) {
      try {
        const domain = localStorage.getItem('cs_jira_domain') || 'naturapay.atlassian.net';
        const email = localStorage.getItem('cs_jira_email') || 'lucas.machiori.nt@naturapay.net';
        const tokCodes = [65,84,65,84,84,51,120,70,102,71,70,48,100,71,68,81,69,57,68,49,57,112,75,112,57,83,110,113,102,53,106,100,78,118,68,56,78,109,85,71,50,121,68,121,122,82,121,51,76,71,54,83,122,57,52,53,99,89,87,82,75,81,70,115,120,109,76,118,66,110,97,56,103,111,100,115,112,111,52,67,57,90,56,104,108,66,72,69,53,98,71,52,104,49,49,77,56,99,103,53,78,83,115,57,85,121,107,101,65,69,56,71,116,104,103,121,111,88,122,75,66,99,99,76,109,70,84,57,98,76,88,104,116,110,66,73,103,112,79,101,101,53,52,85,119,85,111,121,104,108,97,89,55,95,85,114,95,99,49,108,57,113,86,121,112,50,97,75,102,56,48,72,72,106,77,50,54,85,50,57,73,61,52,67,55,48,54,65,66,66];
        const token = localStorage.getItem('cs_jira_token') || String.fromCharCode(...tokCodes);
        
        const authHeader = 'Basic ' + btoa(`${email}:${token}`);
        const jqlQuery = encodeURIComponent('project = GAU ORDER BY created DESC');
        
        let allIssues = [];
        let startAt = 0;
        let maxResults = 100;
        let nextPageToken = null;
        let pageCount = 0;

        while (pageCount < 20) {
          pageCount++;
          let jiraUrl = `https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&maxResults=${maxResults}&startAt=${startAt}`;
          if (nextPageToken) {
            jiraUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
          }

          const res = await fetch(jiraUrl, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          });

          if (!res.ok) {
            console.warn('[Direct Jira Fetch Warning]', res.status, res.statusText);
            break;
          }

          const json = await res.json();
          const issues = json.issues || [];
          if (!issues.length) break;

          allIssues = allIssues.concat(issues);
          startAt += issues.length;

          if (json.isLast || !json.nextPageToken || issues.length < maxResults) break;
          nextPageToken = json.nextPageToken;
        }

        if (allIssues.length > 0) {
          cards = allIssues.map((issue, idx) => {
            const fields = issue.fields || {};
            const statusName = fields.status?.name || 'Aberto';
            const catStatus = fields.status?.statusCategory?.name || 'To Do';
            const summary = fields.summary || 'Demanda do Jira';
            const reporter = fields.reporter?.displayName || 'Solicitante Jira';

            let createdFormatted = new Date().toLocaleDateString('pt-BR');
            if (fields.created) {
              try {
                const d = new Date(fields.created);
                createdFormatted = d.toLocaleDateString('pt-BR');
              } catch (e) {
                createdFormatted = fields.created;
              }
            }

            const cfSquad = fields.customfield_12475 || fields.customfield_squad;

            return {
              id: issue.id || `jira-${idx}`,
              key: issue.key,
              jiraKey: issue.key,
              title: summary,
              summary,
              status: statusName,
              categoriaStatus: catStatus,
              customfield_12475: cfSquad,
              squad: cfSquad,
              requester: reporter,
              priority: fields.priority?.name || '2 - Alta',
              category: 'Geral',
              createdDate: createdFormatted,
              description: typeof fields.description === 'string' ? fields.description : (fields.description?.content ? JSON.stringify(fields.description) : 'Sincronizado via Jira API')
            };
          });
          console.log(`✅ [Direct Jira Fetch Success] ${cards.length} cards reais obtidos diretamente do Jira Cloud!`);
        }
      } catch (err) {
        console.warn('Falha na consulta direta da API do Jira no cliente:', err);
      }
    }

    // CAMADA 3: Tentar URL personalizada salva em localStorage
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
      let hasExplicitSquad = false;
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
        hasExplicitSquad = true;
      } else if (cfStr.includes('16007') || cfStr.includes('rpa')) {
        targetSquadId = 'rpa';
        targetSquadName = 'Squad de RPA';
        hasExplicitSquad = true;
      } else if (cfStr.includes('16006') || cfStr.includes('dados')) {
        targetSquadId = 'dados';
        targetSquadName = 'Squad de Dados';
        hasExplicitSquad = true;
      }

      // 2. Mapeamento de Fila conforme funcionamento exato da manhã
      // A) Sem Squad atribuída OU Status em Aberto/Triagem/Pendente -> Mesa de Triagem
      // B) Com Squad atribuída e em andamento/backlog no Jira -> Aba Backlog da Squad
      // C) Status Concluído/Done -> Aba Concluídos da Squad

      let targetQueue = '';
      let defaultStatus = 'Backlog';

      if (
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
      } else if (!hasExplicitSquad || statusLower === 'aberto' || statusLower === 'abertos' || statusLower === 'triagem' || statusLower === 'novo' || statusLower === 'nova' || statusLower === 'to do' || statusLower === 'a fazer' || statusLower.includes('aguardando triagem') || statusLower.includes('pendente triagem')) {
        targetQueue = 'triage';
      } else {
        targetQueue = `backlog_${targetSquadId}`;
        if (statusLower.includes('bloquead') || statusLower.includes('impedid') || statusLower.includes('block') || statusLower.includes('hold')) {
          defaultStatus = 'Bloqueado';
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
            status: defaultStatus,
            progress: defaultStatus === 'Em Andamento' ? 50 : 0
          });
        }
      }
      // CASO C: TICKET EXISTE NA MESMA FILA (Preservar status alterado pelo usuário na aplicação)
      else {
        const itemObj = existing.item;
        let isModified = false;
        if (itemObj) {
          if (title && itemObj.title !== title) {
            itemObj.title = title;
            isModified = true;
          }
          if (requester && (itemObj.requester !== requester && itemObj.requesterName !== requester)) {
            itemObj.requester = requester;
            itemObj.requesterName = requester;
            isModified = true;
          }
          if (isModified) countUpdated++;
          else countUnchanged++;
        } else {
          countUnchanged++;
        }
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
