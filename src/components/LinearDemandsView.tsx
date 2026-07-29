import React, { useState, useMemo } from 'react';
import { BacklogItem, SquadId } from '../types';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  PauseCircle, 
  TrendingUp,
  Sliders,
  Filter,
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';

interface LinearDemandsViewProps {
  backlogItems: BacklogItem[];
  currentSquadId: SquadId;
  onAddBacklogItem: (item: Omit<BacklogItem, 'id'>) => void;
  onEditBacklogItem: (item: BacklogItem) => void;
  onDeleteBacklogItem: (id: string) => void;
}

export default function LinearDemandsView({
  backlogItems,
  currentSquadId,
  onAddBacklogItem,
  onEditBacklogItem,
  onDeleteBacklogItem
}: LinearDemandsViewProps) {
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

  // Form State (6 campos na ordem exata solicitada)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requesterArea: '',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Em Andamento' as BacklogItem['status'],
    progress: 0
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Get unique requester areas for filtering
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    backlogItems.forEach(item => {
      const a = item.requesterArea || item.requester;
      if (a) areas.add(a);
    });
    return Array.from(areas);
  }, [backlogItems]);

  // Filtered Demands
  const filteredDemands = useMemo(() => {
    return backlogItems.filter(item => {
      const matchSearch = 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.requesterArea || item.requester || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      const itemArea = item.requesterArea || item.requester || '';
      const matchArea = areaFilter === 'all' || itemArea === areaFilter;

      return matchSearch && matchStatus && matchArea;
    });
  }, [backlogItems, searchTerm, statusFilter, areaFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = backlogItems.length;
    const inProgress = backlogItems.filter(i => i.status === 'Em Andamento').length;
    const pending = backlogItems.filter(i => i.status === 'Pendente').length;
    const paused = backlogItems.filter(i => i.status === 'Pausado').length;
    const blocked = backlogItems.filter(i => i.status === 'Impedido').length;
    const completed = backlogItems.filter(i => i.status === 'Concluído').length;

    const totalProgressSum = backlogItems.reduce((acc, curr) => acc + (curr.progress || 0), 0);
    const avgProgress = total > 0 ? Math.round(totalProgressSum / total) : 0;

    return { total, inProgress, pending, paused, blocked, completed, avgProgress };
  }, [backlogItems]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      description: '',
      requesterArea: currentSquadId === 'rpa' ? 'Financeiro & TI' : 'Operações & Atendimento',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Em Andamento',
      progress: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: BacklogItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.notes || '',
      requesterArea: item.requesterArea || item.requester || '',
      dueDate: item.dueDate || item.date || new Date().toISOString().split('T')[0],
      status: item.status || 'Em Andamento',
      progress: typeof item.progress === 'number' ? item.progress : 0
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const areaClean = formData.requesterArea.trim() || 'Área Demandante';

    if (editingItem) {
      onEditBacklogItem({
        ...editingItem,
        title: formData.title.trim(),
        notes: formData.description.trim(),
        requesterArea: areaClean,
        requester: areaClean,
        date: formData.dueDate,
        dueDate: formData.dueDate,
        status: formData.status,
        progress: formData.progress
      });
      showToast('Demanda atualizada com sucesso!');
    } else {
      const codeNum = Math.floor(100 + Math.random() * 900);
      onAddBacklogItem({
        gau: `DEM-${codeNum}`,
        title: formData.title.trim(),
        notes: formData.description.trim(),
        requesterArea: areaClean,
        requester: areaClean,
        team: currentSquadId === 'rpa' ? 'Squad RPA' : 'Squad Operações',
        date: formData.dueDate,
        dueDate: formData.dueDate,
        priority: '3 - Média',
        category: currentSquadId === 'rpa' ? 'Automação' : 'Processos',
        treatmentOrder: backlogItems.length + 1,
        status: formData.status,
        progress: formData.progress
      });
      showToast('Nova demanda cadastrada!');
    }
    setIsModalOpen(false);
  };

  // Inline Handlers for quick edits
  const handleInlineStatusChange = (item: BacklogItem, newStatus: BacklogItem['status']) => {
    onEditBacklogItem({
      ...item,
      status: newStatus,
      progress: newStatus === 'Concluído' ? 100 : item.progress
    });
    showToast(`Status alterado para ${newStatus}`);
  };

  const handleInlineProgressChange = (item: BacklogItem, newProgress: number) => {
    const updatedStatus = newProgress === 100 ? 'Concluído' : (item.status === 'Concluído' ? 'Em Andamento' : item.status);
    onEditBacklogItem({
      ...item,
      progress: newProgress,
      status: updatedStatus
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Demandas</span>
            <Layers size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">{stats.total}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Em Andamento</span>
            <Clock size={14} className="text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-700">{stats.inProgress}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pendentes</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Impedidos/Pausados</span>
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stats.blocked + stats.paused}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Concluídas</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
        </div>

        <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-300 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Evolução Média</span>
            <TrendingUp size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.avgProgress}%</div>
        </div>
      </div>

      {/* Control & Search Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, descrição ou área demandante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todos os Status</option>
                <option value="Pendente">⏳ Pendente</option>
                <option value="Em Andamento">⚡ Em Andamento</option>
                <option value="Pausado">⏸️ Pausado</option>
                <option value="Impedido">🚨 Impedido</option>
                <option value="Concluído">✅ Concluído</option>
              </select>
            </div>

            {/* Area Filter */}
            {availableAreas.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Área:</span>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Áreas</option>
                  {availableAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Add Demand Button */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} />
              <span>Nova Demanda</span>
            </button>
          </div>

        </div>
      </div>

      {/* LINEAR DEMANDS VIEW (ESTRUTURA EM LINHAS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Title Banner */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Lista de Demandas — {currentSquadId === 'rpa' ? 'Squad de RPA & Automações' : 'Squad de Operações'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Acompanhamento estruturado por demanda: Título, Descrição, Área Demandante, Prazo, Status e % de Evolução.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg">
            {filteredDemands.length} {filteredDemands.length === 1 ? 'demanda' : 'demandas'}
          </span>
        </div>

        {filteredDemands.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Layers size={40} className="mx-auto text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-700 text-sm">Nenhuma demanda encontrada</h4>
            <p className="text-xs text-slate-500 mt-1">
              Tente ajustar os filtros ou clique em "Nova Demanda" para cadastrar uma nova solicitação.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all"
            >
              + Cadastrar Primeira Demanda
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-150">
            
            {/* Table Column Headers (Desk/Tablet) */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
              <div className="lg:col-span-3">1. Título & Código</div>
              <div className="lg:col-span-3">2. Descrição (Objetivo / Fluxo)</div>
              <div className="lg:col-span-2">3. Área Demandante</div>
              <div className="lg:col-span-1">4. Prazo</div>
              <div className="lg:col-span-1">5. Status</div>
              <div className="lg:col-span-2">6. % Evolução & Ações</div>
            </div>

            {/* Demand Rows */}
            {filteredDemands.map((item) => (
              <div 
                key={item.id} 
                className="p-4 lg:px-6 lg:py-4 hover:bg-slate-50/80 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                {/* 1. TÍTULO DA DEMANDA */}
                <div className="lg:col-span-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded shadow-xs shrink-0">
                      {item.gau || `DEM-${item.id.slice(0, 4)}`}
                    </span>
                    <h4 className="font-bold text-xs text-slate-800 leading-snug">
                      {item.title}
                    </h4>
                  </div>
                </div>

                {/* 2. DESCRIÇÃO (Objetivo, fluxo ou contexto) */}
                <div className="lg:col-span-3 text-xs text-slate-600">
                  <p className="line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                    {item.notes || 'Sem descrição detalhada.'}
                  </p>
                </div>

                {/* 3. ÁREA DEMANDANTE */}
                <div className="lg:col-span-2">
                  <span className="text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                    <Building2 size={12} className="text-blue-600" />
                    {item.requesterArea || item.requester || 'Não informada'}
                  </span>
                </div>

                {/* 4. PRAZO (Data Alvo) */}
                <div className="lg:col-span-1 text-xs text-slate-700 font-semibold flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400 shrink-0" />
                  <span>{(item.dueDate || item.date || '').split('-').reverse().join('/')}</span>
                </div>

                {/* 5. STATUS */}
                <div className="lg:col-span-1">
                  <select
                    value={item.status || 'Em Andamento'}
                    onChange={(e) => handleInlineStatusChange(item, e.target.value as BacklogItem['status'])}
                    className={`text-[11px] font-extrabold rounded-lg px-2 py-1.5 border transition-all cursor-pointer w-full ${
                      item.status === 'Concluído'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : item.status === 'Em Andamento'
                          ? 'bg-sky-100 text-sky-800 border-sky-300'
                          : item.status === 'Impedido'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : item.status === 'Pausado'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    <option value="Pendente">⏳ Pendente</option>
                    <option value="Em Andamento">⚡ Em Andamento</option>
                    <option value="Pausado">⏸️ Pausado</option>
                    <option value="Impedido">🚨 Impedido</option>
                    <option value="Concluído">✅ Concluído</option>
                  </select>
                </div>

                {/* 6. % DE EVOLUÇÃO (Barra visual interativa) & AÇÕES */}
                <div className="lg:col-span-2 flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-500">Progresso</span>
                      <span className="text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                        {item.progress || 0}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={item.progress || 0}
                        onChange={(e) => handleInlineProgressChange(item, parseInt(e.target.value, 10) || 0)}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        title="Arraste para alterar o % de evolução"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Editar detalhes da demanda"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() => onDeleteBacklogItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir demanda"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

              </div>
            ))}

          </div>
        )}

      </div>

      {/* MODAL CADASTRAR / EDITAR DEMANDA (Ordem exata: Título, Descrição, Área Demandante, Prazo, Status, % Evolução) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {editingItem ? 'Editar Demanda' : 'Cadastrar Nova Demanda'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              
              {/* 1. TÍTULO DA DEMANDA */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  1. Título da Demanda *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  placeholder="Ex: Bot de Download Automático de Extratos ou Mapeamento de Chargeback"
                />
              </div>

              {/* 2. DESCRIÇÃO */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  2. Descrição (Objetivo, fluxo ou contexto do problema) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  placeholder="Descreva o objetivo da demanda, fluxo operacional ou problema a ser resolvido..."
                />
              </div>

              {/* 3. ÁREA DEMANDANTE & 4. PRAZO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    3. Área Demandante *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.requesterArea}
                    onChange={(e) => setFormData({ ...formData, requesterArea: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    placeholder="Ex: Financeiro, Atendimento, Compliance, Suporte"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    4. Prazo (Data Alvo para entrega) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* 5. STATUS & 6. % DE EVOLUÇÃO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    5. Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as BacklogItem['status'] })}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  >
                    <option value="Pendente">⏳ Pendente</option>
                    <option value="Em Andamento">⚡ Em Andamento</option>
                    <option value="Pausado">⏸️ Pausado</option>
                    <option value="Impedido">🚨 Impedido</option>
                    <option value="Concluído">✅ Concluído</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      6. % de Evolução *
                    </label>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                      {formData.progress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={formData.progress}
                      onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value, 10) || 0 })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.progress}
                      onChange={(e) => setFormData({ ...formData, progress: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      className="w-16 text-center text-xs font-extrabold bg-slate-50 border border-slate-200 rounded-xl p-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-all"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Demanda'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
