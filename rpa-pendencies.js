/* ==========================================================================
   Controle de Squads - Módulo Isolado de Pendências RPA (rpa-pendencies.js)
   Garantia Total de Conexão dos Modais (onclick / window.app / DOM Direct)
   ========================================================================== */

(function () {
  'use strict';

  const RpaPendenciesModule = {
    pendencies: [],
    activeId: null,

    // Inicialização do Módulo
    init() {
      this.injectUI();
      this.fetchPendencies();
      this.setupNavigationHook();
      this.registerGlobalAliases();
    },

    // 1. Registro de Aliases Globais no window.app para evitar quebras em qualquer onclick
    registerGlobalAliases() {
      const self = this;
      window.RpaPendenciesModule = self;

      if (window.app) {
        window.app.openNewRpaPendencyModal = function (id = null) { self.openModal(id); };
        window.app.openRpaPendencyModal = function (id = null) { self.openModal(id); };
        window.app.closeRpaPendencyModal = function () { self.closeModal(); };
        window.app.saveRpaPendency = function (e) { self.savePendency(e); };
        window.app.openRpaPendencyDetailsModal = function (id) { self.openDetailsModal(id); };
        window.app.closeRpaPendencyDetailsModal = function () { self.closeDetailsModal(); };
        window.app.renderRpaPendenciesView = function () { self.renderView(); };
      }
    },

    // 2. Auto-Verificação e Leitura no Supabase via REST Client
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
              responsible: item.responsible || 'Redesign',
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

    // 3. Injeção Resiliente da UI (View Limpa + Botão Subnav + Modais)
    injectUI() {
      // Injetar Botão "Pendências RPA" no Subnav das Squads
      document.querySelectorAll('.view-container').forEach(container => {
        const subnav = container.querySelector('.flex.items-center.gap-2.mb-6');
        if (subnav && !subnav.querySelector('.rpa-only-tab-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-secondary text-xs py-1.5 px-3 rpa-only-tab-btn hidden';
          btn.style.cssText = 'display: none !important;';
          btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400 me-1"></i> Pendências RPA';
          btn.onclick = () => RpaPendenciesModule.openRpaView();
          subnav.appendChild(btn);
        }
      });

      // Injetar View Limpa da Tabela de Pendências se não existir
      if (!document.getElementById('view-rpa-pendencies')) {
        const viewHtml = `
          <div class="view-container" id="view-rpa-pendencies">
            <div class="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
              <button class="btn btn-secondary text-xs py-1.5 px-3" onclick="window.app.navigate('board')">
                <i class="fa-solid fa-spinner text-emerald-400 me-1"></i> Em Andamento
              </button>
              <button class="btn btn-secondary text-xs py-1.5 px-3" onclick="window.app.navigate('backlog')">
                <i class="fa-solid fa-list-check me-1"></i> Backlog
              </button>
              <button class="btn btn-secondary text-xs py-1.5 px-3" onclick="window.app.navigate('concluidos')">
                <i class="fa-solid fa-circle-check me-1"></i> Concluídos
              </button>
              <button class="btn btn-primary text-xs py-1.5 px-3 rpa-only-tab-btn" onclick="RpaPendenciesModule.openRpaView()">
                <i class="fa-solid fa-triangle-exclamation text-amber-400 me-1"></i> Pendências RPA
              </button>
            </div>

            <div class="triage-table-panel">
              <div class="panel-header-row mb-6 flex items-center justify-between">
                <div>
                  <h2 style="font-size:20px; font-weight:800; color:#fff; margin:0;">
                    <i class="fa-solid fa-robot text-amber-400 me-2"></i> Pendências de Robôs em Produção
                  </h2>
                  <p style="font-size:12px; color:#94a3b8; margin:4px 0 0 0;">
                    Ocorrências recorrentes, problemas de infra/APIs e histórico de cobrança (Redesign & Caio)
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" class="btn btn-primary text-xs py-2 px-3.5" onclick="RpaPendenciesModule.openModal()">
                    <i class="fa-solid fa-plus me-1.5"></i> Nova Pendência
                  </button>
                  <button type="button" class="btn btn-secondary text-xs py-2 px-3.5" onclick="RpaPendenciesModule.printPDF()">
                    <i class="fa-solid fa-print text-indigo-400 me-1.5"></i> Imprimir / PDF
                  </button>
                </div>
              </div>

              <!-- BARRA DE BUSCA ÚNICA E LIMPA -->
              <div class="search-box" style="width:100%; margin-bottom:20px;">
                <i class="fa-solid fa-magnifying-glass search-icon"></i>
                <input type="search" id="rpa-filter-search" class="input-field" style="padding:12px 14px 12px 44px; font-size:12px;" placeholder="Buscar por robô, ocorrência ou responsável..." onkeyup="RpaPendenciesModule.renderView()">
              </div>

              <!-- Tabela de Pendências -->
              <div class="table-responsive">
                <table class="custom-table w-full text-left">
                  <thead>
                    <tr>
                      <th style="width: 18%;">ROBÔ AFETADO</th>
                      <th style="min-width: 200px;">DESCRIÇÃO / OCORRÊNCIA</th>
                      <th style="width: 15%;">RESPONSÁVEL</th>
                      <th style="width: 12%;">SEVERIDADE</th>
                      <th style="width: 14%;">STATUS</th>
                      <th style="width: 140px; text-align: right;">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody id="rpa-pendencies-tbody">
                    <!-- Gerado via JS -->
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        const dpoView = document.getElementById('view-dpo-sync') || document.getElementById('view-gestao-acessos');
        if (dpoView && dpoView.parentNode) {
          dpoView.parentNode.insertBefore(this.parseHTML(viewHtml), dpoView);
        } else {
          document.body.appendChild(this.parseHTML(viewHtml));
        }
      }

      // Injetar Modal Completo de Cadastro / Edição se não existir
      if (!document.getElementById('modal-rpa-edit')) {
        const editModalHtml = `
          <div class="modal-backdrop hidden" id="modal-rpa-edit" style="z-index: 99999; backdrop-filter: blur(8px); display: none;">
            <div class="modal-content" style="max-width: 520px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 25px 60px rgba(0,0,0,0.7); border-radius: 16px; padding: 24px;">
              <div class="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div>
                    <h3 class="text-base font-extrabold text-white tracking-tight" id="rpa-modal-edit-title">Cadastrar Ocorrência RPA</h3>
                    <p class="text-xs text-slate-400">Controle de Incidentes e Cobrança em Produção</p>
                  </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white transition-colors" onclick="RpaPendenciesModule.closeModal()">
                  <i class="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <form onsubmit="RpaPendenciesModule.savePendency(event)">
                <input type="hidden" id="rpa-edit-id" />

                <div class="form-group mb-3">
                  <label class="form-label text-xs text-slate-300 font-bold">Nome do Robô Afetado *</label>
                  <input type="text" class="form-control text-xs py-2.5" id="rpa-edit-robo" placeholder="Ex: Robô de Conciliação Extratos" required style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;" />
                </div>

                <div class="form-group mb-3">
                  <label class="form-label text-xs text-slate-300 font-bold">Título / Resumo do Problema *</label>
                  <input type="text" class="form-control text-xs py-2.5" id="rpa-edit-title" placeholder="Ex: Timeout na API bancária durante execução" required style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;" />
                </div>

                <div class="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label class="form-label text-xs text-slate-300 font-bold">Responsável *</label>
                    <select class="form-control text-xs py-2.5" id="rpa-edit-responsible" style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;">
                      <option value="Redesign">Redesign (Parceiro)</option>
                      <option value="Caio (Interno)">Caio (Interno)</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label text-xs text-slate-300 font-bold">Severidade *</label>
                    <select class="form-control text-xs py-2.5" id="rpa-edit-severity" style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;">
                      <option value="MEDIA">⚡ Média</option>
                      <option value="BAIXA">🟢 Baixa</option>
                      <option value="ALTA">🔥 Alta</option>
                      <option value="CRITICA">🚨 Crítica</option>
                    </select>
                  </div>
                </div>

                <div class="form-group mb-4">
                  <label class="form-label text-xs text-slate-300 font-bold">Status Inicial *</label>
                  <select class="form-control text-xs py-2.5" id="rpa-edit-status" style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;">
                    <option value="ABERTO">Em Aberto</option>
                    <option value="EM_ANALISE">Em Análise</option>
                    <option value="AGUARDANDO_PARCEIRO">Aguardando Parceiro</option>
                    <option value="RESOLVIDO">Resolvido</option>
                  </select>
                </div>

                <div class="form-group mb-4">
                  <label class="form-label text-xs text-slate-300 font-bold">Nota Inicial / Detalhes do Incidente</label>
                  <textarea class="form-control text-xs py-2.5" id="rpa-edit-note" rows="3" placeholder="Descreva o impacto ou motivo do chamado..." style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical;"></textarea>
                </div>

                <div class="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button type="button" class="btn btn-secondary text-xs px-4 py-2" onclick="RpaPendenciesModule.closeModal()">Cancelar</button>
                  <button type="submit" class="btn btn-primary text-xs px-5 py-2">
                    <i class="fa-solid fa-floppy-disk me-1.5"></i> Salvar Pendência
                  </button>
                </div>
              </form>
            </div>
          </div>
        `;
        document.body.appendChild(this.parseHTML(editModalHtml));
      }

      // Injetar Modal de Detalhes & Histórico se não existir
      if (!document.getElementById('modal-rpa-details')) {
        const detailsModalHtml = `
          <div class="modal-backdrop hidden" id="modal-rpa-details" style="z-index: 99999; backdrop-filter: blur(8px); display: none;">
            <div class="modal-content" style="max-width: 640px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 25px 60px rgba(0,0,0,0.7); border-radius: 16px; padding: 24px;">
              <div class="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                    <i class="fa-solid fa-robot"></i>
                  </div>
                  <div>
                    <h3 class="text-base font-extrabold text-white tracking-tight" id="rpa-detail-robo-title">Robô: --</h3>
                    <p class="text-xs text-slate-400">Histórico de Ocorrências e Cobranças</p>
                  </div>
                </div>
                <button type="button" class="text-slate-400 hover:text-white transition-colors" onclick="RpaPendenciesModule.closeDetailsModal()">
                  <i class="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 text-xs">
                <div>
                  <span class="text-[10px] text-slate-400 block font-bold">RESPONSÁVEL:</span>
                  <span class="font-extrabold text-white" id="rpa-detail-resp">--</span>
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 block font-bold">SEVERIDADE:</span>
                  <span class="font-extrabold" id="rpa-detail-sev">--</span>
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 block font-bold">STATUS ATUAL:</span>
                  <span id="rpa-detail-status">--</span>
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 block font-bold">CRIADO EM:</span>
                  <span class="text-slate-300 font-mono text-[11px]" id="rpa-detail-date">--</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/10 mb-4">
                <label class="text-xs font-bold text-slate-300">Alterar Status da Ocorrência:</label>
                <select id="rpa-detail-status-change" class="form-control text-xs py-1.5 px-3" style="max-width: 200px; background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;" onchange="RpaPendenciesModule.updateStatus(this.value)">
                  <option value="ABERTO">Em Aberto</option>
                  <option value="EM_ANALISE">Em Análise</option>
                  <option value="AGUARDANDO_PARCEIRO">Aguardando Parceiro</option>
                  <option value="RESOLVIDO">Resolvido</option>
                </select>
              </div>

              <div class="mb-4">
                <label class="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block mb-2">
                  <i class="fa-solid fa-comment-dots me-1.5"></i> Registrar Cobrança / Evolução
                </label>
                <div class="flex gap-2 mb-3">
                  <textarea id="rpa-detail-new-text" rows="2" placeholder="Digite uma nova atualização ou data de cobrança..." class="form-control text-xs p-2.5 flex-1" style="background: rgba(15,23,42,0.95); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; resize: vertical;"></textarea>
                  <button type="button" class="btn btn-primary text-xs px-4 py-2 self-end shrink-0" onclick="RpaPendenciesModule.addNote()">
                    <i class="fa-solid fa-paper-plane me-1"></i> Registrar
                  </button>
                </div>
              </div>

              <div>
                <label class="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                  <i class="fa-solid fa-clock-rotate-left me-1.5"></i> Histórico de Notas & Timeline
                </label>
                <div class="timeline-scroll-container max-h-[180px] overflow-y-auto p-3 rounded-xl bg-slate-950/60 border border-slate-800" id="rpa-detail-notes">
                  <!-- Gerado via JS -->
                </div>
              </div>

              <div class="flex items-center justify-end pt-4 mt-4 border-t border-white/10">
                <button type="button" class="btn btn-secondary text-xs px-4 py-2" onclick="RpaPendenciesModule.closeDetailsModal()">Fechar</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(this.parseHTML(detailsModalHtml));
      }
    },

    parseHTML(str) {
      const tmp = document.createElement('div');
      tmp.innerHTML = str.trim();
      return tmp.firstElementChild;
    },

    // 4. Hook Limpo na Navegação do App (Sem Alterar o app.js)
    setupNavigationHook() {
      const checkAndToggleTab = () => {
        const squad = (window.app?.activeSquad || '').toString().toLowerCase();
        const isRpa = squad === 'rpa';
        
        document.querySelectorAll('.rpa-only-tab-btn').forEach(btn => {
          if (isRpa) {
            btn.classList.remove('hidden');
            btn.style.setProperty('display', 'inline-flex', 'important');
          } else {
            btn.classList.add('hidden');
            btn.style.setProperty('display', 'none', 'important');
          }
        });

        if (!isRpa && window.app?.activeView === 'rpa-pendencies') {
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

      setTimeout(checkAndToggleTab, 300);
    },

    openRpaView() {
      if (window.app) {
        window.app.activeView = 'rpa-pendencies';
        document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active-view'));
        const rpaView = document.getElementById('view-rpa-pendencies');
        if (rpaView) rpaView.classList.add('active-view');

        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = 'Pendências - Squad de RPA';
        this.renderView();
      }
    },

    // 5. Renderização da Tabela de Pendências
    renderView() {
      const tbody = document.getElementById('rpa-pendencies-tbody');
      if (!tbody) return;

      const items = this.pendencies || [];
      const search = (document.getElementById('rpa-filter-search')?.value || '').toLowerCase().trim();

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
        let respBadge = `<span class="badge bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 font-bold text-[11px] rounded-lg">${item.responsible}</span>`;
        if (item.responsible === 'Caio (Interno)') {
          respBadge = `<span class="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 font-bold text-[11px] rounded-lg">Caio (Interno)</span>`;
        } else if (item.responsible === 'Ambos') {
          respBadge = `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 font-bold text-[11px] rounded-lg">Ambos</span>`;
        }

        let sevBadge = `<span class="badge bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 font-bold text-[10px]">⚡ Média</span>`;
        if (item.severity === 'CRITICA') sevBadge = `<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 font-bold text-[10px]">🚨 Crítica</span>`;
        else if (item.severity === 'ALTA') sevBadge = `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-bold text-[10px]">🔥 Alta</span>`;
        else if (item.severity === 'BAIXA') sevBadge = `<span class="badge bg-slate-500/20 text-slate-300 border border-slate-500/30 px-2 py-0.5 font-bold text-[10px]">🟢 Baixa</span>`;

        let statusBadge = `<span class="badge bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 font-extrabold text-[11px]">Em Aberto</span>`;
        if (item.status === 'EM_ANALISE') statusBadge = `<span class="badge bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 font-extrabold text-[11px]">Em Análise</span>`;
        else if (item.status === 'AGUARDANDO_PARCEIRO') statusBadge = `<span class="badge bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1 font-extrabold text-[11px]">Aguardando Parceiro</span>`;
        else if (item.status === 'RESOLVIDO') statusBadge = `<span class="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 font-extrabold text-[11px]">Resolvido</span>`;

        const notesCount = (item.history_notes || []).length;
        const lastUpdate = formatDate(item.updated_at || item.created_at);

        return `
          <tr class="hover:bg-white/5 transition-all">
            <td style="padding: 14px 16px;">
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-robot text-amber-400"></i>
                <span class="font-extrabold text-white text-xs">${item.robo_name}</span>
              </div>
            </td>
            <td style="padding: 14px 16px;">
              <span class="font-semibold text-slate-200 text-xs block">${item.title}</span>
              <span class="text-[10px] text-slate-400"><i class="fa-solid fa-clock me-1"></i>Atualizado em ${lastUpdate} · ${notesCount} nota(s)</span>
            </td>
            <td style="padding: 14px 16px;">${respBadge}</td>
            <td style="padding: 14px 16px;">${sevBadge}</td>
            <td style="padding: 14px 16px;">${statusBadge}</td>
            <td style="padding: 14px 16px; text-align: right;">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="RpaPendenciesModule.openDetailsModal('${item.id}')" class="btn btn-secondary text-[11px] py-1 px-2.5" title="Ver Detalhes e Notas de Cobrança">
                  <i class="fa-solid fa-comments text-indigo-400 me-1"></i> Notas (${notesCount})
                </button>
                <button onclick="RpaPendenciesModule.openModal('${item.id}')" class="btn btn-secondary text-[11px] py-1 px-2" title="Editar Pendência">
                  <i class="fa-solid fa-pen text-slate-300"></i>
                </button>
                <button onclick="RpaPendenciesModule.deletePendency('${item.id}')" class="btn btn-secondary text-[11px] py-1 px-2 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30" title="Excluir Pendência">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    // 6. Handlers de Abertura / Fechamento Garantidos de Modais
    openModal(id = null) {
      let modal = document.getElementById('modal-rpa-edit');
      if (!modal) {
        this.injectUI();
        modal = document.getElementById('modal-rpa-edit');
      }
      if (!modal) return;

      const titleEl = document.getElementById('rpa-modal-edit-title');
      const idEl = document.getElementById('rpa-edit-id');
      const roboEl = document.getElementById('rpa-edit-robo');
      const titleInput = document.getElementById('rpa-edit-title');
      const respEl = document.getElementById('rpa-edit-responsible');
      const sevEl = document.getElementById('rpa-edit-severity');
      const statusEl = document.getElementById('rpa-edit-status');
      const noteEl = document.getElementById('rpa-edit-note');

      if (id) {
        const item = this.pendencies.find(i => i.id === id);
        if (item) {
          if (titleEl) titleEl.textContent = 'Editar Ocorrência RPA';
          if (idEl) idEl.value = item.id;
          if (roboEl) roboEl.value = item.robo_name;
          if (titleInput) titleInput.value = item.title;
          if (respEl) respEl.value = item.responsible;
          if (sevEl) sevEl.value = item.severity;
          if (statusEl) statusEl.value = item.status;
          if (noteEl) noteEl.value = item.description || '';
        }
      } else {
        if (titleEl) titleEl.textContent = 'Cadastrar Ocorrência RPA';
        if (idEl) idEl.value = '';
        if (roboEl) roboEl.value = '';
        if (titleInput) titleInput.value = '';
        if (respEl) respEl.value = 'Redesign';
        if (sevEl) sevEl.value = 'MEDIA';
        if (statusEl) statusEl.value = 'ABERTO';
        if (noteEl) noteEl.value = '';
      }

      modal.classList.remove('hidden');
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('z-index', '99999', 'important');
    },

    closeModal() {
      const modal = document.getElementById('modal-rpa-edit');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
      }
    },

    async savePendency(e) {
      if (e && e.preventDefault) e.preventDefault();

      const id = document.getElementById('rpa-edit-id')?.value;
      const robo_name = document.getElementById('rpa-edit-robo')?.value.trim();
      const title = document.getElementById('rpa-edit-title')?.value.trim();
      const responsible = document.getElementById('rpa-edit-responsible')?.value;
      const severity = document.getElementById('rpa-edit-severity')?.value;
      const status = document.getElementById('rpa-edit-status')?.value;
      const initial_note = document.getElementById('rpa-edit-note')?.value.trim();

      if (!robo_name || !title) {
        alert('Por favor, preencha o Nome do Robô e o Título da ocorrência.');
        return;
      }

      const nowIso = new Date().toISOString();
      let target = id ? this.pendencies.find(i => i.id === id) : null;

      if (target) {
        target.robo_name = robo_name;
        target.title = title;
        target.responsible = responsible;
        target.severity = severity;
        target.status = status;
        target.description = initial_note || title;
        target.updated_at = nowIso;
        if (initial_note) {
          if (!Array.isArray(target.history_notes)) target.history_notes = [];
          target.history_notes.unshift({ date: nowIso, author: window.app?.userName || 'Usuário', text: initial_note });
        }
      } else {
        target = {
          id: 'rpa-' + Date.now(),
          robo_name,
          title,
          responsible,
          severity,
          status,
          description: initial_note || title,
          history_notes: [{ date: nowIso, author: window.app?.userName || 'Usuário', text: initial_note || title }],
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
      if (!modal) {
        this.injectUI();
        modal = document.getElementById('modal-rpa-details');
      }
      if (!modal) return;

      document.getElementById('rpa-detail-robo-title').textContent = `Robô: ${item.robo_name}`;
      document.getElementById('rpa-detail-resp').textContent = item.responsible;
      document.getElementById('rpa-detail-date').textContent = new Date(item.created_at).toLocaleDateString('pt-BR');
      document.getElementById('rpa-detail-status-change').value = item.status;

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
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('z-index', '99999', 'important');
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
        modal.style.setProperty('display', 'none', 'important');
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
})();
