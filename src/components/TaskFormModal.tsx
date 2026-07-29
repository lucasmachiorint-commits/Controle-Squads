import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { X, Calendar, Edit3 } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  resourceName: string;
  taskType: 'current' | 'next';
  task: Task | null;
  onSave: (task: Task) => void;
  onClose: () => void;
}

export default function TaskFormModal({
  isOpen,
  resourceName,
  taskType,
  task,
  onSave,
  onClose
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState<'Operações' | 'Geral'>('Operações');
  const [status, setStatus] = useState<Task['status']>('A Fazer');
  const [dueDate, setDueDate] = useState('');
  const [requesterArea, setRequesterArea] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setArea(task.area);
      setStatus(task.status);
      setDueDate(task.dueDate);
      setRequesterArea(task.requesterArea || '');
      setProgress(typeof task.progress === 'number' ? task.progress : 0);
    } else {
      setTitle('');
      setDescription('');
      setArea('Operações');
      setStatus(taskType === 'current' ? 'Em Andamento' : 'A Fazer');
      setRequesterArea('');
      setProgress(0);
      // Set default due date to 1 week from now for current, 2 weeks for next
      const defaultDays = taskType === 'current' ? 7 : 14;
      setDueDate(new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    }
  }, [task, isOpen, taskType]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor, defina um título para a demanda.');
      return;
    }

    onSave({
      id: task?.id || 'task-' + Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      description: description.trim(),
      area,
      status,
      dueDate,
      requesterArea: requesterArea.trim() || undefined,
      progress
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="task-modal">
      <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-lg w-full overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-emanapay-green" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {task ? 'Editar Demanda' : 'Nova Demanda'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Para: <span className="text-slate-700 font-bold">{resourceName}</span> ({taskType === 'current' ? 'Demanda Atual' : 'Próxima Demanda'})
              </p>
            </div>
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
              Título da Demanda
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all shadow-sm"
              placeholder="Ex: Desenvolver fluxo dbt de pagamentos"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Descrição do Escopo / Notas
            </label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all shadow-sm resize-none"
              placeholder="Ex: O que deve ser construído, requisitos principais ou dependências..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Área Demandante
            </label>
            <input 
              type="text"
              value={requesterArea}
              onChange={(e) => setRequesterArea(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 focus:border-emanapay-green rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white transition-all shadow-sm"
              placeholder="Ex: Marketing, Atendimento, Financeiro, Compliance, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Foco de Área
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value as any)}
                className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
              >
                <option value="Operações">Operações ⚙️</option>
                <option value="Geral">Geral 🧩</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Prazo Estimado
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                disabled={taskType === 'next' /* Next task is usually always "A Fazer" initially */}
              >
                <option value="A Fazer">A Fazer</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Impedido">Impedido</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                % de Evolução
              </label>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                {progress}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value, 10) || 0)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-16 text-center text-xs font-extrabold bg-slate-50 border border-slate-200 rounded-xl p-2"
              />
            </div>
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
              Gravar Demanda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
