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
    if (savedTime && timeEl) {
      timeEl.textContent = `Última sync: ${savedTime}`;
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
      triagem: 'Mesa de Triagem & Governança Jira',
      dashboard: 'Dashboard Consolidado 3 Squads',
      board: `Quadro de Membros - ${squadNames[this.activeSquad]}`,
      backlog: `Backlog de Demandas - ${squadNames[this.activeSquad]}`,
      concluidos: `Entregas Concluídas - ${squadNames[this.activeSquad]}`,
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

  // Limpar todos os quadros e remover cards antigos incorretos
  clearAllBoards() {
    if (confirm('Tem certeza que deseja limpar TODOS os cards antigos dos quadros? Essa ação não afetará os dados no Jira Cloud.')) {
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
      this.saveState();
      alert('Quadros limpos com sucesso! Agora clique em "🔄 Atualizar cards do Jira" para importar as solicitações atualizadas do GAU.');
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

    // Salvar timestamp da última sincronização
    const currentSyncTime = result.time || new Date().toLocaleTimeString('pt-BR');
    localStorage.setItem('cs_last_sync_time', currentSyncTime);

    // Toast Feedback & Header Update
    const toast = document.getElementById('sync-toast-banner');
    const toastMsg = document.getElementById('sync-toast-message');
    const timeEl = document.getElementById('sync-last-time');

    if (toast && toastMsg) {
      toastMsg.textContent = result.message;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 7000);
    }

    if (timeEl) {
      timeEl.textContent = `Última sync: ${currentSyncTime}`;
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

  // RENDER: Mesa de Triagem (Tabela no Modelo Exato da Imagem Enviada)
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

    // Atualizar texto dos quadros com o sufixo "cards" exatamente como na imagem
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

    // Filtrar por busca textual
    const filteredDisplayItems = currentList.filter(i => {
      const matchSearch = !searchTerm || 
        i.title.toLowerCase().includes(searchTerm) || 
        i.jiraKey.toLowerCase().includes(searchTerm) ||
        (i.requesterName || '').toLowerCase().includes(searchTerm);
      return matchSearch;
    });

    if (filteredDisplayItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-slate-500 font-semibold">${emptyMessage}</td>
        </tr>
      `;
      return;
    }

    // Renderizar tabela no formato exato da imagem enviada pelo usuário
    tbody.innerHTML = filteredDisplayItems.map((item, idx) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td class="font-bold text-slate-400">${idx + 1}</td>
        <td class="font-extrabold text-emerald-400">${item.jiraKey}</td>
        <td class="font-semibold text-white max-w-md truncate" title="${item.title}">${item.title}</td>
        <td class="text-slate-300">${item.requesterName || 'Solicitante Jira'}</td>
        <td class="text-amber-400 font-medium whitespace-nowrap">${item.createdDate || item.date || 'Data N/D'}</td>
        <td><span class="badge ${item.priority?.includes('1') ? 'badge-urgent' : 'badge-high'}">${item.priority || '2 - Alta'}</span></td>
        <td class="text-slate-400">${item.category || 'Geral'}</td>
        <td><span class="badge badge-medium">${item.status || 'Aguardando Triagem'}</span></td>
        <td>
          <button type="button" class="btn btn-secondary text-xs py-1 px-2.5" onclick="event.stopPropagation(); app.openDemandDetailsModal('${item.id}')">
            <i class="fa-solid fa-up-right-and-down-left-from-center text-emerald-400 me-1"></i> Detalhes
          </button>
        </td>
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
    if (event) {
      event.stopPropagation();
      if (event.preventDefault) event.preventDefault();
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  },

  // Ação: Encaminhar card da Triagem para Squad (com Sincronização Bidirecional no Jira Cloud)
  async triageToSquad(triageId, targetSquadId) {
    const itemIdx = this.state.triageItems.findIndex(i => i.id === triageId);
    if (itemIdx === -1) return;

    const item = this.state.triageItems[itemIdx];
    item.status = 'Triado';
    item.triagedSquadId = targetSquadId;

    // Inserir no backlog da Squad
    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    this.state.backlogItems[targetSquadId].unshift({
      id: `backlog-${item.jiraKey}`,
      gau: item.jiraKey,
      title: item.title,
      notes: item.description,
      requester: item.requesterName,
      team: squadNames[targetSquadId],
      priority: item.priority || '2 - Alta',
      category: item.category || 'Geral',
      treatmentOrder: 1,
      status: 'Em Andamento',
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

  // RENDER: Quadro da Squad (Desenvolvedores Estabelecidos em Dados, Controle Por Demanda em Operações e RPA)
  renderBoardView() {
    const container = document.getElementById('board-members-container');
    if (!container) return;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    const titleEl = document.getElementById('board-squad-title');
    const descEl = document.getElementById('board-squad-desc');
    const actionBtn = document.getElementById('board-action-btn');

    if (this.activeSquad === 'dados') {
      if (titleEl) titleEl.textContent = 'Quadro de Desenvolvedores Estabelecidos - Squad de Dados';
      if (descEl) descEl.textContent = 'Recursos estabelecidos, alocação de capacidade (Ops vs Fin) e acompanhamento de tarefas ativas';
      if (actionBtn) {
        actionBtn.innerHTML = '<i class="fa-solid fa-plus me-1"></i> Novo Desenvolvedor';
        actionBtn.onclick = () => this.openMemberModal();
      }

      const members = this.state.resources.dados || [];
      if (members.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400"><p>Nenhum desenvolvedor cadastrado nesta Squad.</p></div>`;
        return;
      }

      container.innerHTML = members.map(m => `
        <div class="glass-panel p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-bold text-white text-base">${m.name}</h4>
              <span class="text-xs text-slate-400">${m.role}</span>
            </div>
            <span class="badge ${m.status === 'Ativo' ? 'badge-medium' : 'badge-low'}">${m.status || 'Ativo'}</span>
          </div>

          <div class="mb-4">
            <div class="flex justify-between text-xs text-slate-400 mb-1">
              <span>Ops: ${m.allocationOps || 50}%</span>
              <span>Fin: ${m.allocationFin || 50}%</span>
            </div>
            <div class="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden flex">
              <div class="bg-emerald-500 h-full" style="width: ${m.allocationOps || 50}%"></div>
              <div class="bg-blue-500 h-full" style="width: ${m.allocationFin || 50}%"></div>
            </div>
          </div>

          <!-- TAREFA ATIVA -->
          <div class="p-3 rounded-lg bg-white/5 border border-white/10 mb-3">
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Demanda Ativa:</span>
            ${m.currentTask ? `
              <div class="font-semibold text-xs text-white mb-2">${m.currentTask.title}</div>
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span>Prazo: ${m.currentTask.dueDate}</span>
                <span class="text-emerald-400 font-bold">${m.currentTask.status}</span>
              </div>
            ` : '<span class="text-xs text-slate-500 italic">Nenhuma demanda atribuída</span>'}
          </div>

          <!-- PRÓXIMA TAREFA -->
          ${m.nextTask ? `
            <div class="p-3 rounded-lg bg-white/5 border border-white/10">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Próxima Fila:</span>
                <span class="badge badge-low text-[10px]">Aguardando</span>
              </div>
              <div class="font-semibold text-xs text-slate-300">${m.nextTask.title}</div>
            </div>
          ` : ''}
        </div>
      `).join('');
    } else {
      // CONTROLE POR DEMANDA (Squad de Operações & Squad de RPA)
      const squadLabel = squadNames[this.activeSquad];
      if (titleEl) titleEl.textContent = `Monitor de Demandas - ${squadLabel}`;
      if (descEl) descEl.textContent = 'Acompanhamento consultivo de demandas ativas, prazos, prioridades e avanço no Jira';

      const demands = this.state.backlogItems[this.activeSquad] || [];
      if (demands.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center py-12 text-slate-400">
            <i class="fa-solid fa-clipboard-list text-4xl mb-3 text-slate-600"></i>
            <p class="font-semibold text-sm">Nenhuma demanda em acompanhamento nesta Squad.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = demands.map(d => `
        <div class="glass-panel p-5 flex flex-col justify-between" style="border-left: 4px solid ${this.activeSquad === 'operacoes' ? 'var(--color-operacoes)' : 'var(--color-rpa)'};">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-extrabold text-xs text-emerald-400 tracking-wider">${d.gau || d.jiraKey || 'GAU-000'}</span>
              <span class="badge ${d.priority?.includes('1') ? 'badge-urgent' : d.priority?.includes('2') ? 'badge-high' : 'badge-medium'}">${d.priority || '2 - Alta'}</span>
            </div>
            <h4 class="text-base font-bold text-white mb-2 leading-snug">${d.title}</h4>
            <p class="text-xs text-slate-400 mb-4 line-clamp-2">${d.notes || 'Sem observações'}</p>

            <div class="space-y-2 mb-4 text-xs text-slate-300">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Solicitante:</span>
                <span class="font-semibold text-white">${d.requester || 'Solicitante Jira'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Prazo Estimado:</span>
                <span class="font-semibold text-amber-400">${d.dueDate || 'A definir'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Status Atual:</span>
                <span class="badge badge-medium">${d.status || 'Em Andamento'}</span>
              </div>
            </div>

            <!-- BARRA DE PROGRESSO DA DEMANDA -->
            <div class="mb-4">
              <div class="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progresso no Jira</span>
                <span class="font-bold text-emerald-400">${d.progress || 50}%</span>
              </div>
              <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full" style="width: ${d.progress || 50}%"></div>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="text-slate-400"><i class="fa-solid fa-chart-line text-emerald-400 me-1"></i> Acompanhamento Jira</span>
            <span class="badge badge-medium">${d.status || 'Em Andamento'}</span>
          </div>
        </div>
      `).join('');
    }
  },

  // RENDER: Backlog View (Consultivo)
  renderBacklogView() {
    const tbody = document.getElementById('backlog-table-body');
    if (!tbody) return;

    const items = this.state.backlogItems[this.activeSquad] || [];

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">Nenhuma demanda no backlog desta squad.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((item, idx) => `
      <tr>
        <td class="font-bold text-slate-400">${item.treatmentOrder || idx + 1}</td>
        <td class="font-extrabold text-emerald-400">${item.gau || item.jiraKey || 'GAU-000'}</td>
        <td class="font-semibold text-white">${item.title}</td>
        <td class="text-slate-300">${item.requester}</td>
        <td><span class="badge badge-high">${item.priority}</span></td>
        <td class="text-slate-400">${item.category}</td>
        <td><span class="badge badge-medium">${item.status}</span></td>
      </tr>
    `).join('');
  },

  deleteBacklogItem(id) {
    this.state.backlogItems[this.activeSquad] = this.state.backlogItems[this.activeSquad].filter(i => i.id !== id);
    this.saveState();
  },

  // RENDER: Entregas Concluídas
  renderCompletedView() {
    const tbody = document.getElementById('completed-table-body');
    if (!tbody) return;

    const items = this.state.completedTasks[this.activeSquad] || [];
    document.getElementById('completed-count-badge').textContent = `${items.length} entregas`;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">Nenhuma entrega concluída registrada nesta squad.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => `
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

  // Exportar Tabela para Excel (.xlsx)
  exportExcel() {
    const items = this.state.backlogItems[this.activeSquad] || [];
    if (!items.length) {
      alert('Nenhuma demanda no backlog para exportar.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Backlog');
    XLSX.writeFile(wb, `Backlog_${this.activeSquad}_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  // Modais Handlers
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
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
