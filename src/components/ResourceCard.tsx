import React, { useState } from 'react';
import { Resource, Task } from '../types';
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  Plus, 
  Edit, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  PlayCircle,
  HelpCircle,
  TrendingUp,
  Percent
} from 'lucide-react';

interface ResourceCardProps {
  key?: string;
  resource: Resource;
  onEditResource: (resource: Resource) => void;
  onDeleteResource: (id: string) => void;
  onToggleStatus?: (resourceId: string) => void;
  onEditTask: (resourceId: string, taskType: 'current' | 'next') => void;
  onUpdateTaskStatus: (resourceId: string, status: Task['status']) => void;
  onPromoteNextTask: (resourceId: string) => void;
}

export default function ResourceCard({
  resource,
  onEditResource,
  onDeleteResource,
  onToggleStatus,
  onEditTask,
  onUpdateTaskStatus,
  onPromoteNextTask
}: ResourceCardProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const isInactive = resource.status === 'Inativo';

  // Helper to calculate remaining days
  const getRemainingDaysText = (dateStr?: string) => {
    if (!dateStr) return { text: 'Sem prazo definido', color: 'text-slate-400 bg-slate-50' };
    
    const dueDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        text: `Atrasado por ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'dia' : 'dias'}`, 
        color: 'text-rose-600 bg-rose-50 border border-rose-100' 
      };
    } else if (diffDays === 0) {
      return { text: 'Entrega HOJE!', color: 'text-amber-700 bg-amber-50 border border-amber-200 font-bold animate-pulse' };
    } else if (diffDays === 1) {
      return { text: 'Entrega amanhã', color: 'text-amber-600 bg-amber-50 border border-amber-100' };
    } else if (diffDays <= 3) {
      return { text: `Faltam ${diffDays} dias`, color: 'text-amber-600 bg-amber-50' };
    } else {
      return { text: `Faltam ${diffDays} dias`, color: 'text-slate-500 bg-slate-100' };
    }
  };

  const currentTaskDays = resource.currentTask ? getRemainingDaysText(resource.currentTask.dueDate) : null;

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'A Fazer':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Em Andamento':
        return 'bg-emanapay-green/5 text-emanapay-green border-emanapay-green/20';
      case 'Impedido':
        return 'bg-emanapay-pink/5 text-emanapay-pink border-emanapay-pink/20';
      case 'Concluído':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'A Fazer':
        return <Clock size={14} className="mr-1" />;
      case 'Em Andamento':
        return <PlayCircle size={14} className="mr-1 animate-spin-slow" />;
      case 'Impedido':
        return <AlertCircle size={14} className="mr-1" />;
      case 'Concluído':
        return <CheckCircle2 size={14} className="mr-1" />;
    }
  };

  return (
    <div 
      className={`rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
        isInactive 
          ? 'bg-slate-50/90 border-slate-300/80 shadow-xs' 
          : 'bg-white border-slate-150 shadow-sm hover:shadow-md'
      }`} 
      id={`resource-card-${resource.id}`}
    >
      {/* Inactive Notice Banner */}
      {isInactive && (
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-900 font-semibold">
          <span className="flex items-center gap-1.5 text-[11px]">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            Integrante Inativo (Fora de Operações)
          </span>
          <button
            onClick={() => onToggleStatus && onToggleStatus(resource.id)}
            className="text-[11px] font-bold text-amber-900 hover:text-emerald-700 underline transition-colors"
          >
            Ativar profissional
          </button>
        </div>
      )}

      {/* Top Header - Resource Info */}
      <div className={`p-6 pb-4 border-b border-slate-100 ${
        isInactive ? 'bg-slate-100/60' : 'bg-gradient-to-b from-slate-50/50 to-white'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${
              isInactive 
                ? 'bg-slate-300 text-slate-600' 
                : 'bg-emanapay-green text-white shadow-emanapay-green/10'
            }`}>
              {resource.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-base leading-tight ${isInactive ? 'text-slate-600' : 'text-slate-800'}`}>
                  {resource.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{resource.role}</p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Active / Inactive Quick Toggle Pill */}
            <button
              onClick={() => onToggleStatus && onToggleStatus(resource.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-full border flex items-center gap-1.5 transition-all group ${
                isInactive
                  ? 'bg-amber-100 hover:bg-emerald-100 text-amber-800 hover:text-emerald-800 border-amber-300 hover:border-emerald-300'
                  : 'bg-emerald-50 hover:bg-amber-50 text-emerald-800 hover:text-amber-800 border-emerald-200 hover:border-amber-300'
              }`}
              title={isInactive ? 'Ativar integrante na Squad' : 'Inativar integrante (quando não estiver alocado em operações)'}
            >
              <span className={`w-2 h-2 rounded-full ${isInactive ? 'bg-amber-500 group-hover:bg-emerald-500' : 'bg-emerald-500 group-hover:bg-amber-500'}`}></span>
              <span className="group-hover:hidden">{isInactive ? 'Inativo' : 'Ativo'}</span>
              <span className="hidden group-hover:inline">{isInactive ? 'Ativar ⚙️' : 'Inativar ⏸️'}</span>
            </button>

            <button 
              onClick={() => onEditResource(resource)}
              className="p-1.5 text-slate-400 hover:text-emanapay-green hover:bg-emanapay-green/5 rounded-lg transition-colors"
              title="Editar Recurso"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={() => {
                if (confirm(`Tem certeza que deseja remover ${resource.name} do controle?`)) {
                  onDeleteResource(resource.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Excluir Recurso"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Allocation representation */}
        <div className="mt-4 pt-4 border-t border-slate-100/60">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-500 font-medium">Dedicação:</span>
            {isInactive ? (
              <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
                Inativo (Desalocado)
              </span>
            ) : (
              <span className="text-emanapay-green font-bold bg-emanapay-green/10 px-2 py-0.5 rounded-full text-[11px]">
                100% Operações
              </span>
            )}
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
            <div className={`h-full transition-all duration-300 ${isInactive ? 'bg-amber-400 w-full' : 'bg-emanapay-green w-full'}`} />
          </div>
        </div>
      </div>

      {/* Center - Current Task */}
      <div className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Demanda Atual</span>
            <div className="flex items-center gap-1.5">
              {resource.currentTask && (
                <>
                  <button
                    onClick={() => onEditTask(resource.id, 'current')}
                    className="p-1 text-slate-400 hover:text-emanapay-green hover:bg-emanapay-green/5 rounded-md transition-colors flex items-center gap-1 text-[11px] font-semibold border border-transparent hover:border-emanapay-green/10"
                    title="Editar Demanda Atual"
                  >
                    <Edit size={12} />
                    <span>Editar</span>
                  </button>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    resource.currentTask.area === 'Operações' 
                      ? 'bg-emanapay-green/10 text-emanapay-green border border-emanapay-green/20' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {resource.currentTask.area}
                  </span>
                </>
              )}
            </div>
          </div>

          {resource.currentTask ? (
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 relative group/task">
              <div className="flex justify-between items-start gap-2 pr-4">
                <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">
                  {resource.currentTask.title}
                </h4>
                
                {/* Status Toggle Badge */}
                <div className="relative shrink-0">
                  <button 
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className={`flex items-center text-xs px-2 py-1 rounded-full border font-semibold transition-all shadow-sm ${getStatusColor(resource.currentTask.status)}`}
                  >
                    {getStatusIcon(resource.currentTask.status)}
                    {resource.currentTask.status}
                  </button>
                  
                  {showStatusDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)}></div>
                      <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 text-xs">
                        {(['A Fazer', 'Em Andamento', 'Impedido', 'Concluído'] as Task['status'][]).map((st) => (
                          <button
                            key={st}
                            onClick={() => {
                              onUpdateTaskStatus(resource.id, st);
                              setShowStatusDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center text-slate-700 font-medium"
                          >
                            <span className={`w-2 h-2 rounded-full mr-2 ${
                              st === 'A Fazer' ? 'bg-blue-500' :
                              st === 'Em Andamento' ? 'bg-emanapay-green' :
                              st === 'Impedido' ? 'bg-emanapay-pink' : 'bg-emerald-500'
                            }`}></span>
                            {st}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-2 line-clamp-2 min-h-[2.5rem] pr-2">
                {resource.currentTask.description || 'Sem descrição.'}
              </p>

              {resource.currentTask.requesterArea && (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100/80 border border-slate-200/50 px-2 py-0.5 rounded-md w-fit">
                  <span>Demandante: {resource.currentTask.requesterArea}</span>
                </div>
              )}

              {/* Progress Bar for % de Evolução */}
              {typeof resource.currentTask.progress === 'number' && (
                <div className="mt-2.5 bg-white border border-slate-150 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={11} className="text-emerald-600" />
                      Evolução
                    </span>
                    <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      {resource.currentTask.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-150 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, resource.currentTask.progress))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Deadline Indicator */}
              <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  Prazo: {resource.currentTask.dueDate.split('-').reverse().join('/')}
                </span>
                {currentTaskDays && (
                  <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${currentTaskDays.color}`}>
                    {currentTaskDays.text}
                  </span>
                )}
              </div>
              
              <button 
                onClick={() => onEditTask(resource.id, 'current')}
                className="absolute bottom-2 right-2 p-1.5 text-slate-400 hover:text-emanapay-green hover:bg-white rounded-lg transition-all border border-slate-200 shadow-sm bg-slate-50/80"
                title="Editar Nome, Prazo e Status"
              >
                <Edit size={12} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onEditTask(resource.id, 'current')}
              className="w-full py-6 border border-dashed border-slate-250 hover:border-emanapay-green rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-emanapay-green hover:bg-emanapay-green/5 transition-all duration-200"
            >
              <Plus size={18} />
              <span className="text-xs font-semibold">Atribuir Demanda</span>
            </button>
          )}
        </div>

        {/* Bottom Area - Next Task */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Próxima Demanda</span>
            {resource.nextTask && (
              <span className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
                {resource.nextTask.area}
              </span>
            )}
          </div>

          {resource.nextTask ? (
            <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/30 group/next relative">
              <div className="flex justify-between items-start gap-2">
                <h5 className="font-semibold text-slate-700 text-xs line-clamp-1">
                  {resource.nextTask.title}
                </h5>
                <button
                  onClick={() => onPromoteNextTask(resource.id)}
                  className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 transition-all ml-auto shrink-0"
                  title="Promover para Atual"
                >
                  Atuar <ArrowRight size={10} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                {resource.nextTask.description || 'Sem descrição.'}
              </p>

              {resource.nextTask.requesterArea && (
                <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100/50 border border-slate-200/30 px-1.5 py-0.5 rounded w-fit">
                  <span>Demandante: {resource.nextTask.requesterArea}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                <span>Prazo: {resource.nextTask.dueDate.split('-').reverse().join('/')}</span>
                <button 
                  onClick={() => onEditTask(resource.id, 'next')}
                  className="text-slate-400 hover:text-emanapay-green font-medium"
                >
                  Editar
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => onEditTask(resource.id, 'next')}
              className="w-full py-3.5 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              <Plus size={14} />
              <span className="text-[11px] font-medium">Definir Próxima Demanda</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
