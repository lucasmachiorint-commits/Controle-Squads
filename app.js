/* ==========================================================================
   Controle de Squads & Governança Jira - Core Application Script (Padrão Painel-OPS)
   ========================================================================== */

const SUPABASE_URL = 'https://maguyzjhldcgpcvkvkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3V5empobGRjZ3Bjdmt2a3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTU0MDMsImV4cCI6MjEwMDIzMTQwM30.Ow9xruE1qAFTX3mqELERxrY3CRBOdV_n4MoXXhtt3Y8';

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global Application State
const app = {
  activeSquad: 'dados',
  activeView: 'triagem',
  
  state: {
    triageItems: [],
    backlogItems: { dados: [], operacoes: [], rpa: [] },
    completedTasks: { dados: [], operacoes: [], rpa: [] },
    resources: { dados: [], operacoes: [], rpa: [] },
    dpoLogs: []
  },

  init() {
    this.loadLocalState();
    this.seedDefaultDataIfEmpty();
    this.setupRealtimeSync();
    this.restoreLastSyncTime();
    this.render();
  },

  restoreLastSyncTime() {
    const savedTime = localStorage.getItem('cs_last_sync_time');
    const timeEl = document.getElementById('sync-last-time');
    if (timeEl) {
      if (savedTime) {
        timeEl.textContent = `Última atualização: ${savedTime}`;
      } else {
        timeEl.textContent = `Última atualização: Pendente de sincronização`;
      }
    }
  },

  // Alternar Squad Ativa
  setSquad(squadId) {
    this.activeSquad = squadId;

    // Atualizar badge no header
    const squadBadge = document.getElementById('header-squad-badge');
    if (squadBadge) {
      const names = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
      const icons = { dados: 'fa-database', operacoes: 'fa-gears', rpa: 'fa-robot' };
      squadBadge.innerHTML = `<i class="fa-solid ${icons[squadId]}"></i> ${names[squadId]}`;
    }

    this.render();
  },

  selectSquadAndView(squadId, viewId = 'board') {
    this.setSquad(squadId);
    this.navigate(viewId);
  },

  // Alternar View Ativa
  navigate(viewId) {
    this.activeView = viewId;

    // Atualizar links da sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if (viewId === 'triagem') {
      const activeNav = document.getElementById('nav-triagem');
      if (activeNav) activeNav.classList.add('active');
    } else if (viewId === 'dashboard') {
      const activeNav = document.getElementById('nav-dashboard');
      if (activeNav) activeNav.classList.add('active');
    } else {
      // Para visões de squad (board, backlog, concluidos)
      const activeSquadNav = document.getElementById(`nav-squad-${this.activeSquad}`);
      if (activeSquadNav) activeSquadNav.classList.add('active');
    }

    // Alternar visibilidade das views
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active-view'));
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active-view');

    // Atualizar título da página
    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    const titleMap = {
      triagem: 'Mesa de Triagem',
      dashboard: 'Dashboard Consolidado 3 Squads',
      board: `Em Andamento - ${squadNames[this.activeSquad]}`,
      backlog: `Backlog - ${squadNames[this.activeSquad]}`,
      concluidos: `Concluídos - ${squadNames[this.activeSquad]}`,
      'dpo-sync': 'Modo Reunião DPO',
      'dpo-logs': 'Histórico de Alinhamentos DPO'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titleMap[viewId] || 'Controle de Squads';

    this.render();
  },

  // Carregar dados salvos no LocalStorage
  loadLocalState() {
    try {
      const savedTriage = localStorage.getItem('cs_triage_items');
      if (savedTriage) this.state.triageItems = JSON.parse(savedTriage);

      ['dados', 'operacoes', 'rpa'].forEach(id => {
        const b = localStorage.getItem(`cs_backlog_${id}`);
        if (b) this.state.backlogItems[id] = JSON.parse(b);

        const c = localStorage.getItem(`cs_completed_${id}`);
        if (c) this.state.completedTasks[id] = JSON.parse(c);

        const r = localStorage.getItem(`cs_resources_${id}`);
        if (r) this.state.resources[id] = JSON.parse(r);
      });
    } catch (e) {
      console.warn('Erro ao carregar LocalStorage:', e);
    }
  },

  // Salvar estado atual no LocalStorage e no Supabase
  saveState() {
    try {
      localStorage.setItem('cs_triage_items', JSON.stringify(this.state.triageItems));
      ['dados', 'operacoes', 'rpa'].forEach(id => {
        localStorage.setItem(`cs_backlog_${id}`, JSON.stringify(this.state.backlogItems[id]));
        localStorage.setItem(`cs_completed_${id}`, JSON.stringify(this.state.completedTasks[id]));
        localStorage.setItem(`cs_resources_${id}`, JSON.stringify(this.state.resources[id]));
      });
    } catch (e) {
      console.warn('Erro ao salvar LocalStorage:', e);
    }

    this.render();
  },

  // Dados Iniciais Fictícios para cada uma das 3 Squads
  seedDefaultDataIfEmpty() {
    if (!this.state.resources.dados.length) {
      this.state.resources.dados = [
        {
          id: 'res-1',
          name: 'Carolina Santos',
          role: 'Engenheira de Dados Sr.',
          status: 'Ativo',
          allocationOps: 60,
          allocationFin: 40,
          currentTask: { id: 'task-1', title: 'Pipeline Noturno Data Warehouse (GAU-133)', status: 'Em Andamento', dueDate: '2026-08-05' },
          nextTask: { id: 'task-2', title: 'Integração API Billing NPay (GAU-129)', status: 'A Fazer', dueDate: '2026-08-15' }
        },
        {
          id: 'res-2',
          name: 'Roberto Lima',
          role: 'Analista BI Pleno',
          status: 'Ativo',
          allocationOps: 80,
          allocationFin: 20,
          currentTask: { id: 'task-3', title: 'Dashboard Executivo Q3 (GAU-124)', status: 'Em Andamento', dueDate: '2026-08-02' },
          nextTask: null
        }
      ];
    }

    if (!this.state.resources.operacoes.length) {
      this.state.resources.operacoes = [
        {
          id: 'res-op-1',
          name: 'Lucas da Silva Machiori',
          role: 'Coordenador de Operações NPay',
          status: 'Ativo',
          allocationOps: 75,
          allocationFin: 25,
          currentTask: { id: 'task-op-1', title: 'Triagem & Governança de Demandas NPay (GAU-134)', status: 'Em Andamento', dueDate: '2026-08-10' },
          nextTask: { id: 'task-op-2', title: 'Mensuração de KPIs de Operações (GAU-131)', status: 'A Fazer', dueDate: '2026-08-20' }
        },
        {
          id: 'res-op-2',
          name: 'Rodrigo Mendonça',
          role: 'Analista de Processos Sr.',
          status: 'Ativo',
          allocationOps: 90,
          allocationFin: 10,
          currentTask: { id: 'task-op-3', title: 'Revisão dos Processos de Reembolso (GAU-128)', status: 'Em Andamento', dueDate: '2026-08-04' },
          nextTask: null
        }
      ];
    }

    if (!this.state.resources.rpa.length) {
      this.state.resources.rpa = [
        {
          id: 'res-rpa-1',
          name: 'Marcelo Faria',
          role: 'Desenvolvedor RPA Sr.',
          status: 'Ativo',
          allocationOps: 50,
          allocationFin: 50,
          currentTask: { id: 'task-rpa-1', title: 'Automação RPA de Conciliação Bancária (GAU-132)', status: 'Em Andamento', dueDate: '2026-08-06' },
          nextTask: { id: 'task-rpa-2', title: 'Robô de Validação de Chaves Pix (GAU-127)', status: 'A Fazer', dueDate: '2026-08-18' }
        },
        {
          id: 'res-rpa-2',
          name: 'Camila Rocha',
          role: 'Especialista em Automações',
          status: 'Ativo',
          allocationOps: 40,
          allocationFin: 60,
          currentTask: { id: 'task-rpa-3', title: 'Automação de Envio de Relatórios (GAU-125)', status: 'Em Andamento', dueDate: '2026-08-12' },
          nextTask: null
        }
      ];
    }
  },

  // Supabase Realtime Sync (Multi-User)
  setupRealtimeSync() {
    if (!supabaseClient) return;
    try {
      supabaseClient.channel('controle_squads_realtime')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          console.log('[Realtime] Atualização recebida de outro usuário.');
          this.loadLocalState();
          this.render();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime sync offline:', e);
    }
  },

  // Renderizador principal da interface
  render() {
    this.renderBadgeCounts();

    if (this.activeView === 'triagem') this.renderTriageView();
    else if (this.activeView === 'dashboard') this.renderDashboardView();
    else if (this.activeView === 'board') this.renderBoardView();
    else if (this.activeView === 'backlog') this.renderBacklogView();
    else if (this.activeView === 'concluidos') this.renderCompletedView();
  },

  // Badges da Sidebar
  renderBadgeCounts() {
    const pendingCount = this.state.triageItems.filter(i => i.status === 'Pendente').length;
    const badgeEl = document.getElementById('badge-triage-count');
    if (badgeEl) badgeEl.textContent = pendingCount;
  },

  // Limpar todos os cards de demandas (Triagem, Backlog, Em Andamento, Concluídos) mantendo os cadastros de recursos intactos
  clearAllCards() {
    if (confirm('Tem certeza que deseja limpar TODOS os cards de demandas (Triagem, Backlog, Em Andamento e Concluídos)? Os desenvolvedores cadastrados serão mantidos.')) {
      this.state.triageItems = [];
      ['dados', 'operacoes', 'rpa'].forEach(id => {
        this.state.backlogItems[id] = [];
        this.state.completedTasks[id] = [];
      });
      localStorage.removeItem('cs_triage_items');
      ['dados', 'operacoes', 'rpa'].forEach(id => {
        localStorage.removeItem(`cs_backlog_${id}`);
        localStorage.removeItem(`cs_completed_${id}`);
      });
      localStorage.removeItem('cs_last_sync_time');

      const timeEl = document.getElementById('sync-last-time');
      if (timeEl) timeEl.textContent = 'Última atualização: N/D';

      this.saveState();

      const toast = document.getElementById('sync-toast-banner');
      const toastMsg = document.getElementById('sync-toast-message');
      if (toast && toastMsg) {
        toastMsg.textContent = '🗑️ Todos os cards de demandas foram limpos! Clique em Sincronizar com Jira para recarregar.';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
      }
    }
  },

  // Disparar sincronização com o Jira via JiraSyncEngine
  async triggerJiraSync() {
    const btn = document.getElementById('btn-sync-jira');
    const icon = document.getElementById('icon-spin-jira');
    const statusTxt = document.getElementById('sync-status-txt');
    
    if (btn) btn.disabled = true;
    if (icon) icon.classList.add('fa-spin');
    if (statusTxt) statusTxt.textContent = 'Sincronizando com Jira Cloud...';

    const result = await JiraSyncEngine.syncJiraCards(this.state, () => this.saveState());

    if (btn) btn.disabled = false;
    if (icon) icon.classList.remove('fa-spin');
    if (statusTxt) statusTxt.textContent = 'Sincronização concluída';

    // Salvar data e horário completos da última sincronização realizada
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR');
    const fullSyncDateTime = `${formattedDate} às ${formattedTime}`;
    localStorage.setItem('cs_last_sync_time', fullSyncDateTime);

    const timeEl = document.getElementById('sync-last-time');
    if (timeEl) {
      timeEl.textContent = `Última atualização: ${fullSyncDateTime}`;
    }
  },

  triageFilter: 'pending',

  setTriageFilter(filterName) {
    this.triageFilter = filterName;

    // Atualizar classe ativa visual nos 3 quadros de métricas
    ['pending', 'triaged', 'rejected'].forEach(f => {
      const card = document.getElementById(`card-filter-${f}`);
      if (card) {
        if (f === filterName) card.classList.add('active');
        else card.classList.remove('active');
      }
    });

    this.renderTriageView();
  },

  // RENDER: Mesa de Triagem
  renderTriageView() {
    const tbody = document.getElementById('triage-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('search-triage')?.value || '').toLowerCase();

    // Contagem real baseada no status exato do Jira
    const pendingItems = this.state.triageItems.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'backlog' || s === 'pendente' || s === 'aberto' || s === 'triagem';
    });

    const triagedItems = this.state.triageItems.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s.includes('squad') || s.includes('análise') || s.includes('analise') || s === 'triado' || s.includes('coletar');
    });

    const rejectedItems = this.state.triageItems.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s.includes('rejeitado') || s.includes('cancelado') || s.includes('arquivado') || s === 'done';
    });

    // Atualizar texto dos quadros
    const elPending = document.getElementById('metric-triage-pending');
    const elTriaged = document.getElementById('metric-triage-triaged');
    const elRejected = document.getElementById('metric-triage-rejected');

    if (elPending) elPending.textContent = `${pendingItems.length} cards`;
    if (elTriaged) elTriaged.textContent = `${triagedItems.length} cards`;
    if (elRejected) elRejected.textContent = `${rejectedItems.length} cards`;

    // Selecionar lista conforme o filtro ativo do quadro clicado
    let currentList = pendingItems;
    let emptyMessage = 'Nenhuma solicitação aguardando triagem.';
    if (this.triageFilter === 'triaged') {
      currentList = triagedItems;
      emptyMessage = 'Nenhum chamado triado ou atribuído a squads nesta lista.';
    } else if (this.triageFilter === 'rejected') {
      currentList = rejectedItems;
      emptyMessage = 'Nenhum chamado rejeitado ou arquivado nesta lista.';
    }

    // Filtrar por busca textual (título, GAU ou solicitante)
    const filteredDisplayItems = currentList.filter(i => {
      return !searchTerm || 
        (i.title || '').toLowerCase().includes(searchTerm) || 
        (i.jiraKey || '').toLowerCase().includes(searchTerm) ||
        (i.requesterName || '').toLowerCase().includes(searchTerm);
    });

    if (filteredDisplayItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-500 font-semibold">${emptyMessage}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredDisplayItems.map((item, idx) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td class="font-bold text-slate-400" style="white-space:nowrap; width:50px;">${idx + 1}</td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; min-width:130px;">${item.jiraKey}</td>
        <td class="font-semibold text-white max-w-md truncate" title="${item.title}">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; min-width:180px;">${item.requesterName || 'Solicitante Jira'}</td>
        <td class="text-amber-400 font-medium" style="white-space:nowrap; min-width:140px;">${item.createdDate || item.date || 'Data N/D'}</td>
        <td style="white-space:nowrap; min-width:180px;"><span class="badge badge-medium" style="white-space:nowrap;">${item.status || 'Aguardando Triagem'}</span></td>
      </tr>
    `).join('');
  },

  // Pop-up Modal de Detalhes da Demanda
  openDemandDetailsModal(itemId) {
    const item = this.state.triageItems.find(i => i.id === itemId) || 
                 (this.state.backlogItems.dados || []).find(i => i.id === itemId || i.gau === itemId) ||
                 (this.state.backlogItems.operacoes || []).find(i => i.id === itemId || i.gau === itemId) ||
                 (this.state.backlogItems.rpa || []).find(i => i.id === itemId || i.gau === itemId);

    if (!item) return;

    document.getElementById('detail-gau-key').textContent = item.jiraKey || item.gau || 'GAU-000';
    document.getElementById('detail-priority').textContent = item.priority || '2 - Alta';
    document.getElementById('detail-title').textContent = item.title;
    document.getElementById('detail-requester').textContent = item.requesterName || item.requester || 'Solicitante Jira';
    const dateEl = document.getElementById('detail-created-date');
    if (dateEl) dateEl.textContent = item.createdDate || item.date || 'Data N/D';
    document.getElementById('detail-status').textContent = item.status || 'Aguardando Triagem';
    document.getElementById('detail-squad').textContent = item.squad || item.team || 'Mesa de Triagem';
    
    const descEl = document.getElementById('detail-description');
    descEl.textContent = item.description || item.notes || 'Sem descrição fornecida no chamado do Jira.';

    const modal = document.getElementById('modal-demand-details');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
      modal.classList.add('active');
    }
  },

  closeModal(modalId, event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  },

  // Ação: Encaminhar card da Triagem para Squad (Demanda entra naturalmente como Backlog)
  async triageToSquad(triageId, targetSquadId) {
    const itemIdx = this.state.triageItems.findIndex(i => i.id === triageId);
    if (itemIdx === -1) return;

    const item = this.state.triageItems[itemIdx];
    item.status = 'Triado';
    item.triagedSquadId = targetSquadId;

    // Inserir no backlog da Squad com status 'Backlog' por padrão
    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    if (!this.state.backlogItems[targetSquadId]) {
      this.state.backlogItems[targetSquadId] = [];
    }

    this.state.backlogItems[targetSquadId].unshift({
      id: `backlog-${item.jiraKey}`,
      gau: item.jiraKey,
      jiraKey: item.jiraKey,
      title: item.title,
      notes: item.description,
      requester: item.requesterName || 'Solicitante Jira',
      createdDate: item.createdDate || item.date,
      team: squadNames[targetSquadId],
      priority: item.priority || '2 - Alta',
      treatmentOrder: 1,
      status: 'Backlog',
      progress: 0
    });

    this.saveState();

    // Sincronização Bidirecional com o Jira Cloud
    if (item.jiraKey && item.jiraKey.startsWith('GAU-')) {
      try {
        const res = await fetch('http://localhost:3000/api/jira/encaminhar-squad-jira', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jiraKey: item.jiraKey, squadId: targetSquadId })
        });
        if (res.ok) {
          const toast = document.getElementById('sync-toast-banner');
          const toastMsg = document.getElementById('sync-toast-message');
          if (toast && toastMsg) {
            toastMsg.textContent = `✅ Card ${item.jiraKey} encaminhado para ${squadNames[targetSquadId]} e ATUALIZADO NO JIRA CLOUD!`;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 5000);
          }
        }
      } catch (e) {
        console.warn('Backend local não acessível para sincronizar com Jira Cloud em tempo real.', e);
      }
    }
  },

  // Ação: Alterar status da demanda (Backlog <-> Em Andamento <-> Concluído)
  changeDemandStatus(itemId, newStatus) {
    const squadItems = this.state.backlogItems[this.activeSquad] || [];
    const item = squadItems.find(i => i.id === itemId || i.gau === itemId || i.jiraKey === itemId);
    if (!item) return;

    item.status = newStatus;

    // Se alterado para Concluído, registra no histórico de entregas se não existir
    if (newStatus === 'Concluído' || newStatus === 'Concluido') {
      if (!this.state.completedTasks[this.activeSquad]) {
        this.state.completedTasks[this.activeSquad] = [];
      }
      const alreadyCompleted = this.state.completedTasks[this.activeSquad].some(c => c.id === item.id);
      if (!alreadyCompleted) {
        this.state.completedTasks[this.activeSquad].unshift({
          id: item.id,
          taskTitle: item.title,
          completedBy: item.requester || 'Analista Squad',
          completionDate: new Date().toLocaleDateString('pt-BR'),
          gains: 'Demanda concluída via alteração de status no painel'
        });
      }
    }

    this.saveState();
    this.renderBoardView();
    this.renderBacklogView();
    this.renderCompletedView();
  },

  // Ação: Rejeitar solicitação na Triagem
  rejectTriage(triageId) {
    const item = this.state.triageItems.find(i => i.id === triageId);
    if (item) {
      item.status = 'Rejeitado';
      this.saveState();
    }
  },

  // RENDER: Dashboard Consolidado
  renderDashboardView() {
    let totalMembers = 0;
    let activeMembers = 0;
    let totalPending = 0;
    let totalCompleted = 0;

    ['dados', 'operacoes', 'rpa'].forEach(id => {
      const resList = this.state.resources[id] || [];
      totalMembers += resList.length;
      activeMembers += resList.filter(r => r.status === 'Ativo').length;
      totalPending += (this.state.backlogItems[id] || []).length;
      totalCompleted += (this.state.completedTasks[id] || []).length;
    });

    document.getElementById('dash-total-members').textContent = totalMembers;
    document.getElementById('dash-active-members').textContent = activeMembers;
    document.getElementById('dash-pending-backlog').textContent = totalPending;
    document.getElementById('dash-total-completed').textContent = totalCompleted;

    this.renderCharts();
  },

  renderCharts() {
    // Gráfico de Distribuição por Squad
    const ctxSquad = document.getElementById('chart-squad-dist')?.getContext('2d');
    if (ctxSquad) {
      if (window.squadChart) window.squadChart.destroy();
      window.squadChart = new Chart(ctxSquad, {
        type: 'doughnut',
        data: {
          labels: ['Squad de Dados', 'Squad de Operações', 'Squad de RPA'],
          datasets: [{
            data: [
              (this.state.backlogItems.dados || []).length,
              (this.state.backlogItems.operacoes || []).length,
              (this.state.backlogItems.rpa || []).length
            ],
            backgroundColor: ['#00B074', '#FF5E00', '#E31C79']
          }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
      });
    }
  },

  // RENDER: Aba "Em Andamento"
  renderBoardView() {
    const tbody = document.getElementById('board-table-body');
    if (!tbody) return;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    const titleEl = document.getElementById('board-squad-title');
    const descEl = document.getElementById('board-squad-desc');

    if (titleEl) titleEl.textContent = `Em Andamento - ${squadNames[this.activeSquad]}`;
    if (descEl) descEl.textContent = `Acompanhamento de solicitações em andamento na ${squadNames[this.activeSquad]}`;

    const allItems = this.state.backlogItems[this.activeSquad] || [];
    const inProgressItems = allItems.filter(i => i.status === 'Em Andamento');

    const searchTerm = (document.getElementById('search-board')?.value || '').toLowerCase();

    const filteredItems = inProgressItems.filter(item => {
      return !searchTerm ||
        (item.title || '').toLowerCase().includes(searchTerm) ||
        (item.gau || item.jiraKey || '').toLowerCase().includes(searchTerm) ||
        (item.requester || '').toLowerCase().includes(searchTerm);
    });

    if (filteredItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-8 text-slate-500 font-semibold">Nenhuma demanda em andamento encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredItems.map((item, idx) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td class="font-bold text-slate-400" style="white-space:nowrap; width:50px;">${idx + 1}</td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; min-width:130px;">${item.gau || item.jiraKey || 'GAU-000'}</td>
        <td class="font-semibold text-white max-w-md truncate" title="${item.title}">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; min-width:180px;">${item.requester || 'Solicitante Jira'}</td>
        <td onclick="event.stopPropagation();" style="white-space:nowrap; min-width:200px;">
          <select class="status-select-dropdown" onchange="app.changeDemandStatus('${item.id}', this.value)">
            <option value="Em Andamento" selected>Em Andamento</option>
            <option value="Backlog">Backlog</option>
            <option value="Concluído">Concluído</option>
          </select>
        </td>
      </tr>
    `).join('');
  },

  // RENDER: Aba "Backlog"
  renderBacklogView() {
    const tbody = document.getElementById('backlog-table-body');
    if (!tbody) return;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    const titleEl = document.getElementById('backlog-squad-title');
    if (titleEl) titleEl.textContent = `Backlog - ${squadNames[this.activeSquad]}`;

    const allItems = this.state.backlogItems[this.activeSquad] || [];
    const backlogItems = allItems.filter(i => i.status !== 'Em Andamento' && i.status !== 'Concluído' && i.status !== 'Concluido');

    // Garantir que cada item tenha um treatmentOrder válido
    backlogItems.forEach((item, idx) => {
      if (!item.treatmentOrder || item.treatmentOrder <= 0) {
        item.treatmentOrder = idx + 1;
      }
    });

    // Ordenar por treatmentOrder
    backlogItems.sort((a, b) => (a.treatmentOrder || 999) - (b.treatmentOrder || 999));

    const searchTerm = (document.getElementById('search-backlog')?.value || '').toLowerCase();

    const filteredItems = backlogItems.filter(item => {
      return !searchTerm ||
        (item.title || '').toLowerCase().includes(searchTerm) ||
        (item.gau || item.jiraKey || '').toLowerCase().includes(searchTerm) ||
        (item.requester || '').toLowerCase().includes(searchTerm);
    });

    if (filteredItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-8 text-slate-500 font-semibold">Nenhuma demanda no backlog encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredItems.map((item) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td onclick="event.stopPropagation();" style="white-space:nowrap; width:75px;">
          <input type="number" min="1" max="${backlogItems.length}" value="${item.treatmentOrder}"
            class="input-field text-center text-xs font-bold py-1 px-1 bg-slate-800 border-slate-700 text-amber-400 rounded w-[50px] cursor-pointer"
            onchange="app.changeBacklogOrder('${item.id}', parseInt(this.value))"
            onclick="event.stopPropagation(); this.select();"
          />
        </td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; min-width:130px;">${item.gau || item.jiraKey || 'GAU-000'}</td>
        <td class="font-semibold text-white max-w-md truncate" title="${item.title}">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; min-width:180px;">${item.requester || 'Solicitante Jira'}</td>
        <td onclick="event.stopPropagation();" style="white-space:nowrap; min-width:200px;">
          <select class="status-select-dropdown status-backlog" onchange="app.changeDemandStatus('${item.id}', this.value)">
            <option value="Backlog" selected>Backlog</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
        </td>
      </tr>
    `).join('');
  },

  // Alterar a ordem de prioridade no backlog com validação de duplicatas
  changeBacklogOrder(itemId, newOrder) {
    const allItems = this.state.backlogItems[this.activeSquad] || [];
    const backlogItems = allItems.filter(i => i.status !== 'Em Andamento' && i.status !== 'Concluído' && i.status !== 'Concluido');
    const item = backlogItems.find(i => i.id === itemId);
    if (!item) return;

    const totalItems = backlogItems.length;

    // Validar limites
    if (newOrder < 1) newOrder = 1;
    if (newOrder > totalItems) newOrder = totalItems;

    const oldOrder = item.treatmentOrder;
    if (oldOrder === newOrder) return;

    // Reordenar: mover outros itens para abrir espaço
    backlogItems.forEach(bi => {
      if (bi.id === itemId) return;
      if (oldOrder < newOrder) {
        // Movendo para baixo: itens entre old+1 e new sobem 1
        if (bi.treatmentOrder > oldOrder && bi.treatmentOrder <= newOrder) {
          bi.treatmentOrder--;
        }
      } else {
        // Movendo para cima: itens entre new e old-1 descem 1
        if (bi.treatmentOrder >= newOrder && bi.treatmentOrder < oldOrder) {
          bi.treatmentOrder++;
        }
      }
    });

    item.treatmentOrder = newOrder;
    this.saveState();
  },

  deleteBacklogItem(id) {
    this.state.backlogItems[this.activeSquad] = this.state.backlogItems[this.activeSquad].filter(i => i.id !== id);
    this.saveState();
  },

  // RENDER: Entregas Concluídas (Com Filtro de Busca)
  renderCompletedView() {
    const tbody = document.getElementById('completed-table-body');
    if (!tbody) return;

    const items = this.state.completedTasks[this.activeSquad] || [];
    const searchTerm = (document.getElementById('search-concluidos')?.value || '').toLowerCase();

    const filteredItems = items.filter(item => {
      return !searchTerm ||
        (item.taskTitle || '').toLowerCase().includes(searchTerm) ||
        (item.completedBy || '').toLowerCase().includes(searchTerm) ||
        (item.jiraKey || '').toLowerCase().includes(searchTerm);
    });

    document.getElementById('completed-count-badge').textContent = `${filteredItems.length} entregas`;

    if (filteredItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">Nenhuma entrega concluída encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredItems.map(item => `
      <tr>
        <td class="font-bold text-white">${item.taskTitle}</td>
        <td class="text-slate-300">${item.completedBy || 'Squad'}</td>
        <td class="text-slate-400">${item.completionDate || '2026-07-29'}</td>
        <td class="text-emerald-400 text-xs italic">${item.gains || 'Sem registro de ganhos'}</td>
        <td>
          <button class="btn btn-secondary text-xs py-1 px-2" onclick="app.deleteCompletedTask('${item.id}')">
            <i class="fa-solid fa-trash text-rose-400"></i>
          </button>
        </td>
      </tr>
    `).join('');
  },

  deleteCompletedTask(id) {
    this.state.completedTasks[this.activeSquad] = this.state.completedTasks[this.activeSquad].filter(i => i.id !== id);
    this.saveState();
  },

  // Exportar Tabela para Excel (.xlsx) com suporte para as 3 abas
  exportExcel() {
    let items = [];
    let viewLabel = 'Backlog';

    if (this.activeView === 'board') {
      const all = this.state.backlogItems[this.activeSquad] || [];
      items = all.filter(i => i.status === 'Em Andamento');
      viewLabel = 'EmAndamento';
    } else if (this.activeView === 'concluidos') {
      items = this.state.completedTasks[this.activeSquad] || [];
      viewLabel = 'Concluidos';
    } else {
      const all = this.state.backlogItems[this.activeSquad] || [];
      items = all.filter(i => i.status !== 'Em Andamento' && i.status !== 'Concluído' && i.status !== 'Concluido');
      viewLabel = 'Backlog';
    }

    if (!items.length) {
      alert(`Nenhuma demanda na lista para exportar.`);
      return;
    }

    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, viewLabel);
    XLSX.writeFile(wb, `${viewLabel}_${this.activeSquad}_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  // Modais Handlers
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
      modal.classList.add('open');
    }
  },

  openMemberModal() { this.openModal('modal-member'); },
  openTaskModal() { this.openModal('modal-task'); },

  saveMember(e) {
    e.preventDefault();
    const name = document.getElementById('member-name').value;
    const role = document.getElementById('member-role').value;
    const ops = parseInt(document.getElementById('member-alloc-ops').value) || 50;
    const fin = parseInt(document.getElementById('member-alloc-fin').value) || 50;

    this.state.resources[this.activeSquad].push({
      id: `res-${Date.now()}`,
      name,
      role,
      status: 'Ativo',
      allocationOps: ops,
      allocationFin: fin,
      currentTask: null,
      nextTask: null
    });

    this.closeModal('modal-member');
    this.saveState();
  },

  saveTask(e) {
    e.preventDefault();
    const gau = document.getElementById('task-gau').value;
    const title = document.getElementById('task-title').value;
    const requester = document.getElementById('task-requester').value;
    const priority = document.getElementById('task-priority').value;
    const category = document.getElementById('task-category').value;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };

    this.state.backlogItems[this.activeSquad].unshift({
      id: `backlog-${Date.now()}`,
      gau,
      jiraKey: gau,
      title,
      requester,
      team: squadNames[this.activeSquad],
      priority,
      category,
      treatmentOrder: 1,
      status: 'Pendente',
      progress: 0
    });

    this.closeModal('modal-task');
    this.saveState();
  }
};

// Inicializar aplicação ao carregar a página
document.addEventListener('DOMContentLoaded', () => app.init());
