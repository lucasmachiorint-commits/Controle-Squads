import React from 'react';
import { Resource, DpoMeetingLog, CompletedTask } from '../types';
import { Calendar, Users, Briefcase, FileText, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';

interface PrintReportProps {
  resources: Resource[];
  meetingLogs: DpoMeetingLog[];
  completedTasks: CompletedTask[];
}

export default function PrintReport({ resources, meetingLogs, completedTasks }: PrintReportProps) {
  const todayStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate statistics for the report
  const totalResources = resources.length;
  const activeDemands = resources.filter(r => r.currentTask).length;
  
  const statusCounts = resources.reduce((acc, r) => {
    if (r.currentTask) {
      acc[r.currentTask.status] = (acc[r.currentTask.status] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const avgOpsAllocation = Math.round(
    resources.reduce((sum, r) => sum + r.allocationOps, 0) / (totalResources || 1)
  );
  const avgFinAllocation = 100 - avgOpsAllocation;

  // Get latest meeting log
  const latestLog = meetingLogs.length > 0 ? meetingLogs[0] : null;

  return (
    <div className="hidden print:block bg-white text-slate-800 p-8 font-sans max-w-4xl mx-auto" id="print-report">
      {/* 1. REPORT HEADER */}
      <div className="border-b-4 border-emanapay-green pb-6 mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">EmanaPay • Squad de Dados</h1>
              <p className="text-xs text-slate-500 font-medium">Relatório Executivo de Alocações e Demandas</p>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Data de Exportação:</p>
          <p>{todayStr}</p>
          <p className="mt-1 text-[10px] bg-slate-100 px-2 py-0.5 rounded inline-block text-slate-600 font-bold border border-slate-200">
            CONFIDENCIAL INTERNO
          </p>
        </div>
      </div>

      {/* 2. ATA DO ÚLTIMO ALINHAMENTO */}
      {latestLog && (
        <div className="mb-8 bg-slate-50 border border-slate-200 p-5 rounded-2xl break-inside-avoid">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
            <FileText size={16} className="text-emanapay-orange" />
            Ata do Último Alinhamento Semanal com DPO
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-xs">
            <div>
              <span className="font-semibold text-slate-500 block">Data da Reunião:</span>
              <span className="font-bold text-slate-800">{latestLog.date.split('-').reverse().join('/')}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500 block">Entregas Concluídas:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block">
                {latestLog.completedTasksCount} demandas
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-500 block">Demandas Ativadas:</span>
              <span className="font-bold text-emanapay-green bg-emanapay-green/5 border border-emanapay-green/20 px-2 py-0.5 rounded-full inline-block">
                {latestLog.promotedTasksCount} promovidas
              </span>
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 text-xs block mb-1">Resumo das Decisões e Notas:</span>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200">
              {latestLog.summary}
            </p>
          </div>
        </div>
      )}

      {/* 3. EXECUTIVE METRICS GRID */}
      <div className="grid grid-cols-3 gap-4 mb-8 break-inside-avoid">
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <Users size={16} className="mx-auto text-emanapay-green mb-1" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Integrantes</span>
          <span className="text-lg font-bold text-slate-800">{totalResources}</span>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <Clock size={16} className="mx-auto text-emanapay-green mb-1" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Dedicação Squad</span>
          <span className="text-lg font-bold text-slate-800">100% Operações</span>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 text-center">
          <CheckCircle2 size={16} className="mx-auto text-emerald-600 mb-1" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Entregas Ativas</span>
          <span className="text-lg font-bold text-slate-800">{activeDemands}</span>
        </div>
      </div>

      {/* STATUS SUB-STATS */}
      <div className="mb-8 flex flex-wrap gap-4 text-xs bg-slate-100/50 p-3.5 border border-slate-200 rounded-xl items-center justify-around break-inside-avoid">
        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Status das Atividades Ativas:</span>
        <div className="flex gap-1.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span className="font-semibold text-slate-700">A Fazer: {statusCounts['A Fazer'] || 0}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emanapay-green"></span>
          <span className="font-semibold text-slate-700">Em Andamento: {statusCounts['Em Andamento'] || 0}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emanapay-pink"></span>
          <span className="font-semibold text-slate-700">Impedido: {statusCounts['Impedido'] || 0}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="font-semibold text-slate-700">Concluído: {statusCounts['Concluído'] || 0}</span>
        </div>
      </div>

      {/* 4. DETAILED RESOURCES ALIGNMENT LIST */}
      <div className="space-y-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b-2 border-slate-300 pb-2">
          <Users size={16} className="text-emanapay-green" />
          Status Detalhado por Integrante da Squad
        </h2>

        {resources.map((res) => (
          <div key={res.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm break-inside-avoid">
            {/* Header of card */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">{res.name}</h3>
                <p className="text-[10px] text-slate-500 font-medium">{res.role}</p>
              </div>
              <div className="text-right">
                {res.status === 'Inativo' ? (
                  <div className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block">
                    Inativo (Fora de Operações)
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-emanapay-green bg-emanapay-green/10 px-2 py-0.5 rounded-full inline-block">
                    Ativo (100% Operações)
                  </div>
                )}
                {/* Micro allocation bar */}
                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden flex mt-1 ml-auto">
                  <div className={`h-full w-full ${res.status === 'Inativo' ? 'bg-amber-400' : 'bg-emanapay-green'}`} />
                </div>
              </div>
            </div>

            {/* Task contents */}
            <div className="p-4 grid grid-cols-2 gap-4 text-xs">
              {/* Current Task */}
              <div className="border-r border-slate-200 pr-4">
                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                  Demanda Atual (Em Execução)
                </span>
                {res.currentTask ? (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-800 leading-snug">{res.currentTask.title}</p>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                        res.currentTask.status === 'A Fazer' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        res.currentTask.status === 'Em Andamento' ? 'bg-emanapay-green/5 text-emanapay-green border border-emanapay-green/20' :
                        res.currentTask.status === 'Impedido' ? 'bg-emanapay-pink/5 text-emanapay-pink border border-emanapay-pink/20' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {res.currentTask.status}
                      </span>
                    </div>
                    {res.currentTask.description && (
                      <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                        "{res.currentTask.description}"
                      </p>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>Área: <strong className="text-slate-700">{res.currentTask.area}</strong></span>
                      <span>Prazo: <strong className="text-slate-700">{res.currentTask.dueDate.split('-').reverse().join('/')}</strong></span>
                    </div>
                    {res.currentTask.requesterArea && (
                      <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                        Área Demandante: <span className="text-slate-700">{res.currentTask.requesterArea}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic py-2">Sem demanda atual ativa.</p>
                )}
              </div>

              {/* Next Task */}
              <div className="pl-2">
                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
                  Próxima Demanda Planejada
                </span>
                {res.nextTask ? (
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 leading-snug">{res.nextTask.title}</p>
                    {res.nextTask.description && (
                      <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                        "{res.nextTask.description}"
                      </p>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                      <span>Área: <strong className="text-slate-700">{res.nextTask.area}</strong></span>
                      <span>Prazo: <strong className="text-slate-700">{res.nextTask.dueDate.split('-').reverse().join('/')}</strong></span>
                    </div>
                    {res.nextTask.requesterArea && (
                      <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                        Área Demandante: <span className="text-slate-700">{res.nextTask.requesterArea}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic py-2">Nenhuma demanda futura agendada.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 5. FOOTER SIGN-OFF */}
      <div className="mt-12 pt-6 border-t border-slate-300 text-[10px] text-slate-400 flex justify-between items-center break-inside-avoid">
        <p>© Controle de Alocação de Recursos EmanaPay — Squad de Dados</p>
        <p className="font-medium text-slate-500">Documento exportado diretamente do sistema de controle</p>
      </div>
    </div>
  );
}
