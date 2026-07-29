import React, { useState } from 'react';
import { Calendar, Clock, Edit3, Sparkles, X, CheckCircle2, AlertCircle, CalendarDays, TrendingUp } from 'lucide-react';
import { SquadId } from '../types';

export interface SprintConfig {
  sprintName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface QuarterConfig {
  quarterLabel: string; // e.g. "Q3 2026"
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
}

interface CadenceBannerProps {
  currentSquadId: SquadId;
  sprintConfig: SprintConfig;
  quarterConfig: QuarterConfig;
  onUpdateSprintConfig: (newConfig: SprintConfig) => void;
  onUpdateQuarterConfig: (newConfig: QuarterConfig) => void;
}

export default function CadenceBanner({
  currentSquadId,
  sprintConfig,
  quarterConfig,
  onUpdateSprintConfig,
  onUpdateQuarterConfig
}: CadenceBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Temporary state for form inside edit modal
  const [tempSprintName, setTempSprintName] = useState(sprintConfig.sprintName);
  const [tempSprintStart, setTempSprintStart] = useState(sprintConfig.startDate);
  const [tempSprintEnd, setTempSprintEnd] = useState(sprintConfig.endDate);

  const [tempQuarterLabel, setTempQuarterLabel] = useState(quarterConfig.quarterLabel);
  const [tempQuarterStart, setTempQuarterStart] = useState(quarterConfig.startDate);
  const [tempQuarterEnd, setTempQuarterEnd] = useState(quarterConfig.endDate);

  const handleOpenModal = () => {
    setTempSprintName(sprintConfig.sprintName);
    setTempSprintStart(sprintConfig.startDate);
    setTempSprintEnd(sprintConfig.endDate);

    setTempQuarterLabel(quarterConfig.quarterLabel);
    setTempQuarterStart(quarterConfig.startDate);
    setTempQuarterEnd(quarterConfig.endDate);

    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSquadId === 'dados') {
      onUpdateSprintConfig({
        sprintName: tempSprintName || 'Sprint Atual',
        startDate: tempSprintStart,
        endDate: tempSprintEnd
      });
    } else if (currentSquadId === 'operacoes') {
      onUpdateQuarterConfig({
        quarterLabel: tempQuarterLabel || 'Q3 2026',
        startDate: tempQuarterStart,
        endDate: tempQuarterEnd
      });
    }
    setIsModalOpen(false);
  };

