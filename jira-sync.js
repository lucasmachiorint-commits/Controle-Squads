/* ==========================================================================
   Controle de Squads & Governança Jira - Jira Sync & Routing Engine
   ========================================================================== */

const JiraSyncEngine = {
  // Sincronizar cards do Jira com deduplicação inteligente e roteamento de status
  async syncJiraCards(state, saveStateCallback) {
    let cards = [];
    
    // Tentar consultar proxy local ou Edge Function
    try {
      const localUrl = 'http://localhost:3000/api/jira/consultar-cards-jira';
      const res = await fetch(localUrl);
      if (res.ok) {
        const json = await res.json();
        cards = json.cards || json.data || [];
      }
    } catch (e) {
      console.warn('Proxy local não responsivo, verificando Supabase...', e);
    }

    // Se nenhum card retornou, emitir aviso amigável sem sobrescrever dados locais
    if (!Array.isArray(cards) || cards.length === 0) {
      return {
        success: false,
        message: 'Nenhum card retornado do Jira. Verifique as credenciais ou a conexão.'
      };
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

      const jiraKey = card.key || card.jiraKey || card.id || `GAU-${100 + idx}`;
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

      // 1. Mapeamento de Squad (16005 -> Operações, 16006 -> Dados, 16007 -> RPA)
      let targetSquadId = 'dados';
      let targetSquadName = 'Squad de Dados';

      if (
        squadLower === '16005' ||
        squadLower === 'squad de operações' ||
        squadLower === 'squad de operacoes' ||
        squadLower === 'operacoes' ||
        squadLower.includes('operaç') ||
        squadLower.includes('operac')
      ) {
        targetSquadId = 'operacoes';
        targetSquadName = 'Squad de Operações';
      } else if (
        squadLower === '16007' ||
        squadLower === 'squad de rpa' ||
        squadLower === 'rpa' ||
        squadLower.includes('rpa')
      ) {
        targetSquadId = 'rpa';
        targetSquadName = 'Squad de RPA';
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
