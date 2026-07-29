import React, { useState } from 'react';
import { DpoMeetingLog } from '../types';
import { Calendar, FileText, ChevronDown, ChevronUp, CheckSquare, Sparkles, Trash2 } from 'lucide-react';

interface DpoLogsProps {
  logs: DpoMeetingLog[];
  onDeleteLog: (id: string) => void;
}

export default function DpoLogs({ logs, onDeleteLog }: DpoLogsProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const totalCompleted = logs.reduce((acc, log) => acc + log.completedTasksCount, 0);
  const totalPromoted = logs.reduce((acc, log) => acc + log.promotedTasksCount, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-150 shadow-sm p-6" id="dpo-logs-panel">
      {/* Header section with summary stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-100 gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Histórico de Alinhamentos (DPO)</h3>
          <p className="text-xs text-slate-500 mt-1">Registro de decisões semanais com o Ponto Focal de Dados</p>
        </div>
               {logs.length > 0 && (
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs text-slate-600">
            <div className="px-3 border-r border-slate-200">
              <span className="block font-bold text-emanapay-green text-sm text-center">{logs.length}</span>
              Alinhamentos
            </div>
            <div className="px-3 border-r border-slate-200">
              <span className="block font-bold text-emanapay-green text-sm text-center">{totalCompleted}</span>
              Entregas Finalizadas
            </div>
            <div className="px-3">
              <span className="block font-bold text-emanapay-green text-sm text-center">{totalPromoted}</span>
              Demandas Ativadas
            </div>
          </div>
        )}
      </div>

      {/* Accordion List */}
      {logs.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold">Nenhum alinhamento registrado ainda.</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Inicie o "Modo Reunião DPO" na barra superior para registrar o seu primeiro alinhamento com o ponto focal de dados.
          </p>
        </div>
      ) : (
        <div className="space-y-3" id="logs-list">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div 
                key={log.id} 
                className={`border rounded-xl transition-all ${
                  isExpanded 
                    ? 'border-emanapay-pink/20 bg-emanapay-pink/5 shadow-sm' 
                    : 'border-slate-150 hover:border-slate-200'
                }`}
              >
                {/* Accordion Trigger Header */}
                <div 
                  onClick={() => toggleExpand(log.id)}
                  className="p-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-emanapay-pink/10 text-emanapay-pink rounded-lg shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Alinhamento de {log.date.split('-').reverse().join('/')}
                      </h4>
                      <p className="text-xs text-slate-500 truncate max-w-xs md:max-w-md lg:max-w-xl mt-0.5">
                        {log.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {log.completedTasksCount} Concluídas
                      </span>
                      <span className="text-[10px] font-semibold bg-emanapay-pink/10 text-emanapay-pink border border-emanapay-pink/20 px-2 py-0.5 rounded-full">
                        {log.promotedTasksCount} Ativadas
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Tem certeza que deseja remover este registro de reunião?')) {
                            onDeleteLog(log.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                        title="Remover Registro"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content Details */}
                {isExpanded && (
                  <div className="px-4 pb-5 pt-1 border-t border-slate-100 text-slate-600 text-sm">
                    <div className="bg-white p-4 rounded-lg border border-slate-100/80 shadow-inner">
                      <h5 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emanapay-orange" />
                        Anotações do Alinhamento Semanal
                      </h5>
                      <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">
                        {log.summary}
                      </p>
                    </div>
                    
                    <div className="mt-3 flex sm:hidden flex-wrap gap-2 pt-2">
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {log.completedTasksCount} Demandas Concluídas
                      </span>
                      <span className="text-[10px] font-semibold bg-emanapay-pink/10 text-emanapay-pink border border-emanapay-pink/20 px-2 py-0.5 rounded-full">
                        {log.promotedTasksCount} Ativadas
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
