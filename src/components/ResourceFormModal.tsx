import React, { useState, useEffect } from 'react';
import { Resource } from '../types';
import { X, Users, Percent } from 'lucide-react';

interface ResourceFormModalProps {
  isOpen: boolean;
  resource: Resource | null; // If null, we are creating a new resource
  onSave: (resource: Omit<Resource, 'currentTask' | 'nextTask'> & { isNew: boolean }) => void;
  onClose: () => void;
}

export default function ResourceFormModal({ isOpen, resource, onSave, onClose }: ResourceFormModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  useEffect(() => {
    if (resource) {
      setName(resource.name);
      setRole(resource.role);
      setStatus(resource.status || 'Ativo');
    } else {
      setName('');
      setRole('');
      setStatus('Ativo');
    }
  }, [resource, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      alert('Por favor, preencha o Nome e a Função/Cargo.');
      return;
    }

    onSave({
      id: resource?.id || 'res-' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      role: role.trim(),
      status: status,
      allocationOps: 100,
      allocationFin: 0,
      isNew: !resource
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="resource-modal">
      <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emanapay-green" />
            <h3 className="font-bold text-slate-800 text-sm">
              {resource ? 'Editar Cadastro de Recurso' : 'Cadastrar Novo Integrante'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Nome Completo
            </label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all shadow-sm"
              placeholder="Ex: Ana Silva"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Função / Especialidade (Cargo)
            </label>
            <input 
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all shadow-sm"
              placeholder="Ex: Engenheira de Dados Sênior"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Status na Squad (Alocação em Operações)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('Ativo')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  status === 'Ativo'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Ativo (Alocado)</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('Inativo')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  status === 'Inativo'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Inativo (Desalocado)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Inative o profissional quando ele não estiver temporariamente alocado em operações.
            </p>
          </div>

          {/* Allocation Info: Always 100% Operações */}
          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200/80">
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-900 font-bold uppercase tracking-wider">Dedicação do Time:</span>
              <span className="text-emerald-800 bg-emerald-100 font-extrabold px-2.5 py-1 rounded-full border border-emerald-300/80">
                100% Operações ⚙️
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-2 font-medium">
              Time totalmente focado em atividades e demandas de Operações.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emanapay-green hover:bg-emanapay-green/90 text-white text-xs font-bold rounded-xl shadow-md shadow-emanapay-green/10 transition-all"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
