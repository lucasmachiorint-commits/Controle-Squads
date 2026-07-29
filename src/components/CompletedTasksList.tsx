import React, { useState } from 'react';
import { CompletedTask } from '../types';
import { 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Calendar, 
  Search, 
  TrendingUp, 
  Award, 
  FolderSync,
  Lightbulb,
  FileText
} from 'lucide-react';

interface CompletedTasksListProps {
  completedTasks: CompletedTask[];
  onUpdateTask: (taskId: string, title: string, gains: string) => void;
  onDeleteCompletedTask: (taskId: string) => void;
}

export default function CompletedTasksList({ 
  completedTasks, 
  onUpdateTask, 
  onDeleteCompletedTask 
}: CompletedTasksListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<'all' | 'Operações' | 'Geral'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [requesterAreaFilter, setRequesterAreaFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempGains, setTempGains] = useState('');

  // Get list of unique completedBy values for filtering
  const uniqueResponsibles = Array.from(
    new Set(completedTasks.map(t => t.completedBy).filter(Boolean))
  ).sort();

  // Get list of unique requesterArea values for filtering
  const uniqueRequesterAreas = Array.from(
    new Set(completedTasks.map(t => t.requesterArea).filter(Boolean))
  ).sort() as string[];

  // Helper to determine if a completion date matches the selected range
  const matchesDate = (completionDateStr: string) => {
    if (dateFilter === 'custom') {
      if (!completionDateStr) return false;
      const compTime = new Date(completionDateStr + 'T00:00:00').getTime();
      
      if (startDate) {
        const startTime = new Date(startDate + 'T00:00:00').getTime();
        if (compTime < startTime) return false;
      }
      
      if (endDate) {
        const endTime = new Date(endDate + 'T00:00:00').getTime();
        if (compTime > endTime) return false;
      }
      
      return true;
    }

    if (dateFilter === 'all') return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = completionDateStr.split('-').map(Number);
    const compDate = new Date(year, month - 1, day);
    compDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - compDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (dateFilter === 'today') {
      return diffDays === 0;
    }
    if (dateFilter === 'week') {
      return diffDays >= 0 && diffDays < 7;
    }
    if (dateFilter === 'month') {
      return diffDays >= 0 && diffDays < 30;
    }
    return true;
  };

  // Start editing task details (both title and gains)
  const startEditing = (task: CompletedTask) => {
    setEditingId(task.id);
    setTempTitle(task.taskTitle);
    setTempGains(task.gains);
  };

  // Save edited title and gains
  const handleSave = (taskId: string) => {
    if (!tempTitle.trim()) {
      alert('O nome da atividade não pode ficar em branco.');
      return;
    }
    onUpdateTask(taskId, tempTitle.trim(), tempGains);
    setEditingId(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
  };

  // Filter completed tasks
  const filteredTasks = completedTasks.filter(task => {
    const matchesSearch = task.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          task.completedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.taskDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.gains.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (task.requesterArea && task.requesterArea.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesArea = areaFilter === 'all' || task.area === areaFilter;
    const matchesResp = responsibleFilter === 'all' || task.completedBy === responsibleFilter;
    const matchesDateFilter = matchesDate(task.completionDate);
    const matchesReqArea = requesterAreaFilter === 'all' || 
                           (requesterAreaFilter === 'none' && !task.requesterArea) ||
                           (task.requesterArea === requesterAreaFilter);
    
    return matchesSearch && matchesArea && matchesResp && matchesDateFilter && matchesReqArea;
  });

  // Calculate statistics
  const totalCompleted = completedTasks.length;
  const opsCount = completedTasks.filter(t => t.area === 'Operações').length;
  const gerCount = completedTasks.filter(t => t.area === 'Geral').length;

  return (
    <div className="space-y-6" id="completed-tasks-container">
      {/* 1. TOP METRICS & STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="completed-stats">
        
        {/* Total Metric */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emanapay-green/10 border border-emanapay-green/20 flex items-center justify-center text-emanapay-green">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Concluído</span>
            <span className="text-2xl font-black text-slate-800" id="stat-completed-total">{totalCompleted}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Atividades entregues</span>
          </div>
        </div>

        {/* Ops Metric */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emanapay-green/10 border border-emanapay-green/20 flex items-center justify-center text-emanapay-green">
            <FolderSync size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Operações</span>
            <span className="text-2xl font-black text-slate-800" id="stat-completed-ops">{opsCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pipelines, dbt e dados</span>
          </div>
        </div>

        {/* Geral Metric */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Demandas Gerais</span>
            <span className="text-2xl font-black text-slate-800" id="stat-completed-geral">{gerCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Demandas transversais</span>
          </div>
        </div>

        {/* Achievements Metric */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Award size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Métricas / Geral</span>
            <span className="text-2xl font-black text-slate-800" id="stat-completed-geral">{gerCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Outras áreas auxiliadas</span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4" id="completed-filters">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search bar */}
          <div className="relative w-full lg:flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome da atividade, responsável, ganho obtido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-emanapay-green focus:bg-white rounded-xl py-3 pl-10 pr-4 transition-all focus:ring-1 focus:ring-emanapay-green"
            />
          </div>
          
          {/* Active filters summary */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {(areaFilter !== 'all' || dateFilter !== 'all' || responsibleFilter !== 'all' || requesterAreaFilter !== 'all' || startDate !== '' || endDate !== '' || searchTerm !== '') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setAreaFilter('all');
                  setDateFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setResponsibleFilter('all');
                  setRequesterAreaFilter('all');
                }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg transition-all"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Filter select elements grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          
          {/* Area filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Área:</label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value as any)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white"
            >
              <option value="all">Todas Áreas 🧩</option>
              <option value="Operações">Operações ⚙️</option>
              <option value="Geral">Geral 🧩</option>
            </select>
          </div>

          {/* Date of completion filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Conclusão:</label>
            <select
              value={dateFilter}
              onChange={(e) => {
                const val = e.target.value as any;
                setDateFilter(val);
                if (val !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white"
            >
              <option value="all">Qualquer Período 📅</option>
              <option value="today">Hoje ☀️</option>
              <option value="week">Esta Semana (Últimos 7 dias) 🗓️</option>
              <option value="month">Este Mês (Últimos 30 dias) 🌙</option>
              <option value="custom">Período Personalizado 🗓️</option>
            </select>
          </div>

          {/* Responsible filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável:</label>
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white"
            >
              <option value="all">Todos Integrantes 👥</option>
              {uniqueResponsibles.map(resp => (
                <option key={resp} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

          {/* Requester Area filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Área Demandante:</label>
            <select
              value={requesterAreaFilter}
              onChange={(e) => setRequesterAreaFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white"
            >
              <option value="all">Todas Demandantes 👥</option>
              <option value="none">Sem Área Demandante ❓</option>
              {uniqueRequesterAreas.map(reqArea => (
                <option key={reqArea} value={reqArea}>{reqArea}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Dynamic Custom Date Picker Fields */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 animate-scale-up">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">De (Data de Conclusão):</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Até (Data de Conclusão):</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. COMPLETED LIST */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 shadow-sm" id="completed-empty">
          <CheckCircle2 size={48} className="mx-auto text-slate-200 mb-3" />
          <h4 className="font-bold text-slate-700 text-base">Nenhuma atividade concluída encontrada</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Quando você atualizar o status de uma demanda ativa para "Concluído", ela será movida automaticamente para esta tela, onde você poderá detalhar os ganhos e resultados gerados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6" id="completed-tasks-grid">
          {filteredTasks.map((task) => (
            <div 
              key={task.id}
              className="bg-white rounded-2xl border border-slate-150 shadow-sm hover:border-slate-200 transition-all overflow-hidden flex flex-col md:flex-row"
              id={`completed-task-card-${task.id}`}
            >
              
              {/* Left Bar Indicator & Responsibility */}
              <div className="p-6 md:w-64 bg-slate-50 border-r border-slate-100 flex flex-col justify-between shrink-0 gap-4">
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      task.area === 'Operações' 
                        ? 'bg-emanapay-green/10 text-emanapay-green border-emanapay-green/20' 
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {task.area}
                    </span>

                    {task.requesterArea && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700" title={`Área Demandante: ${task.requesterArea}`}>
                        Req: {task.requesterArea}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emanapay-green text-white font-bold text-xs flex items-center justify-center">
                      {task.completedBy.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{task.completedBy}</p>
                      <span className="text-[10px] text-slate-400 font-medium">Responsável</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400 shrink-0" />
                    <span>Prazo: {task.dueDate.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emanapay-green font-medium">
                    <CheckCircle2 size={12} className="text-emanapay-green shrink-0" />
                    <span>Conclusão: {task.completionDate.split('-').reverse().join('/')}</span>
                  </div>
                </div>
              </div>

              {/* Main Information */}
              <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                
                {/* Header Title and Description */}
                <div>
                  <div className="flex items-start justify-between gap-4">
                    
                    {editingId === task.id ? (
                      <div className="flex-1 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                          <FileText size={11} className="text-slate-500" />
                          Nome da Atividade (Editável):
                        </label>
                        <input
                          type="text"
                          value={tempTitle}
                          onChange={(e) => setTempTitle(e.target.value)}
                          className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-250 focus:border-emanapay-green rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emanapay-green"
                          placeholder="Digite o nome da atividade..."
                        />
                      </div>
                    ) : (
                      <h3 className="font-bold text-slate-900 text-base leading-tight flex-1">
                        {task.taskTitle}
                      </h3>
                    )}
                    
                    {/* Actions and Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === task.id ? (
                        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => handleSave(task.id)}
                            className="bg-emanapay-green hover:bg-emanapay-dark text-white p-1 rounded transition-colors flex items-center justify-center"
                            title="Salvar Alterações"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded transition-colors flex items-center justify-center"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(task)}
                          className="p-1.5 text-slate-400 hover:text-emanapay-green hover:bg-emanapay-green/5 rounded-lg transition-colors"
                          title="Editar atividade e ganhos"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          if (confirm(`Remover "${task.taskTitle}" do histórico de concluídos?`)) {
                            onDeleteCompletedTask(task.id);
                          }
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover histórico"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                  </div>
                  
                  <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                    {task.taskDescription || 'Sem descrição fornecida.'}
                  </p>
                </div>

                {/* Editable Gains Section */}
                <div className="pt-4 border-t border-slate-100 bg-slate-50/40 p-4 rounded-xl border border-dashed border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emanapay-green uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-emanapay-orange" />
                      Ganhos & Resultados (Editável):
                    </span>

                    {editingId !== task.id && (
                      <button
                        onClick={() => startEditing(task)}
                        className="text-xs text-emanapay-green hover:text-emanapay-dark font-semibold flex items-center gap-1 hover:underline"
                        title="Editar Ganhos"
                      >
                        <Edit2 size={12} />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {editingId === task.id ? (
                    <textarea
                      value={tempGains}
                      onChange={(e) => setTempGains(e.target.value)}
                      placeholder="Descreva os ganhos reais gerados (ex: tempo reduzido, automação criada, custos evitados...)"
                      className="w-full text-xs p-3.5 bg-white border border-slate-200 focus:border-emanapay-green rounded-lg min-h-[5.5rem] focus:outline-none focus:ring-1 focus:ring-emanapay-green"
                    />
                  ) : (
                    <div 
                      onClick={() => startEditing(task)}
                      className="text-xs text-slate-600 leading-relaxed cursor-pointer hover:bg-white/60 p-2.5 rounded-lg transition-colors italic min-h-[2.5rem] flex items-center"
                    >
                      {task.gains ? (
                        <span>"{task.gains}"</span>
                      ) : (
                        <span className="text-slate-400">Nenhum ganho registrado ainda. Clique aqui ou no botão Editar acima para descrever o impacto desta entrega!</span>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
