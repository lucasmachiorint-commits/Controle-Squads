import React, { useState, useMemo } from 'react';
import { Resource, CompletedTask, BacklogItem, SquadId, Task } from '../types';
import { SQUADS_CONFIG } from '../defaultData';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  Users, 
  Search, 
  Calendar, 
  Filter, 
  Database, 
  Cog, 
  Bot, 
  ArrowRight, 
  ChevronRight, 
  Sparkles,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  PieChart,
  Tag,
  Briefcase,
  Check,
  User
} from 'lucide-react';

export interface SquadDataCollection {
  squadId: SquadId;
  resources: Resource[];
  backlogItems: BacklogItem[];
  completedTasks: CompletedTask[];
}

interface MultiSquadDashboardProps {
  allSquadsData: Record<SquadId, SquadDataCollection>;
  onSelectSquadAndTab: (squadId: SquadId, tab: 'board' | 'backlog' | 'completed' | 'logs') => void;
}

type CompletedFilterPeriod = 'dia' | 'semana' | 'mes' | 'ano' | 'tudo';

export default function MultiSquadDashboard({
  allSquadsData,
  onSelectSquadAndTab
}: MultiSquadDashboardProps) {

  // Search & Filter States
  const [demandSearch, setDemandSearch] = useState('');
  const [demandSquadFilter, setDemandSquadFilter] = useState<'all' | SquadId>('all');
  const [demandStatusFilter, setDemandStatusFilter] = useState<string>('all');

  const [completedSearch, setCompletedSearch] = useState('');
  const [completedSquadFilter, setCompletedSquadFilter] = useState<'all' | SquadId>('all');
  const [completedPeriod, setCompletedPeriod] = useState<CompletedFilterPeriod>('tudo');

  const [inProgressSquadFilter, setInProgressSquadFilter] = useState<'all' | SquadId>('all');

  // Helper: Get Squad Info
  const getSquadInfo = (squadId: SquadId) => {
    return SQUADS_CONFIG.find(s => s.id === squadId) || SQUADS_CONFIG[0];
  };

  const getSquadIcon = (iconName: string, size = 16) => {
    switch (iconName) {
      case 'Database': return <Database size={size} />;
      case 'Cog': return <Cog size={size} />;
      case 'Bot': return <Bot size={size} />;
      default: return <Layers size={size} />;
    }
  };

  // 1. COMPUTE AGGREGATE STATS ACROSS ALL SQUADS
  const aggregatedStats = useMemo(() => {
    let totalMembers = 0;
    let totalActiveMembers = 0;
    let totalTasksInProgress = 0;
    let totalTasksBlocked = 0;
    let totalBacklogPending = 0;
    let totalCompleted = 0;

    const squadBreakdown: Record<SquadId, {
      activeMembers: number;
      inProgressCount: number;
      blockedCount: number;
      backlogCount: number;
      completedCount: number;
    }> = {
      dados: { activeMembers: 0, inProgressCount: 0, blockedCount: 0, backlogCount: 0, completedCount: 0 },
      operacoes: { activeMembers: 0, inProgressCount: 0, blockedCount: 0, backlogCount: 0, completedCount: 0 },
      rpa: { activeMembers: 0, inProgressCount: 0, blockedCount: 0, backlogCount: 0, completedCount: 0 }
    };

    (Object.keys(allSquadsData) as SquadId[]).forEach(id => {
      const squad = allSquadsData[id];
      if (!squad) return;

      const activeM = squad.resources.filter(r => r.status !== 'Inativo').length;
      totalMembers += squad.resources.length;
      totalActiveMembers += activeM;

      let inProgress = 0;
      let blocked = 0;

      squad.resources.forEach(r => {
        if (r.currentTask) {
          if (r.currentTask.status === 'Em Andamento') inProgress++;
          if (r.currentTask.status === 'Impedido') blocked++;
        }
        if (r.nextTask) {
          if (r.nextTask.status === 'Em Andamento') inProgress++;
          if (r.nextTask.status === 'Impedido') blocked++;
        }
      });

      const backlogP = squad.backlogItems.filter(b => b.status === 'Pendente').length;
      const completedC = squad.completedTasks.length;

      totalTasksInProgress += inProgress;
      totalTasksBlocked += blocked;
      totalBacklogPending += backlogP;
      totalCompleted += completedC;

      squadBreakdown[id] = {
        activeMembers: activeM,
        inProgressCount: inProgress,
        blockedCount: blocked,
        backlogCount: backlogP,
        completedCount: completedC
      };
    });

    return {
      totalMembers,
      totalActiveMembers,
      totalTasksInProgress,
      totalTasksBlocked,
      totalBacklogPending,
      totalCompleted,
      squadBreakdown
    };
  }, [allSquadsData]);

  // 2. EXTRACT IN-PROGRESS TASKS ACROSS ALL SQUADS
  const allTasksInProgress = useMemo(() => {
    const list: Array<{
      squadId: SquadId;
      resourceName: string;
      resourceRole: string;
      taskType: 'current' | 'next';
      task: Task;
    }> = [];

    (Object.keys(allSquadsData) as SquadId[]).forEach(id => {
      const squad = allSquadsData[id];
      if (!squad) return;

      squad.resources.forEach(res => {
        if (res.currentTask && res.currentTask.status === 'Em Andamento') {
          list.push({
            squadId: id,
            resourceName: res.name,
            resourceRole: res.role,
            taskType: 'current',
            task: res.currentTask
          });
        }
        if (res.nextTask && res.nextTask.status === 'Em Andamento') {
          list.push({
            squadId: id,
            resourceName: res.name,
            resourceRole: res.role,
            taskType: 'next',
            task: res.nextTask
          });
        }
      });
    });

    if (inProgressSquadFilter !== 'all') {
      return list.filter(item => item.squadId === inProgressSquadFilter);
    }

    return list;
  }, [allSquadsData, inProgressSquadFilter]);

  // 3. EXTRACT ALL BLOCKED TASKS (GARGALOS)
  const allBlockedTasks = useMemo(() => {
    const list: Array<{
      squadId: SquadId;
      resourceName: string;
      task: Task;
    }> = [];

    (Object.keys(allSquadsData) as SquadId[]).forEach(id => {
      const squad = allSquadsData[id];
      if (!squad) return;

      squad.resources.forEach(res => {
        if (res.currentTask && res.currentTask.status === 'Impedido') {
          list.push({ squadId: id, resourceName: res.name, task: res.currentTask });
        }
        if (res.nextTask && res.nextTask.status === 'Impedido') {
          list.push({ squadId: id, resourceName: res.name, task: res.nextTask });
        }
      });
    });

    return list;
  }, [allSquadsData]);

  // 4. CONSOLIDATE ALL DEMANDS (ASSIGNED TASKS + BACKLOG ITEMS) BY SQUAD
  const consolidatedDemands = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description?: string;
      squadId: SquadId;
      type: 'Atribuída' | 'Backlog';
      status: string;
      assignedTo?: string;
      dueDateOrDate?: string;
      priority?: string;
      requesterArea?: string;
    }> = [];

    (Object.keys(allSquadsData) as SquadId[]).forEach(id => {
      const squad = allSquadsData[id];
      if (!squad) return;

      // Add member assigned tasks
      squad.resources.forEach(res => {
        if (res.currentTask) {
          items.push({
            id: `curr-${res.id}-${res.currentTask.id}`,
            title: res.currentTask.title,
            description: res.currentTask.description,
            squadId: id,
            type: 'Atribuída',
            status: res.currentTask.status,
            assignedTo: res.name,
            dueDateOrDate: res.currentTask.dueDate,
            requesterArea: res.currentTask.requesterArea || res.currentTask.area
          });
        }
        if (res.nextTask) {
          items.push({
            id: `next-${res.id}-${res.nextTask.id}`,
            title: res.nextTask.title,
            description: res.nextTask.description,
            squadId: id,
            type: 'Atribuída',
            status: res.nextTask.status,
            assignedTo: res.name,
            dueDateOrDate: res.nextTask.dueDate,
            requesterArea: res.nextTask.requesterArea || res.nextTask.area
          });
        }
      });

      // Add backlog items
      squad.backlogItems.forEach(b => {
        items.push({
          id: `backlog-${b.id}`,
          title: b.title,
          description: `${b.gau ? `[${b.gau}] ` : ''}${b.notes || ''}`,
          squadId: id,
          type: 'Backlog',
          status: b.status === 'Pendente' ? 'Pendente (Backlog)' : 'Atribuído',
          assignedTo: b.assignedTo || 'Não Atribuído',
          dueDateOrDate: b.date,
          priority: b.priority,
          requesterArea: b.team || b.requester
        });
      });
    });

    // Apply filters
    return items.filter(item => {
      // Squad filter
      if (demandSquadFilter !== 'all' && item.squadId !== demandSquadFilter) return false;

      // Status filter
      if (demandStatusFilter !== 'all' && item.status !== demandStatusFilter) return false;

      // Search term
      if (demandSearch.trim()) {
        const query = demandSearch.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchAssignee = item.assignedTo?.toLowerCase().includes(query);
        const matchArea = item.requesterArea?.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        if (!matchTitle && !matchAssignee && !matchArea && !matchDesc) return false;
      }

      return true;
    });
  }, [allSquadsData, demandSquadFilter, demandStatusFilter, demandSearch]);

  // 5. CONSOLIDATED COMPLETED TASKS WITH DYNAMIC DATE FILTERING
  const filteredCompletedTasks = useMemo(() => {
    const list: Array<CompletedTask & { squadId: SquadId }> = [];

    (Object.keys(allSquadsData) as SquadId[]).forEach(id => {
      const squad = allSquadsData[id];
      if (!squad) return;

      squad.completedTasks.forEach(task => {
        list.push({ ...task, squadId: id });
      });
    });

    // Sort by completionDate descending
    list.sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime());

    // Calculate reference dates
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Seven days ago
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Current month YYYY-MM
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Current year YYYY
    const currentYearStr = `${now.getFullYear()}`;

    return list.filter(item => {
      // Squad Filter
      if (completedSquadFilter !== 'all' && item.squadId !== completedSquadFilter) return false;

      // Search Filter
      if (completedSearch.trim()) {
        const query = completedSearch.toLowerCase();
        const matchTitle = item.taskTitle.toLowerCase().includes(query);
        const matchBy = item.completedBy.toLowerCase().includes(query);
        const matchGains = item.gains?.toLowerCase().includes(query);
        if (!matchTitle && !matchBy && !matchGains) return false;
      }

      // Dynamic Time Range Filter
      if (!item.completionDate) return true;
      const compDate = item.completionDate;

      if (completedPeriod === 'dia') {
        return compDate === todayStr;
      } else if (completedPeriod === 'semana') {
        const itemDate = new Date(compDate);
        return itemDate >= sevenDaysAgo && itemDate <= now;
      } else if (completedPeriod === 'mes') {
        return compDate.startsWith(currentMonthStr);
      } else if (completedPeriod === 'ano') {
        return compDate.startsWith(currentYearStr);
      }

      return true; // 'tudo'
    });
  }, [allSquadsData, completedSquadFilter, completedSearch, completedPeriod]);

  return (
    <div className="space-y-8 animate-fade-in pb-12" id="multisquad-dashboard">
      
      {/* HEADER BANNER WITH EMANAPAY BRAND DESIGN */}
      <div className="bg-white rounded-3xl p-6 md:p-8 text-slate-900 shadow-sm border border-slate-200/80 relative overflow-hidden">
        {/* Emana brand top accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#004D36] via-[#E31C79] to-[#FF5E00]" />
        
        {/* Background ambient glows in Emana colors */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-[#00B074]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-40 -mb-10 w-60 h-60 bg-[#E31C79]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#004D36]/10 border border-[#004D36]/20 text-[#004D36] text-xs font-extrabold uppercase tracking-widest mb-3">
              <Sparkles size={14} className="text-[#00B074]" />
              <span>Painel Executivo EmanaPay Squads</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Visão Consolidada de Recursos & Demandas
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1.5 leading-relaxed">
              Gestão centralizada com modalidades sob medida: <strong className="text-[#004D36]">Dados</strong> (Sprints de 15 dias), <strong className="text-[#FF5E00]">Operações</strong> (Visão por Quarter) e <strong className="text-[#E31C79]">RPA</strong> (Atendimento por Demanda).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {SQUADS_CONFIG.map(s => {
              const b = aggregatedStats.squadBreakdown[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSquadAndTab(s.id, 'board')}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-2xl text-left transition-all hover:border-slate-300 flex items-center gap-3 group"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${s.badgeColor}`}>
                    {getSquadIcon(s.iconName, 16)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 block group-hover:text-emanapay-green transition-colors">
                        {s.shortName}
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                        {s.cadenceTag}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      {b?.activeMembers || 0} membros • {b?.inProgressCount || 0} em andamento
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOP AGGREGATED METRICS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Integrantes Ativos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{aggregatedStats.totalActiveMembers}</span>
              <span className="text-xs text-slate-500 font-semibold">/ {aggregatedStats.totalMembers} total</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Em Andamento</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-600">{aggregatedStats.totalTasksInProgress}</span>
              <span className="text-xs text-blue-600/80 font-bold">tarefas ativas</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Impedimentos / Riscos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${aggregatedStats.totalTasksBlocked > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {aggregatedStats.totalTasksBlocked}
              </span>
              <span className="text-xs text-slate-500 font-semibold">gargalos</span>
            </div>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${aggregatedStats.totalTasksBlocked > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Backlog Pendente</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-600">{aggregatedStats.totalBacklogPending}</span>
              <span className="text-xs text-indigo-600/80 font-bold">demandas</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Concluídos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600">{aggregatedStats.totalCompleted}</span>
              <span className="text-xs text-emerald-600/80 font-bold">entregas</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* CRITICAL WARNING BANNER IF ANY TASK IS BLOCKED */}
      {allBlockedTasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-scale-up">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                Atenção: {allBlockedTasks.length} {allBlockedTasks.length === 1 ? 'demanda está impedida' : 'demandas estão impedidas'}
              </h4>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-800 font-medium mt-1">
                {allBlockedTasks.map((b, i) => {
                  const sq = getSquadInfo(b.squadId);
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-amber-950">{sq.shortName}:</span>
                      <span>"{b.task.title}" ({b.resourceName})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => onSelectSquadAndTab(allBlockedTasks[0].squadId, 'board')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Resolver no Quadro</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: TAREFAS EM ANDAMENTO POR SQUAD */}
      <section className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              Tarefas em Andamento por Squad ({allTasksInProgress.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Acompanhamento de todas as demandas ativas sendo executadas pelos integrantes
            </p>
          </div>

          {/* Squad Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
            <button
              onClick={() => setInProgressSquadFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${inProgressSquadFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Todas Squads ({allTasksInProgress.length})
            </button>
            {SQUADS_CONFIG.map(s => {
              const count = allTasksInProgress.filter(t => t.squadId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setInProgressSquadFilter(s.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${inProgressSquadFilter === s.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.id === 'dados' ? 'bg-emerald-500' : s.id === 'operacoes' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                  <span>{s.shortName}</span>
                  <span className="text-[10px] text-slate-400 font-extrabold">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List Grid of Tasks in Progress */}
        {allTasksInProgress.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Clock size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">Nenhuma tarefa em andamento nesta seleção.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Todas as demandas da squad podem estar concluídas ou em a fazer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allTasksInProgress.map((item, idx) => {
              const sq = getSquadInfo(item.squadId);
              return (
                <div 
                  key={`${item.squadId}-${item.resourceName}-${item.task.id}-${idx}`}
                  className="bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between space-y-3 group"
                >
                  <div>
                    {/* Header: Squad Badge & Assignee */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1 ${sq.badgeColor}`}>
                        {getSquadIcon(sq.iconName, 12)}
                        <span>{sq.shortName}</span>
                      </span>

                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                        Em Andamento
                      </span>
                    </div>

                    {/* Task Title */}
                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                      {item.task.title}
                    </h4>

                    {/* Description */}
                    {item.task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {item.task.description}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center uppercase shrink-0">
                        {item.resourceName.charAt(0)}
                      </div>
                      <span className="truncate max-w-[110px]" title={item.resourceName}>{item.resourceName}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{item.task.dueDate || 'Sem prazo'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: TODAS AS DEMANDAS (COM SEGREGAÇÃO E FILTROS) */}
      <section className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers size={20} className="text-indigo-600" />
              Todas as Demandas das Squads ({consolidatedDemands.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consolidado de demandas atribuídas aos membros e itens do backlog por squad
            </p>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar demanda, membro ou área..."
                value={demandSearch}
                onChange={(e) => setDemandSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Squad Filter Dropdown */}
            <select
              value={demandSquadFilter}
              onChange={(e) => setDemandSquadFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Todas as Squads</option>
              <option value="dados">Squad de Dados</option>
              <option value="operacoes">Squad de Operações</option>
              <option value="rpa">Squad de RPA</option>
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={demandStatusFilter}
              onChange={(e) => setDemandStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">Todos os Status</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="A Fazer">A Fazer</option>
              <option value="Impedido">Impedido</option>
              <option value="Pendente (Backlog)">Pendente (Backlog)</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>
        </div>

        {/* Consolidated Demands Table / Cards */}
        {consolidatedDemands.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Layers size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">Nenhuma demanda encontrada para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                  <th className="py-3 px-4 rounded-l-xl">Squad</th>
                  <th className="py-3 px-4">Demanda</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Responsável / Atribuição</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data / Prazo</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {consolidatedDemands.map((item) => {
                  const sq = getSquadInfo(item.squadId);

                  let statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (item.status === 'Em Andamento') statusBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                  else if (item.status === 'Impedido') statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                  else if (item.status === 'Concluído') statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (item.status === 'Pendente (Backlog)') statusBadge = 'bg-indigo-50 text-indigo-700 border-indigo-200';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Squad Column */}
                      <td className="py-3.5 px-4 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${sq.badgeColor}`}>
                          {getSquadIcon(sq.iconName, 11)}
                          <span>{sq.shortName}</span>
                        </span>
                      </td>

                      {/* Demand Title & Description */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                        <div className="font-bold text-slate-900 text-xs leading-snug">{item.title}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.type === 'Atribuída' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {item.type}
                        </span>
                      </td>

                      {/* Assigned To */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span>{item.assignedTo}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {item.dueDateOrDate || '-'}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onSelectSquadAndTab(item.squadId, item.type === 'Backlog' ? 'backlog' : 'board')}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-all inline-flex items-center gap-1"
                        >
                          <span>Ver na Squad</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3: TODAS AS CONCLUÍDAS (COM FILTRO DINÂMICO DE DATA) */}
      <section className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              Entregas Concluídas Multisquads ({filteredCompletedTasks.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Histórico consolidado de entregas com ganhos de negócio gerados
            </p>
          </div>

          {/* DYNAMIC TIME RANGE FILTER BAR & SQUAD SELECTOR */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* Dynamic Period Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setCompletedPeriod('dia')}
                className={`px-3 py-1.5 rounded-lg transition-all ${completedPeriod === 'dia' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setCompletedPeriod('semana')}
                className={`px-3 py-1.5 rounded-lg transition-all ${completedPeriod === 'semana' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setCompletedPeriod('mes')}
                className={`px-3 py-1.5 rounded-lg transition-all ${completedPeriod === 'mes' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Este Mês
              </button>
              <button
                onClick={() => setCompletedPeriod('ano')}
                className={`px-3 py-1.5 rounded-lg transition-all ${completedPeriod === 'ano' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Este Ano
              </button>
              <button
                onClick={() => setCompletedPeriod('tudo')}
                className={`px-3 py-1.5 rounded-lg transition-all ${completedPeriod === 'tudo' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Todo o Período
              </button>
            </div>

            {/* Squad Filter Dropdown */}
            <select
              value={completedSquadFilter}
              onChange={(e) => setCompletedSquadFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">Todas as Squads</option>
              <option value="dados">Squad de Dados</option>
              <option value="operacoes">Squad de Operações</option>
              <option value="rpa">Squad de RPA</option>
            </select>
          </div>
        </div>

        {/* Search for completed items */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar concluídos por título, responsável ou ganho de negócio..."
            value={completedSearch}
            onChange={(e) => setCompletedSearch(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:bg-white focus:border-emerald-500 transition-all"
          />
        </div>

        {/* List of Completed Items */}
        {filteredCompletedTasks.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <CheckCircle2 size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">Nenhuma entrega concluída neste período.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tente selecionar outro período no filtro acima (ex: Todo o Período).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompletedTasks.map((task) => {
              const sq = getSquadInfo(task.squadId);
              return (
                <div 
                  key={task.id}
                  className="bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-100/80 hover:border-emerald-300 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${sq.badgeColor}`}>
                        {getSquadIcon(sq.iconName, 11)}
                        <span>{sq.shortName}</span>
                      </span>

                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={12} />
                        <span>Concluído</span>
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                      {task.taskTitle}
                    </h4>

                    {task.gains && (
                      <div className="mt-2.5 p-2.5 bg-white/90 rounded-xl border border-emerald-100 text-xs text-slate-700">
                        <span className="font-extrabold text-emerald-800 text-[10px] uppercase tracking-wider block mb-0.5">
                          💡 Ganho de Negócio / Resultado:
                        </span>
                        <p className="text-slate-600 italic leading-relaxed text-[11px]">
                          "{task.gains}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-emerald-100/60 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      Entregue por: <strong>{task.completedBy}</strong>
                    </span>
                    <span className="font-mono text-[11px] text-emerald-800 font-bold">
                      {task.completionDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 4: VISÃO COMPARATIVA DE RECURSOS & CAPACIDADE POR SQUAD */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SQUADS_CONFIG.map(squad => {
          const stats = aggregatedStats.squadBreakdown[squad.id];
          const squadData = allSquadsData[squad.id];
          const totalRes = squadData?.resources.length || 0;

          return (
            <div 
              key={squad.id}
              className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${squad.badgeColor}`}>
                      {getSquadIcon(squad.iconName, 18)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                        {squad.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">{squad.shortName}</p>
                    </div>
                  </div>
                  
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${squad.badgeColor}`}>
                    {squad.cadenceTag}
                  </span>
                </div>

                <div className="mb-3 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Modalidade:</span>
                  <span className="text-xs font-extrabold text-slate-900">{squad.cadence}</span>
                </div>

                {/* Squad Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Membros Ativos</span>
                    <span className="text-base font-extrabold text-slate-800">{stats?.activeMembers || 0} / {totalRes}</span>
                  </div>

                  <div className="bg-blue-50/60 p-2.5 rounded-xl">
                    <span className="text-[10px] text-blue-600 font-bold uppercase block">Em Andamento</span>
                    <span className="text-base font-extrabold text-blue-800">{stats?.inProgressCount || 0}</span>
                  </div>

                  <div className="bg-indigo-50/60 p-2.5 rounded-xl">
                    <span className="text-[10px] text-indigo-600 font-bold uppercase block">Backlog</span>
                    <span className="text-base font-extrabold text-indigo-800">{stats?.backlogCount || 0}</span>
                  </div>

                  <div className="bg-emerald-50/60 p-2.5 rounded-xl">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase block">Concluídos</span>
                    <span className="text-base font-extrabold text-emerald-800">{stats?.completedCount || 0}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectSquadAndTab(squad.id, 'board')}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <span>Acessar Quadro {squad.shortName}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </section>

    </div>
  );
}
