import React from 'react';
import { SquadId, SquadInfo } from '../types';
import { SQUADS_CONFIG } from '../defaultData';
import { 
  Database, 
  Cog, 
  Bot, 
  LayoutDashboard, 
  Layers, 
  CheckCircle2, 
  History, 
  Users, 
  X, 
  ChevronRight, 
  Sparkles,
  Layers3,
  PieChart,
  Inbox
} from 'lucide-react';

interface SidebarProps {
  currentSquadId: SquadId;
  onSelectSquad: (squadId: SquadId) => void;
  activeTab: 'dashboard' | 'board' | 'backlog' | 'completed' | 'logs' | 'triage';
  onSelectTab: (tab: 'dashboard' | 'board' | 'backlog' | 'completed' | 'logs' | 'triage') => void;
  squadSummaryStats: Record<SquadId, { totalMembers: number; activeMembers: number; backlogCount: number }>;
  pendingTriageCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onStartDpoSync: () => void;
}

export default function Sidebar({
  currentSquadId,
  onSelectSquad,
  activeTab,
  onSelectTab,
  squadSummaryStats,
  pendingTriageCount = 0,
  isOpenMobile,
  onCloseMobile
}: SidebarProps) {

  const getSquadIcon = (iconName: string, size = 18) => {
    switch (iconName) {
      case 'Database': return <Database size={size} />;
      case 'Cog': return <Cog size={size} />;
      case 'Bot': return <Bot size={size} />;
      default: return <Layers3 size={size} />;
    }
  };

  const isDashboardActive = activeTab === 'dashboard';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#002B1D] text-slate-100 flex flex-col justify-between border-r border-[#004D36]/60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Decorative Emana Brand Wave Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#00B074] via-[#E31C79] to-[#FF5E00]" />

        {/* Top Header & Brand */}
        <div className="p-5 border-b border-[#004D36]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#001F15] border border-[#00B074]/40 text-[#00B074] flex items-center justify-center shrink-0 shadow-xs">
                <Layers3 size={22} />
              </div>
              <div>
                <h1 className="font-extrabold text-white text-base tracking-tight leading-tight flex items-center gap-1.5">
                  Eficiência Operacional
                  <span className="text-[10px] font-extrabold bg-[#00B074]/20 text-[#00B074] px-1.5 py-0.5 rounded border border-[#00B074]/30">
                    Squads
                  </span>
                </h1>
                <p className="text-[11px] text-emerald-200/60 font-medium">Gestão Multidisciplinar Squads</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button 
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-emerald-200/60 hover:text-white rounded-lg hover:bg-[#003B27]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
          
          {/* 1. MÓDULO DE TRIAGEM E ENTRADA (BEFORE SQUADS) */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400/80">
                Entrada & Triagem Jira
              </span>
              <span className="text-[10px] text-amber-300 font-extrabold bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                Hub Passivo
              </span>
            </div>

            <button
              onClick={() => {
                onSelectTab('triage');
                if (isOpenMobile) onCloseMobile();
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-center justify-between ${
                activeTab === 'triage'
                  ? 'bg-amber-950/80 border-amber-500 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30'
                  : 'bg-[#001F15]/80 hover:bg-[#003B27] border-[#004D36] hover:border-amber-500/50 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  activeTab === 'triage'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    : 'bg-[#001F15] text-amber-400/80 border-[#004D36] group-hover:text-amber-400'
                }`}>
                  <Inbox size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className={`font-bold text-xs truncate ${activeTab === 'triage' ? 'text-white font-extrabold' : 'text-slate-200'}`}>
                      Fila de Triagem
                    </h2>
                    {pendingTriageCount > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                        {pendingTriageCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-200/50 truncate mt-0.5">
                    Formulários & Webhooks Jira
                  </p>
                </div>
              </div>

              <ChevronRight size={14} className={`shrink-0 transition-transform ${
                activeTab === 'triage' ? 'text-amber-400 translate-x-0.5' : 'text-emerald-700 group-hover:text-emerald-400'
              }`} />
            </button>
          </div>

          {/* 2. SQUADS SELECTION SECTION */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300/60">
                Squads ({SQUADS_CONFIG.length})
              </span>
              <span className="text-[10px] text-emerald-300/80 font-semibold bg-[#001F15] px-2 py-0.5 rounded-full border border-[#004D36]">
                Operação
              </span>
            </div>

            <div className="space-y-2">
              {SQUADS_CONFIG.map((squad) => {
                const isSelected = !isDashboardActive && activeTab !== 'triage' && squad.id === currentSquadId;
                const stats = squadSummaryStats[squad.id] || { totalMembers: 0, activeMembers: 0, backlogCount: 0 };

                let badgeStyles = 'bg-[#001F15] text-slate-300 border-[#004D36]';
                let activeGlow = '';
                let cadencePill = 'bg-[#001F15] text-slate-400 border-[#004D36]';
                let accentColor = '#00B074';

                if (squad.id === 'dados') {
                  accentColor = '#00B074'; // Emana Mint
                  cadencePill = 'bg-[#00B074]/15 text-[#00B074] border-[#00B074]/30';
                } else if (squad.id === 'operacoes') {
                  accentColor = '#FF5E00'; // Emana Orange
                  cadencePill = 'bg-[#FF5E00]/15 text-[#FF5E00] border-[#FF5E00]/30';
                } else {
                  accentColor = '#E31C79'; // Emana Pink
                  cadencePill = 'bg-[#E31C79]/15 text-[#E31C79] border-[#E31C79]/30';
                }

                if (isSelected) {
                  if (squad.id === 'dados') {
                    badgeStyles = 'bg-[#00B074]/20 text-[#00B074] border-[#00B074]/50';
                    activeGlow = 'border-[#00B074]/60 bg-[#003B27] shadow-lg shadow-[#00B074]/10';
                  } else if (squad.id === 'operacoes') {
                    badgeStyles = 'bg-[#FF5E00]/20 text-[#FF5E00] border-[#FF5E00]/50';
                    activeGlow = 'border-[#FF5E00]/60 bg-[#3B1C0B] shadow-lg shadow-[#FF5E00]/10';
                  } else {
                    badgeStyles = 'bg-[#E31C79]/20 text-[#E31C79] border-[#E31C79]/50';
                    activeGlow = 'border-[#E31C79]/60 bg-[#3B001F] shadow-lg shadow-[#E31C79]/10';
                  }
                }

                return (
                  <button
                    key={squad.id}
                    onClick={() => {
                      onSelectSquad(squad.id);
                      if (isOpenMobile) onCloseMobile();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-center justify-between ${
                      isSelected 
                        ? `${activeGlow}` 
                        : 'bg-[#001F15]/60 hover:bg-[#003B27] border-[#004D36]/70 hover:border-[#00B074]/40 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected 
                          ? badgeStyles 
                          : 'bg-[#001F15] text-slate-400 border-[#004D36] group-hover:text-white'
                      }`}>
                        {getSquadIcon(squad.iconName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className={`font-bold text-xs truncate ${isSelected ? 'text-white font-extrabold' : 'text-slate-200'}`}>
                            {squad.name}
                          </h2>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${cadencePill}`}>
                            {squad.cadenceTag}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-200/50 truncate mt-0.5">
                          {stats.activeMembers} membros {stats.backlogCount > 0 ? `• ${stats.backlogCount} no backlog` : ''}
                        </p>
                      </div>
                    </div>

                    <ChevronRight size={14} className={`shrink-0 transition-transform ${
                      isSelected ? 'text-white translate-x-0.5' : 'text-emerald-700 group-hover:text-emerald-400'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. VISÃO GERENCIAL / DASHBOARD CONSOLIDADO */}
          <div>
            <div className="px-2 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300/60">
                Visão Gerencial
              </span>
            </div>

            <div className="space-y-2">
              {/* CONSOLIDATED DASHBOARD */}
              <button
                onClick={() => {
                  onSelectTab('dashboard');
                  if (isOpenMobile) onCloseMobile();
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-center justify-between ${
                  isDashboardActive
                    ? 'bg-gradient-to-r from-[#004D36] to-[#002B1D] border-[#00B074] text-white shadow-lg shadow-[#00B074]/10'
                    : 'bg-[#001F15]/60 hover:bg-[#003B27] border-[#004D36]/70 hover:border-[#00B074]/40 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    isDashboardActive
                      ? 'bg-[#00B074]/20 text-[#00B074] border-[#00B074]/50'
                      : 'bg-[#001F15] text-slate-400 border-[#004D36] group-hover:text-[#00B074]'
                  }`}>
                    <PieChart size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className={`font-bold text-xs truncate ${isDashboardActive ? 'text-white font-extrabold' : 'text-slate-200'}`}>
                        Dashboard Consolidado
                      </h2>
                    </div>
                    <p className="text-[10px] text-emerald-200/50 truncate mt-0.5">
                      Visão Executiva (Multi-Squad)
                    </p>
                  </div>
                </div>

                <ChevronRight size={14} className={`shrink-0 transition-transform ${
                  isDashboardActive ? 'text-[#00B074] translate-x-0.5' : 'text-emerald-700 group-hover:text-emerald-400'
                }`} />
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[#004D36]/60 bg-[#001F15] text-[11px] text-emerald-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#00B074]" />
            <span>3 Squads Ativas</span>
          </div>
          <span className="text-[10px] bg-[#003B27] text-emerald-300 px-2 py-0.5 rounded font-mono border border-[#004D36]">v2.5</span>
        </div>
      </aside>
    </>
  );
}
