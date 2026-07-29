import React, { useState } from 'react';
import { BacklogItem, Resource, Task } from '../types';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  UserPlus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers, 
  ArrowRight,
  X,
  FileText,
  User,
  Users,
  Calendar,
  Tag,
  Sparkles,
  Database,
  BarChart3,
  Code2,
  FolderKanban,
  ArrowUp,
  ArrowDown,
  Hash,
  ListOrdered,
  TrendingUp
} from 'lucide-react';

import { SquadId } from '../types';

interface BacklogViewProps {
  backlogItems: BacklogItem[];
  resources: Resource[];
  currentSquadId?: SquadId;
  onAddBacklogItem: (item: Omit<BacklogItem, 'id'>) => void;
  onAddBacklogItemsBatch: (items: Omit<BacklogItem, 'id'>[]) => void;
  onEditBacklogItem: (item: BacklogItem) => void;
  onDeleteBacklogItem: (id: string) => void;
  onAssignToSquad: (backlogItem: BacklogItem, resourceId: string, taskPosition: 'current' | 'next', area: 'Operações' | 'Geral') => void;
}

export default function BacklogView({
  backlogItems,
  resources,
  currentSquadId = 'dados',
  onAddBacklogItem,
  onAddBacklogItemsBatch,
  onEditBacklogItem,
  onDeleteBacklogItem,
  onAssignToSquad
}: BacklogViewProps) {
  const isOperacoesOrRpa = currentSquadId === 'operacoes' || currentSquadId === 'rpa';

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [requesterFilter, setRequesterFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'order-asc' | 'order-desc' | 'priority-asc' | 'priority-desc' | 'date' | 'gau'>('order-asc');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [assigningItem, setAssigningItem] = useState<BacklogItem | null>(null);

  // Manual Form State
  const [formData, setFormData] = useState({
    gau: '',
    title: '',
    requester: '',
    requesterArea: '',
    team: currentSquadId === 'rpa' ? 'RPA' : 'Operações',
    date: new Date().toISOString().split('T')[0],
    priority: '3 - Média' as BacklogItem['priority'],
    category: 'Automação' as BacklogItem['category'],
    treatmentOrder: 1,
    notes: '',
    status: 'Em Andamento' as BacklogItem['status'],
    progress: 0
  });

  // Assign Form State
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<'current' | 'next'>('current');
  const [selectedArea, setSelectedArea] = useState<'Operações' | 'Geral'>('Operações');

  // Import Preview State
  const [parsedPreview, setParsedPreview] = useState<Omit<BacklogItem, 'id' | 'status'>[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Move item up/down in treatment order
  const handleMoveOrder = (item: BacklogItem, direction: 'up' | 'down') => {
    const currentOrder = item.treatmentOrder || 1;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    if (targetOrder < 1 || targetOrder > 100) return;

    // Find if another item has targetOrder
    const swappedItem = backlogItems.find(i => (i.treatmentOrder || 1) === targetOrder);
    
    // Update main item
    onEditBacklogItem({ ...item, treatmentOrder: targetOrder });
    
    // Swap with existing if present
    if (swappedItem) {
      onEditBacklogItem({ ...swappedItem, treatmentOrder: currentOrder });
    }
  };

  // Unique filters data
  const uniqueRequesters = Array.from(new Set(backlogItems.map(i => i.requester).filter(Boolean))).sort();
  const uniqueTeams = Array.from(new Set(backlogItems.map(i => i.team).filter(Boolean))).sort();

  // Helper for priority numeric weight (1 = Urgente, 2 = Alta, 3 = Média, 4 = Baixa)
  const getPriorityNumber = (p: string) => {
    if (p.includes('1') || p.toLowerCase().includes('urg')) return 1;
    if (p.includes('2') || p.toLowerCase().includes('alt')) return 2;
    if (p.includes('3') || p.toLowerCase().includes('med') || p.toLowerCase().includes('méd')) return 3;
    if (p.includes('4') || p.toLowerCase().includes('baix')) return 4;
    return 3;
  };

  // Filter & Sort Backlog items
  const filteredItems = backlogItems.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.gau.toLowerCase().includes(searchLower) ||
      item.title.toLowerCase().includes(searchLower) ||
      item.requester.toLowerCase().includes(searchLower) ||
      item.team.toLowerCase().includes(searchLower) ||
      (item.category && item.category.toLowerCase().includes(searchLower)) ||
      (item.notes && item.notes.toLowerCase().includes(searchLower)) ||
      (item.treatmentOrder && item.treatmentOrder.toString().includes(searchLower));

    const matchesRequester = requesterFilter === 'all' || item.requester === requesterFilter;
    const matchesTeam = teamFilter === 'all' || item.team === teamFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesRequester && matchesTeam && matchesCategory && matchesPriority && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'order-asc') {
      return (a.treatmentOrder || 999) - (b.treatmentOrder || 999);
    } else if (sortBy === 'order-desc') {
      return (b.treatmentOrder || 0) - (a.treatmentOrder || 0);
    } else if (sortBy === 'priority-asc') {
      return getPriorityNumber(a.priority) - getPriorityNumber(b.priority);
    } else if (sortBy === 'priority-desc') {
      return getPriorityNumber(b.priority) - getPriorityNumber(a.priority);
    } else if (sortBy === 'date') {
      return (a.date || '').localeCompare(b.date || '');
    } else {
      return a.gau.localeCompare(b.gau);
    }
  });

  // Export Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ORDEM': 1,
        'GAU': 'GAU-1024',
        'NOME DA DEMANDA': 'Exemplo: Pipeline de Carga CDC - Clientes',
        'SOLICITANTE': 'Maria Silva',
        'EQUIPE': 'Operações',
        'CATEGORIA': 'Ingestão',
        'DATA': '2026-08-15',
        'PRIORIDADE': '1 - Urgente'
      },
      {
        'ORDEM': 2,
        'GAU': 'GAU-2050',
        'NOME DA DEMANDA': 'Exemplo: Painel de Indicadores Financeiros FIDC',
        'SOLICITANTE': 'Carlos Oliveira',
        'EQUIPE': 'Finanças',
        'CATEGORIA': 'Dashboard',
        'DATA': '2026-08-20',
        'PRIORIDADE': '2 - Alta'
      },
      {
        'ORDEM': 3,
        'GAU': 'GAU-3090',
        'NOME DA DEMANDA': 'Exemplo: Endpoint de Webhook de Pagamentos PIX',
        'SOLICITANTE': 'Fernanda Costa',
        'EQUIPE': 'Operações',
        'CATEGORIA': 'API',
        'DATA': '2026-08-30',
        'PRIORIDADE': '3 - Média'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Backlog');
    XLSX.writeFile(wb, 'Modelo_Importacao_Backlog.xlsx');
  };

  // Process uploaded Excel / CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (!rawData || rawData.length === 0) {
          setImportError('O arquivo selecionado está vazio.');
          return;
        }

        const parsedItems: Omit<BacklogItem, 'id' | 'status'>[] = [];

        rawData.forEach((row, index) => {
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toString().trim().toUpperCase()] = row[key];
          });

          // Order de Tratativa
          let treatmentOrder = index + 1;
          const rawOrder = normalizedRow['ORDEM'] || normalizedRow['ORDEM DE TRATATIVA'] || normalizedRow['POSICAO'] || normalizedRow['POSIÇÃO'] || normalizedRow['FILA'] || normalizedRow['ITEM'];
          if (rawOrder && !isNaN(parseInt(rawOrder, 10))) {
            treatmentOrder = parseInt(rawOrder, 10);
          }

          const gau = (normalizedRow['GAU'] || normalizedRow['CODIGO'] || `GAU-${1000 + index}`).toString().trim();
          const title = (
            normalizedRow['NOME DA DEMANDA'] || 
            normalizedRow['NOME'] || 
            normalizedRow['NOME DEMANDA'] || 
            normalizedRow['DEMANDA'] || 
            normalizedRow['TITULO'] || 
            'Sem título'
          ).toString().trim();
          
          const requester = (
            normalizedRow['SOLICITANTE'] || 
            normalizedRow['RESPONSAVEL'] || 
            normalizedRow['DEMANDANTE'] || 
            'Não informado'
          ).toString().trim();

          const team = (
            normalizedRow['EQUIPE'] || 
            normalizedRow['AREA'] || 
            normalizedRow['SQUAD'] || 
            'Geral'
          ).toString().trim();

          // Category mapping (Ingestão, Dashboard, API, Outros)
          let category: BacklogItem['category'] = 'Ingestão';
          const rawCat = (normalizedRow['CATEGORIA'] || normalizedRow['TIPO'] || normalizedRow['CATEGORIA DA DEMANDA'] || '').toString().trim().toLowerCase();
          if (rawCat.includes('ingest') || rawCat.includes('pipe') || rawCat.includes('cdc') || rawCat.includes('etl')) {
            category = 'Ingestão';
          } else if (rawCat.includes('dash') || rawCat.includes('painel') || rawCat.includes('bi') || rawCat.includes('relat')) {
            category = 'Dashboard';
          } else if (rawCat.includes('api') || rawCat.includes('integ') || rawCat.includes('endpoint') || rawCat.includes('webh')) {
            category = 'API';
          } else if (rawCat) {
            category = 'Outros';
          }

          // Format Date
          let dateStr = new Date().toISOString().split('T')[0];
          const rawDate = normalizedRow['DATA'] || normalizedRow['PRAZO'] || normalizedRow['DATA DA DEMANDA'];
          if (rawDate) {
            if (rawDate instanceof Date) {
              dateStr = rawDate.toISOString().split('T')[0];
            } else if (typeof rawDate === 'string' && rawDate.includes('/')) {
              const parts = rawDate.split('/');
              if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (typeof rawDate === 'string' && rawDate.includes('-')) {
              dateStr = rawDate.trim();
            }
          }

          // Numbered Priority Mapping (1 - Urgente, 2 - Alta, 3 - Média, 4 - Baixa)
          let priority: BacklogItem['priority'] = '3 - Média';
          const rawPriority = (normalizedRow['PRIORIDADE'] || normalizedRow['PRIORITY'] || '').toString().trim().toLowerCase();
          if (rawPriority.includes('1') || rawPriority.includes('urg')) priority = '1 - Urgente';
          else if (rawPriority.includes('2') || rawPriority.includes('alt')) priority = '2 - Alta';
          else if (rawPriority.includes('3') || rawPriority.includes('med') || rawPriority.includes('méd')) priority = '3 - Média';
          else if (rawPriority.includes('4') || rawPriority.includes('baix')) priority = '4 - Baixa';

          const notes = (normalizedRow['OBSERVACOES'] || normalizedRow['NOTAS'] || '').toString().trim();

          if (title && title !== 'Sem título') {
            parsedItems.push({
              gau,
              title,
              requester,
              team,
              date: dateStr,
              priority,
              category,
              treatmentOrder,
              notes
            });
          }
        });

        if (parsedItems.length === 0) {
          setImportError('Nenhuma demanda válida encontrada no arquivo. Verifique o cabeçalho das colunas (GAU, NOME DA DEMANDA, SOLICITANTE, EQUIPE, CATEGORIA, DATA, PRIORIDADE).');
        } else {
          setParsedPreview(parsedItems);
        }
      } catch (err) {
        console.error('Error parsing excel file', err);
        setImportError('Erro ao ler arquivo Excel. Certifique-se de que é um formato válido (.xlsx, .xls ou .csv).');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirm Batch Import
  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) return;
    onAddBacklogItemsBatch(parsedPreview);
    showToast(`${parsedPreview.length} demandas importadas para o Backlog com sucesso!`);
    setIsImportModalOpen(false);
    setParsedPreview([]);
    setImportFileName('');
  };

  // Open Add/Edit Manual Modal
  const handleOpenManualAdd = () => {
    setEditingItem(null);
    const nextOrder = backlogItems.length + 1;
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      gau: `DEM-${Math.floor(1000 + Math.random() * 9000)}`,
      title: '',
      requester: currentSquadId === 'rpa' ? 'TI & Automação' : 'Operações & Atendimento',
      requesterArea: currentSquadId === 'rpa' ? 'TI & Automação' : 'Operações & Atendimento',
      team: currentSquadId === 'rpa' ? 'Squad RPA' : currentSquadId === 'operacoes' ? 'Squad Operações' : 'Squad Dados',
      date: defaultDate,
      priority: '3 - Média',
      category: 'Automação',
      treatmentOrder: nextOrder > 100 ? 100 : nextOrder,
      notes: '',
      status: 'Em Andamento',
      progress: 0
    });
    setIsManualModalOpen(true);
  };

  const handleOpenManualEdit = (item: BacklogItem) => {
    setEditingItem(item);
    setFormData({
      gau: item.gau || `DEM-${Math.floor(1000 + Math.random() * 9000)}`,
      title: item.title,
      requester: item.requesterArea || item.requester || '',
      requesterArea: item.requesterArea || item.requester || '',
      team: item.team,
      date: item.date || item.dueDate || new Date().toISOString().split('T')[0],
      priority: item.priority || '3 - Média',
      category: item.category || 'Automação',
      treatmentOrder: item.treatmentOrder || 1,
      notes: item.notes || '',
      status: item.status || 'Em Andamento',
      progress: typeof item.progress === 'number' ? item.progress : 0
    });
    setIsManualModalOpen(true);
  };

  // Save Manual Add/Edit
  const handleSaveManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const requesterAreaClean = formData.requesterArea.trim() || formData.requester.trim() || 'Área Demandante';

    if (editingItem) {
      onEditBacklogItem({
        ...editingItem,
        gau: formData.gau,
        title: formData.title.trim(),
        requester: requesterAreaClean,
        requesterArea: requesterAreaClean,
        team: formData.team,
        date: formData.date,
        dueDate: formData.date,
        priority: formData.priority,
        category: formData.category,
        treatmentOrder: Number(formData.treatmentOrder) || 1,
        notes: formData.notes.trim(),
        status: formData.status,
        progress: Number(formData.progress) || 0
      });
      showToast('Demanda atualizada com sucesso!');
    } else {
      onAddBacklogItem({
        gau: formData.gau.trim() || `DEM-${Math.floor(1000 + Math.random() * 9000)}`,
        title: formData.title.trim(),
        requester: requesterAreaClean,
        requesterArea: requesterAreaClean,
        team: formData.team,
        date: formData.date,
        dueDate: formData.date,
        priority: formData.priority,
        category: formData.category,
        treatmentOrder: Number(formData.treatmentOrder) || 1,
        notes: formData.notes.trim(),
        status: formData.status,
        progress: Number(formData.progress) || 0
      });
      showToast('Demanda cadastrada com sucesso!');
    }
    setIsManualModalOpen(false);
  };

  // Open Assign Modal
  const handleOpenAssignModal = (item: BacklogItem) => {
    setAssigningItem(item);
    if (resources.length > 0) {
      setSelectedResourceId(resources[0].id);
    }
    setSelectedPosition('current');
    if (item.team.includes('Fin')) setSelectedArea('Finanças');
    else if (item.team.includes('Op')) setSelectedArea('Operações');
    else setSelectedArea('Geral');
  };

  // Confirm Assign to Squad
  const handleConfirmAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningItem || !selectedResourceId) return;

    const resource = resources.find(r => r.id === selectedResourceId);
    onAssignToSquad(assigningItem, selectedResourceId, selectedPosition, selectedArea);
    
    showToast(`Demanda "${assigningItem.gau}" atribuída com sucesso para ${resource?.name || 'o integrante'}!`);
    setAssigningItem(null);
  };

  // Stats calculation
  const totalCount = backlogItems.length;
  const pendingCount = backlogItems.filter(i => i.status === 'Pendente').length;
  const assignedCount = backlogItems.filter(i => i.status === 'Atribuído').length;
  const urgentCount = backlogItems.filter(i => i.priority === '1 - Urgente' && i.status === 'Pendente').length;

  return (
    <div className="space-y-6">
      
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 size={18} className="text-emanapay-green" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 1. HEADER & TOP BANNER (Clean Light Theme matching application) */}
      <div className="bg-white text-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-emanapay-green/10 text-emanapay-green text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-emanapay-green/20 tracking-wider flex items-center gap-1">
                <Sparkles size={11} />
                Fila de Tratativa (Até 100 Casos)
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Campos: ORDEM (1-100), GAU, NOME, SOLICITANTE, EQUIPE, CATEGORIA, DATA, PRIORIDADE
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ListOrdered className="text-emanapay-green" size={24} />
              Backlog Geral de Demandas
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Organize até 100 casos enumerados conforme sua ordem de tratativa. Gerencie prioridade (1 a 4), categorias e distribuição para a Squad.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadTemplate}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200 transition-all shadow-2xs"
              title="Baixar planilha modelo de exemplo com colunas configuradas"
            >
              <Download size={15} />
              Baixar Modelo Excel
            </button>

            <button
              onClick={() => {
                setParsedPreview([]);
                setImportFileName('');
                setImportError('');
                setIsImportModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emanapay-green hover:bg-emerald-600 px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emanapay-green/10"
            >
              <FileSpreadsheet size={16} />
              Importar Excel
            </button>

            <button
              onClick={handleOpenManualAdd}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl border border-slate-200 transition-all"
            >
              <Plus size={16} />
              Nova Demanda
            </button>
          </div>

        </div>

        {/* Quick Counters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
              <ListOrdered size={12} className="text-emerald-600" />
              Capacidade da Fila
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{totalCount} <span className="text-xs font-normal text-slate-500">/ 100 casos</span></div>
          </div>
          
          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Aguardando Tratativa</div>
            <div className="text-xl font-black text-amber-900 mt-0.5">{pendingCount} <span className="text-xs font-normal text-amber-700">pendentes</span></div>
          </div>

          <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/60">
            <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700">Prioridade 1 (Urgente)</div>
            <div className="text-xl font-black text-rose-900 mt-0.5">{urgentCount} <span className="text-xs font-normal text-rose-700">no backlog</span></div>
          </div>

          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/60">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Atribuídas à Squad</div>
            <div className="text-xl font-black text-emerald-950 mt-0.5">{assignedCount} <span className="text-xs font-normal text-emerald-800">distribuídas</span></div>
          </div>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search Bar */}
          <div className="relative w-full lg:flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por GAU, nome da demanda, solicitante, equipe ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-emanapay-green focus:bg-white rounded-xl py-3 pl-10 pr-4 transition-all focus:ring-1 focus:ring-emanapay-green"
            />
          </div>

          {/* Sort & Count */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-700 focus:ring-1 focus:ring-emanapay-green"
              >
                <option value="order-asc">Ordem de Tratativa (#1 ➔ #100)</option>
                <option value="order-desc">Ordem de Tratativa (#100 ➔ #1)</option>
                <option value="priority-asc">Prioridade (1 - Urgente ➔ 4 - Baixa)</option>
                <option value="priority-desc">Prioridade (4 - Baixa ➔ 1 - Urgente)</option>
                <option value="date">Data de Prazo</option>
                <option value="gau">Código GAU</option>
              </select>
            </div>

            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-slate-100 px-2.5 py-2 rounded-lg border border-slate-200">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
            </span>

            {(requesterFilter !== 'all' || teamFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || searchTerm !== '') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRequesterFilter('all');
                  setTeamFilter('all');
                  setCategoryFilter('all');
                  setPriorityFilter('all');
                  setStatusFilter('all');
                }}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg transition-all"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 border-t border-slate-100 pt-4">
          
          {/* Categoria Filter (Ingestão, Dashboard, API) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white font-medium"
            >
              <option value="all">Todas Categorias 📂</option>
              <option value="Ingestão">⚙️ Ingestão</option>
              <option value="Dashboard">📊 Dashboard</option>
              <option value="API">🔌 API</option>
              <option value="Outros">🧩 Outros</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Prioridade:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white font-medium"
            >
              <option value="all">Todas Prioridades (1 a 4) 🚨</option>
              <option value="1 - Urgente">1 - Urgente 🔥</option>
              <option value="2 - Alta">2 - Alta 🔴</option>
              <option value="3 - Média">3 - Média 🟡</option>
              <option value="4 - Baixa">4 - Baixa 🟢</option>
            </select>
          </div>

          {/* Solicitante Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solicitante:</label>
            <select
              value={requesterFilter}
              onChange={(e) => setRequesterFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white font-medium"
            >
              <option value="all">Todos Solicitantes 👥</option>
              {uniqueRequesters.map(req => (
                <option key={req} value={req}>{req}</option>
              ))}
            </select>
          </div>

          {/* Equipe Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipe / Área:</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white font-medium"
            >
              <option value="all">Todas Equipes 🏢</option>
              {uniqueTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green transition-all focus:bg-white font-medium"
            >
              <option value="all">Todos Status 📌</option>
              <option value="Pendente">⏳ Pendente</option>
              <option value="Atribuído">✅ Atribuído para Squad</option>
            </select>
          </div>

        </div>
      </div>

      {/* 3. BACKLOG ITEMS LIST */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Layers size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Nenhuma demanda encontrada</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Não foram encontradas demandas com os filtros selecionados ou seu backlog ainda está vazio. Clique em "Importar Excel" para subir suas demandas em lote!
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => {
                  setParsedPreview([]);
                  setImportFileName('');
                  setIsImportModalOpen(true);
                }}
                className="text-xs font-bold text-emerald-950 bg-emanapay-green hover:bg-emerald-400 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                <FileSpreadsheet size={15} />
                Importar Planilha Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredItems.map(item => {
              const isPending = item.status === 'Pendente';
              const pStr = item.priority || '3 - Média';
              const catStr = item.category || 'Ingestão';
              
              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isPending ? 'border-slate-200 hover:border-slate-300' : 'border-emerald-200 bg-emerald-50/10'
                  }`}
                >
                  {/* Left Column Info */}
                  <div className="flex-1 space-y-2">
                    
                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      
                      {!isOperacoesOrRpa && (
                        /* Ordem de Tratativa Badge & Up/Down Controls */
                        <div className="flex items-center gap-1 bg-emerald-100/80 text-emerald-950 font-black text-[11px] px-2.5 py-0.5 rounded-lg border border-emerald-300/80 shadow-xs">
                          <Hash size={12} className="text-emerald-700" />
                          <span>#{item.treatmentOrder || 1}º Tratativa</span>
                          <div className="flex items-center gap-0.5 ml-1 border-l border-emerald-300 pl-1">
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(item, 'up')}
                              disabled={(item.treatmentOrder || 1) <= 1}
                              className="hover:bg-emerald-200 p-0.5 rounded disabled:opacity-30 transition-all text-emerald-900"
                              title="Subir posição na ordem de tratativa"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(item, 'down')}
                              disabled={(item.treatmentOrder || 1) >= 100}
                              className="hover:bg-emerald-200 p-0.5 rounded disabled:opacity-30 transition-all text-emerald-900"
                              title="Descer posição na ordem de tratativa"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* GAU or CODE Badge */}
                      <span className="font-mono text-[11px] font-extrabold bg-slate-900 text-white px-2.5 py-0.5 rounded-md shadow-xs">
                        {item.gau || `DEM-${item.id.slice(0, 4)}`}
                      </span>

                      {/* Area Demandante Badge */}
                      <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Users size={11} />
                        Área Demandante: {item.requesterArea || item.requester || 'Não informada'}
                      </span>

                      {!isOperacoesOrRpa && (
                        <>
                          {/* Numbered Priority Badge */}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                            pStr.includes('1') || pStr.includes('Urgente')
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : pStr.includes('2') || pStr.includes('Alta')
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : pStr.includes('3') || pStr.includes('Média')
                                  ? 'bg-sky-100 text-sky-800 border-sky-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            Prioridade: {pStr}
                          </span>

                          {/* Category Badge */}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            catStr === 'Ingestão' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : catStr === 'Dashboard'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : catStr === 'API'
                                  ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {catStr === 'Ingestão' && <Database size={11} />}
                            {catStr === 'Dashboard' && <BarChart3 size={11} />}
                            {catStr === 'API' && <Code2 size={11} />}
                            {catStr === 'Outros' && <Tag size={11} />}
                            <span>Categoria: {catStr}</span>
                          </span>
                        </>
                      )}

                      {/* Status Badge */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ml-auto md:ml-0 ${
                        item.status === 'Concluído'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : item.status === 'Em Andamento'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : item.status === 'Impedido'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : item.status === 'Pausado'
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {item.status === 'Concluído' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        Status: {item.status || 'Pendente'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                      {item.title}
                    </h3>

                    {/* Progress Bar for % de Evolução */}
                    {typeof item.progress === 'number' && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <TrendingUp size={12} className="text-emerald-600" />
                            Evolução da Demanda
                          </span>
                          <span className="text-emerald-700 font-extrabold bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                            {item.progress}% concluído
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta info: Solicitante & Data / Prazo */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <User size={13} className="text-slate-400" />
                        <span>Área Demandante: <strong className="text-slate-700 font-semibold">{item.requesterArea || item.requester}</strong></span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        <span>Prazo: <strong className="text-slate-700 font-semibold">{(item.date || item.dueDate || '').split('-').reverse().join('/')}</strong></span>
                      </div>
                    </div>

                    {/* Notes / Description if present */}
                    {item.notes && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        "{item.notes}"
                      </p>
                    )}

                  </div>

                  {/* Right Column Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-end">
                    
                    {!isOperacoesOrRpa ? (
                      /* Action: Distribuir para Squad (Dados) */
                      <button
                        onClick={() => handleOpenAssignModal(item)}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-3.5 py-2 rounded-xl transition-all shadow-sm hover:shadow-emerald-600/20"
                        title="Distribuir essa demanda do backlog para um integrante da Squad"
                      >
                        <UserPlus size={15} />
                        {isPending ? 'Distribuir para Squad' : 'Redistribuir'}
                      </button>
                    ) : (
                      /* Action: Editar Demanda (Operações/RPA) */
                      <button
                        onClick={() => handleOpenManualEdit(item)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-xl transition-all shadow-xs"
                        title="Atualizar status, prazo e % de evolução da demanda"
                      >
                        <Edit3 size={14} />
                        Editar Demanda
                      </button>
                    )}

                    {/* Edit icon for Dados */}
                    {!isOperacoesOrRpa && (
                      <button
                        onClick={() => handleOpenManualEdit(item)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                        title="Editar detalhes da demanda"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm(`Deseja remover a demanda "${item.gau} - ${item.title}" do backlog?`)) {
                          onDeleteBacklogItem(item.id);
                          showToast('Demanda removida do Backlog.');
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Excluir demanda"
                    >
                      <Trash2 size={15} />
                    </button>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EXCEL IMPORT MODAL */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 border border-slate-150 animate-scale-up">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emanapay-green/15 text-emerald-950 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Importar Demandas via Excel</h3>
                  <p className="text-xs text-slate-400">Envie um arquivo (.xlsx, .xls ou .csv) no layout esperado</p>
                </div>
              </div>

              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template column guideline box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Layout das Colunas do Excel:</span>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Download size={13} />
                  Baixar Modelo
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-600">
                <span className="bg-white px-2 py-1 rounded border border-slate-200">GAU</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">NOME DA DEMANDA</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">SOLICITANTE</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">EQUIPE</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">CATEGORIA</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">DATA</span>
                <span className="bg-white px-2 py-1 rounded border border-slate-200">PRIORIDADE</span>
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div className="relative border-2 border-dashed border-slate-200 hover:border-emanapay-green bg-slate-50/50 hover:bg-white rounded-2xl p-8 text-center transition-all cursor-pointer">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {importFileName ? `Arquivo Selecionado: ${importFileName}` : 'Clique ou arraste a planilha Excel (.xlsx, .csv) aqui'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Formatos suportados: Microsoft Excel (.xlsx, .xls), CSV</p>
            </div>

            {/* Error Message */}
            {importError && (
              <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Preview of Parsed Items */}
            {parsedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Pré-visualização das Demandas Encontradas ({parsedPreview.length}):</span>
                  <span className="text-emerald-700 font-extrabold">Pronto para importar</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/30">
                  {parsedPreview.map((item, idx) => (
                    <div key={idx} className="p-2.5 text-xs flex justify-between items-center gap-2">
                      <div className="truncate flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded">{item.gau}</span>
                        <span className="font-semibold text-slate-800 truncate">{item.title}</span>
                      </div>
                      <div className="shrink-0 text-[10px] text-slate-500">
                        {item.category} • {item.priority}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={parsedPreview.length === 0}
                onClick={handleConfirmImport}
                className="text-xs font-bold text-emerald-950 bg-emanapay-green hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-all shadow-md"
              >
                Confirmar Importação ({parsedPreview.length})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MANUAL ADD / EDIT MODAL */}
      {/* ========================================================================= */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-slate-150 animate-scale-up">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-800">
                {editingItem ? 'Editar Demanda do Backlog' : 'Nova Demanda no Backlog'}
              </h3>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualItem} className="space-y-4">
              
              {isOperacoesOrRpa ? (
                <>
                  {/* 1. TÍTULO DA DEMANDA */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      1. Título da Demanda *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      placeholder="Ex: Automação de Extratos Bancários ou Ajuste de Fila de Disputas"
                    />
                  </div>

                  {/* 2. DESCRIÇÃO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      2. Descrição *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      placeholder="Descreva o objetivo da demanda, fluxo ou problema a ser resolvido..."
                    />
                  </div>

                  {/* 3. ÁREA DEMANDANTE & 4. PRAZO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        3. Área Demandante *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.requesterArea}
                        onChange={(e) => setFormData({ ...formData, requesterArea: e.target.value, requester: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        placeholder="Ex: Financeiro, Atendimento, Compliance, Operations"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        4. Prazo (Data Alvo) *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* 5. STATUS & 6. % DE EVOLUÇÃO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        5. Status *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as BacklogItem['status'] })}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      >
                        <option value="Pendente">⏳ Pendente</option>
                        <option value="Em Andamento">⚡ Em Andamento</option>
                        <option value="Pausado">⏸️ Pausado</option>
                        <option value="Impedido">🚨 Impedido</option>
                        <option value="Concluído">✅ Concluído</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          6. % de Evolução *
                        </label>
                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                          {formData.progress}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={formData.progress}
                          onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value, 10) || 0 })}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.progress}
                          onChange={(e) => setFormData({ ...formData, progress: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                          className="w-16 text-center text-xs font-extrabold bg-slate-50 border border-slate-200 rounded-xl p-2"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Ordem (1-100) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={formData.treatmentOrder}
                        onChange={(e) => setFormData({ ...formData, treatmentOrder: parseInt(e.target.value, 10) || 1 })}
                        className="w-full text-xs font-black text-emerald-950 bg-emerald-50/60 border border-emerald-300 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Código GAU *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.gau}
                        onChange={(e) => setFormData({ ...formData, gau: e.target.value })}
                        className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                        placeholder="Ex: GAU-1024"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Prioridade (1 - 4) *
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                      >
                        <option value="1 - Urgente">1 - Urgente 🔥</option>
                        <option value="2 - Alta">2 - Alta 🔴</option>
                        <option value="3 - Média">3 - Média 🟡</option>
                        <option value="4 - Baixa">4 - Baixa 🟢</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Categoria *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                      >
                        <option value="Ingestão">⚙️ Ingestão</option>
                        <option value="Dashboard">📊 Dashboard</option>
                        <option value="API">🔌 API</option>
                        <option value="Outros">🧩 Outros</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Nome da Demanda *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                      placeholder="Ex: Pipeline CDC de Clientes Natura"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Solicitante *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.requester}
                        onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                        placeholder="Ex: Sérgio Ramos"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Equipe / Área *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.team}
                        onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                        placeholder="Ex: Operações, Finanças"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Data Alvo / Prazo *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Observações / Detalhes (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                      placeholder="Contexto adicional da solicitação..."
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="text-xs font-bold text-emerald-950 bg-emanapay-green hover:bg-emerald-400 px-5 py-2.5 rounded-xl transition-all shadow-md"
                >
                  Salvar Demanda
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ASSIGN TO SQUAD MODAL */}
      {/* ========================================================================= */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-slate-150 animate-scale-up">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Distribuir Demanda para a Squad</h3>
                  <p className="text-xs text-slate-400">Atribua esta demanda a um integrante disponível</p>
                </div>
              </div>

              <button 
                onClick={() => setAssigningItem(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Item summary card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {assigningItem.gau}
                </span>
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Prioridade: {assigningItem.priority}
                </span>
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Categoria: {assigningItem.category || 'Ingestão'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-800">{assigningItem.title}</h4>
              <div className="text-[11px] text-slate-500">
                Solicitante: <strong>{assigningItem.requester}</strong> • Prazo: <strong>{assigningItem.date.split('-').reverse().join('/')}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmAssign} className="space-y-4">
              
              {/* Select Resource */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Selecione o Integrante da Squad *
                </label>
                <select
                  required
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green focus:bg-white"
                >
                  {resources.map(res => (
                    <option key={res.id} value={res.id}>
                      {res.name} ({res.role}) {res.status === 'Inativo' ? '⚠️ [INATIVO - Fora de Operações]' : ''} — {res.currentTask ? `Atual: ${res.currentTask.title}` : 'Sem demanda atual'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task position */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Posição no Quadro da Squad *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`border p-3 rounded-2xl cursor-pointer transition-all flex flex-col gap-1 ${
                    selectedPosition === 'current' ? 'border-emanapay-green bg-emerald-50/50 shadow-xs' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="position"
                      value="current"
                      checked={selectedPosition === 'current'}
                      onChange={() => setSelectedPosition('current')}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      ⚡ Demanda Atual
                    </span>
                    <span className="text-[10px] text-slate-500">Entra em execução imediata</span>
                  </label>

                  <label className={`border p-3 rounded-2xl cursor-pointer transition-all flex flex-col gap-1 ${
                    selectedPosition === 'next' ? 'border-emanapay-green bg-emerald-50/50 shadow-xs' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="position"
                      value="next"
                      checked={selectedPosition === 'next'}
                      onChange={() => setSelectedPosition('next')}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      📅 Demanda Futura
                    </span>
                    <span className="text-[10px] text-slate-500">Aguardando término da atual</span>
                  </label>
                </div>
              </div>

              {/* Area */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Área da Demanda *
                </label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value as any)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emanapay-green"
                >
                  <option value="Operações">Operações ⚙️</option>
                  <option value="Geral">Geral 🧩</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningItem(null)}
                  className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  Confirmar Distribuição
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
