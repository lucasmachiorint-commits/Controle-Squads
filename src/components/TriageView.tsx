import React, { useState } from 'react';
import { 
  Inbox, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Database, 
  Cog, 
  Bot, 
  Zap, 
  ExternalLink, 
  AlertCircle, 
  Filter, 
  Search, 
  Plus, 
  Sparkles,
  Layers,
  FileCheck,
  Check,
  RotateCcw
} from 'lucide-react';
import { TriageItem, SquadId, BacklogItem } from '../types';

interface TriageViewProps {
  triageItems: TriageItem[];
  onTriageToSquad: (triageItem: TriageItem, targetSquadId: SquadId) => void;
  onRejectTriage: (id: string) => void;
  onOpenJiraHub: () => void;
  onSimulateIncomingJira: () => void;
  onSyncJiraCards?: () => void;
  isSyncingJira?: boolean;
  lastJiraSyncTime?: string;
  syncNotification?: string | null;
}

export default function TriageView({
  triageItems,
  onTriageToSquad,
  onRejectTriage,
  onOpenJiraHub,
  onSimulateIncomingJira,
  onSyncJiraCards,
  isSyncingJira = false,
  lastJiraSyncTime = '--:--:--',
  syncNotification
}: TriageViewProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pendente' | 'Triado' | 'Rejeitado'>('Pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSquadTarget, setSelectedSquadTarget] = useState<Record<string, SquadId>>({});

  const pendingCount = triageItems.filter(i => i.status === 'Pendente').length;
  const triagedCount = triageItems.filter(i => i.status === 'Triado').length;
  const rejectedCount = triageItems.filter(i => i.status === 'Rejeitado').length;

  const filteredItems = triageItems.filter(item => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.jiraKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.requesterArea && item.requesterArea.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getPriorityBadge = (p: string) => {
    if (p.includes('Urgente') || p.includes('1')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (p.includes('Alta') || p.includes('2')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (p.includes('Média') || p.includes('3')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getSquadDetails = (squadId: SquadId) => {
    if (squadId === 'dados') {
      return {
        name: 'Squad de Dados',
        cadence: 'Sprint de 15 Dias',
        badge: 'bg-[#00B074]/15 text-[#00B074] border-[#00B074]/30',
        icon: <Database size={15} />
      };
    }
    if (squadId === 'operacoes') {
      return {
        name: 'Squad de Operações',
        cadence: 'Quarter (Trimestral)',
        badge: 'bg-[#FF5E00]/15 text-[#FF5E00] border-[#FF5E00]/30',
        icon: <Cog size={15} />
      };
    }
    return {
      name: 'Squad de RPA',
      cadence: 'Por Demanda',
      badge: 'bg-[#E31C79]/15 text-[#E31C79] border-[#E31C79]/30',
      icon: <Bot size={15} />
    };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* HEADER BANNER */}
      <div className="bg-white rounded-3xl p-6 md:p-8 text-slate-900 shadow-xs border border-slate-200/80 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#004D36] via-[#E31C79] to-[#FF5E00]" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#004D36]/10 border border-[#004D36]/20 text-[#004D36] text-xs font-extrabold uppercase tracking-widest mb-3">
              <Inbox size={14} className="text-[#00B074]" />
              <span>Sincronizador Passivo • Formulários & Webhooks Jira</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Mesa de Triagem & Monitor de Demandas Jira
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1.5 leading-relaxed">
              <strong>O Jira é a sua fonte central da verdade.</strong> Esta aplicação escuta em tempo real todas as movimentações: quando um formulário entra na <strong className="text-amber-700">Triagem</strong>, quando você encaminha para uma <strong className="text-[#004D36]">Squad</strong> e quando o card é <strong className="text-emerald-700">Concluído</strong> no Jira.
            </p>
          </div>

          {onSyncJiraCards && (
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={onSyncJiraCards}
                disabled={isSyncingJira}
                className={`px-4 py-2.5 bg-[#004D36] hover:bg-[#003B27] disabled:opacity-80 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  isSyncingJira ? 'ring-2 ring-[#00B074]/50' : ''
                }`}
                title="Sincronizar e atualizar todas as filas (Triagem, Squad de Dados, Operações, RPA e Concluídos)"
              >
                <RotateCcw size={15} className={`text-[#00B074] ${isSyncingJira ? 'animate-spin text-amber-400' : ''}`} />
                <span>{isSyncingJira ? 'Atualizando todas as filas...' : '🔄 Atualizar cards do Jira'}</span>
              </button>
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock size={12} className={`text-[#00B074] ${isSyncingJira ? 'animate-spin text-amber-500' : ''}`} />
                {isSyncingJira ? (
                  <span className="text-amber-600 font-bold animate-pulse">atualizando ....</span>
                ) : (
                  <span>
                    Atualizado em <strong className="text-slate-800">{lastJiraSyncTime}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* NOTIFICATION TOAST BANNER */}
        {syncNotification && (
          <div className="mt-4 p-3 bg-[#004D36]/10 border border-[#004D36]/30 rounded-2xl flex items-center gap-3 text-xs text-[#004D36] font-medium animate-scale-up">
            <Sparkles size={16} className="text-[#00B074] shrink-0" />
            <span className="flex-1">{syncNotification}</span>
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-4 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Aguardando Triagem</span>
              <span className="text-2xl font-black text-amber-900">{pendingCount} cards</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Triados & Atribuídos</span>
              <span className="text-2xl font-black text-emerald-900">{triagedCount} cards</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Rejeitados / Arquivados</span>
              <span className="text-2xl font-black text-slate-800">{rejectedCount} cards</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center font-bold">
              <XCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setFilterStatus('Pendente')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'Pendente'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={13} />
            <span>Pendentes ({pendingCount})</span>
          </button>

          <button
            onClick={() => setFilterStatus('Triado')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'Triado'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Triados ({triagedCount})</span>
          </button>

          <button
            onClick={() => setFilterStatus('Rejeitado')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'Rejeitado'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle size={13} />
            <span>Rejeitados ({rejectedCount})</span>
          </button>

          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({triageItems.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Jira Key, Título ou Solicitante..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* TRIAGE CARDS LIST */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Inbox size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Nenhum card encontrado na fila</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {filterStatus === 'Pendente' 
              ? 'Todos os formulários do Jira já foram analisados e direcionados para suas respectivas Squads!' 
              : 'Não há registros para o filtro ou termo de busca informado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const currentSelectedSquad = selectedSquadTarget[item.id] || item.suggestedSquad || 'dados';

            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${
                  item.status === 'Pendente' 
                    ? 'border-amber-200 hover:border-amber-400' 
                    : item.status === 'Triado'
                    ? 'border-emerald-200/80 opacity-90'
                    : 'border-slate-200 bg-slate-50/50 opacity-75'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black font-mono tracking-wide shrink-0">
                      {item.jiraKey}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(item.priority)}`}>
                          {item.priority}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                          {item.category}
                        </span>
                        {item.issueType && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            • {item.issueType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="text-left lg:text-right text-xs shrink-0">
                    <span className="text-slate-500 block">Solicitante</span>
                    <strong className="text-slate-800 font-bold block">{item.requesterName}</strong>
                    <span className="text-[11px] text-slate-400">{item.requesterArea || 'Sem área'} • {item.createdAt}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 my-3 leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  {item.description}
                </p>

                {/* TRIAGE ACTIONS FOOTER */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    {item.status === 'Pendente' && (
                      <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1.5">
                        <Clock size={13} />
                        Pendente de Análise
                      </span>
                    )}
                    {item.status === 'Triado' && (
                      <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        Triado para Squad {item.triagedSquadId?.toUpperCase()} ({item.triagedAt})
                      </span>
                    )}
                    {item.status === 'Rejeitado' && (
                      <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
                        <XCircle size={13} />
                        Rejeitado
                      </span>
                    )}
                  </div>

                  {/* Actions for Pending items */}
                  {item.status === 'Pendente' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500 hidden xl:inline">Atribuir a:</span>

                      {/* Squad Target Select */}
                      <select
                        value={currentSelectedSquad}
                        onChange={(e) => setSelectedSquadTarget({ ...selectedSquadTarget, [item.id]: e.target.value as SquadId })}
                        className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="dados">Squad de Dados (Sprint 15d)</option>
                        <option value="operacoes">Squad de Operações (Quarter)</option>
                        <option value="rpa">Squad de RPA (Por Demanda)</option>
                      </select>

                      <button
                        onClick={() => onTriageToSquad(item, currentSelectedSquad)}
                        className="px-4 py-1.5 bg-[#004D36] hover:bg-[#003B27] text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <Check size={14} />
                        <span>Confirmar & Enviar para Squad</span>
                      </button>

                      <button
                        onClick={() => onRejectTriage(item.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all"
                        title="Rejeitar solicitação"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AUTOMATION EXPLANATION BOX */}
      <div className="bg-gradient-to-r from-[#002B1D] to-[#001F15] rounded-3xl p-6 text-white border border-[#004D36] shadow-xl mt-8">
        <div className="flex items-center gap-2 text-[#00B074] text-xs font-extrabold uppercase tracking-widest mb-2">
          <Sparkles size={16} />
          <span>Fluxo Automatizado de Integração Jira</span>
        </div>
        <h3 className="text-xl font-black mb-4">Como funciona a sincronização em tempo real?</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#003B27]/60 p-4 rounded-2xl border border-[#004D36]">
            <div className="w-7 h-7 rounded-lg bg-[#00B074]/20 text-[#00B074] flex items-center justify-center font-bold mb-2.5">
              1
            </div>
            <h4 className="font-bold text-white text-sm mb-1">1. Entrada no Formulário Jira</h4>
            <p className="text-emerald-200/70 leading-relaxed">
              O solicitante preenche o formulário no Jira. A regra de automação dispara um Webhook para esta aplicação e cria a solicitação na <strong>Fila de Triagem</strong>.
            </p>
          </div>

          <div className="bg-[#003B27]/60 p-4 rounded-2xl border border-[#004D36]">
            <div className="w-7 h-7 rounded-lg bg-[#FF5E00]/20 text-[#FF5E00] flex items-center justify-center font-bold mb-2.5">
              2
            </div>
            <h4 className="font-bold text-white text-sm mb-1">2. Triagem e Encaminhamento</h4>
            <p className="text-emerald-200/70 leading-relaxed">
              Você analisa a demanda e escolhe o squad de destino. O item é automaticamente criado no <strong>Backlog da Squad</strong> selecionada (Dados, Operações ou RPA).
            </p>
          </div>

          <div className="bg-[#003B27]/60 p-4 rounded-2xl border border-[#004D36]">
            <div className="w-7 h-7 rounded-lg bg-[#E31C79]/20 text-[#E31C79] flex items-center justify-center font-bold mb-2.5">
              3
            </div>
            <h4 className="font-bold text-white text-sm mb-1">3. Fechamento Automático</h4>
            <p className="text-emerald-200/70 leading-relaxed">
              Quando o card for marcado como <strong>Concluído</strong> no Jira, o status é atualizado via Webhook e a tarefa é movida para a lista de <strong>Entregas Concluídas</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
