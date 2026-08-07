/* ==========================================================================
   Controle de Squads - Módulo Isolado de Pendências RPA (rpa-pendencies.js)
   Design System Harmonizado Impeccable (v1.5.0)
   ========================================================================== */

var RpaPendenciesModule = window.RpaPendenciesModule = {
  pendencies: [],
  activeId: null,
  selectedRobots: [],
  selectedResponsibles: [],
  selectedTimelineUpdates: [],

  // Inicialização do Módulo
  init() {
    this.injectUI();
    this.fetchPendencies();
    this.setupNavigationHook();
    this.registerGlobalAliases();
  },

  registerGlobalAliases() {
    const self = this;
    window.RpaPendenciesModule = self;
    window.openRpaView = function () { self.openRpaView(); };
    window.openRpaModal = function (id = null) { self.openModal(id); };
    window.openNewRpaPendencyModal = function (id = null) { self.openModal(id); };

    if (window.app) {
      window.app.openNewRpaPendencyModal = function (id = null) { self.openModal(id); };
      window.app.openRpaPendencyModal = function (id = null) { self.openModal(id); };
      window.app.closeRpaPendencyModal = function () { self.closeModal(); };
      window.app.saveRpaPendency = function (e) { self.savePendency(e); };
      window.app.openRpaPendencyDetailsModal = function (id) { self.openDetailsModal(id); };
      window.app.closeRpaPendencyDetailsModal = function () { self.closeDetailsModal(); };
      window.app.renderRpaPendenciesView = function () { self.renderView(); };
      window.app.addRpaTimelineUpdate = function () { self.addTimelineUpdate(); };
      window.app.removeRpaTimelineUpdate = function (idx) { self.removeTimelineUpdate(idx); };
    }
  },

    // Auto-Verificação e Leitura no Supabase via REST Client
    async fetchPendencies() {
      try {
        if (window.supabaseClient) {
          const { data, error } = await window.supabaseClient
            .from('rpa_pendencies')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            this.pendencies = data.map(item => ({
              id: item.id,
              robo_name: item.robo_name || 'Robô sem nome',
              title: item.title || 'Sem título',
              responsible: item.responsible || 'Redesign (Parceiro)',
              status: item.status || 'ABERTO',
              severity: item.severity || 'MEDIA',
              description: item.description || item.title || '',
              history_notes: Array.isArray(item.history_notes) ? item.history_notes : [],
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString()
            }));
            this.saveLocal();
            this.renderView();
            return;
          } else if (error) {
            console.info('[RPA Pendencies] Supabase REST notice:', error.message || error);
          }
        }
      } catch (err) {
        console.warn('[RPA Pendencies] Modo de operação resiliente ativado:', err);
      }

      this.loadLocal();
      this.renderView();
    },

    loadLocal() {
      try {
        const saved = localStorage.getItem('cs_rpa_pendencies_v2');
        if (saved) this.pendencies = JSON.parse(saved);
      } catch (_) {
        this.pendencies = [];
      }
    },

    saveLocal() {
      try {
        localStorage.setItem('cs_rpa_pendencies_v2', JSON.stringify(this.pendencies));
      } catch (_) {}
    },

    // Injeção Dinâmica da UI (Estática no HTML)
    injectUI() {
      // Elementos visuais já estão estaticamente no HTML
    },

    parseHTML(str) {
      const tmp = document.createElement('div');
      tmp.innerHTML = str.trim();
      return tmp.firstElementChild;
    },

    // 4. Lógica de Pílulas + Selects Adicionadores
    addRobot(robotName) {
      if (!robotName) return;
      if (!this.selectedRobots.includes(robotName)) {
        this.selectedRobots.push(robotName);
        this.renderRobotPills();
      }
    },

    removeRobot(robotName) {
      const idx = this.selectedRobots.indexOf(robotName);
      if (idx >= 0) {
        this.selectedRobots.splice(idx, 1);
        this.renderRobotPills();
      }
    },

    renderRobotPills() {
      const container = document.getElementById('rpa-robot-pills-container');
      if (!container) return;

      if (!this.selectedRobots.length) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = this.selectedRobots.map(robot => {
        const safeName = robot.replace(/'/g, "\\'");
        return `
          <span class="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0 shadow-sm">
            ${robot}
            <button type="button" onclick="app.removeRpaRobot('${safeName}')" class="text-emerald-400/80 hover:text-emerald-100 cursor-pointer text-xs font-bold transition-colors ml-0.5" title="Remover">✕</button>
          </span>
        `;
      }).join('');
    },

    addResponsible(respName) {
      if (!respName) return;
      if (!this.selectedResponsibles.includes(respName)) {
        this.selectedResponsibles.push(respName);
        this.renderRespPills();
      }
    },

    removeResponsible(respName) {
      const idx = this.selectedResponsibles.indexOf(respName);
      if (idx >= 0) {
        this.selectedResponsibles.splice(idx, 1);
        this.renderRespPills();
      }
    },

    renderRespPills() {
      const container = document.getElementById('rpa-resp-pills-container');
      if (!container) return;

      if (!this.selectedResponsibles.length) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = this.selectedResponsibles.map(rName => {
        const safeName = rName.replace(/'/g, "\\'");
        return `
          <span class="bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0 shadow-sm">
            ${rName}
            <button type="button" onclick="app.removeRpaResponsible('${safeName}')" class="text-indigo-400/80 hover:text-indigo-100 cursor-pointer text-xs font-bold transition-colors ml-0.5" title="Remover">✕</button>
          </span>
        `;
      }).join('');
    },

    getSelectedRobotsString() {
      return this.selectedRobots.join(', ');
    },

    getSelectedResponsiblesString() {
      return this.selectedResponsibles.length ? this.selectedResponsibles.join(' ; ') : 'Redesign (Parceiro)';
    },

    // 4.5 Lógica da Linha do Tempo de Atualizações
    addTimelineUpdate() {
      const dateVal = document.getElementById('rpa-update-date')?.value;
      const textInput = document.getElementById('rpa-update-text');
      const textVal = (textInput?.value || '').trim();

      if (!textVal) {
        alert('Por favor, digite o resumo da atualização.');
        return;
      }

      let formattedDate = '--/--/----';
      if (dateVal) {
        const parts = dateVal.split('-');
        if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = new Date().toLocaleDateString('pt-BR');
      }

      const nowIso = new Date().toISOString();
      this.selectedTimelineUpdates.unshift({
        id: 'upd-' + Date.now(),
        date: dateVal || nowIso,
        displayDate: formattedDate,
        author: window.app?.userName || 'Usuário',
        text: textVal
      });

      if (textInput) textInput.value = '';
      this.renderTimelineList();
    },

    removeTimelineUpdate(index) {
      if (index >= 0 && index < this.selectedTimelineUpdates.length) {
        this.selectedTimelineUpdates.splice(index, 1);
        this.renderTimelineList();
      }
    },

    renderTimelineList() {
      const container = document.getElementById('rpa-timeline-container');
      if (!container) return;

      if (!this.selectedTimelineUpdates.length) {
        container.innerHTML = `<p class="text-[11px] text-slate-500 text-center py-2">Nenhuma atualização registrada.</p>`;
        return;
      }

      container.innerHTML = this.selectedTimelineUpdates.map((item, idx) => {
        const displayDate = item.displayDate || (item.date ? (item.date.includes('/') ? item.date : new Date(item.date).toLocaleDateString('pt-BR')) : '--/--/----');
        return `
          <div class="flex items-start justify-between gap-2 p-2 rounded bg-slate-900/90 border border-white/5 text-xs">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">📅 ${displayDate}</span>
                <span class="text-[10px] text-slate-400">por ${item.author || 'Usuário'}</span>
              </div>
              <p class="text-slate-200 text-[11px] leading-relaxed break-words margin-0">${item.text}</p>
            </div>
            <button type="button" onclick="app.removeRpaTimelineUpdate(${idx})" class="text-slate-500 hover:text-rose-400 cursor-pointer text-xs p-1 transition-colors" title="Remover atualização">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      }).join('');
    },

    // 5. Hook Limpo na Navegação do App
    setupNavigationHook() {
      const checkAndToggleTab = () => {
        const squad = (window.app?.activeSquad || '').toString().toLowerCase();
        const activeDemandSquad = (window.app?.activeDemandSquadKey || '').toString().toLowerCase();
        const pageTitle = (document.getElementById('page-title')?.textContent || '').toLowerCase();
        const boardTitle = (document.getElementById('board-squad-title')?.textContent || '').toLowerCase();
        const backlogTitle = (document.getElementById('backlog-squad-title')?.textContent || '').toLowerCase();
        const concluidosTitle = (document.getElementById('concluidos-squad-title')?.textContent || '').toLowerCase();

        const isRpa = squad.includes('rpa') || 
                      activeDemandSquad.includes('rpa') || 
                      pageTitle.includes('rpa') || 
                      boardTitle.includes('rpa') || 
                      backlogTitle.includes('rpa') || 
                      concluidosTitle.includes('rpa');

        const activeView = window.app?.activeView || 'board';
        
        // 1. Alternar 4ª Aba "⚠️ Pendências RPA" nas Squads
        document.querySelectorAll('.rpa-only-tab-btn').forEach(btn => {
          if (isRpa) {
            btn.classList.remove('hidden');
            btn.style.setProperty('display', 'inline-flex', 'important');
            if (activeView === 'rpa-pendencies') {
              btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer rpa-only-tab-btn bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10';
            } else {
              btn.className = 'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer rpa-only-tab-btn text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
            }
          } else {
            btn.classList.add('hidden');
            btn.style.setProperty('display', 'none', 'important');
          }
        });

        // 2. Atualizar estilos das outras 3 abas
        document.querySelectorAll('.tab-btn-board').forEach(btn => {
          if (activeView === 'board') {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all tab-btn-board bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10';
          } else {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-semibold transition-all tab-btn-board text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
          }
        });

        document.querySelectorAll('.tab-btn-backlog').forEach(btn => {
          if (activeView === 'backlog') {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all tab-btn-backlog bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10';
          } else {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-semibold transition-all tab-btn-backlog text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
          }
        });

        document.querySelectorAll('.tab-btn-concluidos').forEach(btn => {
          if (activeView === 'concluidos') {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all tab-btn-concluidos bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10';
          } else {
            btn.className = 'px-4 py-2 rounded-lg text-xs font-semibold transition-all tab-btn-concluidos text-gray-400 hover:text-white hover:bg-slate-800 border border-transparent';
          }
        });

        if (!isRpa && activeView === 'rpa-pendencies') {
          window.app.navigate('board');
        }
      };

      if (window.app) {
        const origSetSquad = window.app.setSquad;
        window.app.setSquad = function (squadId) {
          if (origSetSquad) origSetSquad.call(window.app, squadId);
          checkAndToggleTab();
        };

        const origNavigate = window.app.navigate;
        window.app.navigate = function (viewId) {
          if (origNavigate) origNavigate.call(window.app, viewId);
          checkAndToggleTab();
        };
      }

      checkAndToggleTab();
      setInterval(checkAndToggleTab, 200);
    },

    openRpaView() {
      document.body.classList.add('squad-rpa');
      if (window.app) {
        window.app.setSquad('rpa');
        window.app.activeView = 'rpa-pendencies';
        document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active-view'));
        const rpaView = document.getElementById('view-rpa-pendencies');
        if (rpaView) rpaView.classList.add('active-view');

        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = 'Pendências - Squad de RPA';
        
        this.renderView();
      }
    },

    // 6. Renderização da Tabela de Pendências
    renderView() {
      const tbody = document.getElementById('rpa-pendencies-tbody');
      if (!tbody) return;

      const items = this.pendencies || [];
      const search = (document.getElementById('rpa-filter-search')?.value || '').toLowerCase().trim();

      const totalCount = items.length;
      const openCount = items.filter(i => i.status !== 'RESOLVIDO').length;
      const resolvedCount = items.filter(i => i.status === 'RESOLVIDO').length;

      const totalEl = document.getElementById('metric-rpa-total');
      if (totalEl) totalEl.textContent = `${totalCount} pendência${totalCount === 1 ? '' : 's'}`;

      const openEl = document.getElementById('metric-rpa-open');
      if (openEl) openEl.textContent = `${openCount} aberta${openCount === 1 ? '' : 's'}`;

      const resolvedEl = document.getElementById('metric-rpa-resolved');
      if (resolvedEl) resolvedEl.textContent = `${resolvedCount} concluída${resolvedCount === 1 ? '' : 's'}`;

      const filtered = items.filter(i => {
        if (search) {
          const matchRobo = (i.robo_name || '').toLowerCase().includes(search);
          const matchTitle = (i.title || '').toLowerCase().includes(search);
          const matchResp = (i.responsible || '').toLowerCase().includes(search);
          const matchDesc = (i.description || '').toLowerCase().includes(search);
          if (!matchRobo && !matchTitle && !matchResp && !matchDesc) return false;
        }
        return true;
      });

      if (!filtered.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-slate-400">
              <i class="fa-solid fa-folder-open text-2xl mb-2 block text-slate-500"></i>
              Nenhuma pendência de robô cadastrada ou encontrada.
            </td>
          </tr>
        `;
        return;
      }

      const formatDate = (iso) => {
        if (!iso) return '--';
        try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (_) { return iso; }
      };

      tbody.innerHTML = filtered.map(item => {
        // Renderizar responsáveis em badges
        const respList = (item.responsible || '').split(/;|;/).map(s => s.trim()).filter(Boolean);
        const respBadges = respList.map(r => `
          <span class="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md mb-1 me-1">
            👤 ${r}
          </span>
        `).join('');

        let sevBadge = `<span class="badge bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 font-bold text-[10px]">⚡ Média</span>`;
        if (item.severity === 'CRITICA') sevBadge = `<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 font-bold text-[10px]">🚨 Crítica</span>`;
        else if (item.severity === 'ALTA') sevBadge = `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-bold text-[10px]">🔥 Alta</span>`;
        else if (item.severity === 'BAIXA') sevBadge = `<span class="badge bg-slate-500/20 text-slate-300 border border-slate-500/30 px-2 py-0.5 font-bold text-[10px]">🟢 Baixa</span>`;

        let statusBadge = `<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 font-extrabold text-[11px]">Em Aberto</span>`;
        if (item.status === 'EM_ANALISE') statusBadge = `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 font-extrabold text-[11px]">Em Análise</span>`;
        else if (item.status === 'AGUARDANDO_PARCEIRO') statusBadge = `<span class="badge bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1 font-extrabold text-[11px]">Aguardando Parceiro</span>`;
        else if (item.status === 'RESOLVIDO') statusBadge = `<span class="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 font-extrabold text-[11px]">Resolvido</span>`;

        // Renderizar robôs selecionados em badges limpas na tabela
        const robotList = (item.robo_name || '').split(',').map(s => s.trim()).filter(Boolean);
        const robotBadges = robotList.map(r => `
          <span class="inline-flex items-center gap-1 bg-slate-800/90 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md mb-1 me-1">
            🤖 ${r}
          </span>
        `).join('');

        const notes = item.history_notes || [];
        let latestUpdateText = '';

        if (Array.isArray(notes) && notes.length > 0) {
          const latest = notes[0];
          let dStr = latest.displayDate;
          if (!dStr && latest.date) {
            try {
              dStr = latest.date.includes('/') ? latest.date : new Date(latest.date).toLocaleDateString('pt-BR');
            } catch (_) {
              dStr = latest.date;
            }
          }
          if (!dStr) {
            dStr = formatDate(item.updated_at || item.created_at);
          }
          latestUpdateText = `${dStr} - ${latest.text || ''}`;
        } else if (item.description) {
          latestUpdateText = item.description;
        }

        return `
          <tr class="hover:bg-white/5 transition-all">
            <td style="padding: 14px 16px;">
              <div class="flex flex-wrap items-center">
                ${robotBadges || `<span class="text-slate-400 text-xs">${item.robo_name}</span>`}
              </div>
            </td>
            <td style="padding: 14px 16px; min-width: 260px;">
              <span class="font-extrabold text-white text-xs block mb-1.5">${item.title}</span>
              ${latestUpdateText ? `
                <div class="text-[11px] text-emerald-300/90 bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5 leading-relaxed shadow-sm">
                  <i class="fa-solid fa-comment-dots text-emerald-400 me-1.5 shrink-0"></i>${latestUpdateText}
                </div>
              ` : `
                <span class="text-[10px] text-slate-500 italic">Sem atualizações registradas</span>
              `}
            </td>
            <td style="padding: 14px 16px;">
              <div class="flex flex-wrap items-center">
                ${respBadges || `<span class="text-slate-400 text-xs">${item.responsible}</span>`}
              </div>
            </td>
            <td style="padding: 14px 16px;">${sevBadge}</td>
            <td style="padding: 14px 16px;">${statusBadge}</td>
            <td style="padding: 14px 16px; text-align: right;">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="app.openNewRpaPendencyModal('${item.id}')" class="btn btn-secondary text-[11px] py-1 px-2" title="Editar Pendência">
                  <i class="fa-solid fa-pen text-slate-300"></i>
                </button>
                <button onclick="app.deleteRpaPendency('${item.id}')" class="btn btn-secondary text-[11px] py-1 px-2 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30" title="Excluir Pendência">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    // 7. Handlers de Modais e Formulários
    openModal(id = null) {
      let modal = document.getElementById('modal-rpa-edit');
      if (!modal) return;

      const titleEl = document.getElementById('rpa-modal-edit-title') || document.getElementById('modal-rpa-title');
      const idEl = document.getElementById('rpa-edit-id');
      const titleInput = document.getElementById('rpa-edit-title');
      const sevEl = document.getElementById('rpa-edit-severity');
      const statusEl = document.getElementById('rpa-edit-status');

      const todayIso = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('rpa-update-date');
      const textInput = document.getElementById('rpa-update-text');

      if (dateInput) dateInput.value = todayIso;
      if (textInput) textInput.value = '';

      const formatDate = (iso) => {
        if (!iso) return '--/--/----';
        try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (_) { return iso; }
      };

      if (id) {
        const item = this.pendencies.find(i => i.id === id);
        if (item) {
          if (titleEl) titleEl.textContent = 'Editar Ocorrência RPA';
          if (idEl) idEl.value = item.id;
          this.selectedRobots = item.robo_name ? item.robo_name.split(',').map(s => s.trim()).filter(Boolean) : [];
          this.selectedResponsibles = item.responsible ? item.responsible.split(/;|;/).map(s => s.trim()).filter(Boolean) : ['Redesign (Parceiro)'];

          if (Array.isArray(item.history_notes) && item.history_notes.length > 0) {
            this.selectedTimelineUpdates = [...item.history_notes];
          } else if (item.description && item.description !== item.title) {
            const dStr = formatDate(item.created_at || item.updated_at);
            this.selectedTimelineUpdates = [{
              id: 'upd-' + Date.now(),
              date: item.created_at || new Date().toISOString(),
              displayDate: dStr,
              author: window.app?.userName || 'Usuário',
              text: item.description
            }];
          } else {
            this.selectedTimelineUpdates = [];
          }

          if (titleInput) titleInput.value = item.title;
          if (sevEl) sevEl.value = item.severity;
          if (statusEl) statusEl.value = item.status;
        }
      } else {
        if (titleEl) titleEl.textContent = 'Nova Pendência de Robô RPA';
        if (idEl) idEl.value = '';
        this.selectedRobots = [];
        this.selectedResponsibles = ['Redesign (Parceiro)'];
        this.selectedTimelineUpdates = [];
        if (titleInput) titleInput.value = '';
        if (sevEl) sevEl.value = 'MEDIA';
        if (statusEl) statusEl.value = 'ABERTO';
      }

      this.renderRobotPills();
      this.renderRespPills();
      this.renderTimelineList();

      modal.classList.remove('hidden');
      modal.classList.add('open', 'active');
      modal.style.cssText = 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; z-index: 999999 !important; align-items: center; justify-content: center;';
    },

    closeModal() {
      const modal = document.getElementById('modal-rpa-edit');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open', 'active');
        modal.style.cssText = 'display: none !important; opacity: 0 !important; pointer-events: none !important;';
      }
    },

    async savePendency(e) {
      if (e && e.preventDefault) e.preventDefault();

      const id = document.getElementById('rpa-edit-id')?.value;
      const robo_name = this.getSelectedRobotsString();
      const responsible = this.getSelectedResponsiblesString();
      const title = document.getElementById('rpa-edit-title')?.value.trim();
      const severity = document.getElementById('rpa-edit-severity')?.value;
      const status = document.getElementById('rpa-edit-status')?.value;

      if (!robo_name) {
        alert('Por favor, selecione ao menos um Robô Afetado.');
        return;
      }
      if (!title) {
        alert('Por favor, preencha o Título da ocorrência.');
        return;
      }

      const nowIso = new Date().toISOString();
      let target = id ? this.pendencies.find(i => i.id === id) : null;

      let latestSummary = title;
      if (this.selectedTimelineUpdates.length > 0) {
        const first = this.selectedTimelineUpdates[0];
        let dStr = first.displayDate;
        if (!dStr && first.date) {
          try {
            dStr = first.date.includes('/') ? first.date : new Date(first.date).toLocaleDateString('pt-BR');
          } catch (_) {
            dStr = first.date;
          }
        }
        if (!dStr) dStr = new Date().toLocaleDateString('pt-BR');
        latestSummary = `${dStr} - ${first.text}`;
      }

      if (target) {
        target.robo_name = robo_name;
        target.title = title;
        target.responsible = responsible;
        target.severity = severity;
        target.status = status;
        target.description = latestSummary;
        target.history_notes = [...this.selectedTimelineUpdates];
        target.updated_at = nowIso;
      } else {
        target = {
          id: 'rpa-' + Date.now(),
          robo_name,
          title,
          responsible,
          severity,
          status,
          description: latestSummary,
          history_notes: [...this.selectedTimelineUpdates],
          created_at: nowIso,
          updated_at: nowIso
        };
        this.pendencies.unshift(target);
      }

      if (window.supabaseClient) {
        try {
          const payload = {
            robo_name: target.robo_name,
            title: target.title,
            responsible: target.responsible,
            severity: target.severity,
            status: target.status,
            description: target.description,
            history_notes: target.history_notes,
            updated_at: nowIso
          };
          if (id && !id.startsWith('rpa-')) {
            await window.supabaseClient.from('rpa_pendencies').update(payload).eq('id', id);
          } else {
            const { data, error } = await window.supabaseClient.from('rpa_pendencies').insert([payload]).select().single();
            if (!error && data) target.id = data.id;
          }
        } catch (err) {
          console.warn('[RPA Pendencies] Supabase insert/update warning:', err);
        }
      }

      this.saveLocal();
      this.closeModal();
      this.renderView();
      alert('✅ Pendência salva com sucesso!');
    },

    openDetailsModal(id) {
      const item = this.pendencies.find(i => i.id === id);
      if (!item) return;

      this.activeId = id;
      let modal = document.getElementById('modal-rpa-details');
      if (!modal) return;

      const titleEl = document.getElementById('rpa-detail-robo-title') || document.getElementById('rpa-det-title');
      if (titleEl) titleEl.textContent = `Robô(s): ${item.robo_name}`;
      const respEl = document.getElementById('rpa-detail-resp');
      if (respEl) respEl.textContent = item.responsible;
      const dateEl = document.getElementById('rpa-detail-date');
      if (dateEl) dateEl.textContent = new Date(item.created_at).toLocaleDateString('pt-BR');
      const statusChangeEl = document.getElementById('rpa-detail-status-change');
      if (statusChangeEl) statusChangeEl.value = item.status;

      const sevEl = document.getElementById('rpa-detail-sev');
      if (sevEl) {
        if (item.severity === 'CRITICA') sevEl.innerHTML = '<span class="text-rose-400 font-extrabold">🚨 Crítica</span>';
        else if (item.severity === 'ALTA') sevEl.innerHTML = '<span class="text-amber-400 font-extrabold">🔥 Alta</span>';
        else if (item.severity === 'MEDIA') sevEl.innerHTML = '<span class="text-yellow-400 font-extrabold">⚡ Média</span>';
        else sevEl.innerHTML = '<span class="text-slate-300 font-extrabold">🟢 Baixa</span>';
      }

      const statusEl = document.getElementById('rpa-detail-status');
      if (statusEl) {
        if (item.status === 'ABERTO') statusEl.innerHTML = '<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 font-bold text-[10px]">Em Aberto</span>';
        else if (item.status === 'EM_ANALISE') statusEl.innerHTML = '<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 font-bold text-[10px]">Em Análise</span>';
        else if (item.status === 'AGUARDANDO_PARCEIRO') statusEl.innerHTML = '<span class="badge bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 font-bold text-[10px]">Aguardando Parceiro</span>';
        else statusEl.innerHTML = '<span class="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 font-bold text-[10px]">Resolvido</span>';
      }

      this.renderNotesList(item);
      modal.classList.remove('hidden');
      modal.classList.add('open', 'active');
      modal.style.cssText = 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; z-index: 999999 !important; align-items: center; justify-content: center;';
    },

    renderNotesList(item) {
      const listEl = document.getElementById('rpa-detail-notes');
      if (!listEl) return;

      const notes = item.history_notes || [];
      if (!notes.length) {
        listEl.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Nenhuma nota ou cobrança registrada.</p>`;
        return;
      }

      listEl.innerHTML = notes.map(n => `
        <div class="mb-2.5 pb-2.5 border-b border-white/5 last:border-none last:mb-0 last:pb-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[11px] font-bold text-emerald-400"><i class="fa-solid fa-user me-1"></i>${n.author || 'Usuário'}</span>
            <span class="text-[10px] text-slate-400 font-mono">${new Date(n.date).toLocaleDateString('pt-BR')}</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">${n.text}</p>
        </div>
      `).join('');
    },

    closeDetailsModal() {
      const modal = document.getElementById('modal-rpa-details');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open', 'active');
        modal.style.cssText = 'display: none !important; opacity: 0 !important; pointer-events: none !important;';
      }
    },

    async addNote() {
      const id = this.activeId;
      if (!id) return;

      const textarea = document.getElementById('rpa-detail-new-text');
      const text = (textarea?.value || '').trim();
      if (!text) {
        alert('Digite o texto da nota de cobrança.');
        return;
      }

      const item = this.pendencies.find(i => i.id === id);
      if (!item) return;

      if (!Array.isArray(item.history_notes)) item.history_notes = [];
      const nowIso = new Date().toISOString();

      item.history_notes.unshift({
        date: nowIso,
        author: window.app?.userName || 'Usuário',
        text: text
      });
      item.updated_at = nowIso;

      if (window.supabaseClient) {
        try {
          await window.supabaseClient.from('rpa_pendencies').update({ history_notes: item.history_notes, updated_at: nowIso }).eq('id', id);
        } catch (_) {}
      }

      this.saveLocal();
      if (textarea) textarea.value = '';
      this.renderNotesList(item);
      this.renderView();
    },

    async updateStatus(newStatus) {
      const id = this.activeId;
      if (!id) return;

      const item = this.pendencies.find(i => i.id === id);
      if (!item) return;

      const oldStatus = item.status;
      if (oldStatus === newStatus) return;

      item.status = newStatus;
      const nowIso = new Date().toISOString();
      item.updated_at = nowIso;

      if (!Array.isArray(item.history_notes)) item.history_notes = [];
      item.history_notes.unshift({
        date: nowIso,
        author: 'Sistema',
        text: `Status alterado de "${oldStatus}" para "${newStatus}".`
      });

      if (window.supabaseClient) {
        try {
          await window.supabaseClient.from('rpa_pendencies').update({ status: newStatus, history_notes: item.history_notes, updated_at: nowIso }).eq('id', id);
        } catch (_) {}
      }

      this.saveLocal();
      this.openDetailsModal(id);
      this.renderView();
    },

    async deletePendency(id) {
      if (!confirm('Tem certeza que deseja excluir esta pendência de robô?')) return;

      this.pendencies = this.pendencies.filter(i => i.id !== id);

      if (window.supabaseClient) {
        try {
          await window.supabaseClient.from('rpa_pendencies').delete().eq('id', id);
        } catch (_) {}
      }

      this.saveLocal();
      this.renderView();
    },

    printPDF() {
      window.print();
    }
  };

  window.RpaPendenciesModule = RpaPendenciesModule;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RpaPendenciesModule.init());
  } else {
    RpaPendenciesModule.init();
  }