  // Helper to parse dates safely without timezone shifts
  const parseLocalDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date();
  };

  const formatDateBR = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Calculations for Today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Quick Quarter presets helper
  const applyQuarterPreset = (preset: 'Q1' | 'Q2' | 'Q3' | 'Q4', year = 2026) => {
    setTempQuarterLabel(`${preset} ${year}`);
    if (preset === 'Q1') {
      setTempQuarterStart(`${year}-01-01`);
      setTempQuarterEnd(`${year}-03-31`);
    } else if (preset === 'Q2') {
      setTempQuarterStart(`${year}-04-01`);
      setTempQuarterEnd(`${year}-06-30`);
    } else if (preset === 'Q3') {
      setTempQuarterStart(`${year}-07-01`);
      setTempQuarterEnd(`${year}-09-30`);
    } else if (preset === 'Q4') {
      setTempQuarterStart(`${year}-10-01`);
      setTempQuarterEnd(`${year}-12-31`);
    }
  };

  // Render SQUAD DE DADOS CADENCE (Sprint)
  if (currentSquadId === 'dados') {
    const start = parseLocalDate(sprintConfig.startDate);
    const end = parseLocalDate(sprintConfig.endDate);

    const totalMs = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)) + 1);

    const elapsedMs = today.getTime() - start.getTime();
    const elapsedDaysRaw = Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1;

    let currentDay = Math.min(Math.max(1, elapsedDaysRaw), totalDays);
    let progressPct = Math.min(Math.max(0, Math.round((elapsedDaysRaw / totalDays) * 100)), 100);

    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    let statusText = 'Sprint em Andamento';
    let statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';

    if (today < start) {
      statusText = 'Sprint a Iniciar';
      statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
      progressPct = 0;
      currentDay = 0;
    } else if (today > end) {
      statusText = 'Sprint Concluída';
      statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
      progressPct = 100;
      currentDay = totalDays;
    }

    return (
      <>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs mb-8 transition-all hover:border-slate-300">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CalendarDays size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ciclo da Sprint</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                    {statusText}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  {sprintConfig.sprintName}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Período Configurado</span>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  {formatDateBR(sprintConfig.startDate)} até {formatDateBR(sprintConfig.endDate)} ({totalDays} dias)
                </span>
              </div>

              <button
                onClick={handleOpenModal}
                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                title="Configurar Início e Fim da Sprint"
              >
                <Edit3 size={14} />
                <span>Editar Sprint</span>
              </button>
            </div>
          </div>

          {/* Progress Indicators & Metric Badges */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <Clock size={15} className="text-emerald-600" />
                {today < start ? (
                  <span>Sprint inicia em breve</span>
                ) : today > end ? (
                  <span>100% dos dias concluídos</span>
                ) : (
                  <span>
                    Dia {currentDay} de {totalDays} de Sprint • <strong className="text-emerald-700">{progressPct}% decorridos</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                {remainingDays > 0 && today <= end && (
                  <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                    Faltam {remainingDays} {remainingDays === 1 ? 'dia' : 'dias'} para o encerramento
                  </span>
                )}
                {today > end && (
                  <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px]">
                    Pronta para fechamento / Retrospectiva
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* EDIT SPRINT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Configurar Datas da Sprint</h3>
                    <p className="text-xs text-slate-500">Ajuste o período oficial para a Squad de Dados</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome / Identificação da Sprint
                  </label>
                  <input
                    type="text"
                    value={tempSprintName}
                    onChange={(e) => setTempSprintName(e.target.value)}
                    placeholder="Ex: Sprint 14, Sprint Quinzenal - Julho"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={tempSprintStart}
                      onChange={(e) => setTempSprintStart(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Data de Término
                    </label>
                    <input
                      type="date"
                      value={tempSprintEnd}
                      onChange={(e) => setTempSprintEnd(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-medium leading-relaxed">
                  💡 A contagem de dias passados, porcentagem e alerta de dias restantes será calculada automaticamente com base no dia atual.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render SQUAD DE OPERAÇÕES CADENCE (Quarter)
  if (currentSquadId === 'operacoes') {
    const start = parseLocalDate(quarterConfig.startDate);
    const end = parseLocalDate(quarterConfig.endDate);

    const totalMs = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)) + 1);

    const elapsedMs = today.getTime() - start.getTime();
    const elapsedDaysRaw = Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1;

    let currentDay = Math.min(Math.max(1, elapsedDaysRaw), totalDays);
    let progressPct = Math.min(Math.max(0, Math.round((elapsedDaysRaw / totalDays) * 100)), 100);

    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    let statusText = 'Quarter em Andamento';
    let statusBadge = 'bg-blue-50 text-blue-700 border-blue-200';

    if (today < start) {
      statusText = 'Quarter a Iniciar';
      statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
      progressPct = 0;
      currentDay = 0;
    } else if (today > end) {
      statusText = 'Quarter Finalizado';
      statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
      progressPct = 100;
      currentDay = totalDays;
    }

    return (
      <>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs mb-8 transition-all hover:border-slate-300">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planejamento Trimestral</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                    {statusText}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Quarter Ativo: {quarterConfig.quarterLabel}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Período do Trimestre</span>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  {formatDateBR(quarterConfig.startDate)} até {formatDateBR(quarterConfig.endDate)}
                </span>
              </div>

              <button
                onClick={handleOpenModal}
                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                title="Configurar Quarter e Datas"
              >
                <Edit3 size={14} />
                <span>Editar Quarter</span>
              </button>
            </div>
          </div>

          {/* Progress Indicators & Metric Badges */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <Clock size={15} className="text-blue-600" />
                {today < start ? (
                  <span>Quarter inicia em breve</span>
                ) : today > end ? (
                  <span>100% do Quarter concluído</span>
                ) : (
                  <span>
                    Dia {currentDay} de {totalDays} do Trimestre • <strong className="text-blue-700">{progressPct}% do {quarterConfig.quarterLabel} percorrido</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                {remainingDays > 0 && today <= end && (
                  <span className="bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200 text-[11px]">
                    Faltam {remainingDays} {remainingDays === 1 ? 'dia' : 'dias'} para o fim do Quarter
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* EDIT QUARTER MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Configurar Quarter Ativo</h3>
                    <p className="text-xs text-slate-500">Defina o trimestre e as datas de vigência em Operações</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome do Quarter
                  </label>
                  <input
                    type="text"
                    value={tempQuarterLabel}
                    onChange={(e) => setTempQuarterLabel(e.target.value)}
                    placeholder="Ex: Q3 2026, Q4 2026"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                {/* Quick Presets Buttons */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Atalhos de Trimestres (2026)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => applyQuarterPreset(q, 2026)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                          tempQuarterLabel.startsWith(q)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {q} 2026
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Início do Quarter
                    </label>
                    <input
                      type="date"
                      value={tempQuarterStart}
                      onChange={(e) => setTempQuarterStart(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Término do Quarter
                    </label>
                    <input
                      type="date"
                      value={tempQuarterEnd}
                      onChange={(e) => setTempQuarterEnd(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
