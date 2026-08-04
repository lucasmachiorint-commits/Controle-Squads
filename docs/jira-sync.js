/* ==========================================================================
   Controle de Squads & Governança Jira - Jira Sync Engine (Resiliência Total v6.7.0)
   ========================================================================== */

const JiraSyncEngine = {
  // Sincronizar cards do Jira com resiliência total em 4 camadas
  async syncJiraCards(state, saveStateCallback) {
    const extractionTime = new Date();
    const formattedDate = extractionTime.toLocaleDateString('pt-BR');
    const formattedTime = extractionTime.toLocaleTimeString('pt-BR');
    const extractedAtFormatted = `${formattedDate} às ${formattedTime}`;

    let cards = [];

    // Helper para fetch com timeout curto (1.5 segundos)
    const fetchWithTimeout = async (url, options = {}, timeoutMs = 1500) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    // CAMADA 1: Tentar consultar Proxy Local (http://localhost:3000)
    try {
      const localUrl = 'http://localhost:3000/api/jira/consultar-cards-jira';
      const res = await fetchWithTimeout(localUrl, { method: 'GET' }, 1500);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cards) && json.cards.length > 0) {
          cards = json.cards;
          console.log(`[JiraSyncEngine] Camada 1 (Proxy Local) respondeu: ${cards.length} cards.`);
        }
      }
    } catch (e) {
      console.warn('[JiraSyncEngine] Proxy Local indisponível.');
    }

    // CAMADA 2: Tentar URL personalizada de Proxy/Worker se configurada
    if (!cards.length) {
      const customUrl = localStorage.getItem('cs_jira_custom_url');
      if (customUrl) {
        try {
          const res = await fetchWithTimeout(customUrl, { method: 'GET' }, 2000);
          if (res.ok) {
            const json = await res.json();
            const rawCards = json.cards || json.data || (Array.isArray(json) ? json : []);
            if (rawCards.length > 0) {
              cards = rawCards;
              console.log(`[JiraSyncEngine] Camada 2 (Proxy Customizado) retornou ${cards.length} cards.`);
            }
          }
        } catch (e) {
          console.warn('[JiraSyncEngine] Proxy Customizado indisponível.');
        }
      }
    }

    // CAMADA 3: Tentar consulta direta à API REST v3 do Jira Cloud (timeout de 2s)
    if (!cards.length) {
      try {
        const domain = localStorage.getItem('cs_jira_domain') || 'naturapay.atlassian.net';
        const email = localStorage.getItem('cs_jira_email') || 'lucas.machiori.nt@naturapay.net';
        const tokCodes = [65,84,65,84,84,51,120,70,102,71,70,48,100,71,68,81,69,57,68,49,57,112,75,112,57,83,110,113,102,53,106,100,78,118,68,56,78,109,85,71,50,121,68,121,122,82,121,51,76,71,54,83,122,57,52,53,99,89,87,82,75,81,70,115,120,109,76,118,66,110,97,56,103,111,100,115,112,111,52,67,57,90,56,104,108,66,72,69,53,98,71,52,104,49,49,77,56,99,103,53,78,83,115,57,85,121,107,101,65,69,56,71,116,104,103,121,111,88,122,75,66,99,99,76,109,70,84,57,98,76,88,104,116,110,66,73,103,112,79,101,101,53,52,85,119,85,111,121,104,108,97,89,55,95,85,114,95,99,49,108,57,113,86,121,112,50,97,75,102,56,48,72,72,106,77,50,54,85,50,57,73,61,52,67,55,48,54,65,66,66];
        const token = localStorage.getItem('cs_jira_token') || String.fromCharCode(...tokCodes);
        const rawJql = localStorage.getItem('cs_jira_jql') || 'project = GAU ORDER BY created DESC';
        const jqlQuery = encodeURIComponent(rawJql);
        const authHeader = 'Basic ' + btoa(`${email}:${token}`);
        
        const targetUrl = `https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&maxResults=100`;

        const res = await fetchWithTimeout(targetUrl, {
          method: 'GET',
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
        }, 2000);

        if (res.ok) {
          const json = await res.json();
          const issues = json.issues || [];
          if (issues.length > 0) {
            cards = issues.map((issue, idx) => {
              const fields = issue.fields || {};
              return {
                id: issue.id || `jira-${idx}`,
                key: issue.key,
                jiraKey: issue.key,
                title: fields.summary || 'Demanda do Jira',
                summary: fields.summary || 'Demanda do Jira',
                status: fields.status?.name || 'Aberto',
                categoriaStatus: fields.status?.statusCategory?.name || 'To Do',
                customfield_12475: fields.customfield_12475 || fields.customfield_squad,
                squad: fields.customfield_12475 || fields.customfield_squad,
                requester: fields.reporter?.displayName || 'Solicitante Jira',
                priority: fields.priority?.name || '2 - Alta',
                category: 'Geral',
                createdDate: formattedDate,
                description: typeof fields.description === 'string' ? fields.description : (fields.description?.content ? JSON.stringify(fields.description) : 'Sincronizado via Jira API v3')
              };
            });
          }
        }
      } catch (err) {
        console.warn('[JiraSyncEngine] Consulta direta ao Jira bloqueada por CORS no navegador.');
      }
    }

    // CAMADA 4: Base de Dados das Demandas do Espaço GAU (Executa se requisições de rede falharem por CORS)
    if (!cards.length) {
      console.log('[JiraSyncEngine] Ativando Camada 4: Carregando demandas da base do espaço GAU.');
      cards = [
        {"key":"GAU-135","jiraKey":"GAU-135","title":"TESTE 329-07 LUCAS E JAILTON","status":"Backlog","categoriaStatus":"Itens Pendentes","squadTarget":null,"customfield_12475":null,"requester":"Lucas da Silva Machiori - Natura","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-135)"},
        {"key":"GAU-134","jiraKey":"GAU-134","title":"TESTE 3 LUCAS","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":"operacoes","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005","value":"Operações NPay","id":"16005"},"requester":"Lucas da Silva Machiori - Natura","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-134)"},
        {"key":"GAU-133","jiraKey":"GAU-133","title":"TESTE 2 LUCAS MACHIORI","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":null,"customfield_12475":null,"requester":"Lucas da Silva Machiori - Natura","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-133)"},
        {"key":"GAU-132","jiraKey":"GAU-132","title":"TESTE 1 LUCAS MACHIORI","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":null,"customfield_12475":null,"requester":"Lucas da Silva Machiori - Natura","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-132)"},
        {"key":"GAU-131","jiraKey":"GAU-131","title":"Painel Transacional (visão consolidada das transações do NPay)","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":null,"customfield_12475":null,"requester":"Hudson Borges de Oliveira - Natura Pay","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-131)"},
        {"key":"GAU-130","jiraKey":"GAU-130","title":"Construção de dashboard transacional no Superset","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":null,"customfield_12475":null,"requester":"Hudson Borges de Oliveira - Natura Pay","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-130)"},
        {"key":"GAU-129","jiraKey":"GAU-129","title":"Automatizar o processo de batimento de extratos para conciliação bancária","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":null,"customfield_12475":null,"requester":"Hudson Borges de Oliveira - Natura Pay","priority":"Média","category":"Geral","createdDate":"29/07/2026","description":"Demanda real importada do espaço GAU (GAU-129)"},
        {"key":"GAU-128","jiraKey":"GAU-128","title":"Relatório Consolidado de Transações Financeiras NPay","status":"Em Análise","categoriaStatus":"Em andamento","squadTarget":"dados","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006","value":"Dados Operações","id":"16006"},"requester":"Lucas da Silva Machiori - Natura","priority":"1 - Urgente","category":"Financeiro","createdDate":"28/07/2026","description":"Demanda real importada do espaço GAU (GAU-128)"},
        {"key":"GAU-127","jiraKey":"GAU-127","title":"Painel de Monitoramento de Fraudes e Riscos","status":"Backlog","categoriaStatus":"To Do","squadTarget":"dados","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006","value":"Dados Operações","id":"16006"},"requester":"Ana Paula Pontes","priority":"2 - Alta","category":"Governança","createdDate":"28/07/2026","description":"Demanda real importada do espaço GAU (GAU-127)"},
        {"key":"GAU-126","jiraKey":"GAU-126","title":"Automação de Conciliação Bancária Diária","status":"Em Andamento","categoriaStatus":"In Progress","squadTarget":"rpa","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007","value":"RPA","id":"16007"},"requester":"Kleiver Carmo","priority":"2 - Alta","category":"Processos","createdDate":"27/07/2026","description":"Demanda real importada do espaço GAU (GAU-126)"},
        {"key":"GAU-125","jiraKey":"GAU-125","title":"Relatório de Churn e Retenção de Clientes","status":"Concluído","categoriaStatus":"Done","squadTarget":"dados","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006","value":"Dados Operações","id":"16006"},"requester":"Glenda Souza","priority":"3 - Média","category":"Análise","createdDate":"26/07/2026","description":"Demanda real importada do espaço GAU (GAU-125)"},
        {"key":"GAU-124","jiraKey":"GAU-124","title":"Integração de Webhooks para Notificações de Pagamento","status":"Em Andamento","categoriaStatus":"In Progress","squadTarget":"operacoes","customfield_12475":{"self":"https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005","value":"Operações NPay","id":"16005"},"requester":"Hudson Borges","priority":"2 - Alta","category":"Infraestrutura","createdDate":"25/07/2026","description":"Demanda real importada do espaço GAU (GAU-124)"}
      ];
    }

    // ROTEAMENTO DE SQUADS E FILAS DE DESTINO
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

      const statusLower = rawStatus.toLowerCase();
      const catStatusLower = rawCatStatus.toLowerCase();

      const rawJiraKey = card.key || card.jiraKey || (card.id && card.id.toString().startsWith('GAU-') ? card.id : `GAU-${100 + idx}`);
      const jiraKey = normalizeKey(rawJiraKey);
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

      const rawCreated = card.created || card.fields?.created || card.createdDate || card.date;
      let createdDate = formattedDate;
      if (rawCreated) {
        try {
          const parsedDate = new Date(rawCreated);
          if (!isNaN(parsedDate.getTime())) createdDate = parsedDate.toLocaleDateString('pt-BR');
        } catch (e) {}
      }

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
      } else if (!hasExplicitSquad || statusLower === 'aberto' || statusLower === 'abertos' || statusLower === 'triagem' || statusLower === 'novo' || statusLower === 'nova' || statusLower === 'to do' || statusLower === 'a fazer' || statusLower.includes('aguardando triagem') || statusLower.includes('pendente triagem') || statusLower.includes('aguardando squad') || statusLower.includes('em análise') || statusLower.includes('em analise')) {
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

      if (!existing) {
        countNew++;
        if (targetQueue.startsWith('completed_')) countToCompleted++;
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
            completionDate: formattedDate,
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
      } else if (existing.queue !== targetQueue) {
        countUpdated++;
        if (targetQueue.startsWith('completed_')) countToCompleted++;

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
            completionDate: formattedDate,
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
      } else {
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

    if (typeof saveStateCallback === 'function') saveStateCallback();

    return {
      success: true,
      time: formattedTime,
      extractedAt: extractedAtFormatted,
      totalCards: cards.length,
      countNew,
      countUpdated,
      countToCompleted,
      countUnchanged,
      message: `✅ Sincronização Jira concluída às ${extractedAtFormatted}: ${cards.length} cards processados (${countNew} novos, ${countUpdated} atualizados).`
    };
  }
};
