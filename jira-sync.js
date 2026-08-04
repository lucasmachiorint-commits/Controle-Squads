/* ==========================================================================
   Controle de Squads & Governan├ºa Jira - Jira Sync & Routing Engine Universal
   ========================================================================== */

const JiraSyncEngine = {
  // Sincronizar cards do Jira com deduplica├º├úo inteligente e roteamento de status
  async syncJiraCards(state, saveStateCallback) {
    if (!state) state = {};
    if (!Array.isArray(state.triageItems)) state.triageItems = [];
    if (!state.backlogItems || typeof state.backlogItems !== 'object') state.backlogItems = {};
    if (!state.completedTasks || typeof state.completedTasks !== 'object') state.completedTasks = {};
    ['dados', 'operacoes', 'rpa'].forEach(squadId => {
      if (!Array.isArray(state.backlogItems[squadId])) state.backlogItems[squadId] = [];
      if (!Array.isArray(state.completedTasks[squadId])) state.completedTasks[squadId] = [];
    });

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
      console.warn('Proxy local n├úo acess├¡vel.');
    }

    // CAMADA 2: Consulta via Cache no Supabase (GitHub Actions Automático)
    if (!cards.length) {
      try {
        console.log('Buscando cards no Supabase Cache...');
        const supaUrl = 'https://maguyzjhldcgpcvkvkqe.supabase.co';
        const supaKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3V5empobGRjZ3Bjdmt2a3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTU0MDMsImV4cCI6MjEwMDIzMTQwM30.Ow9xruE1qAFTX3mqELERxrY3CRBOdV_n4MoXXhtt3Y8';
        
        const res = await fetch(`${supaUrl}/rest/v1/board_state?id=eq.jira_cache&select=data`, {
          headers: {
            'apikey': supaKey,
            'Authorization': `Bearer ${supaKey}`,
            'Accept': 'application/json'
          }
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json && json.length > 0 && json[0].data && Array.isArray(json[0].data.cards)) {
            cards = json[0].data.cards;
            console.log(`Supabase Cache retornou ${cards.length} cards.`);
          }
        } else {
          console.warn('Erro na resposta do Supabase:', res.status);
        }
      } catch (err) {
        console.warn('Falha na consulta ao cache do Jira no Supabase:', err);
      }
    }
    // Construir mapa de cards existentes por jiraKey para deduplica├º├úo sem perda de chamados
    const existingMap = new Map();

    const normalizeKey = (k) => (k || '').toString().trim().toUpperCase();

    (state.triageItems || []).forEach(t => {
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

      // Garantir chave Jira v├ílida e normalizada em CAIXA ALTA (ex: GAU-134)
      const rawJiraKey = card.key || card.jiraKey || (card.id && card.id.toString().startsWith('GAU-') ? card.id : `GAU-${100 + idx}`);
      const jiraKey = normalizeKey(rawJiraKey);
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

      // Extra├º├úo da Data de Cria├º├úo do card Jira
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

      // 1. Mapeamento de Squad (16005 -> Opera├º├Áes, 16006 -> Dados, 16007 -> RPA)
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

      if (cfStr.includes('16005') || cfStr.includes('operac') || cfStr.includes('opera├º')) {
        targetSquadId = 'operacoes';
        targetSquadName = 'Squad de Opera├º├Áes';
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

      // 2. Mapeamento de Fila conforme funcionamento exato da manh├ú
      // A) Sem Squad atribu├¡da OU Status em Aberto/Triagem/Pendente -> Mesa de Triagem
      // B) Com Squad atribu├¡da e em andamento/backlog no Jira -> Aba Backlog da Squad
      // C) Status Conclu├¡do/Done -> Aba Conclu├¡dos da Squad

      let targetQueue = '';
      let defaultStatus = 'Backlog';

      if (
        statusLower === 'conclu├¡do' ||
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
            gains: 'Conclu├¡do via sincroniza├º├úo com Jira',
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
            gains: 'Conclu├¡do via sincroniza├º├úo com Jira',
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
      // CASO C: TICKET EXISTE NA MESMA FILA (Preservar status alterado pelo usu├írio na aplica├º├úo)
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
      message: `Ô£à Sincroniza├º├úo Jira conclu├¡da ├ás ${nowTime}: ${countNew} novos criados | ${countUpdated} atualizados | ${countToCompleted} conclu├¡dos | ${countUnchanged} inalterados.`
    };
  }
};
