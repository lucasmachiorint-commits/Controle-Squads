import React, { useState } from 'react';
import { Resource, Task, DpoMeetingLog } from '../types';
import { 
  CheckCircle, 
  ArrowRight, 
  Users, 
  MessageSquare, 
  Calendar, 
  Save, 
  UserCheck, 
  Play, 
  AlertCircle, 
  PlusCircle,
  TrendingUp,
  XCircle
} from 'lucide-react';

interface DpoSyncModeProps {
  resources: Resource[];
  onSaveSync: (updatedResources: Resource[], logSummary: string) => void;
  onCancel: () => void;
}

export default function DpoSyncMode({ resources, onSaveSync, onCancel }: DpoSyncModeProps) {
  // We clone the resources state locally during the wizard session
  const [localResources, setLocalResources] = useState<Resource[]>(JSON.parse(JSON.stringify(resources)));
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [meetingSummary, setMeetingSummary] = useState<string>('');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  
  // Track tasks created/modified during this session for stats
  const [sessionCompletedCount, setSessionCompletedCount] = useState<number>(0);
  const [sessionPromotedCount, setSessionPromotedCount] = useState<number>(0);

  const activeResource = localResources[activeIndex];

  const handleNext = () => {
    // Mark current resource step as done
    if (activeResource) {
      setCompletedSteps(prev => ({ ...prev, [activeResource.id]: true }));
    }
    if (activeIndex < localResources.length) {
      setActiveIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  const handleUpdateStatus = (status: Task['status']) => {
    if (!activeResource || !activeResource.currentTask) return;
    
    const updated = [...localResources];
    const currentTask = updated[activeIndex].currentTask!;
    
    // Check if transitioning to Concluído
    if (status === 'Concluído' && currentTask.status !== 'Concluído') {
      setSessionCompletedCount(prev => prev + 1);
    } else if (status !== 'Concluído' && currentTask.status === 'Concluído') {
      setSessionCompletedCount(prev => Math.max(0, prev - 1));
    }

    currentTask.status = status;
    setLocalResources(updated);
  };

  const handlePromoteNext = () => {
    if (!activeResource || !activeResource.nextTask) return;
    
    const updated = [...localResources];
    const currentRes = updated[activeIndex];
    
    // Check if there is an existing current task - if so, it gets marked as completed or archived
    currentRes.currentTask = {
      ...currentRes.nextTask,
      status: 'Em Andamento' // automatically set promoted to in progress
    };
    currentRes.nextTask = null; // empty next task to be refilled
    
    setSessionPromotedCount(prev => prev + 1);
    setLocalResources(updated);
  };

  const handleUpdateAllocation = (ops: number) => {
    const updated = [...localResources];
    updated[activeIndex].allocationOps = ops;
    updated[activeIndex].allocationFin = 100 - ops;
    setLocalResources(updated);
  };

  const handleUpdateCurrentTaskDetails = (field: keyof Task, value: any) => {
    const updated = [...localResources];
    const currentRes = updated[activeIndex];
    if (!currentRes.currentTask) {
      // Create a default empty task
      currentRes.currentTask = {
        id: 'task-new-cur-' + Math.random().toString(36).substr(2, 9),
        title: '',
        description: '',
        status: 'Em Andamento',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        area: currentRes.allocationOps >= 50 ? 'Operações' : 'Finanças'
      };
    }
    currentRes.currentTask = {
      ...currentRes.currentTask,
      [field]: value
    };
    setLocalResources(updated);
  };

  const handleUpdateNextTaskDetails = (field: keyof Task, value: any) => {
    const updated = [...localResources];
    const currentRes = updated[activeIndex];
    if (!currentRes.nextTask) {
      // Create a default empty task
      currentRes.nextTask = {
        id: 'task-new-next-' + Math.random().toString(36).substr(2, 9),
        title: '',
        description: '',
        status: 'A Fazer',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        area: currentRes.allocationOps >= 50 ? 'Operações' : 'Finanças'
      };
    }
    currentRes.nextTask = {
      ...currentRes.nextTask,
      [field]: value
    };
    setLocalResources(updated);
  };

  const handleFinishMeeting = () => {
    const finalSummary = meetingSummary.trim() || 
      `Alinhamento de rotina com o DPO. Foram atualizados os status de ${localResources.length} recursos.`;
    
    onSaveSync(localResources, finalSummary);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-150 shadow-md overflow-hidden" id="dpo-sync-panel">
      {/* Header of Sync Mode */}
      <div className="bg-gradient-to-r from-emanapay-dark via-emanapay-green to-emanapay-green text-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 text-white border border-white/30 flex items-center justify-center font-black tracking-tight text-sm">
            DPO
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Modo Reunião de Alinhamento</h2>
            <p className="text-xs text-slate-100/85">Atualização objetiva com o Ponto Focal de Dados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emanapay-dark/60 px-3 py-1 rounded-full text-white font-medium">
            Hoje: {new Date().toLocaleDateString('pt-BR')}
          </span>
          <button 
            onClick={onCancel}
            className="text-slate-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg text-xs transition-colors"
          >
            Sair do Modo Reunião
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        {/* Left Side: Resources list progression */}
        <div className="lg:col-span-3 border-r border-slate-100 bg-slate-50/50 p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3 px-2">Integrantes da Squad</span>
            <div className="space-y-1.5">
              {localResources.map((res, idx) => {
                const isActive = idx === activeIndex;
                const isDone = completedSteps[res.id];
                return (
                  <button
                    key={res.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
                      isActive 
                        ? 'bg-emanapay-green text-white border-emanapay-green shadow-md shadow-emanapay-green/10' 
                        : 'bg-white hover:bg-slate-100/70 border-slate-150 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-emanapay-green/10 text-emanapay-green'
                      }`}>
                        {res.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-xs leading-tight truncate">{res.name}</p>
                        <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-green-100' : 'text-slate-400'}`}>
                          {res.role}
                        </p>
                      </div>
                    </div>
                    {isDone && !isActive && (
                      <CheckCircle size={14} className="text-emerald-500 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => setActiveIndex(localResources.length)}
                className={`w-full flex items-center gap-2 p-3 rounded-xl transition-all text-left border ${
                  activeIndex === localResources.length
                    ? 'bg-emanapay-green text-white border-emanapay-green shadow-md shadow-emanapay-green/10'
                    : 'bg-white hover:bg-slate-100/70 border-slate-150 text-slate-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeIndex === localResources.length ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <MessageSquare size={14} />
                </div>
                <div>
                  <p className="font-semibold text-xs">Concluir Alinhamento</p>
                  <p className={`text-[10px] ${activeIndex === localResources.length ? 'text-green-100' : 'text-slate-400'}`}>
                    Salvar histórico e logs
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="p-3 bg-emanapay-pink/5 rounded-xl border border-emanapay-pink/10 mt-4">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emanapay-pink" />
              Sessão de Hoje:
            </h5>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-slate-600">
              <div>
                <span className="block font-bold text-emanapay-pink text-sm">{sessionCompletedCount}</span>
                Tarefas Concluídas
              </div>
              <div>
                <span className="block font-bold text-emanapay-pink text-sm">{sessionPromotedCount}</span>
                Próximas Iniciadas
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right Side: Form and Interactive Content */}
        <div className="lg:col-span-9 p-6 lg:p-8 flex flex-col justify-between">
          
          {/* STEP: Individual Resource Update */}
          {activeIndex < localResources.length ? (
            <div className="space-y-6" id={`dpo-focus-${activeResource.id}`}>
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emanapay-green to-emanapay-dark text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emanapay-green/10">
                  {activeResource.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-emanapay-green uppercase tracking-widest block mb-0.5">Foco de Alinhamento</span>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">{activeResource.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{activeResource.role}</p>
                </div>
                {/* Quick allocation switcher */}
                <div className="bg-white px-3 py-2 rounded-xl border border-slate-150 text-right">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Dedicação</span>
                  <span className="text-xs font-bold text-emanapay-green bg-emanapay-green/10 px-2 py-0.5 rounded-full inline-block">
                    100% Operações
                  </span>
                </div>
              </div>

              {/* Grid with Current Task and Next Task side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. CURRENT TASK */}
                <div className="border border-slate-150 rounded-2xl p-5 bg-white relative shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Demanda Atual</span>
                    <select
                      value={activeResource.currentTask?.area || 'Operações'}
                      onChange={(e) => handleUpdateCurrentTaskDetails('area', e.target.value)}
                      className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-emanapay-green"
                    >
                      <option value="Operações">Operações</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>

                  {activeResource.currentTask ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Título do Trabalho</label>
                        <input
                          type="text"
                          value={activeResource.currentTask.title}
                          onChange={(e) => handleUpdateCurrentTaskDetails('title', e.target.value)}
                          className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all"
                          placeholder="Ex: Refatorar pipeline dbt"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Descrição</label>
                        <textarea
                          rows={2}
                          value={activeResource.currentTask.description}
                          onChange={(e) => handleUpdateCurrentTaskDetails('description', e.target.value)}
                          className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all resize-none"
                          placeholder="Ex: Detalhes sobre o que está sendo feito..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Prazo de Entrega</label>
                          <input
                            type="date"
                            value={activeResource.currentTask.dueDate}
                            onChange={(e) => handleUpdateCurrentTaskDetails('dueDate', e.target.value)}
                            className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Status da Atividade</label>
                          <div className="grid grid-cols-2 gap-1">
                            {(['A Fazer', 'Em Andamento', 'Impedido', 'Concluído'] as Task['status'][]).map(st => {
                              const isSelected = activeResource.currentTask?.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleUpdateStatus(st)}
                                  className={`p-1.5 text-[10px] font-bold rounded-md border text-center transition-all truncate ${
                                    isSelected 
                                      ? 'bg-emanapay-green text-white border-emanapay-green shadow-sm'
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                      <p className="text-xs text-slate-400 mb-3">Nenhuma demanda ativa no momento.</p>
                      <button
                        type="button"
                        onClick={() => handleUpdateCurrentTaskDetails('title', 'Nova Atividade')}
                        className="px-3 py-1.5 bg-emanapay-green/10 hover:bg-emanapay-green/20 text-emanapay-green text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
                      >
                        <PlusCircle size={14} /> Atribuir Demanda
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. NEXT TASK */}
                <div className="border border-slate-150 rounded-2xl p-5 bg-white relative shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Próxima Demanda</span>
                      {activeResource.nextTask && (
                        <select
                          value={activeResource.nextTask.area}
                          onChange={(e) => handleUpdateNextTaskDetails('area', e.target.value)}
                          className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-emanapay-green"
                        >
                          <option value="Operações">Operações</option>
                          <option value="Geral">Geral</option>
                        </select>
                      )}
                    </div>

                    {activeResource.nextTask ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Título do Próximo Trabalho</label>
                          <input
                            type="text"
                            value={activeResource.nextTask.title}
                            onChange={(e) => handleUpdateNextTaskDetails('title', e.target.value)}
                            className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all"
                            placeholder="Ex: Integração Looker"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Descrição</label>
                          <textarea
                            rows={2}
                            value={activeResource.nextTask.description}
                            onChange={(e) => handleUpdateNextTaskDetails('description', e.target.value)}
                            className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all resize-none"
                            placeholder="Ex: Escopo da próxima entrega..."
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Estimativa de Prazo</label>
                          <input
                            type="date"
                            value={activeResource.nextTask.dueDate}
                            onChange={(e) => handleUpdateNextTaskDetails('dueDate', e.target.value)}
                            className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center h-[180px]">
                        <p className="text-xs text-slate-400 mb-3">Nenhum backlog imediato definido.</p>
                        <button
                          type="button"
                          onClick={() => handleUpdateNextTaskDetails('title', 'Nova Próxima Atividade')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
                        >
                          <PlusCircle size={14} /> Adicionar Próxima
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Flow Shortcut */}
                  {activeResource.nextTask && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] text-slate-400">
                        Se a atual acabou, promova esta.
                      </div>
                      <button
                        type="button"
                        onClick={handlePromoteNext}
                        className="flex items-center gap-1 text-xs font-bold text-emanapay-green bg-emanapay-green/5 hover:bg-emanapay-green/15 border border-emanapay-green/10 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Ativar esta demanda <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Navigation controls for wizard */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={handleBack}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium text-sm disabled:opacity-30 disabled:pointer-events-none"
                >
                  Voltar
                </button>
                <div className="text-xs text-slate-400 font-medium">
                  Recurso {activeIndex + 1} de {localResources.length}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-emanapay-green hover:bg-emanapay-green/90 text-white font-bold text-sm rounded-xl shadow-md shadow-emanapay-green/10 transition-all flex items-center gap-1"
                >
                  Próximo Recurso <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* STEP: Finish Meeting and Summary */
            <div className="space-y-6" id="dpo-sync-summary">
              <div className="max-w-2xl mx-auto text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4 border border-emerald-100 shadow-sm animate-bounce">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Alinhamento Concluído!</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Você passou por todos os recursos e atualizou os status de demandas com o DPO. Agora, escreva um breve comentário para o histórico da semana.
                </p>
              </div>

              <div className="max-w-xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-150">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Anotações da Reunião (Ata Semanal)
                </label>
                <textarea
                  rows={4}
                  value={meetingSummary}
                  onChange={(e) => setMeetingSummary(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 focus:border-emanapay-green rounded-xl p-3.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all resize-none shadow-sm"
                  placeholder="Escreva as principais conclusões, impedimentos ou novidades decididas com o DPO nesta data..."
                />
                
                <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-slate-500">
                  <div className="bg-white p-3 rounded-lg border border-slate-100">
                    <span className="block font-bold text-emanapay-green text-lg">{sessionCompletedCount}</span>
                    demandas movidas para concluído
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100">
                    <span className="block font-bold text-emanapay-green text-lg">{sessionPromotedCount}</span>
                    próximas demandas ativadas
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-between max-w-xl mx-auto">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium text-sm"
                >
                  Voltar e Revisar
                </button>
                <button
                  type="button"
                  onClick={handleFinishMeeting}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-100 hover:shadow-emerald-200 transition-all flex items-center gap-2"
                >
                  <Save size={16} /> Salvar e Finalizar Alinhamento
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
