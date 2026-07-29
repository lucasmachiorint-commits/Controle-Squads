import React from 'react';
import { Resource } from '../types';
import { Users, ShieldAlert, PieChart as PieIcon, Activity, CheckSquare } from 'lucide-react';

interface DashboardStatsProps {
  resources: Resource[];
}

export default function DashboardStats({ resources }: DashboardStatsProps) {
  // Calculations
  const totalResources = resources.length;
  const activeResourcesCount = resources.filter(r => r.status !== 'Inativo').length;
  const inactiveResourcesCount = resources.filter(r => r.status === 'Inativo').length;
  
  let totalOps = 0;
  let totalFin = 0;
  resources.forEach(r => {
    totalOps += r.allocationOps;
    totalFin += r.allocationFin;
  });
  
  const avgOps = totalResources > 0 ? Math.round(totalOps / totalResources) : 0;
  const avgFin = totalResources > 0 ? Math.round(totalFin / totalResources) : 0;

  // Task metrics
  let totalTasks = 0;
  let statusCounts = {
    'A Fazer': 0,
    'Em Andamento': 0,
    'Impedido': 0,
    'Concluído': 0,
  };
  let urgentDeadlines = 0;

  resources.forEach(r => {
    if (r.currentTask) {
      totalTasks++;
      statusCounts[r.currentTask.status] = (statusCounts[r.currentTask.status] || 0) + 1;
      
      // Calculate remaining days
      const dueDate = new Date(r.currentTask.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays <= 3 && r.currentTask.status !== 'Concluído') {
        urgentDeadlines++;
      }
    }
  });

  const activeTaskCount = statusCounts['Em Andamento'] + statusCounts['Impedido'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" id="dashboard-stats-grid">
      {/* Total Resources */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200" id="stat-card-resources">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Membros na Squad</span>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{activeResourcesCount}</h3>
            <span className="text-xs text-slate-400 font-medium">/ {totalResources} total</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              {activeResourcesCount} Ativos
            </span>
            {inactiveResourcesCount > 0 && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                {inactiveResourcesCount} Inativo{inactiveResourcesCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="p-4 bg-emanapay-green/10 text-emanapay-green rounded-xl">
          <Users size={24} />
        </div>
      </div>

      {/* Allocation Mix - 100% Operações */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 col-span-1 md:col-span-2 flex flex-col justify-between" id="stat-card-allocation">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Foco e Dedicação do Time</span>
            <span className="text-xs text-slate-500">Squad 100% dedicada a Operações</span>
          </div>
          <div className="p-2.5 bg-emanapay-green/10 text-emanapay-green rounded-xl">
            <PieIcon size={20} />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-emanapay-green flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emanapay-green"></span> Operações: 100% Dedicado
            </span>
            <span className="text-slate-400 font-medium">Sem divisões externas</span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="bg-emanapay-green h-full w-full transition-all duration-500" 
              title="Operações: 100% Dedicado"
            />
          </div>
        </div>
      </div>

      {/* Alerts / Near Deadlines */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-200" id="stat-card-deadlines">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Prazos Apertados</span>
          <h3 className={`text-3xl font-bold tracking-tight ${urgentDeadlines > 0 ? 'text-emanapay-orange' : 'text-slate-800'}`}>
            {urgentDeadlines}
          </h3>
          <span className="text-xs text-slate-500 mt-1 block">Entregas em até 3 dias</span>
        </div>
        <div className={`p-4 rounded-xl ${urgentDeadlines > 0 ? 'bg-emanapay-orange/10 text-emanapay-orange' : 'bg-slate-50 text-slate-400'}`}>
          <ShieldAlert size={24} />
        </div>
      </div>

      {/* Status Breakdown Row */}
      <div className="col-span-1 md:col-span-4 bg-slate-50 rounded-2xl p-5 border border-slate-100/50 flex flex-wrap gap-4 items-center justify-between" id="status-quick-breakdown">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-200/60 rounded-lg text-slate-600">
            <Activity size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Status das Demandas Atuais</h4>
            <p className="text-xs text-slate-500">{totalTasks} tarefas ativas sendo monitoradas</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 md:gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span className="text-xs text-slate-600 font-medium">A Fazer: <strong className="text-slate-800">{statusCounts['A Fazer']}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emanapay-green animate-pulse"></span>
            <span className="text-xs text-slate-600 font-medium">Em Andamento: <strong className="text-slate-800">{statusCounts['Em Andamento']}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emanapay-pink"></span>
            <span className="text-xs text-slate-600 font-medium">Impedidos: <strong className="text-slate-800">{statusCounts['Impedido']}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-slate-600 font-medium">Concluídos: <strong className="text-slate-800">{statusCounts['Concluído']}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
