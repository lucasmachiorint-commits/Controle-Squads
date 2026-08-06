/* ==========================================================================
   Controle de Squads - Módulo Isolado de Pendências RPA (rpa-pendencies.js)
   Design System Harmonizado Impeccable (v1.5.0)
   100% Autônomo, Resiliente com Fallback REST Supabase + LocalStorage
   ========================================================================== */

(function () {
  'use strict';

  const RpaPendenciesModule = {
    pendencies: [],
    activeId: null,
    selectedRobots: [],
    selectedResponsibles: [],

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

    // Injeção Dinâmica da UI (View Limpa + Subnav + Modais)
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

      // Injetar View Limpa da Tabela de Pendências
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
                      <th style="width: 26%;">ROBÔ(S) AFETADO(S)</th>
                      <th style="min-width: 200px;">DESCRIÇÃO / OCORRÊNCIA</th>
                      <th style="width: 16%;">RESPONSÁVEL(IS)</th>
                      <th style="width: 11%;">SEVERIDADE</th>
                      <th style="width: 12%;">STATUS</th>
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

        const mainWrapper = document.querySelector('.main-wrapper') || document.querySelector('main');
        const gestaoView = document.getElementById('view-gestao-acessos') || document.getElementById('view-dashboard');
        if (gestaoView && gestaoView.parentNode) {
          gestaoView.parentNode.insertBefore(this.parseHTML(viewHtml), gestaoView);
        } else if (mainWrapper) {
          mainWrapper.appendChild(this.parseHTML(viewHtml));
        } else {
          document.body.appendChild(this.parseHTML(viewHtml));
        }
      }

      // Injetar Modal Completo com Tags + Selects Adicionadores HARMONIZADOS (Design System Glass Panel)
      const oldModal = document.getElementById('modal-rpa-edit');
      if (oldModal) oldModal.remove();

      const editModalHtml = `
          <div class="modal-backdrop hidden" id="modal-rpa-edit" style="display: none;">
            <div class="glass-panel modal-content" style="max-width: 560px;">
              
              <!-- Modal Header Padronizado -->
              <div class="modal-header">
                <h3 class="modal-title">⚠️ <span id="rpa-modal-edit-title">Cadastrar Ocorrência RPA</span></h3>
                <button type="button" class="btn btn-secondary" onclick="RpaPendenciesModule.closeModal()" title="Fechar" aria-label="Fechar modal">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p class="text-xs text-slate-400 mb-4" style="margin-top: -12px;">Controle de Incidentes e Cobrança em Produção</p>

              <form onsubmit="RpaPendenciesModule.savePendency(event)">
                <input type="hidden" id="rpa-edit-id" />

                <!-- 1. ROBÔ(S) AFETADO(S) -->
                <div class="form-group mb-4">
                  <label class="form-label" style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">Robô(s) Afetado(s) <span class="required-asterisk" style="color: #f43f5e;">*</span></label>
                  <div class="w-full bg-[#111827] rounded-2xl p-2.5 transition-all flex flex-wrap items-center gap-2 min-h-[48px]" style="border: 1.5px solid #059669; box-shadow: 0 0 14px rgba(5, 150, 105, 0.35);">
                    <div id="rpa-robot-pills-container" style="display: contents;"></div>
                    <select id="rpa-robot-adder-select" 
                            style="background: transparent; border: none; outline: none; color: #94a3b8; font-size: 12px; font-family: inherit; cursor: pointer; flex: 1; min-width: 150px; height: 26px; padding: 0; appearance: none; -webkit-appearance: none;"
                            onchange="RpaPendenciesModule.addRobot(this.value); this.value = '';">
                      <option value="" disabled selected class="bg-[#111827] text-gray-400">+ Selecionar Robô...</option>
                      <optgroup label="PAGAMENTOS NÃO BAIXADOS" class="bg-[#111827] text-gray-400 font-bold">
                        <option value="ID05 - Baixa Manual Lote" class="bg-[#111827] text-gray-200">ID05 - Baixa Manual Lote</option>
                        <option value="ID06 - Demandas de BKO" class="bg-[#111827] text-gray-200">ID06 - Demandas de BKO</option>
                        <option value="ID08 - Arquivo Reembolso" class="bg-[#111827] text-gray-200">ID08 - Arquivo Reembolso</option>
                        <option value="ID09 - Importação Reembolso Zord" class="bg-[#111827] text-gray-200">ID09 - Importação Reembolso Zord</option>
                        <option value="ID10 - Status Reembolso Zord" class="bg-[#111827] text-gray-200">ID10 - Status Reembolso Zord</option>
                        <option value="ID11 - Triagem Sucesso Zord" class="bg-[#111827] text-gray-200">ID11 - Triagem Sucesso Zord</option>
                        <option value="ID13 - Atualização Jira" class="bg-[#111827] text-gray-200">ID13 - Atualização Jira</option>
                        <option value="ID29 - Pendência Tesouraria" class="bg-[#111827] text-gray-200">ID29 - Pendência Tesouraria</option>
                      </optgroup>
                      <optgroup label="CANCELAMENTO DYNAMICS" class="bg-[#111827] text-gray-400 font-bold">
                        <option value="ID12 - Rejeitados Jira" class="bg-[#111827] text-gray-200">ID12 - Rejeitados Jira</option>
                        <option value="ID14 - Extração Tarefas Dynamics" class="bg-[#111827] text-gray-200">ID14 - Extração Tarefas Dynamics</option>
                        <option value="ID15 - Pendência Recompra" class="bg-[#111827] text-gray-200">ID15 - Pendência Recompra</option>
                        <option value="ID16 - Cancelamento Jira" class="bg-[#111827] text-gray-200">ID16 - Cancelamento Jira</option>
                        <option value="ID18 - Cancelamento Dynamics" class="bg-[#111827] text-gray-200">ID18 - Cancelamento Dynamics</option>
                        <option value="ID19 - Cancelamento SAP" class="bg-[#111827] text-gray-200">ID19 - Cancelamento SAP</option>
                        <option value="ID20 - Cancelamento CAPTA" class="bg-[#111827] text-gray-200">ID20 - Cancelamento CAPTA</option>
                      </optgroup>
                      <optgroup label="AMORTIZAÇÃO NOTAS DE CRÉDITO" class="bg-[#111827] text-gray-400 font-bold">
                        <option value="ID26 - Amortização Dispatcher" class="bg-[#111827] text-gray-200">ID26 - Amortização Dispatcher</option>
                        <option value="ID27 - Amortização Performer 1" class="bg-[#111827] text-gray-200">ID27 - Amortização Performer 1</option>
                        <option value="ID28 - Amortização Performer 2" class="bg-[#111827] text-gray-200">ID28 - Amortização Performer 2</option>
                        <option value="IDXX - Amortização Reembolso" class="bg-[#111827] text-gray-200">IDXX - Amortização Reembolso</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                <!-- TÍTULO -->
                <div class="form-group mb-4">
                  <label class="form-label">Título / Resumo do Problema <span class="required-asterisk">*</span></label>
                  <input type="text" class="form-control" id="rpa-edit-title" placeholder="Ex: Timeout na API bancária durante execução" required />
                </div>

                <!-- 2. RESPONSÁVEL & SEVERIDADE -->
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="form-label" style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block;">Responsável <span class="required-asterisk" style="color: #f43f5e;">*</span></label>
                    <div class="w-full bg-[#111827] rounded-2xl p-2.5 transition-all flex flex-wrap items-center gap-2 min-h-[48px]" style="border: 1.5px solid #6366f1; box-shadow: 0 0 14px rgba(99, 102, 241, 0.35);">
                      <div id="rpa-resp-pills-container" style="display: contents;"></div>
                      <select id="rpa-resp-adder-select" 
                              style="background: transparent; border: none; outline: none; color: #94a3b8; font-size: 12px; font-family: inherit; cursor: pointer; flex: 1; min-width: 120px; height: 26px; padding: 0; appearance: none; -webkit-appearance: none;"
                              onchange="RpaPendenciesModule.addResponsible(this.value); this.value = '';">
                        <option value="" disabled selected class="bg-[#111827] text-gray-400">+ Selecionar Responsável...</option>
                        <option value="Redesign (Parceiro)" class="bg-[#111827] text-gray-200">Redesign (Parceiro)</option>
                        <option value="Caio (Interno)" class="bg-[#111827] text-gray-200">Caio (Interno)</option>
                        <option value="Time Skytel" class="bg-[#111827] text-gray-200">Time Skytel</option>
                        <option value="Ambos / Squad RPA" class="bg-[#111827] text-gray-200">Ambos / Squad RPA</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label class="form-label">Severidade <span class="required-asterisk">*</span></label>
                    <select class="form-control" id="rpa-edit-severity">
                      <option value="MEDIA">⚡ Média</option>
                      <option value="BAIXA">🟢 Baixa</option>
                      <option value="ALTA">🔥 Alta</option>
                      <option value="CRITICA">🚨 Crítica</option>
                    </select>
                  </div>
                </div>

                <!-- STATUS INICIAL -->
                <div class="form-group mb-4">
                  <label class="form-label">Status Inicial <span class="required-asterisk">*</span></label>
                  <select class="form-control" id="rpa-edit-status">
                    <option value="ABERTO">Em Aberto</option>
                    <option value="EM_ANALISE">Em Análise</option>
                    <option value="AGUARDANDO_PARCEIRO">Aguardando Parceiro</option>
                    <option value="RESOLVIDO">Resolvido</option>
                  </select>
                </div>

                <!-- NOTA INICIAL -->
                <div class="form-group mb-6">
                  <label class="form-label">Nota Inicial / Detalhes do Incidente</label>
                  <textarea class="form-control" id="rpa-edit-note" rows="3" placeholder="Descreva o impacto ou motivo do chamado..." style="resize: vertical;"></textarea>
                </div>

                <!-- RODAPÉ DE AÇÕES -->
                <div class="flex justify-end gap-3 mt-6">
                  <button type="button" class="btn btn-secondary" onclick="RpaPendenciesModule.closeModal()">Cancelar</button>
                  <button type="submit" class="btn btn-primary">
                    <i class="fa-solid fa-floppy-disk me-1.5"></i> Salvar Pendência
                  </button>
                </div>
              </form>
            </div>
          </div>
        `;
      document.body.appendChild(this.parseHTML(editModalHtml));

      // Injetar Modal de Detalhes & Histórico
      const oldDetailsModal = document.getElementById('modal-rpa-details');
      if (oldDetailsModal) oldDetailsModal.remove();
        const detailsModalHtml = `
          <div class="modal-backdrop hidden" id="modal-rpa-details" style="display: none;">
            <div class="glass-panel modal-content" style="max-width: 640px;">
              <div class="modal-header">
                <h3 class="modal-title" id="rpa-detail-robo-title">Robô: --</h3>
                <button type="button" class="btn btn-secondary" onclick="RpaPendenciesModule.closeDetailsModal()" title="Fechar" aria-label="Fechar modal">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p class="text-xs text-slate-400 mb-4" style="margin-top: -12px;">Histórico de Ocorrências e Cobranças</p>

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
                <select id="rpa-detail-status-change" class="form-control" style="max-width: 200px;" onchange="RpaPendenciesModule.updateStatus(this.value)">
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
                  <textarea id="rpa-detail-new-text" rows="2" placeholder="Digite uma nova atualização ou data de cobrança..." class="form-control flex-1" style="resize: vertical;"></textarea>
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
                <button type="button" class="btn btn-secondary" onclick="RpaPendenciesModule.closeDetailsModal()">Fechar</button>
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
          <span style="background: rgba(6, 78, 59, 0.6); border: 1px solid rgba(16, 185, 129, 0.6); color: #34d399; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">
            ${robot}
            <button type="button" onclick="RpaPendenciesModule.removeRobot('${safeName}')" style="background: none; border: none; color: #34d399; opacity: 0.85; cursor: pointer; padding: 0; margin-left: 2px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center;" title="Remover">
              ✕
            </button>
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
          <span style="background: rgba(49, 46, 129, 0.6); border: 1px solid rgba(99, 102, 241, 0.6); color: #818cf8; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">
            ${rName}
            <button type="button" onclick="RpaPendenciesModule.removeResponsible('${safeName}')" style="background: none; border: none; color: #818cf8; opacity: 0.85; cursor: pointer; padding: 0; margin-left: 2px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center;" title="Remover">
              ✕
            </button>
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

    // 5. Hook Limpo na Navegação do App
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

    // 6. Renderização da Tabela de Pendências
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

        const notesCount = (item.history_notes || []).length;
        const lastUpdate = formatDate(item.updated_at || item.created_at);

        return `
          <tr class="hover:bg-white/5 transition-all">
            <td style="padding: 14px 16px;">
              <div class="flex flex-wrap items-center">
                ${robotBadges || `<span class="text-slate-400 text-xs">${item.robo_name}</span>`}
              </div>
            </td>
            <td style="padding: 14px 16px;">
              <span class="font-semibold text-slate-200 text-xs block">${item.title}</span>
              <span class="text-[10px] text-slate-400"><i class="fa-solid fa-clock me-1"></i>Atualizado em ${lastUpdate} · ${notesCount} nota(s)</span>
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

    // 7. Handlers de Modais e Formulários
    openModal(id = null) {
      let modal = document.getElementById('modal-rpa-edit');
      if (!modal) {
        this.injectUI();
        modal = document.getElementById('modal-rpa-edit');
      }
      if (!modal) return;

      const titleEl = document.getElementById('rpa-modal-edit-title');
      const idEl = document.getElementById('rpa-edit-id');
      const titleInput = document.getElementById('rpa-edit-title');
      const sevEl = document.getElementById('rpa-edit-severity');
      const statusEl = document.getElementById('rpa-edit-status');
      const noteEl = document.getElementById('rpa-edit-note');

      if (id) {
        const item = this.pendencies.find(i => i.id === id);
        if (item) {
          if (titleEl) titleEl.textContent = 'Editar Ocorrência RPA';
          if (idEl) idEl.value = item.id;
          this.selectedRobots = item.robo_name ? item.robo_name.split(',').map(s => s.trim()).filter(Boolean) : [];
          this.selectedResponsibles = item.responsible ? item.responsible.split(/;|;/).map(s => s.trim()).filter(Boolean) : ['Redesign (Parceiro)'];
          if (titleInput) titleInput.value = item.title;
          if (sevEl) sevEl.value = item.severity;
          if (statusEl) statusEl.value = item.status;
          if (noteEl) noteEl.value = item.description || '';
        }
      } else {
        if (titleEl) titleEl.textContent = 'Cadastrar Ocorrência RPA';
        if (idEl) idEl.value = '';
        this.selectedRobots = [];
        this.selectedResponsibles = ['Redesign (Parceiro)'];
        if (titleInput) titleInput.value = '';
        if (sevEl) sevEl.value = 'MEDIA';
        if (statusEl) statusEl.value = 'ABERTO';
        if (noteEl) noteEl.value = '';
      }

      this.renderRobotPills();
      this.renderRespPills();

      modal.classList.remove('hidden');
      modal.classList.add('open', 'active');
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('z-index', '99999', 'important');
    },

    closeModal() {
      const modal = document.getElementById('modal-rpa-edit');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open', 'active');
        modal.style.setProperty('display', 'none', 'important');
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
      const initial_note = document.getElementById('rpa-edit-note')?.value.trim();

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

      document.getElementById('rpa-detail-robo-title').textContent = `Robô(s): ${item.robo_name}`;
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
      modal.classList.add('open', 'active');
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
        modal.classList.remove('open', 'active');
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
