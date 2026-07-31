/* ==========================================================================
   Controle de Squads & Governança Jira - Core Application Script (Padrão Painel-OPS)
   Supabase Auth + Realtime + RBAC (v2.0.0)
   ========================================================================== */

const SUPABASE_URL = 'https://maguyzjhldcgpcvkvkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3V5empobGRjZ3Bjdmt2a3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTU0MDMsImV4cCI6MjEwMDIzMTQwM30.Ow9xruE1qAFTX3mqELERxrY3CRBOdV_n4MoXXhtt3Y8';

let supabaseClient = null;
if (window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Erro ao inicializar Supabase Client:', err);
  }
}

let _lastSelfSaveTime = 0;
let _saveDebounceTimer = null;

// Global Application State
const app = {
  activeSquad: 'dados',
  activeView: 'triagem',
  userRole: 'consulta', // 'admin' ou 'consulta'
  userEmail: '',
  userName: 'Visitante',
  authUserId: null,
  realtimeChannel: null,
  
  state: {
    triageItems: [],
    backlogItems: { dados: [], operacoes: [], rpa: [] },
    completedTasks: { dados: [], operacoes: [], rpa: [] },
    resources: { dados: [], operacoes: [], rpa: [] },
    dpoLogs: [],
    usersList: []
  },

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  async init() {
    const hasSession = await this.checkSession();
    if (!hasSession) {
      this.showAuthOverlay();
      return;
    }
    this.loadLocalState();
    await this.loadStateFromSupabase();
    this.loadUsersState();
    this.seedDefaultDataIfEmpty();
    this.setupRealtimeSync();
    this.restoreLastSyncTime();
    this.setupKeyboardShortcuts();
    this.render();
  },

  // ============================================================
  // SUPABASE AUTH - LOGIN / SIGNUP / LOGOUT / SESSION
  // ============================================================
  async checkSession() {
    if (!supabaseClient) return false;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        await this.setupUserSession(session.user);
        return true;
      }
    } catch (e) {
      console.warn('Erro ao verificar sessão:', e);
    }
    return false;
  },

  async setupUserSession(user) {
    if (!user) {
      this.showAuthOverlay();
      return;
    }

    this.hideAuthOverlay();
    this.authUserId = user.id;
    this.userEmail = user.email || '';
    this.userName = user.email ? user.email.split('@')[0] : 'Usuário';
    this.userRole = 'consulta'; // Default

    // Buscar perfil na tabela profiles do Supabase (mesma do Painel-OPS)
    if (supabaseClient) {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('perfil, nome')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          if (profile.perfil) this.userRole = profile.perfil.toLowerCase() === 'admin' ? 'admin' : 'consulta';
          if (profile.nome) this.userName = profile.nome;
        }
      } catch (e) {
        console.warn('Aviso ao buscar perfil:', e);
        // Fallback: verificar user_metadata
        const meta = user.user_metadata || {};
        if (meta.perfil) this.userRole = meta.perfil.toLowerCase() === 'admin' ? 'admin' : 'consulta';
        if (meta.nome) this.userName = meta.nome;
      }
    }

    this.updateUserBadgeUI();
    this.applyRolePermissions();
  },

  async handleLogin() {
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    const btnLogin = document.getElementById('btn-auth-login');
    const errorEl = document.getElementById('auth-error-msg');

    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value.trim() : '';

    if (!email || !password) {
      if (errorEl) { errorEl.textContent = 'Por favor, preencha o e-mail e a senha.'; errorEl.style.display = 'block'; }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    if (!supabaseClient) {
      if (errorEl) { errorEl.textContent = 'Não foi possível conectar ao Supabase.'; errorEl.style.display = 'block'; }
      return;
    }

    const origText = btnLogin ? btnLogin.textContent : 'Entrar';
    if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Entrando...'; }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        let msg = error.message;
        if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid_grant')) msg = 'E-mail ou senha incorretos.';
        if (msg.toLowerCase().includes('email not confirmed')) msg = 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
      } else {
        const user = data?.session?.user || data?.user;
        if (user) {
          await this.setupUserSession(user);
          this.loadLocalState();
          await this.loadStateFromSupabase();
          this.loadUsersState();
          this.seedDefaultDataIfEmpty();
          this.setupRealtimeSync();
          this.restoreLastSyncTime();
          this.render();
        } else {
          if (errorEl) { errorEl.textContent = 'E-mail ou senha incorretos.'; errorEl.style.display = 'block'; }
        }
      }
    } catch (err) {
      if (errorEl) { errorEl.textContent = 'Erro de conexão: ' + (err.message || ''); errorEl.style.display = 'block'; }
    } finally {
      if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = origText; }
    }
  },

  async handleSignup() {
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    const btnSignup = document.getElementById('btn-auth-signup');
    const errorEl = document.getElementById('auth-error-msg');
    const infoEl = document.getElementById('auth-info-msg');

    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value.trim() : '';

    if (!email || !password) {
      if (errorEl) { errorEl.textContent = 'Por favor, preencha o e-mail e a senha.'; errorEl.style.display = 'block'; }
      return;
    }
    if (password.length < 6) {
      if (errorEl) { errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; errorEl.style.display = 'block'; }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';
    if (infoEl) infoEl.style.display = 'none';

    if (!supabaseClient) {
      if (errorEl) { errorEl.textContent = 'Não foi possível conectar ao Supabase.'; errorEl.style.display = 'block'; }
      return;
    }

    const origText = btnSignup ? btnSignup.textContent : 'Criar conta';
    if (btnSignup) { btnSignup.disabled = true; btnSignup.textContent = 'Criando conta...'; }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { perfil: 'CONSULTA', nome: email.split('@')[0] } }
      });
      if (error) {
        if (errorEl) { errorEl.textContent = error.message; errorEl.style.display = 'block'; }
      } else {
        const user = data?.session?.user || data?.user;
        if (user && data?.session) {
          if (infoEl) { infoEl.textContent = 'Conta criada com sucesso!'; infoEl.style.display = 'block'; }
          await this.setupUserSession(user);
          this.loadLocalState();
          await this.loadStateFromSupabase();
          this.loadUsersState();
          this.seedDefaultDataIfEmpty();
          this.setupRealtimeSync();
          this.render();
        } else {
          if (infoEl) { infoEl.textContent = 'Conta criada! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.'; infoEl.style.display = 'block'; }
        }
      }
    } catch (err) {
      if (errorEl) { errorEl.textContent = 'Erro: ' + (err.message || ''); errorEl.style.display = 'block'; }
    } finally {
      if (btnSignup) { btnSignup.disabled = false; btnSignup.textContent = origText; }
    }
  },

  async handleLogout() {
    if (this.realtimeChannel && supabaseClient) {
      try { supabaseClient.removeAllChannels(); } catch (_) {}
    }
    this.realtimeChannel = null;
    this.authUserId = null;
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (e) { console.warn('Erro no logout:', e); }
    }
    this.showAuthOverlay();
  },

  showAuthOverlay() {
    const overlay = document.getElementById('cs-auth-overlay');
    if (overlay) {
      overlay.style.setProperty('display', 'flex', 'important');
      overlay.style.setProperty('opacity', '1', 'important');
      overlay.style.setProperty('pointer-events', 'auto', 'important');
    }
    const errorEl = document.getElementById('auth-error-msg');
    const infoEl = document.getElementById('auth-info-msg');
    if (errorEl) errorEl.style.display = 'none';
    if (infoEl) infoEl.style.display = 'none';
  },

  hideAuthOverlay() {
    const overlay = document.getElementById('cs-auth-overlay');
    if (overlay) {
      overlay.style.setProperty('display', 'none', 'important');
      overlay.style.setProperty('opacity', '0', 'important');
      overlay.style.setProperty('pointer-events', 'none', 'important');
    }
  },

  // ============================================================
  // SUPABASE DATABASE - PERSISTÊNCIA CENTRALIZADA
  // ============================================================
  async saveStateToSupabase() {
    if (!supabaseClient) return;
    _lastSelfSaveTime = Date.now();
    try {
      const { error } = await supabaseClient
        .from('cs_board_state')
        .upsert({
          id: 'default',
          data: this.state,
          updated_by: this.authUserId || null,
          updated_at: new Date().toISOString()
        });
      if (error) {
        console.warn('[Supabase Save Error]', error.message);
      }
    } catch (err) {
      console.warn('[Supabase Save Exception]', err);
    }
  },

  async loadStateFromSupabase() {
    if (!supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient
        .from('cs_board_state')
        .select('data, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        console.warn('[Supabase Load Error]', error.message);
        return false;
      }
      if (!data || !data.data) {
        console.log('[Supabase Load] Nenhum registro existente. Usando localStorage.');
        return false;
      }

      this.state = data.data;
      // Garantir que usersList existe no state carregado
      if (!this.state.usersList) this.state.usersList = [];
      localStorage.setItem('cs_triage_items', JSON.stringify(this.state.triageItems || []));
      ['dados', 'operacoes', 'rpa'].forEach(id => {
        localStorage.setItem(`cs_backlog_${id}`, JSON.stringify(this.state.backlogItems?.[id] || []));
        localStorage.setItem(`cs_completed_${id}`, JSON.stringify(this.state.completedTasks?.[id] || []));
        localStorage.setItem(`cs_resources_${id}`, JSON.stringify(this.state.resources?.[id] || []));
      });
      console.log('[Supabase Load] Estado compartilhado carregado com sucesso!');
      return true;
    } catch (err) {
      console.warn('[Supabase Load Exception]', err);
      return false;
    }
  },

  // ============================================================
  // UI DO BADGE NO HEADER
  // ============================================================
  updateUserBadgeUI() {
    const infoEl = document.getElementById('user-display-info');
    const iconEl = document.getElementById('user-role-icon');
    if (infoEl) {
      if (this.userRole === 'admin') {
        infoEl.textContent = `Admin: ${this.userName}`;
        infoEl.style.color = '#34d399';
        if (iconEl) iconEl.className = 'fa-solid fa-user-shield text-emerald-400';
      } else {
        infoEl.textContent = `Consulta: ${this.userName}`;
        infoEl.style.color = '#38bdf8';
        if (iconEl) iconEl.className = 'fa-solid fa-eye text-sky-400';
      }
    }
  },

  toggleLoginModal() {
    // No novo sistema, o badge abre opção de logout
    if (this.authUserId) {
      if (confirm('Deseja sair do sistema?')) {
        this.handleLogout();
      }
    } else {
      this.showAuthOverlay();
    }
  },

  applyRolePermissions() {
    const isAdmin = this.userRole === 'admin';

    // 1. Esconder/Exibir botões exclusivos do perfil Admin
    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) {
        el.classList.remove('hidden');
        el.style.display = '';
      } else {
        el.classList.add('hidden');
        el.style.display = 'none';
      }
    });

    // 2. Botões de Ação na aplicação
    const actionSelector = '.btn-add-demand, .btn-forward-squad, #btn-new-member, #btn-save-timeline, #btn-add-timeline-entry';
    document.querySelectorAll(actionSelector).forEach(btn => {
      if (isAdmin) {
        btn.removeAttribute('disabled');
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      } else {
        btn.setAttribute('disabled', 'true');
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      }
    });

    // 3. Campos editáveis no Modal de Detalhes (Read-Only para Consulta)
    const modalDetailFields = [
      'task-gau', 'task-title', 'task-requester', 'task-priority',
      'followup-dev-role', 'followup-dev-name', 'followup-dev-target-date',
      'followup-dev-progress', 'followup-ganhos', 'followup-timeline-text'
    ];

    modalDetailFields.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        if (isAdmin) {
          field.removeAttribute('disabled');
          field.removeAttribute('readonly');
          field.style.opacity = '1';
          field.style.pointerEvents = 'auto';
        } else {
          field.setAttribute('disabled', 'true');
          field.setAttribute('readonly', 'true');
          field.style.opacity = '0.75';
          field.style.pointerEvents = 'none';
        }
      }
    });

    // 4. Inputs de reordenação numérica do Backlog
    document.querySelectorAll('.treatment-order-input').forEach(input => {
      if (isAdmin) {
        input.removeAttribute('disabled');
        input.style.opacity = '1';
        input.style.pointerEvents = 'auto';
      } else {
        input.setAttribute('disabled', 'true');
        input.style.opacity = '0.6';
        input.style.pointerEvents = 'none';
      }
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Tecla Escape (Esc): fechar qualquer modal ativo
      if (e.key === 'Escape') {
        this.closeModal();
      }

      // Tecla '/' para focar na busca da visão ativa se não estiver digitando em um input
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        let searchInput = null;
        if (this.activeView === 'triagem') searchInput = document.getElementById('search-triage');
        else if (this.activeView === 'board') searchInput = document.getElementById('search-board');
        else if (this.activeView === 'backlog') searchInput = document.getElementById('search-backlog');
        else if (this.activeView === 'concluidos') searchInput = document.getElementById('search-concluidos');

        if (searchInput) searchInput.focus();
      }
    });
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

    const savedMetrics = localStorage.getItem('cs_last_sync_metrics');
    if (savedMetrics) {
      try {
        const metrics = JSON.parse(savedMetrics);
        this.updateSyncMetricsUI(metrics);
      } catch (e) {}
    }
  },

  updateSyncMetricsUI(metrics) {
    if (!metrics) return;
    const elNew = document.getElementById('sync-count-new');
    const elUpdated = document.getElementById('sync-count-updated');
    const elCompleted = document.getElementById('sync-count-completed');
    const elUnchanged = document.getElementById('sync-count-unchanged');

    if (elNew) elNew.textContent = metrics.countNew || 0;
    if (elUpdated) elUpdated.textContent = metrics.countUpdated || 0;
    if (elCompleted) elCompleted.textContent = metrics.countToCompleted || 0;
    if (elUnchanged) elUnchanged.textContent = metrics.countUnchanged || 0;
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
    } else if (viewId === 'gestao-acessos') {
      const activeNav = document.getElementById('nav-gestao-acessos');
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
      'dpo-logs': 'Histórico de Alinhamentos DPO',
      'gestao-acessos': 'Gestão de Perfis & Acessos Supabase'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titleMap[viewId] || 'Controle de Squads';

    this.render();
  },

  // Extrair o código GAU / Chave Jira de qualquer objeto de demanda
  getItemGau(item) {
    if (!item) return 'GAU-000';
    if (item.gau && item.gau !== 'GAU-000') return item.gau;
    if (item.jiraKey && item.jiraKey !== 'GAU-000') return item.jiraKey;

    // Tentar extrair do ID (ex: "completed-NPAY-123", "backlog-GAU-134", "NPAY-123")
    if (item.id) {
      const matchId = item.id.match(/(NPAY-\d+|GAU-\d+|[A-Z0-9]+-\d+)/i);
      if (matchId) return matchId[1].toUpperCase();
    }

    // Tentar extrair do título (ex: "Minha Tarefa (NPAY-123)")
    const titleStr = item.title || item.taskTitle || '';
    const matchTitle = titleStr.match(/\(([A-Z0-9]+-\d+)\)/i) || titleStr.match(/(NPAY-\d+|GAU-\d+|[A-Z0-9]+-\d+)/i);
    if (matchTitle) return matchTitle[1].toUpperCase();

    return 'GAU-000';
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
        if (c) {
          const list = JSON.parse(c);
          list.forEach(item => {
            const extractedGau = this.getItemGau(item);
            if (!item.gau || item.gau === 'GAU-000') item.gau = extractedGau;
            if (!item.jiraKey || item.jiraKey === 'GAU-000') item.jiraKey = extractedGau;
          });
          this.state.completedTasks[id] = list;
        }

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

    // Debounce para salvar no Supabase (evita flood de chamadas)
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => {
      this.saveStateToSupabase();
    }, 1000);

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

  // Supabase Realtime Sync (Multi-User) — Padrão Painel-OPS
  setupRealtimeSync() {
    if (!supabaseClient) return;
    try {
      // Limpar canais anteriores
      try { supabaseClient.removeAllChannels(); } catch (_) {}
      this.realtimeChannel = null;

      const channel = supabaseClient
        .channel('cs-board-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cs_board_state'
        }, (payload) => {
          console.log('[Realtime] Evento recebido via WebSocket:', payload.eventType);
          
          const payloadData = payload.new || payload.record;
          if (payloadData && payloadData.data) {
            // Ignorar atualizações feitas pelo próprio usuário
            if (payloadData.updated_by && this.authUserId && payloadData.updated_by === this.authUserId) {
              return;
            }
            // Ignorar self-echoes dentro de 3 segundos
            if (Date.now() - _lastSelfSaveTime < 3000) {
              return;
            }

            this.state = payloadData.data;
            if (!this.state.usersList) this.state.usersList = [];

            // Atualizar localStorage com dados recebidos
            try {
              localStorage.setItem('cs_triage_items', JSON.stringify(this.state.triageItems || []));
              ['dados', 'operacoes', 'rpa'].forEach(id => {
                localStorage.setItem(`cs_backlog_${id}`, JSON.stringify(this.state.backlogItems?.[id] || []));
                localStorage.setItem(`cs_completed_${id}`, JSON.stringify(this.state.completedTasks?.[id] || []));
                localStorage.setItem(`cs_resources_${id}`, JSON.stringify(this.state.resources?.[id] || []));
              });
            } catch (e) {}

            this.render();
            console.log('[Realtime] Painel atualizado em tempo real por outro usuário!');
          }
        })
        .subscribe((status) => {
          console.log('[Realtime] Status da inscrição:', status);
        });

      this.realtimeChannel = channel;
    } catch (e) {
      console.warn('Realtime sync offline:', e);
    }
  },

  // --- GESTÃO DE ACESSOS VIA SUPABASE PROFILES ---
  loadUsersState() {
    // No novo modelo, os usuários são carregados do Supabase na renderUsersTable
    // Manter fallback local para usersList caso necessário
    try {
      const savedUsers = localStorage.getItem('cs_users_list');
      if (savedUsers) {
        this.state.usersList = JSON.parse(savedUsers);
      }
    } catch (e) {
      console.warn('Erro ao carregar lista de usuários local:', e);
    }
  },

  saveUsersState() {
    try {
      localStorage.setItem('cs_users_list', JSON.stringify(this.state.usersList));
    } catch (e) {}
  },

  async renderUsersTable() {
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;

    // Buscar usuários da tabela profiles do Supabase
    let users = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('id, nome, perfil, email')
          .order('nome', { ascending: true });
        if (!error && data) {
          users = data.map(p => ({
            id: p.id,
            name: p.nome || p.email || 'Usuário',
            email: p.email || '',
            role: p.perfil ? p.perfil.toLowerCase() : 'consulta',
            status: 'Ativo'
          }));
        }
      } catch (e) {
        console.warn('Erro ao buscar perfis do Supabase:', e);
      }
    }

    // Fallback para dados locais se Supabase não retornou nada
    if (users.length === 0) {
      users = this.state.usersList || [];
    }

    // Atualizar estatísticas
    const totalEl = document.getElementById('stat-user-total');
    const adminsEl = document.getElementById('stat-user-admins');
    const consultasEl = document.getElementById('stat-user-consultas');

    const adminCount = users.filter(u => u.role === 'admin').length;
    const consultaCount = users.filter(u => u.role === 'consulta' || u.role === 'CONSULTA').length;

    if (totalEl) totalEl.textContent = users.length;
    if (adminsEl) adminsEl.textContent = adminCount;
    if (consultasEl) consultasEl.textContent = consultaCount;

    // Filtro de pesquisa
    const searchInput = document.getElementById('search-users');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredUsers = users.filter(u => 
      !term || (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)
    );

    if (filteredUsers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400 font-semibold">Nenhum usuário encontrado.</td>
        </tr>
      `;
      return;
    }

    const isAdminCurrentUser = this.userRole === 'admin';

    tbody.innerHTML = filteredUsers.map((user, idx) => `
      <tr class="hover:bg-white/5 transition-all">
        <td class="font-bold text-slate-400" style="width: 50px;">${idx + 1}</td>
        <td>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full ${user.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'} flex items-center justify-center font-bold text-xs">
              <i class="fa-solid ${user.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i>
            </div>
            <div>
              <div class="font-bold text-white text-xs">${user.name}</div>
              <div class="text-[11px] text-slate-400">${user.email === this.userEmail ? '(Você)' : ''}</div>
            </div>
          </div>
        </td>
        <td class="text-slate-300 text-xs font-mono">${user.email}</td>
        <td style="width: 200px;">
          <select class="form-control text-xs py-1 px-2 ${isAdminCurrentUser ? '' : 'pointer-events-none opacity-60'}" 
                  onchange="app.changeUserRoleDirectly('${user.id}', this.value)"
                  ${isAdminCurrentUser ? '' : 'disabled="true"'}
                  style="background: rgba(15,23,42,0.9); color:#fff; border: 1px solid ${user.role === 'admin' ? 'rgba(52,211,153,0.4)' : 'rgba(56,189,248,0.4)'}; border-radius: 6px;">
            <option value="consulta" ${user.role === 'consulta' ? 'selected' : ''}>👁️ Consulta (Leitura)</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👨‍💻 Admin (Acesso Total)</option>
          </select>
        </td>
        <td style="width: 140px;">
          <span class="badge ${user.status === 'Ativo' ? 'badge-success' : 'badge-neutral'} text-[11px]">${user.status || 'Ativo'}</span>
        </td>
        <td style="width: 140px; text-align: right;">
          <div class="flex items-center justify-end gap-1.5">
            <button class="btn btn-secondary text-xs p-1.5 hover:text-purple-300 ${isAdminCurrentUser ? '' : 'hidden'}" onclick="app.openEditUserModal('${user.id}')" title="Editar Usuário">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  async changeUserRoleDirectly(userId, newRole) {
    if (this.userRole !== 'admin') {
      alert('Acesso negado: Perfil ADMIN necessário.');
      return;
    }

    // Atualizar na tabela profiles do Supabase
    const perfilValue = newRole === 'admin' ? 'ADMIN' : 'CONSULTA';
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('profiles')
          .update({ perfil: perfilValue })
          .eq('id', userId);
        if (error) {
          alert('Erro ao atualizar perfil no Supabase: ' + error.message);
          return;
        }
      } catch (e) {
        alert('Erro de conexão ao atualizar perfil.');
        return;
      }
    }

    // Se o usuário alterado for o próprio usuário ativo nesta sessão
    if (userId === this.authUserId) {
      this.userRole = newRole;
      this.updateUserBadgeUI();
      this.applyRolePermissions();
    }

    this.renderUsersTable();
  },

  openNewUserModal() {
    // No modelo Supabase Auth, novos usuários são criados via signup
    alert('No modelo Supabase Auth, novos usuários devem se cadastrar pela tela de login usando "Criar nova conta".');
  },

  openEditUserModal(userId) {
    // Com Supabase Auth, a edição é feita diretamente pelo select de perfil
    alert('Use o seletor de perfil na tabela para alterar o nível de acesso do usuário.');
  },

  closeUserModal() {
    const modal = document.getElementById('modal-user-edit');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  },

  saveUserFromModal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // Mantido para compatibilidade — Supabase Auth gerencia os usuários agora
    this.closeUserModal();
    this.renderUsersTable();
  },

  deleteUser(userId) {
    alert('No modelo Supabase Auth, a exclusão de usuários é gerenciada pelo painel do Supabase.');
  },

  // Renderizador principal da interface
  render() {
    this.renderBadgeCounts();

    if (this.activeView === 'triagem') this.renderTriageView();
    else if (this.activeView === 'dashboard') this.renderDashboardView();
    else if (this.activeView === 'board') this.renderBoardView();
    else if (this.activeView === 'backlog') this.renderBacklogView();
    else if (this.activeView === 'concluidos') this.renderCompletedView();
    else if (this.activeView === 'gestao-acessos') this.renderUsersTable();

    this.applyRolePermissions();
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
      localStorage.removeItem('cs_last_sync_metrics');

      const timeEl = document.getElementById('sync-last-time');
      if (timeEl) timeEl.textContent = 'Última atualização: N/D';

      this.updateSyncMetricsUI({ countNew: 0, countUpdated: 0, countToCompleted: 0, countUnchanged: 0 });

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

    // Salvar e atualizar o Status da Atualização (Métricas detalhadas)
    const metrics = {
      countNew: result.countNew || 0,
      countUpdated: result.countUpdated || 0,
      countToCompleted: result.countToCompleted || 0,
      countUnchanged: result.countUnchanged || 0,
      syncTime: fullSyncDateTime
    };
    localStorage.setItem('cs_last_sync_metrics', JSON.stringify(metrics));
    this.updateSyncMetricsUI(metrics);

    // Toast de notificação com o resumo da atualização
    const toast = document.getElementById('sync-toast-banner');
    const toastMsg = document.getElementById('sync-toast-message');
    if (toast && toastMsg) {
      toastMsg.textContent = `🔄 Sincronização Jira realizada! ${metrics.countNew} novos criados, ${metrics.countUpdated} atualizados, ${metrics.countToCompleted} concluídos.`;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 6000);
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
        <td class="font-bold text-slate-400" style="white-space:nowrap; width:45px;">${idx + 1}</td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; width:110px;">${item.jiraKey}</td>
        <td class="font-semibold text-white" style="white-space:normal; word-break:break-word; line-height:1.4;">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; width:160px;">${item.requesterName || 'Solicitante Jira'}</td>
        <td style="white-space:nowrap; width:160px;"><span class="badge badge-medium" style="white-space:nowrap;">${item.status || 'Aguardando Triagem'}</span></td>
        <td class="text-amber-400 font-semibold text-xs" style="white-space:nowrap; width:120px;">${this.formatOnlyDate(item.createdDate || item.date || item.createdAt)}</td>
      </tr>
    `).join('');
  },

  // Helper para formatar apenas a data (DD/MM/AAAA) eliminando qualquer horario
  formatOnlyDate(dateVal) {
    if (!dateVal) return '29/07/2026';
    const str = dateVal.toString().trim();
    
    // Se for apenas formato de hora (ex: "14:25" ou "14:25:00"), retornar data padrão
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      return '29/07/2026';
    }

    // Se contiver 'T' ou espaço com horário (ex: 2026-07-29T14:25:00 ou 29/07/2026 14:25:00)
    if (str.includes('T') || (str.includes(' ') && str.includes(':'))) {
      const cleanDatePart = str.split('T')[0].split(' ')[0];
      if (cleanDatePart.includes('-')) {
        const parts = cleanDatePart.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      if (cleanDatePart.includes('/')) {
        return cleanDatePart;
      }
    }

    // Se for formato YYYY-MM-DD
    if (str.includes('-') && !str.includes('/')) {
      const parts = str.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    return str.split(' ')[0].split('T')[0];
  },

  // Pop-up Modal de Detalhes da Demanda
  openDemandDetailsModal(itemId) {
    const item = this.state.triageItems.find(i => i.id === itemId || i.jiraKey === itemId) || 
                 (this.state.backlogItems.dados || []).find(i => i.id === itemId || i.gau === itemId || i.jiraKey === itemId) ||
                 (this.state.backlogItems.operacoes || []).find(i => i.id === itemId || i.gau === itemId || i.jiraKey === itemId) ||
                 (this.state.backlogItems.rpa || []).find(i => i.id === itemId || i.gau === itemId || i.jiraKey === itemId) ||
                 (this.state.completedTasks.dados || []).find(i => i.id === itemId || i.jiraKey === itemId) ||
                 (this.state.completedTasks.operacoes || []).find(i => i.id === itemId || i.jiraKey === itemId) ||
                 (this.state.completedTasks.rpa || []).find(i => i.id === itemId || i.jiraKey === itemId);

    if (!item) return;

    this.activeDemandItemId = item.id;

    document.getElementById('detail-gau-key').textContent = item.jiraKey || item.gau || 'GAU-000';
    document.getElementById('detail-priority').textContent = item.priority || '2 - Alta';
    document.getElementById('detail-title').textContent = item.title || item.taskTitle || 'Demanda do Jira';
    document.getElementById('detail-requester').textContent = item.requesterName || item.requester || item.completedBy || item.requesterArea || 'Solicitante Jira';
    
    const dateEl = document.getElementById('detail-created-date');
    if (dateEl) {
      dateEl.textContent = this.formatOnlyDate(item.createdDate || item.date || item.createdAt || item.completionDate);
    }
    
    document.getElementById('detail-status').textContent = item.status || (item.completionDate ? 'Concluído' : 'Aguardando Triagem');
    
    const descEl = document.getElementById('detail-description');
    descEl.textContent = item.description || item.notes || item.taskDescription || item.gains || 'Sem descrição fornecida no chamado do Jira.';

    // Identificar com precisão a Squad Alvo do Item (dados, operacoes, rpa)
    let targetSquadKey = this.activeSquad || 'operacoes';

    if (['board', 'backlog', 'concluidos'].includes(this.activeView) && this.activeSquad) {
      targetSquadKey = this.activeSquad;
    } else {
      const isOperacoes = (this.state.backlogItems.operacoes || []).some(i => i.id === item.id || i.jiraKey === item.id || i.gau === item.id) ||
                          (this.state.completedTasks.operacoes || []).some(i => i.id === item.id || i.jiraKey === item.id);
      const isRpa = (this.state.backlogItems.rpa || []).some(i => i.id === item.id || i.jiraKey === item.id || i.gau === item.id) ||
                    (this.state.completedTasks.rpa || []).some(i => i.id === item.id || i.jiraKey === item.id);
      const isDados = (this.state.backlogItems.dados || []).some(i => i.id === item.id || i.jiraKey === item.id || i.gau === item.id) ||
                      (this.state.completedTasks.dados || []).some(i => i.id === item.id || i.jiraKey === item.id);

      if (isOperacoes) {
        targetSquadKey = 'operacoes';
      } else if (isRpa) {
        targetSquadKey = 'rpa';
      } else if (isDados) {
        targetSquadKey = 'dados';
      } else {
        const rawSquadStr = (item.squad || item.team || item.suggestedSquad || item.triagedSquadId || item.completedBy || '').toString().toLowerCase();
        if (rawSquadStr.includes('operac') || rawSquadStr.includes('operaç') || rawSquadStr.includes('16005')) {
          targetSquadKey = 'operacoes';
        } else if (rawSquadStr.includes('rpa') || rawSquadStr.includes('16007')) {
          targetSquadKey = 'rpa';
        } else {
          targetSquadKey = 'dados';
        }
      }
    }

    this.activeDemandSquadKey = targetSquadKey;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    
    const detailSquadEl = document.getElementById('detail-squad');
    if (detailSquadEl) {
      detailSquadEl.textContent = squadNames[targetSquadKey] || 'Mesa de Triagem';
    }

    // Configurar e Exibir o Card de Acompanhamento Específico para a Squad do Item
    const followupSection = document.getElementById('section-squad-followup');
    if (followupSection) {
      followupSection.classList.remove('hidden');
      this.configureSquadFollowupUI(targetSquadKey, item);
    }

    const modal = document.getElementById('modal-demand-details');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
      modal.classList.add('active');
    }
  },

  // Configurar a interface do card de acompanhamento para cada Squad específica
  configureSquadFollowupUI(squadKey, item) {
    const titleEl = document.getElementById('followup-title');
    const roleContainer = document.getElementById('followup-role-container');
    const nameContainer = document.getElementById('followup-name-container');
    const gridContainer = document.getElementById('followup-grid-container');
    const labelRoleEl = document.getElementById('followup-label-role');
    const roleSelect = document.getElementById('followup-dev-role');
    const labelNameEl = document.getElementById('followup-label-name');
    const nameInput = document.getElementById('followup-dev-name');
    const labelDateEl = document.getElementById('followup-label-target-date');
    const dateInput = document.getElementById('followup-dev-target-date');
    const labelProgressEl = document.getElementById('followup-label-progress');
    const progressSelect = document.getElementById('followup-dev-progress');

    // Configurações customizadas por Squad
    if (squadKey === 'operacoes') {
      if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-gears me-1.5" style="color:#f59e0b;"></i> ACOMPANHAMENTO SQUAD DE OPERAÇÕES`;
      
      if (roleContainer) {
        roleContainer.classList.add('hidden');
        roleContainer.style.setProperty('display', 'none', 'important');
      }
      if (nameContainer) {
        nameContainer.classList.add('hidden');
        nameContainer.style.setProperty('display', 'none', 'important');
      }
      if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr 1fr';

      if (labelDateEl) labelDateEl.textContent = 'Previsão de Conclusão / SLA:';
      if (labelProgressEl) labelProgressEl.textContent = 'Status do Processo / Evolução:';
      if (progressSelect) {
        progressSelect.innerHTML = `
          <option value="0%">0% - Mapeamento Inicial</option>
          <option value="25%">25% - Em Análise de Fluxo</option>
          <option value="50%">50% - Em Execução Operacional</option>
          <option value="75%">75% - Validação de SLA</option>
          <option value="100%">100% - Processo Finalizado</option>
        `;
      }
    } else if (squadKey === 'rpa') {
      if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-robot me-1.5" style="color:#f43f5e;"></i> ACOMPANHAMENTO SQUAD DE RPA`;
      
      if (roleContainer) {
        roleContainer.classList.add('hidden');
        roleContainer.style.setProperty('display', 'none', 'important');
      }
      if (nameContainer) {
        nameContainer.classList.add('hidden');
        nameContainer.style.setProperty('display', 'none', 'important');
      }
      if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr 1fr';

      if (labelDateEl) labelDateEl.textContent = 'Previsão de Conclusão / SLA:';
      if (labelProgressEl) labelProgressEl.textContent = 'Fase da Automação:';
      if (progressSelect) {
        progressSelect.innerHTML = `
          <option value="0%">0% - Mapeamento PDD</option>
          <option value="25%">25% - Desenvolvimento Bot</option>
          <option value="50%">50% - Testes de Cenários</option>
          <option value="75%">75% - Homologação UAT</option>
          <option value="100%">100% - Go-Live em Produção</option>
        `;
      }
    } else {
      // Squad de Dados (Padrão)
      if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-code-commit me-1.5" style="color:#10b981;"></i> ACOMPANHAMENTO SQUAD DE DADOS`;
      
      if (roleContainer) {
        roleContainer.classList.remove('hidden');
        roleContainer.style.setProperty('display', 'block', 'important');
      }
      if (nameContainer) {
        nameContainer.classList.remove('hidden');
        nameContainer.style.setProperty('display', 'block', 'important');
      }
      if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr 1fr';

      if (labelRoleEl) labelRoleEl.textContent = 'Atribuição / Especialidade:';
      if (roleSelect) {
        roleSelect.innerHTML = `
          <option value="Engenheiro de Dados">Engenheiro de Dados</option>
          <option value="Analista Engenheiro">Analista Engenheiro</option>
          <option value="Data Analytics">Data Analytics</option>
        `;
      }
      if (labelNameEl) labelNameEl.textContent = 'Desenvolvedor Responsável:';
      if (nameInput) nameInput.placeholder = 'Ex: Lucas Machiori';
      if (labelDateEl) labelDateEl.textContent = 'Previsão de Entrega:';
      if (labelProgressEl) labelProgressEl.textContent = 'Evolução / Progresso:';
      if (progressSelect) {
        progressSelect.innerHTML = `
          <option value="0%">0% - Não Iniciado</option>
          <option value="25%">25% - Análise / Modelagem</option>
          <option value="50%">50% - Em Desenvolvimento</option>
          <option value="75%">75% - Homologação / Testes</option>
          <option value="100%">100% - Concluído / Deploy</option>
        `;
      }
    }

    // Carregar valores salvos do item
    if (roleSelect) roleSelect.value = item.devRole || roleSelect.options[0]?.value || '';
    if (nameInput) nameInput.value = item.devName || '';
    if (dateInput) dateInput.value = item.targetDeliveryDate || '';
    if (progressSelect) progressSelect.value = item.devProgress || '0%';
    
    const gainsTextarea = document.getElementById('followup-ganhos');
    if (gainsTextarea) gainsTextarea.value = item.gains || '';

    // Data de hoje para nova atualização na timeline
    const todayISO = new Date().toISOString().split('T')[0];
    const timelineDateInput = document.getElementById('followup-timeline-date');
    const timelineTextInput = document.getElementById('followup-timeline-text');
    if (timelineDateInput) timelineDateInput.value = todayISO;
    if (timelineTextInput) timelineTextInput.value = '';

    this.renderTimelineList(item);
  },

  // Salvar campos de acompanhamento da Squad ativa com auto-save no localStorage
  saveSquadDevFields() {
    if (!this.activeDemandItemId) return;

    const squadKey = this.activeDemandSquadKey || this.activeSquad;
    const item = (this.state.backlogItems[squadKey] || []).find(i => i.id === this.activeDemandItemId || i.gau === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId) ||
                 (this.state.completedTasks[squadKey] || []).find(i => i.id === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId) ||
                 this.state.triageItems.find(i => i.id === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId);

    if (!item) return;

    const roleSelect = document.getElementById('followup-dev-role');
    const nameInput = document.getElementById('followup-dev-name');
    const dateInput = document.getElementById('followup-dev-target-date');
    const progressSelect = document.getElementById('followup-dev-progress');
    const gainsTextarea = document.getElementById('followup-ganhos');

    if (roleSelect) item.devRole = roleSelect.value;
    if (nameInput) item.devName = nameInput.value;
    if (dateInput) item.targetDeliveryDate = dateInput.value;
    if (progressSelect) item.devProgress = progressSelect.value;
    if (gainsTextarea) item.gains = gainsTextarea.value;

    this.saveState();
    if (this.activeView === 'concluidos') {
      this.renderCompletedView();
    }
  },

  // Adicionar entrada na linha do tempo com auto-save no localStorage
  addTimelineEntry() {
    if (!this.activeDemandItemId) return;

    const squadKey = this.activeDemandSquadKey || this.activeSquad;
    const item = (this.state.backlogItems[squadKey] || []).find(i => i.id === this.activeDemandItemId || i.gau === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId) ||
                 (this.state.completedTasks[squadKey] || []).find(i => i.id === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId) ||
                 this.state.triageItems.find(i => i.id === this.activeDemandItemId || i.jiraKey === this.activeDemandItemId);

    if (!item) return;

    const dateVal = document.getElementById('followup-timeline-date')?.value;
    const textVal = document.getElementById('followup-timeline-text')?.value.trim();

    if (!textVal) return;

    if (!item.timelineEntries) item.timelineEntries = [];

    // Formatar data para exibição (DD/MM/AAAA)
    let displayDate = dateVal;
    if (dateVal && dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    item.timelineEntries.unshift({
      date: displayDate || new Date().toLocaleDateString('pt-BR'),
      text: textVal,
      timestamp: Date.now()
    });

    const textInput = document.getElementById('followup-timeline-text');
    if (textInput) textInput.value = '';
    this.saveState();
    this.renderTimelineList(item);
  },

  // Renderizar a lista em formato de Linha do Tempo com Scrollbar
  renderTimelineList(item) {
    const listEl = document.getElementById('followup-timeline-list');
    if (!listEl) return;

    const entries = item.timelineEntries || [];

    if (entries.length === 0) {
      listEl.innerHTML = `<div style="color:#64748b; font-size:11px; font-style:italic; padding:8px 0;">Nenhuma atualização registrada ainda nesta demanda.</div>`;
      return;
    }

    listEl.innerHTML = entries.map(entry => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-date">${entry.date}</div>
        <div class="timeline-text">${entry.text}</div>
      </div>
    `).join('');
  },

  closeModal(modalId, event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (modalId && typeof modalId === 'string') {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
        modal.classList.remove('active');
      }
    } else {
      ['modal-demand-details', 'modal-new-task'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
          modal.style.display = 'none';
          modal.classList.remove('open');
          modal.classList.remove('active');
        }
      });
    }
    this.activeDemandItemId = null;
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
        const gauKey = this.getItemGau(item);
        this.state.completedTasks[this.activeSquad].unshift({
          id: item.id,
          gau: gauKey,
          jiraKey: item.jiraKey || item.gau || gauKey,
          title: item.title || item.taskTitle,
          taskTitle: item.title || item.taskTitle,
          description: item.description || item.notes || item.taskDescription,
          taskDescription: item.description || item.notes || item.taskDescription,
          requester: item.requester || item.requesterName || 'Solicitante Jira',
          requesterName: item.requester || item.requesterName || 'Solicitante Jira',
          completedBy: item.requester || item.requesterName || 'Analista Squad',
          createdDate: item.createdDate || item.date || item.createdAt,
          completionDate: new Date().toLocaleDateString('pt-BR'),
          gains: item.gains || 'Demanda concluída via alteração de status no painel',
          devRole: item.devRole,
          devName: item.devName,
          targetDeliveryDate: item.targetDeliveryDate,
          devProgress: item.devProgress || '100%',
          timelineEntries: item.timelineEntries || []
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

  // Parseador robusto de datas para chamados e entregas
  parseItemDate(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return new Date(dateStr);
    
    const str = String(dateStr).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  },

  // Agrupar todos os chamados das 3 squads para análise consolidada
  getAllDashboardDemands() {
    let allDemands = [];
    ['dados', 'operacoes', 'rpa'].forEach(squadId => {
      // 1. Demanda em Backlog / Em Andamento / Bloqueado
      (this.state.backlogItems[squadId] || []).forEach(item => {
        allDemands.push({
          ...item,
          squadId,
          itemType: 'active'
        });
      });

      // 2. Demandas Concluídas
      (this.state.completedTasks[squadId] || []).forEach(item => {
        allDemands.push({
          ...item,
          squadId,
          status: 'Concluído',
          itemType: 'completed'
        });
      });
    });
    return allDemands;
  },

  // Limpar todos os filtros do Dashboard
  clearDashboardFilters() {
    const sSquad = document.getElementById('dash-filter-squad');
    const sStatus = document.getElementById('dash-filter-status');
    const sPeriod = document.getElementById('dash-filter-period');
    const dFrom = document.getElementById('dash-date-from');
    const dTo = document.getElementById('dash-date-to');

    if (sSquad) sSquad.value = 'all';
    if (sStatus) sStatus.value = 'all';
    if (sPeriod) sPeriod.value = 'all';
    if (dFrom) dFrom.value = '';
    if (dTo) dTo.value = '';

    this.renderDashboardView();
  },

  // RENDER: Dashboard Consolidado com Filtros Dinâmicos por Squad, Status e Período
  renderDashboardView() {
    const squadFilter = document.getElementById('dash-filter-squad')?.value || 'all';
    const statusFilter = document.getElementById('dash-filter-status')?.value || 'all';
    const periodFilter = document.getElementById('dash-filter-period')?.value || 'all';

    // Se seleção customizada, exibir/ocultar contêiner de De/Até
    const customContainer = document.getElementById('dash-custom-date-container');
    if (customContainer) {
      if (periodFilter === 'custom') {
        customContainer.classList.remove('hidden');
        customContainer.style.display = 'flex';
      } else {
        customContainer.classList.add('hidden');
        customContainer.style.display = 'none';
      }
    }

    const dateFromStr = document.getElementById('dash-date-from')?.value;
    const dateToStr = document.getElementById('dash-date-to')?.value;

    const dateFrom = dateFromStr ? new Date(dateFromStr + 'T00:00:00') : null;
    const dateTo = dateToStr ? new Date(dateToStr + 'T23:59:59') : null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek - 1), 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

    let demands = this.getAllDashboardDemands();

    // 1. Filtro por Squad (dados, operacoes, rpa)
    if (squadFilter !== 'all') {
      demands = demands.filter(d => d.squadId === squadFilter);
    }

    // 2. Filtro por Status (Em Andamento, Backlog, Bloqueado, Concluído)
    if (statusFilter !== 'all') {
      demands = demands.filter(d => {
        if (statusFilter === 'Concluído') return d.status === 'Concluído' || d.status === 'Concluido' || d.itemType === 'completed';
        if (statusFilter === 'Em Andamento') return d.status === 'Em Andamento';
        if (statusFilter === 'Backlog') return d.status === 'Backlog';
        if (statusFilter === 'Bloqueado') return d.status === 'Bloqueado';
        return d.status === statusFilter;
      });
    }

    // 3. Filtro por Período (Hoje, Esta Semana, Este Mês, Este Ano, Custom)
    if (periodFilter !== 'all') {
      demands = demands.filter(d => {
        const dateObj = this.parseItemDate(d.createdDate || d.date || d.createdAt || d.completionDate);
        if (!dateObj) return true;

        if (periodFilter === 'today') {
          return dateObj >= todayStart && dateObj <= todayEnd;
        } else if (periodFilter === 'week') {
          return dateObj >= weekStart;
        } else if (periodFilter === 'month') {
          return dateObj >= monthStart;
        } else if (periodFilter === 'year') {
          return dateObj >= yearStart;
        } else if (periodFilter === 'custom') {
          if (dateFrom && dateObj < dateFrom) return false;
          if (dateTo && dateObj > dateTo) return false;
          return true;
        }
        return true;
      });
    }

    // Calcular as 4 Métricas Consolidadas
    const inProgressCount = demands.filter(d => d.status === 'Em Andamento').length;
    const backlogCount = demands.filter(d => d.status === 'Backlog').length;
    const blockedCount = demands.filter(d => d.status === 'Bloqueado').length;
    const completedCount = demands.filter(d => d.status === 'Concluído' || d.status === 'Concluido' || d.itemType === 'completed').length;

    // Atualizar os 4 quadros do Dashboard
    const elInProgress = document.getElementById('dash-total-in-progress');
    const elBacklog = document.getElementById('dash-total-backlog');
    const elBlocked = document.getElementById('dash-total-blocked');
    const elCompleted = document.getElementById('dash-total-completed');

    if (elInProgress) elInProgress.textContent = inProgressCount;
    if (elBacklog) elBacklog.textContent = backlogCount;
    if (elBlocked) elBlocked.textContent = blockedCount;
    if (elCompleted) elCompleted.textContent = completedCount;

    // Renderizar Gráficos com Dados Filtrados
    this.renderCharts(demands);
  },

  renderCharts(demands) {
    if (!demands) demands = this.getAllDashboardDemands();

    // 1. Gráfico: Distribuição por Squad (Doughnut compacto com legenda lateral)
    const ctxSquad = document.getElementById('chart-squad-dist')?.getContext('2d');
    if (ctxSquad) {
      if (window.squadChart) window.squadChart.destroy();

      const countDados = demands.filter(d => d.squadId === 'dados').length;
      const countOperac = demands.filter(d => d.squadId === 'operacoes').length;
      const countRpa = demands.filter(d => d.squadId === 'rpa').length;

      window.squadChart = new Chart(ctxSquad, {
        type: 'doughnut',
        data: {
          labels: ['Squad de Dados', 'Squad de Operações', 'Squad de RPA'],
          datasets: [{
            data: [countDados, countOperac, countRpa],
            backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
            borderWidth: 3,
            borderColor: '#0f172a',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#94a3b8',
                font: { size: 11, weight: '600' },
                boxWidth: 10,
                padding: 12,
                usePointStyle: true
              }
            }
          }
        }
      });
    }

    // 2. Gráfico: Status das Demandas (Bar Chart elegante e compacto)
    const ctxStatus = document.getElementById('chart-status-dist')?.getContext('2d');
    if (ctxStatus) {
      if (window.statusChart) window.statusChart.destroy();

      const countInProgress = demands.filter(d => d.status === 'Em Andamento').length;
      const countBacklog = demands.filter(d => d.status === 'Backlog').length;
      const countBlocked = demands.filter(d => d.status === 'Bloqueado').length;
      const countCompleted = demands.filter(d => d.status === 'Concluído' || d.status === 'Concluido' || d.itemType === 'completed').length;

      window.statusChart = new Chart(ctxStatus, {
        type: 'bar',
        data: {
          labels: ['Em Andamento', 'Backlog', 'Bloqueado', 'Concluído'],
          datasets: [{
            label: 'Total de Demandas',
            data: [countInProgress, countBacklog, countBlocked, countCompleted],
            backgroundColor: ['#06b6d4', '#f59e0b', '#f43f5e', '#10b981'],
            borderRadius: 6,
            maxBarThickness: 28
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8', font: { size: 10, weight: '600' } },
              grid: { display: false }
            },
            y: {
              ticks: { color: '#64748b', font: { size: 10 }, precision: 0 },
              grid: { color: 'rgba(255,255,255,0.05)' }
            }
          }
        }
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

    // Exibir/Ocultar o Banner da Sprint de 15 Dias (Exclusivo Squad de Dados)
    const sprintBanner = document.getElementById('squad-dados-sprint-banner');
    if (sprintBanner) {
      if (this.activeSquad === 'dados') {
        sprintBanner.classList.remove('hidden');
      } else {
        sprintBanner.classList.add('hidden');
      }
    }

    const allItems = this.state.backlogItems[this.activeSquad] || [];
    const inProgressItems = allItems.filter(i => i.status === 'Em Andamento' || i.status === 'Bloqueado');

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
          <td colspan="6" class="text-center py-8 text-slate-500 font-semibold">Nenhuma demanda em andamento ou bloqueada encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredItems.map((item, idx) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td class="font-bold text-slate-400" style="white-space:nowrap; width:45px;">${idx + 1}</td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; width:110px;">${item.gau || item.jiraKey || 'GAU-000'}</td>
        <td class="font-semibold text-white" style="white-space:normal; word-break:break-word; line-height:1.4;">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; width:160px;">${item.requester || 'Solicitante Jira'}</td>
        <td onclick="event.stopPropagation();" style="white-space:nowrap; width:160px;">
          <select class="status-select-dropdown ${item.status === 'Bloqueado' ? 'status-bloqueado' : ''}" onchange="app.changeDemandStatus('${item.id}', this.value)">
            <option value="Em Andamento" ${item.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
            <option value="Bloqueado" ${item.status === 'Bloqueado' ? 'selected' : ''}>Bloqueado</option>
            <option value="Backlog" ${item.status === 'Backlog' ? 'selected' : ''}>Backlog</option>
            <option value="Concluído" ${item.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
          </select>
        </td>
        <td class="text-amber-400 font-semibold text-xs" style="white-space:nowrap; width:120px;">${this.formatOnlyDate(item.createdDate || item.date || item.createdAt)}</td>
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

    // Garantir que cada item tenha uma ordem de tratativa única de 1 a N
    const usedOrders = new Set();
    backlogItems.forEach((item, idx) => {
      if (!item.treatmentOrder || item.treatmentOrder <= 0 || usedOrders.has(item.treatmentOrder)) {
        item.treatmentOrder = idx + 1;
      }
      usedOrders.add(item.treatmentOrder);
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
          <td colspan="6" class="text-center py-8 text-slate-500 font-semibold">Nenhuma demanda no backlog encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredItems.map((item) => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td onclick="event.stopPropagation();" style="white-space:nowrap; width:65px;">
          <input type="number" min="1" max="${backlogItems.length}" value="${item.treatmentOrder}"
            class="order-input-field"
            onchange="app.changeBacklogOrder('${item.id}', this.value)"
            onkeydown="if(event.key === 'Enter'){ this.blur(); }"
            onclick="event.stopPropagation(); this.select();"
            title="Digite a posição desejada para reordenar"
          />
        </td>
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; width:110px;">${item.gau || item.jiraKey || 'GAU-000'}</td>
        <td class="font-semibold text-white" style="white-space:normal; word-break:break-word; line-height:1.4;">${item.title}</td>
        <td class="text-slate-300" style="white-space:nowrap; width:160px;">${item.requester || 'Solicitante Jira'}</td>
        <td onclick="event.stopPropagation();" style="white-space:nowrap; width:160px;">
          <select class="status-select-dropdown status-backlog ${item.status === 'Bloqueado' ? 'status-bloqueado' : ''}" onchange="app.changeDemandStatus('${item.id}', this.value)">
            <option value="Backlog" ${item.status === 'Backlog' ? 'selected' : ''}>Backlog</option>
            <option value="Em Andamento" ${item.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
            <option value="Bloqueado" ${item.status === 'Bloqueado' ? 'selected' : ''}>Bloqueado</option>
          </select>
        </td>
        <td class="text-amber-400 font-semibold text-xs" style="white-space:nowrap; width:120px;">${this.formatOnlyDate(item.createdDate || item.date || item.createdAt)}</td>
      </tr>
    `).join('');
  },

  // Alterar a ordem de prioridade no backlog com troca direta de posição (swap) e reordenação automática
  changeBacklogOrder(itemId, newOrderInput) {
    const allItems = this.state.backlogItems[this.activeSquad] || [];
    const backlogItems = allItems.filter(i => i.status !== 'Em Andamento' && i.status !== 'Bloqueado' && i.status !== 'Concluído' && i.status !== 'Concluido');
    const item = backlogItems.find(i => i.id === itemId);
    if (!item) return;

    let newOrder = parseInt(newOrderInput, 10);
    const totalItems = backlogItems.length;

    // Se não for um número válido, recarregar sem alterar
    if (isNaN(newOrder)) {
      this.renderBacklogView();
      return;
    }

    // Clampar valor entre 1 e total de itens
    if (newOrder < 1) newOrder = 1;
    if (newOrder > totalItems) newOrder = totalItems;

    const oldOrder = item.treatmentOrder || 1;
    if (oldOrder === newOrder) {
      this.renderBacklogView();
      return;
    }

    // Encontrar a demanda que atualmente possui a ordem desejada (a demanda subscrita)
    const targetItem = backlogItems.find(bi => bi.id !== itemId && bi.treatmentOrder === newOrder);

    if (targetItem) {
      // TROCA DIRETA (SWAP): a demanda subscrita recebe a antiga ordem do card editado
      targetItem.treatmentOrder = oldOrder;
    } else {
      // Ajustar itens entre old e new
      backlogItems.forEach(bi => {
        if (bi.id === itemId) return;
        if (oldOrder < newOrder) {
          if (bi.treatmentOrder > oldOrder && bi.treatmentOrder <= newOrder) {
            bi.treatmentOrder--;
          }
        } else {
          if (bi.treatmentOrder >= newOrder && bi.treatmentOrder < oldOrder) {
            bi.treatmentOrder++;
          }
        }
      });
    }

    // Atribuir a nova ordem ao item editado
    item.treatmentOrder = newOrder;

    // Salvar estado e re-renderizar a visualização ordenada
    this.saveState();
    this.renderBacklogView();
  },

  deleteBacklogItem(id) {
    this.state.backlogItems[this.activeSquad] = this.state.backlogItems[this.activeSquad].filter(i => i.id !== id);
    this.saveState();
  },

  // RENDER: Entregas Concluídas (Com Filtro de Busca)
  renderCompletedView() {
    const tbody = document.getElementById('completed-table-body');
    if (!tbody) return;

    const squadNames = { dados: 'Squad de Dados', operacoes: 'Squad de Operações', rpa: 'Squad de RPA' };
    const titleEl = document.getElementById('concluidos-squad-title');
    if (titleEl) titleEl.textContent = `Concluídos - ${squadNames[this.activeSquad]}`;

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
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500 font-semibold">Nenhuma entrega concluída encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredItems.map(item => `
      <tr class="hover:bg-white/5 cursor-pointer transition-all" onclick="app.openDemandDetailsModal('${item.id}')">
        <td class="font-extrabold text-emerald-400" style="white-space:nowrap; width:110px;">${this.getItemGau(item)}</td>
        <td class="font-semibold text-white" style="white-space:normal; word-break:break-word; line-height:1.4;">${item.title || item.taskTitle}</td>
        <td class="text-slate-300" style="white-space:nowrap; width:160px;">${item.requester || item.completedBy || item.requesterName || 'Solicitante Jira'}</td>
        <td class="text-amber-400 font-semibold text-xs" style="white-space:nowrap; width:120px;">${this.formatOnlyDate(item.createdDate || item.date || item.createdAt)}</td>
        <td class="text-slate-300 font-semibold text-xs" style="white-space:nowrap; width:120px;">${this.formatOnlyDate(item.completionDate || item.completedAt)}</td>
        <td class="text-emerald-400 text-xs italic" style="white-space:normal; word-break:break-word;">${item.gains || 'Demanda concluída com sucesso'}</td>
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
