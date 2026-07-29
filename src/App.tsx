import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Resource, Task, DpoMeetingLog, CompletedTask, BacklogItem, SquadId, TriageItem } from './types';
import { 
  SQUADS_CONFIG, 
  initialResourcesSquadDados, 
  initialResourcesSquadOperacoes, 
  initialResourcesSquadRPA,
  initialMeetingLogs, 
  initialCompletedTasks, 
  initialBacklogItems,
  initialBacklogItemsSquadOperacoes,
  initialBacklogItemsSquadRPA,
  initialTriageItems
} from './defaultData';
import Sidebar from './components/Sidebar';
import DashboardStats from './components/DashboardStats';
import ResourceCard from './components/ResourceCard';
import DpoSyncMode from './components/DpoSyncMode';
import ResourceFormModal from './components/ResourceFormModal';
import TaskFormModal from './components/TaskFormModal';
import DpoLogs from './components/DpoLogs';
import CompletedTasksList from './components/CompletedTasksList';
import BacklogView from './components/BacklogView';
import LinearDemandsView from './components/LinearDemandsView';
import MultiSquadDashboard from './components/MultiSquadDashboard';
import TriageView from './components/TriageView';
import JiraIntegrationModal from './components/JiraIntegrationModal';
import PrintReport from './components/PrintReport';
import CadenceBanner, { SprintConfig, QuarterConfig } from './components/CadenceBanner';
import { 
  Users, 
  Play, 
  Plus, 
  Search, 
  History,
  LayoutDashboard,
  Sparkles,
  CheckCircle2,
  FileText,
  Layers,
  Trash2,
  AlertTriangle,
  Menu,
  Database,
  Cog,
  Bot,
  Layers3,
  PieChart,
  Inbox,
  Zap
} from 'lucide-react';

const loadSquadData = (squadId: SquadId) => {
  // Resources
  let resKey = `squad_${squadId}_resources`;
  let savedRes = localStorage.getItem(resKey);
  if (!savedRes && squadId === 'dados') {
    savedRes = localStorage.getItem('squad_resources');
  }
  let loadedResources: Resource[] = [];
  if (savedRes) {
    try { loadedResources = JSON.parse(savedRes); } catch (e) { console.error(e); }
  }
  if (!loadedResources || loadedResources.length === 0) {
    if (squadId === 'dados') loadedResources = initialResourcesSquadDados;
    else if (squadId === 'operacoes') loadedResources = initialResourcesSquadOperacoes;
    else if (squadId === 'rpa') loadedResources = initialResourcesSquadRPA;
  }

  // Backlog
  let backlogKey = `squad_${squadId}_backlog_items`;
  let savedBacklog = localStorage.getItem(backlogKey);
  if (!savedBacklog && squadId === 'dados') {
    savedBacklog = localStorage.getItem('squad_backlog_items');
  }
  let loadedBacklog: BacklogItem[] = [];
  if (savedBacklog) {
    try { loadedBacklog = JSON.parse(savedBacklog); } catch (e) { console.error(e); }
  }

  // Completed
  let completedKey = `squad_${squadId}_completed_tasks`;
  let savedCompleted = localStorage.getItem(completedKey);
  if (!savedCompleted && squadId === 'dados') {
    savedCompleted = localStorage.getItem('squad_completed_tasks');
  }
  let loadedCompleted: CompletedTask[] = [];
  if (savedCompleted) {
    try { loadedCompleted = JSON.parse(savedCompleted); } catch (e) { console.error(e); }
  }

  // Logs
  let logsKey = `squad_${squadId}_meeting_logs`;
  let savedLogs = localStorage.getItem(logsKey);
  if (!savedLogs && squadId === 'dados') {
    savedLogs = localStorage.getItem('squad_meeting_logs');
  }
  let loadedLogs: DpoMeetingLog[] = [];
  if (savedLogs) {
    try { loadedLogs = JSON.parse(savedLogs); } catch (e) { console.error(e); }
  }

  return {
    resources: loadedResources,
    backlogItems: loadedBacklog,
    completedTasks: loadedCompleted,
    meetingLogs: loadedLogs
  };
};

export default function App() {
  // Multi-Squad Active Selection
  const [currentSquadId, setCurrentSquadId] = useState<SquadId>('dados');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Active Squad Data state
  const [resources, setResources] = useState<Resource[]>([]);
  const [meetingLogs, setMeetingLogs] = useState<DpoMeetingLog[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'board' | 'backlog' | 'completed' | 'logs' | 'triage'>('triage');

  // Triage & Jira Integration state
  const [isJiraHubOpen, setIsJiraHubOpen] = useState(false);
  const [triageItems, setTriageItems] = useState<TriageItem[]>(() => {
    const saved = localStorage.getItem('jira_triage_items');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return initialTriageItems;
  });

  const saveTriageState = (updated: TriageItem[]) => {
    setTriageItems(updated);
    localStorage.setItem('jira_triage_items', JSON.stringify(updated));
  };

  // Compute aggregated data for all 3 squads for MultiSquadDashboard
  const allSquadsData = React.useMemo(() => {
    return {
      dados: currentSquadId === 'dados'
        ? { squadId: 'dados' as SquadId, resources, backlogItems, completedTasks }
        : { squadId: 'dados' as SquadId, ...loadSquadData('dados') },
      operacoes: currentSquadId === 'operacoes'
        ? { squadId: 'operacoes' as SquadId, resources, backlogItems, completedTasks }
        : { squadId: 'operacoes' as SquadId, ...loadSquadData('operacoes') },
      rpa: currentSquadId === 'rpa'
        ? { squadId: 'rpa' as SquadId, resources, backlogItems, completedTasks }
        : { squadId: 'rpa' as SquadId, ...loadSquadData('rpa') }
    };
  }, [currentSquadId, resources, backlogItems, completedTasks]);
  
  // Sprint config state for Dados
  const [sprintConfig, setSprintConfig] = useState<SprintConfig>(() => {
    const saved = localStorage.getItem('sprint_dados_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      sprintName: 'Sprint 15d',
      startDate: '2026-07-20',
      endDate: '2026-08-03'
    };
  });

  // Quarter config state for Operações
  const [quarterConfig, setQuarterConfig] = useState<QuarterConfig>(() => {
    const saved = localStorage.getItem('quarter_operacoes_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      quarterLabel: 'Q3 2026',
      startDate: '2026-07-01',
      endDate: '2026-09-30'
    };
  });

  const handleUpdateSprintConfig = (newConfig: SprintConfig) => {
    setSprintConfig(newConfig);
    localStorage.setItem('sprint_dados_config', JSON.stringify(newConfig));
  };

  const handleUpdateQuarterConfig = (newConfig: QuarterConfig) => {
    setQuarterConfig(newConfig);
    localStorage.setItem('quarter_operacoes_config', JSON.stringify(newConfig));
  };

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'A Fazer' | 'Em Andamento' | 'Impedido' | 'Concluído'>('all');

  // Interactive Mode
  const [isDpoSyncMode, setIsDpoSyncMode] = useState(false);
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState(false);
  const [showClearToast, setShowClearToast] = useState(false);

  // Clear modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const currentSquadInfo = SQUADS_CONFIG.find(s => s.id === currentSquadId) || SQUADS_CONFIG[0];

  const handleExportPDF = () => {
    window.print();
  };

  // Modals state
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedResIdForTask, setSelectedResIdForTask] = useState<string>('');
  const [selectedTaskType, setSelectedTaskType] = useState<'current' | 'next'>('current');
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);

  // Load active squad data on initial mount & clean mock demands
  useEffect(() => {
    // One-time cleanup of fictional/mock demands & tasks across all squads
    const MOCK_CLEARED_KEY = 'v6_clean_mock_demands_data';
    if (!localStorage.getItem(MOCK_CLEARED_KEY)) {
      ['dados', 'operacoes', 'rpa'].forEach(id => {
        localStorage.setItem(`squad_${id}_backlog_items`, JSON.stringify([]));
        localStorage.removeItem(`squad_${id}_backlog`);
        const resKey = `squad_${id}_resources`;
        const savedRes = localStorage.getItem(resKey);
        if (savedRes) {
          try {
            const parsedRes: Resource[] = JSON.parse(savedRes);
            const cleanedRes = parsedRes.map(r => ({ ...r, currentTask: null, nextTask: null }));
            localStorage.setItem(resKey, JSON.stringify(cleanedRes));
          } catch (e) { console.error(e); }
        }
      });
      localStorage.setItem('squad_backlog_items', JSON.stringify([]));
      localStorage.setItem('jira_triage_items', JSON.stringify([]));
      localStorage.setItem(MOCK_CLEARED_KEY, 'true');
    }

    const savedSquadId = (localStorage.getItem('squad_active_id') as SquadId) || 'dados';
    setCurrentSquadId(savedSquadId);
    const data = loadSquadData(savedSquadId);
    setResources(data.resources);
    setBacklogItems(data.backlogItems);
    setCompletedTasks(data.completedTasks);
    setMeetingLogs(data.meetingLogs);
  }, []);

  // Save to LocalStorage helpers for ACTIVE squad
  const saveResourcesState = (updated: Resource[]) => {
    setResources(updated);
    localStorage.setItem(`squad_${currentSquadId}_resources`, JSON.stringify(updated));
    if (currentSquadId === 'dados') {
      localStorage.setItem('squad_resources', JSON.stringify(updated));
    }
  };

  const saveLogsState = (updated: DpoMeetingLog[]) => {
    setMeetingLogs(updated);
    localStorage.setItem(`squad_${currentSquadId}_meeting_logs`, JSON.stringify(updated));
    if (currentSquadId === 'dados') {
      localStorage.setItem('squad_meeting_logs', JSON.stringify(updated));
    }
  };

  const saveCompletedTasksState = (updated: CompletedTask[]) => {
    setCompletedTasks(updated);
    localStorage.setItem(`squad_${currentSquadId}_completed_tasks`, JSON.stringify(updated));
    if (currentSquadId === 'dados') {
      localStorage.setItem('squad_completed_tasks', JSON.stringify(updated));
    }
  };

  const saveBacklogItemsState = (updated: BacklogItem[]) => {
    setBacklogItems(updated);
    localStorage.setItem(`squad_${currentSquadId}_backlog_items`, JSON.stringify(updated));
    if (currentSquadId === 'dados') {
      localStorage.setItem('squad_backlog_items', JSON.stringify(updated));
    }
  };

  // Track processed Jira Webhook Event IDs to avoid duplicate processing
  const processedJiraEventIds = React.useRef<Set<string>>(new Set());

  // Function to process a Jira event from Webhook or Simulator
  const processJiraEvent = React.useCallback((evt: {
    id?: string;
    event: string;
    jiraKey: string;
    summary: string;
    description?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterArea?: string;
    issueType?: string;
    priority?: string;
    category?: string;
    squad?: SquadId;
    status?: string;
    receivedAt?: string;
  }) => {
    const nowStr = evt.receivedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const targetSquadId = evt.squad || 'dados';
    const squadName = targetSquadId === 'dados' ? 'Squad de Dados' : targetSquadId === 'operacoes' ? 'Squad de Operações' : 'Squad de RPA';

    if (evt.event === 'jira:issue_created' || evt.status === 'Triagem') {
      // 1. NOVA SOLICITAÇÃO NA TRIAGEM
      setTriageItems(prev => {
        const exists = prev.some(item => item.jiraKey === evt.jiraKey);
        if (exists) {
          return prev.map(item => item.jiraKey === evt.jiraKey ? {
            ...item,
            title: evt.summary,
            description: evt.description || item.description,
            requesterName: evt.requesterName || item.requesterName,
            status: 'Pendente' as const
          } : item);
        }
        const newTriage: TriageItem = {
          id: `triage-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          jiraKey: evt.jiraKey,
          jiraUrl: `https://jira.empresa.com/browse/${evt.jiraKey}`,
          title: evt.summary,
          description: evt.description || 'Solicitação aberta via formulário no Jira.',
          requesterName: evt.requesterName || 'Solicitante Jira',
          requesterEmail: evt.requesterEmail || 'solicitante@empresa.com',
          requesterArea: evt.requesterArea || 'Área de Negócios',
          issueType: evt.issueType || 'Formulário Jira',
          priority: (evt.priority as any) || '2 - Alta',
          category: (evt.category as any) || 'Automação',
          suggestedSquad: targetSquadId,
          createdAt: nowStr,
          status: 'Pendente'
        };
        const updated = [newTriage, ...prev];
        localStorage.setItem('jira_triage_items', JSON.stringify(updated));
        return updated;
      });
    } else if (evt.event === 'jira:issue_updated' || evt.status === 'Em Andamento' || evt.squad) {
      // 2. ENCAMINHAMENTO PARA SQUAD NO JIRA -> Atualiza Triagem e cria/atualiza card no Board da Squad
      setTriageItems(prev => {
        const updated = prev.map(item => 
          item.jiraKey === evt.jiraKey 
            ? { ...item, status: 'Triado' as const, triagedSquadId: targetSquadId, triagedAt: nowStr }
            : item
        );
        localStorage.setItem('jira_triage_items', JSON.stringify(updated));
        return updated;
      });

      const newBacklogItem: BacklogItem = {
        id: `backlog-jira-${evt.jiraKey}-${Date.now()}`,
        gau: evt.jiraKey,
        title: evt.summary,
        requester: evt.requesterName || 'Automação Jira',
        team: squadName,
        date: new Date().toISOString().split('T')[0],
        priority: (evt.priority as any) || '2 - Alta',
        category: (evt.category as any) || 'Dashboard',
        treatmentOrder: 1,
        status: 'Pendente',
        notes: evt.description || 'Encaminhado para a squad via transição no Jira.',
        jiraMetadata: {
          jiraKey: evt.jiraKey,
          jiraUrl: `https://jira.empresa.com/browse/${evt.jiraKey}`,
          reporterName: evt.requesterName || 'Automação Jira',
          reporterEmail: evt.requesterEmail,
          issueType: evt.issueType || 'Formulário Jira',
          jiraStatus: 'Encaminhado para Squad',
          squadTarget: targetSquadId,
          receivedAt: nowStr
        }
      };

      if (targetSquadId === currentSquadId) {
        setBacklogItems(prev => {
          const filtered = prev.filter(b => b.gau !== evt.jiraKey);
          const updated = [newBacklogItem, ...filtered];
          localStorage.setItem(`squad_${currentSquadId}_backlog_items`, JSON.stringify(updated));
          return updated;
        });
      } else {
        const savedKey = `squad_${targetSquadId}_backlog_items`;
        const savedItems = localStorage.getItem(savedKey);
        let targetBacklog: BacklogItem[] = [];
        if (savedItems) {
          try { targetBacklog = JSON.parse(savedItems); } catch (e) { console.error(e); }
        }
        const filtered = targetBacklog.filter(b => b.gau !== evt.jiraKey);
        localStorage.setItem(savedKey, JSON.stringify([newBacklogItem, ...filtered]));
      }
    } else if (evt.event === 'jira:issue_resolved' || evt.status === 'Concluído') {
      // 3. CARD CONCLUÍDO NO JIRA -> Atualiza Triagem, remove do Backlog ativo e move para Concluídos
      setTriageItems(prev => {
        const updated = prev.map(item => 
          item.jiraKey === evt.jiraKey 
            ? { ...item, status: 'Triado' as const, triagedSquadId: targetSquadId, triagedAt: nowStr }
            : item
        );
        localStorage.setItem('jira_triage_items', JSON.stringify(updated));
        return updated;
      });

      // Remove from backlog if exists
      if (targetSquadId === currentSquadId) {
        setBacklogItems(prev => {
          const updated = prev.filter(b => b.gau !== evt.jiraKey);
          localStorage.setItem(`squad_${currentSquadId}_backlog_items`, JSON.stringify(updated));
          return updated;
        });
      } else {
        const savedKey = `squad_${targetSquadId}_backlog_items`;
        const savedItems = localStorage.getItem(savedKey);
        if (savedItems) {
          try {
            const list: BacklogItem[] = JSON.parse(savedItems);
            const filtered = list.filter(b => b.gau !== evt.jiraKey);
            localStorage.setItem(savedKey, JSON.stringify(filtered));
          } catch (e) { console.error(e); }
        }
      }

      // Add to completed tasks
      const newCompleted: CompletedTask = {
        id: `comp-jira-${evt.jiraKey}-${Date.now()}`,
        taskTitle: `${evt.summary} (${evt.jiraKey})`,
        taskDescription: evt.description || 'Demanda concluída no Jira e resolvida no fluxo da Squad.',
        area: 'Geral',
        completedBy: squadName,
        resourceId: 'jira-sync',
        dueDate: new Date().toISOString().split('T')[0],
        completionDate: new Date().toISOString().split('T')[0],
        gains: 'Concluído e validado automaticamente via Jira Webhook',
        requesterArea: evt.requesterArea || 'Atendimento Jira'
      };

      if (targetSquadId === currentSquadId) {
        setCompletedTasks(prev => {
          const filtered = prev.filter(c => !c.taskTitle.includes(evt.jiraKey));
          const updated = [newCompleted, ...filtered];
          localStorage.setItem(`squad_${currentSquadId}_completed_tasks`, JSON.stringify(updated));
          return updated;
        });
      } else {
        const savedKey = `squad_${targetSquadId}_completed_tasks`;
        const savedItems = localStorage.getItem(savedKey);
        let targetCompleted: CompletedTask[] = [];
        if (savedItems) {
          try { targetCompleted = JSON.parse(savedItems); } catch (e) { console.error(e); }
        }
        const filtered = targetCompleted.filter(c => !c.taskTitle.includes(evt.jiraKey));
        localStorage.setItem(savedKey, JSON.stringify([newCompleted, ...filtered]));
      }
    }
  }, [currentSquadId]);

  // Helpers para mapear squad do card
  const parseSquadIdFromCard = (squadInput?: string): SquadId => {
    if (!squadInput) return 'dados';
    const lower = squadInput.toLowerCase().trim();
    if (lower.includes('dados') || lower === 'squad de dados') return 'dados';
    if (lower.includes('opera') || lower === 'squad de operações' || lower === 'squad de operacoes') return 'operacoes';
    if (lower.includes('rpa') || lower === 'squad de rpa') return 'rpa';
    return 'dados';
  };

  const parseSquadNameFromCard = (squadInput?: string): string => {
    const squadId = parseSquadIdFromCard(squadInput);
    if (squadId === 'dados') return 'Squad de Dados';
    if (squadId === 'operacoes') return 'Squad de Operações';
    return 'Squad de RPA';
  };

  // Estados e sincronizador proativo via Supabase Edge Function 'consultar-cards-jira'
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [lastJiraSyncTime, setLastJiraSyncTime] = useState<string>(() => {
    return localStorage.getItem('last_jira_sync_time') || '--:--:--';
  });

  const sincronizarFilaJira = React.useCallback(async () => {
    setIsSyncingJira(true);
    let cards: any[] = [];

    try {
      // 1. Invocar Supabase Edge Function 'consultar-cards-jira'
      const { data, error } = await supabase.functions.invoke('consultar-cards-jira');
      if (!error && data) {
        cards = data.cards || data.data || (Array.isArray(data) ? data : []);
      } else {
        if (error) console.warn('Supabase edge function invoke notice:', error);
        // Fallback local caso o Supabase não esteja provisionado
        const edgeUrl = localStorage.getItem('supabase_edge_function_url') || '/api/jira/consultar-cards-jira';
        const res = await fetch(edgeUrl);
        if (res.ok) {
          const json = await res.json();
          cards = json.cards || json.data || [];
        }
      }
    } catch (err) {
      console.warn('Erro ao chamar Supabase Edge Function, tentando fallback local:', err);
      try {
        const edgeUrl = localStorage.getItem('supabase_edge_function_url') || '/api/jira/consultar-cards-jira';
        const res = await fetch(edgeUrl);
        if (res.ok) {
          const json = await res.json();
          cards = json.cards || json.data || [];
        }
      } catch (e) {
        console.error('Falha em todas as tentativas de consulta ao Jira:', e);
      }
    }

    // 2. Limpar todas as colunas/filas antes de repovoar e aplicar as regras estritas de De/Para
    const newTriageItems: TriageItem[] = [];
    const newDadosBacklog: BacklogItem[] = [];
    const newOperacoesBacklog: BacklogItem[] = [];
    const newRpaBacklog: BacklogItem[] = [];

    const newDadosCompleted: CompletedTask[] = [];
    const newOperacoesCompleted: CompletedTask[] = [];
    const newRpaCompleted: CompletedTask[] = [];

    if (Array.isArray(cards)) {
      cards.forEach((card: any, idx: number) => {
        const rawStatus = (card.status || card.fields?.status?.name || '').toString().trim();
        const rawCatStatus = (card.categoriaStatus || card.fields?.status?.statusCategory?.name || '').toString().trim();
        const rawSquad = (card.squad || card.squadTarget || card.fields?.customfield_squad || '').toString().trim();

        const statusLower = rawStatus.toLowerCase();
        const catStatusLower = rawCatStatus.toLowerCase();
        const squadLower = rawSquad.toLowerCase();

        const jiraKey = card.key || card.jiraKey || card.id || `JIRA-${100 + idx}`;
        const title = card.title || card.summary || card.nome || 'Demanda do Jira';
        const description = card.description || card.descricao || card.notes || 'Sincronizado da Edge Function consultar-cards-jira';
        const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

        // REGRA DE/PARA 1: Fila 'Aberto' ➔ status === 'Aberto' ou 'Triagem'
        if (statusLower === 'aberto' || statusLower === 'triagem') {
          let suggested: SquadId = 'dados';
          if (
            squadLower === 'squad de operações' ||
            squadLower === 'squad de operacoes' ||
            squadLower === 'operacoes' ||
            squadLower.includes('operaç') ||
            squadLower.includes('operac')
          ) {
            suggested = 'operacoes';
          } else if (
            squadLower === 'squad de rpa' ||
            squadLower === 'rpa' ||
            squadLower.includes('rpa')
          ) {
            suggested = 'rpa';
          }

          newTriageItems.push({
            id: card.id || `triage-${jiraKey}`,
            jiraKey,
            jiraUrl: card.jiraUrl || `https://jira.empresa.com/browse/${jiraKey}`,
            title,
            description,
            requesterName: requester,
            requesterEmail: card.requesterEmail || 'solicitante@empresa.com',
            requesterArea: card.requesterArea || 'Área Demandante',
            issueType: card.issueType || 'Triagem Jira',
            priority: card.priority || '2 - Alta',
            category: card.category || 'Geral',
            suggestedSquad: suggested,
            createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'Pendente'
          });
        }
        // REGRA DE/PARA 3: Fila 'Concluídos' ➔ status === 'Concluído', 'Finalizado' ou categoriaStatus === 'Done'
        else if (
          statusLower === 'concluído' ||
          statusLower === 'concluido' ||
          statusLower === 'finalizado' ||
          catStatusLower === 'done'
        ) {
          let targetSquadId: SquadId = 'dados';
          let squadName = 'Squad de Dados';

          if (
            squadLower === 'squad de operações' ||
            squadLower === 'squad de operacoes' ||
            squadLower === 'operacoes' ||
            squadLower.includes('operaç') ||
            squadLower.includes('operac')
          ) {
            targetSquadId = 'operacoes';
            squadName = 'Squad de Operações';
          } else if (
            squadLower === 'squad de rpa' ||
            squadLower === 'rpa' ||
            squadLower.includes('rpa')
          ) {
            targetSquadId = 'rpa';
            squadName = 'Squad de RPA';
          }

          const completedTask: CompletedTask = {
            id: card.id || `completed-${jiraKey}`,
            taskTitle: `${title} (${jiraKey})`,
            taskDescription: description,
            area: 'Geral',
            completedBy: squadName,
            resourceId: 'jira-sync',
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            completionDate: card.completionDate || new Date().toISOString().split('T')[0],
            gains: 'Concluído via sincronização com Supabase Edge Function consultar-cards-jira',
            requesterArea: card.requesterArea || requester
          };

          if (targetSquadId === 'dados') newDadosCompleted.push(completedTask);
          else if (targetSquadId === 'operacoes') newOperacoesCompleted.push(completedTask);
          else if (targetSquadId === 'rpa') newRpaCompleted.push(completedTask);
        }
        // REGRA DE/PARA 2: Filas de Squads ('Aguardando Squads' / 'Em Andamento')
        else {
          let itemStatus: BacklogItem['status'] = 'Em Andamento';
          if (statusLower.includes('pausad')) itemStatus = 'Pausado';
          else if (statusLower.includes('impedid')) itemStatus = 'Impedido';
          else if (statusLower.includes('aguardando') || statusLower.includes('pendente')) itemStatus = 'Pendente';

          let squadName = 'Squad de Dados';
          let targetSquadId: SquadId = 'dados';

          if (
            squadLower === 'squad de operações' ||
            squadLower === 'squad de operacoes' ||
            squadLower === 'operacoes' ||
            squadLower.includes('operaç') ||
            squadLower.includes('operac')
          ) {
            squadName = 'Squad de Operações';
            targetSquadId = 'operacoes';
          } else if (
            squadLower === 'squad de rpa' ||
            squadLower === 'rpa' ||
            squadLower.includes('rpa')
          ) {
            squadName = 'Squad de RPA';
            targetSquadId = 'rpa';
          }

          const backlogItem: BacklogItem = {
            id: card.id || `backlog-${jiraKey}`,
            gau: jiraKey,
            title,
            notes: description,
            requesterArea: card.requesterArea || requester,
            requester,
            team: squadName,
            date: card.dueDate || card.date || new Date().toISOString().split('T')[0],
            dueDate: card.dueDate || card.date || new Date().toISOString().split('T')[0],
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: itemStatus,
            progress: typeof card.progress === 'number' ? card.progress : (itemStatus === 'Em Andamento' ? 50 : 0),
            jiraMetadata: {
              jiraKey,
              jiraUrl: card.jiraUrl || `https://jira.empresa.com/browse/${jiraKey}`,
              reporterName: requester,
              jiraStatus: rawStatus || 'Em Andamento',
              squadTarget: targetSquadId,
              receivedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          };

          if (targetSquadId === 'dados') newDadosBacklog.push(backlogItem);
          else if (targetSquadId === 'operacoes') newOperacoesBacklog.push(backlogItem);
          else if (targetSquadId === 'rpa') newRpaBacklog.push(backlogItem);
        }
      });
    }

    // Limpar e repovoar estado no LocalStorage
    saveTriageState(newTriageItems);

    localStorage.setItem('squad_dados_backlog_items', JSON.stringify(newDadosBacklog));
    localStorage.setItem('squad_operacoes_backlog_items', JSON.stringify(newOperacoesBacklog));
    localStorage.setItem('squad_rpa_backlog_items', JSON.stringify(newRpaBacklog));

    localStorage.setItem('squad_dados_completed_tasks', JSON.stringify(newDadosCompleted));
    localStorage.setItem('squad_operacoes_completed_tasks', JSON.stringify(newOperacoesCompleted));
    localStorage.setItem('squad_rpa_completed_tasks', JSON.stringify(newRpaCompleted));

    // Atualizar estado da squad ativa no momento
    if (currentSquadId === 'dados') {
      setBacklogItems(newDadosBacklog);
      setCompletedTasks(newDadosCompleted);
    } else if (currentSquadId === 'operacoes') {
      setBacklogItems(newOperacoesBacklog);
      setCompletedTasks(newOperacoesCompleted);
    } else if (currentSquadId === 'rpa') {
      setBacklogItems(newRpaBacklog);
      setCompletedTasks(newRpaCompleted);
    }

    // Registrar e exibir o horário da última atualização
    const nowTime = new Date().toLocaleTimeString('pt-BR');
    setLastJiraSyncTime(nowTime);
    localStorage.setItem('last_jira_sync_time', nowTime);

    setIsSyncingJira(false);
  }, [currentSquadId]);

  // Executar no evento DOMContentLoaded e no carregamento da página
  useEffect(() => {
    (window as any).sincronizarFilaJira = sincronizarFilaJira;

    const handleDOMContentLoaded = () => {
      sincronizarFilaJira();
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', handleDOMContentLoaded);
    } else {
      sincronizarFilaJira();
    }

    return () => {
      window.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
    };
  }, [sincronizarFilaJira]);

  // Real-time Poller for Jira Events from backend
  useEffect(() => {
    const fetchJiraEvents = async () => {
      try {
        const res = await fetch('/api/jira/events');
        if (res.ok) {
          const data = await res.json();
          const events = data.events || [];
          // Process events in chronological order (oldest to newest)
          const unhandled = events.filter((e: any) => !processedJiraEventIds.current.has(e.id));
          if (unhandled.length > 0) {
            unhandled.reverse().forEach((evt: any) => {
              processedJiraEventIds.current.add(evt.id);
              processJiraEvent(evt);
            });
          }
        }
      } catch (err) {
        // Silent catch for background polling
      }
    };

    fetchJiraEvents();
    const interval = setInterval(fetchJiraEvents, 3000);
    return () => clearInterval(interval);
  }, [processJiraEvent]);

  // Triage Queue Handlers
  const handleTriageToSquad = (triageItem: TriageItem, targetSquadId: SquadId) => {
    processJiraEvent({
      event: 'jira:issue_updated',
      jiraKey: triageItem.jiraKey,
      summary: triageItem.title,
      description: triageItem.description,
      requesterName: triageItem.requesterName,
      requesterEmail: triageItem.requesterEmail,
      requesterArea: triageItem.requesterArea,
      issueType: triageItem.issueType,
      priority: triageItem.priority,
      category: triageItem.category,
      squad: targetSquadId,
      status: 'Em Andamento'
    });
  };

  const handleRejectTriage = (id: string) => {
    const updated = triageItems.map(item => 
      item.id === id ? { ...item, status: 'Rejeitado' as const } : item
    );
    saveTriageState(updated);
  };

  const handleTriggerSimulatedWebhook = (eventType: string, squadId: SquadId, title: string) => {
    const jiraKey = `KAN-${Math.floor(100 + Math.random() * 900)}`;
    processJiraEvent({
      event: eventType,
      jiraKey,
      summary: title,
      description: 'Evento de teste gerado via simulador do Jira.',
      requesterName: 'Simulador Jira',
      requesterArea: 'Área Negócios',
      priority: '2 - Alta',
      category: 'Automação',
      squad: squadId,
      status: eventType === 'jira:issue_resolved' ? 'Concluído' : eventType === 'jira:issue_updated' ? 'Em Andamento' : 'Triagem'
    });
  };

  const handleSelectSquad = (newSquadId: SquadId) => {
    setCurrentSquadId(newSquadId);
    localStorage.setItem('squad_active_id', newSquadId);

    const data = loadSquadData(newSquadId);
    setResources(data.resources);
    setBacklogItems(data.backlogItems);
    setCompletedTasks(data.completedTasks);
    setMeetingLogs(data.meetingLogs);
    setSearchTerm('');
    setMemberStatusFilter('all');
    setStatusFilter('all');

    // Always switch to board tab when selecting a squad from dashboard or triage
    if (activeTab === 'dashboard' || activeTab === 'triage') {
      setActiveTab('board');
    }
  };

  // Compute live summary stats for each squad for the sidebar badges
  const squadSummaryStats = React.useMemo(() => {
    const stats: Record<SquadId, { totalMembers: number; activeMembers: number; backlogCount: number }> = {
      dados: { totalMembers: 0, activeMembers: 0, backlogCount: 0 },
      operacoes: { totalMembers: 0, activeMembers: 0, backlogCount: 0 },
      rpa: { totalMembers: 0, activeMembers: 0, backlogCount: 0 }
    };

    const squadIds: SquadId[] = ['dados', 'operacoes', 'rpa'];
    squadIds.forEach(id => {
      if (id === currentSquadId) {
        stats[id] = {
          totalMembers: resources.length,
          activeMembers: resources.filter(r => r.status !== 'Inativo').length,
          backlogCount: backlogItems.filter(b => b.status === 'Pendente').length
        };
      } else {
        const d = loadSquadData(id);
        stats[id] = {
          totalMembers: d.resources.length,
          activeMembers: d.resources.filter(r => r.status !== 'Inativo').length,
          backlogCount: d.backlogItems.filter(b => b.status === 'Pendente').length
        };
      }
    });

    return stats;
  }, [currentSquadId, resources, backlogItems]);

  // Clear All Demands Handler
  const handleClearAllDemands = () => {
    const clearedRes = resources.map(r => ({
      ...r,
      currentTask: null,
      nextTask: null
    }));
    saveResourcesState(clearedRes);
    saveBacklogItemsState([]);
    saveCompletedTasksState([]);

    setIsClearModalOpen(false);
    setShowClearToast(true);
    setTimeout(() => setShowClearToast(false), 4000);
  };

  // Backlog actions
  const handleAddBacklogItem = (itemData: Omit<BacklogItem, 'id'>) => {
    const nextOrder = itemData.treatmentOrder || (backlogItems.length + 1);
    const newItem: BacklogItem = {
      ...itemData,
      id: 'backlog-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      treatmentOrder: nextOrder,
      status: itemData.status || 'Pendente'
    };
    const updated = [newItem, ...backlogItems];
    saveBacklogItemsState(updated);
  };

  const handleAddBacklogItemsBatch = (itemsData: Omit<BacklogItem, 'id'>[]) => {
    const currentMaxOrder = backlogItems.reduce((max, i) => Math.max(max, i.treatmentOrder || 0), 0);
    const newItems: BacklogItem[] = itemsData.map((data, idx) => ({
      ...data,
      id: 'backlog-' + (Date.now() + idx) + '-' + Math.random().toString(36).substr(2, 4),
      treatmentOrder: data.treatmentOrder || (currentMaxOrder + idx + 1),
      status: data.status || 'Pendente'
    }));
    const updated = [...newItems, ...backlogItems];
    saveBacklogItemsState(updated);
  };

  const handleEditBacklogItem = (updatedItem: BacklogItem) => {
    const updated = backlogItems.map(item => item.id === updatedItem.id ? updatedItem : item);
    saveBacklogItemsState(updated);
  };

  const handleDeleteBacklogItem = (id: string) => {
    const updated = backlogItems.filter(item => item.id !== id);
    saveBacklogItemsState(updated);
  };

  const handleAssignBacklogToSquad = (
    backlogItem: BacklogItem, 
    resourceId: string, 
    taskPosition: 'current' | 'next', 
    area: 'Operações' | 'Geral'
  ) => {
    const res = resources.find(r => r.id === resourceId);
    if (!res) return;

    const newTask: Task = {
      id: 'task-' + Date.now(),
      title: `${backlogItem.gau} - ${backlogItem.title}`,
      description: `Solicitante: ${backlogItem.requester} | Equipe: ${backlogItem.team}${backlogItem.notes ? `\n\n${backlogItem.notes}` : ''}`,
      status: 'Em Andamento',
      dueDate: backlogItem.date,
      area: area,
      requesterArea: backlogItem.team || backlogItem.requester
    };

    // Update resource
    const updatedResources = resources.map(r => {
      if (r.id === resourceId) {
        if (taskPosition === 'current') {
          return { ...r, currentTask: newTask };
        } else {
          return { ...r, nextTask: newTask };
        }
      }
      return r;
    });

    saveResourcesState(updatedResources);

    // Update backlog item status
    const updatedBacklog = backlogItems.map(item => {
      if (item.id === backlogItem.id) {
        return {
          ...item,
          status: 'Atribuído' as const,
          assignedTo: res.name
        };
      }
      return item;
    });

    saveBacklogItemsState(updatedBacklog);
  };

  // Resources CRUD actions
  const handleOpenAddResource = () => {
    setEditingResource(null);
    setIsResourceModalOpen(true);
  };

  const handleOpenEditResource = (resource: Resource) => {
    setEditingResource(resource);
    setIsResourceModalOpen(true);
  };

  const handleSaveResource = (data: Omit<Resource, 'currentTask' | 'nextTask'> & { isNew: boolean }) => {
    let updated: Resource[];
    if (data.isNew) {
      // Create new
      const newResource: Resource = {
        id: data.id,
        name: data.name,
        role: data.role,
        status: data.status || 'Ativo',
        allocationOps: data.allocationOps,
        allocationFin: data.allocationFin,
        currentTask: null,
        nextTask: null
      };
      updated = [...resources, newResource];
    } else {
      // Edit existing
      updated = resources.map(r => r.id === data.id ? {
        ...r,
        name: data.name,
        role: data.role,
        status: data.status || r.status || 'Ativo',
        allocationOps: data.allocationOps,
        allocationFin: data.allocationFin
      } : r);
    }
    saveResourcesState(updated);
    setIsResourceModalOpen(false);
  };

  const handleToggleResourceStatus = (id: string) => {
    const updated = resources.map(r => {
      if (r.id === id) {
        const nextStatus: 'Ativo' | 'Inativo' = r.status === 'Inativo' ? 'Ativo' : 'Inativo';
        return { ...r, status: nextStatus };
      }
      return r;
    });
    saveResourcesState(updated);
  };

  const handleDeleteResource = (id: string) => {
    const updated = resources.filter(r => r.id !== id);
    saveResourcesState(updated);
  };

  // Task actions
  const handleOpenEditTask = (resourceId: string, taskType: 'current' | 'next') => {
    const res = resources.find(r => r.id === resourceId);
    if (!res) return;

    setSelectedResIdForTask(resourceId);
    setSelectedTaskType(taskType);
    setSelectedTaskForEdit(taskType === 'current' ? res.currentTask : res.nextTask);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (taskData: Task) => {
    const res = resources.find(r => r.id === selectedResIdForTask);
    if (!res) return;

    if (taskData.status === 'Concluído') {
      const newCompleted: CompletedTask = {
        id: 'comp-' + Math.random().toString(36).substr(2, 9),
        taskTitle: taskData.title,
        taskDescription: taskData.description,
        area: taskData.area,
        completedBy: res.name,
        resourceId: res.id,
        dueDate: taskData.dueDate,
        completionDate: new Date().toISOString().split('T')[0],
        gains: '',
        requesterArea: taskData.requesterArea
      };

      const updated = resources.map(r => {
        if (r.id === selectedResIdForTask) {
          if (selectedTaskType === 'current') {
            return { ...r, currentTask: null };
          } else {
            return { ...r, nextTask: null };
          }
        }
        return r;
      });

      saveResourcesState(updated);
      saveCompletedTasksState([newCompleted, ...completedTasks]);
    } else {
      const updated = resources.map(r => {
        if (r.id === selectedResIdForTask) {
          if (selectedTaskType === 'current') {
            return { ...r, currentTask: taskData };
          } else {
            return { ...r, nextTask: taskData };
          }
        }
        return r;
      });
      saveResourcesState(updated);
    }
    setIsTaskModalOpen(false);
  };

  const handleUpdateTaskStatus = (resourceId: string, status: Task['status']) => {
    const res = resources.find(r => r.id === resourceId);
    if (status === 'Concluído' && res && res.currentTask) {
      const newCompleted: CompletedTask = {
        id: 'comp-' + Math.random().toString(36).substr(2, 9),
        taskTitle: res.currentTask.title,
        taskDescription: res.currentTask.description,
        area: res.currentTask.area,
        completedBy: res.name,
        resourceId: res.id,
        dueDate: res.currentTask.dueDate,
        completionDate: new Date().toISOString().split('T')[0],
        gains: '',
        requesterArea: res.currentTask.requesterArea
      };

      const updated = resources.map(r => {
        if (r.id === resourceId) {
          return { ...r, currentTask: null };
        }
        return r;
      });

      saveResourcesState(updated);
      saveCompletedTasksState([newCompleted, ...completedTasks]);
    } else {
      const updated = resources.map(r => {
        if (r.id === resourceId && r.currentTask) {
          return {
            ...r,
            currentTask: {
              ...r.currentTask,
              status
            }
          };
        }
        return r;
      });
      saveResourcesState(updated);
    }
  };

  // Promotion of Next Task to Current Task
  const handlePromoteNextTask = (resourceId: string) => {
    const updated = resources.map(r => {
      if (r.id === resourceId && r.nextTask) {
        return {
          ...r,
          currentTask: {
            ...r.nextTask,
            status: 'Em Andamento' as const // Promote automatically sets it to Em Andamento
          },
          nextTask: null // Clear next demand
        };
      }
      return r;
    });
    saveResourcesState(updated);
  };

  // DPO Sync Session Completion
  const handleSaveDpoSync = (updatedResources: Resource[], logSummary: string) => {
    // 1. Calculate how many tasks were completed or promoted relative to the previous state
    let completedCount = 0;
    let promotedCount = 0;
    const newlyCompleted: CompletedTask[] = [];

    const resourcesAfterClear = updatedResources.map(updatedRes => {
      const oldRes = resources.find(r => r.id === updatedRes.id);
      if (!oldRes) return updatedRes;

      // Check if current task status became "Concluído"
      if (updatedRes.currentTask?.status === 'Concluído' && oldRes.currentTask?.status !== 'Concluído') {
        completedCount++;
        newlyCompleted.push({
          id: 'comp-' + Math.random().toString(36).substr(2, 9),
          taskTitle: updatedRes.currentTask.title,
          taskDescription: updatedRes.currentTask.description,
          area: updatedRes.currentTask.area,
          completedBy: updatedRes.name,
          resourceId: updatedRes.id,
          dueDate: updatedRes.currentTask.dueDate,
          completionDate: new Date().toISOString().split('T')[0],
          gains: '',
          requesterArea: updatedRes.currentTask.requesterArea
        });

        return {
          ...updatedRes,
          currentTask: null
        };
      }

      // Check if next task status became "Concluído"
      if (updatedRes.nextTask?.status === 'Concluído' && oldRes.nextTask?.status !== 'Concluído') {
        completedCount++;
        newlyCompleted.push({
          id: 'comp-' + Math.random().toString(36).substr(2, 9),
          taskTitle: updatedRes.nextTask.title,
          taskDescription: updatedRes.nextTask.description,
          area: updatedRes.nextTask.area,
          completedBy: updatedRes.name,
          resourceId: updatedRes.id,
          dueDate: updatedRes.nextTask.dueDate,
          completionDate: new Date().toISOString().split('T')[0],
          gains: '',
          requesterArea: updatedRes.nextTask.requesterArea
        });

        return {
          ...updatedRes,
          nextTask: null
        };
      }

      // Check if old nextTask was promoted (meaning old nextTask was populated, but is now currentTask, or nextTask was cleared)
      if (oldRes.nextTask && (!updatedRes.nextTask || updatedRes.currentTask?.id === oldRes.nextTask.id)) {
        promotedCount++;
      }
      
      return updatedRes;
    });

    // 2. Create the meeting log
    const newLog: DpoMeetingLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      summary: logSummary,
      completedTasksCount: completedCount,
      promotedTasksCount: promotedCount
    };

    // 3. Save states
    saveResourcesState(resourcesAfterClear);
    saveLogsState([newLog, ...meetingLogs]);
    if (newlyCompleted.length > 0) {
      saveCompletedTasksState([...newlyCompleted, ...completedTasks]);
    }
    setIsDpoSyncMode(false);
    setShowSyncSuccessToast(true);
  };

  const handleUpdateCompletedTask = (taskId: string, title: string, gains: string) => {
    const updated = completedTasks.map(t => t.id === taskId ? { ...t, taskTitle: title, gains } : t);
    saveCompletedTasksState(updated);
  };

  const handleDeleteCompletedTask = (taskId: string) => {
    const updated = completedTasks.filter(t => t.id !== taskId);
    saveCompletedTasksState(updated);
  };

  const handleDeleteLog = (id: string) => {
    const updated = meetingLogs.filter(log => log.id !== id);
    saveLogsState(updated);
  };

  // Resource Filtering Logic
  const filteredResources = resources.filter(res => {
    // Search matching
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          res.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (res.currentTask && res.currentTask.title.toLowerCase().includes(searchTerm.toLowerCase()));

    // Member status matching
    let matchesMemberStatus = true;
    if (memberStatusFilter === 'active') {
      matchesMemberStatus = res.status !== 'Inativo';
    } else if (memberStatusFilter === 'inactive') {
      matchesMemberStatus = res.status === 'Inativo';
    }

    // Task status matching
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = res.currentTask?.status === statusFilter;
    }

    return matchesSearch && matchesMemberStatus && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans" id="app-root">
      {/* SIDEBAR NAVIGATION MENU */}
      <Sidebar
        currentSquadId={currentSquadId}
        onSelectSquad={handleSelectSquad}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        squadSummaryStats={squadSummaryStats}
        pendingTriageCount={triageItems.filter(i => i.status === 'Pendente').length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onStartDpoSync={() => setIsDpoSyncMode(true)}
      />

      {/* MAIN CONTAINER OFFSET BY SIDEBAR ON DESKTOP */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        
        {/* 1. TOP GLOBAL BAR */}
        <header className="bg-white border-b border-slate-150 sticky top-0 z-30 print:hidden" id="main-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {activeTab === 'triage' ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 border border-slate-200 shadow-xs shrink-0"
                    title="Abrir Menu de Squads"
                  >
                    <Menu size={22} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <Inbox size={18} className="text-amber-600" />
                        Mesa de Triagem & Governança Jira
                      </h1>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                        Sincronizador Passivo
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Escuta automática em tempo real dos formulários e transições do Jira.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setIsJiraHubOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                    title="Configurações e simulação de Webhook Jira"
                  >
                    <Zap size={14} className="fill-white" />
                    <span>Hub de Integração Jira</span>
                  </button>
                </div>
              </div>
            ) : activeTab === 'dashboard' ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 border border-slate-200 shadow-xs shrink-0"
                    title="Abrir Menu de Squads"
                  >
                    <Menu size={22} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <PieChart size={18} className="text-indigo-600" />
                        Dashboard Consolidado (3 Squads)
                      </h1>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                        Visão Executiva
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Gestão integrada das Squads de Dados (15d), Operações (Quarter) e RPA (Por Demanda)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleExportPDF}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                    title="Exportar relatório consolidado para PDF"
                  >
                    <FileText size={14} />
                    <span>Exportar PDF Consolidado</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Menu Toggle & Squad Info */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 border border-slate-200 shadow-xs shrink-0"
                    title="Abrir Menu de Squads"
                  >
                    <Menu size={22} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        {currentSquadInfo.name}
                      </h1>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${currentSquadInfo.badgeColor}`}>
                        {currentSquadInfo.cadenceTag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                      {currentSquadInfo.description}
                    </p>
                  </div>
                </div>

                {/* Core Interactive Meeting Switcher */}
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                  {/* Botão de Atualização do Jira + Horário da Última Atualização */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button
                      id="btnAtualizarJira"
                      onClick={sincronizarFilaJira}
                      disabled={isSyncingJira}
                      className="w-full sm:w-auto px-4 py-2.5 bg-[#004D36] hover:bg-[#003B27] disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      title="Sincronizar e consultar cards do Jira via Supabase Edge Function"
                    >
                      {isSyncingJira ? (
                        <>
                          <span className="animate-spin text-white">🔄</span>
                          <span>Carregando...</span>
                        </>
                      ) : (
                        <span>🔄 Atualizar cards do Jira</span>
                      )}
                    </button>
                    <span id="lastJiraSyncTime" className="text-xs text-slate-600 font-semibold whitespace-nowrap">
                      Última atualização: {lastJiraSyncTime}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsClearModalOpen(true)}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                    title={`Limpar todas as demandas da ${currentSquadInfo.shortName}`}
                    id="btn-clear-demands"
                  >
                    <Trash2 size={14} className="text-rose-600" />
                    <span>Limpar Demandas</span>
                  </button>

                  <button
                    onClick={handleExportPDF}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-emanapay-green border border-slate-200 text-xs font-bold rounded-xl shadow-sm hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                    title="Exportar painel de alocações e demandas para PDF"
                    id="btn-export-pdf"
                  >
                    <FileText size={14} className="text-emanapay-orange" />
                    <span>Exportar PDF</span>
                  </button>

                  <button
                    onClick={() => setIsDpoSyncMode(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emanapay-green hover:bg-emanapay-dark text-white text-xs font-bold rounded-xl shadow-lg shadow-emanapay-green/10 hover:shadow-emanapay-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    title={`Iniciar rodada de alinhamento individual com a ${currentSquadInfo.name}`}
                    id="btn-sync-mode"
                  >
                    <Play size={14} className="fill-white text-emanapay-orange" />
                    <span>Modo Reunião DPO</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* 2. DPO MEETING MODE (Full-Screen Overlayer View) */}
        {isDpoSyncMode ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:hidden flex-1" id="dpo-sync-wrapper">
            <DpoSyncMode 
              resources={resources}
              onSaveSync={handleSaveDpoSync}
              onCancel={() => setIsDpoSyncMode(false)}
            />
          </div>
        ) : (
          /* NORMAL DASHBOARD MODE */
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:hidden flex-1" id="main-content">
            
            {/* Toast / Clear Banner */}
            {showClearToast && (
              <div className="bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-md border border-slate-800 flex items-center justify-between gap-4 animate-scale-up print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Demandas da {currentSquadInfo.name} foram limpas!</h4>
                    <p className="text-xs text-slate-300">
                      O painel e o backlog desta squad estão prontos para receber novas demandas.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClearToast(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-all"
                >
                  Entendido
                </button>
              </div>
            )}

            {/* Toast / Success Banner */}
            {showSyncSuccessToast && (
              <div className="bg-gradient-to-r from-emanapay-green to-emanapay-dark text-white p-4 rounded-2xl mb-6 shadow-md border border-emanapay-green/25 flex flex-col md:flex-row items-center justify-between gap-4 animate-scale-up print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg shadow-inner shrink-0">
                    🎉
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Alinhamento da {currentSquadInfo.shortName} salvo!</h4>
                    <p className="text-xs text-slate-200">
                      Todas as demandas, alocações e notas da reunião foram registradas para esta squad.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  <button
                    onClick={() => {
                      handleExportPDF();
                      setShowSyncSuccessToast(false);
                    }}
                    className="px-4 py-2 bg-emanapay-orange hover:bg-emanapay-orange/95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <FileText size={14} />
                    <span>Exportar Relatório PDF</span>
                  </button>
                  <button
                    onClick={() => setShowSyncSuccessToast(false)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* 4. MAIN CONTENT SWITCH */}
            {activeTab === 'triage' ? (
              <TriageView
                triageItems={triageItems}
                onTriageToSquad={handleTriageToSquad}
                onRejectTriage={handleRejectTriage}
                onOpenJiraHub={() => setIsJiraHubOpen(true)}
                onSimulateIncomingJira={() => setIsJiraHubOpen(true)}
                onSyncJiraCards={sincronizarFilaJira}
              />
            ) : activeTab === 'dashboard' ? (
              <MultiSquadDashboard 
                allSquadsData={allSquadsData}
                onSelectSquadAndTab={(sqId, tab) => {
                  handleSelectSquad(sqId);
                  setActiveTab(tab);
                }}
              />
            ) : (
              <>
                {/* Cadence Banner (Sprint for Dados / Quarter for Operações) */}
                <CadenceBanner
                  currentSquadId={currentSquadId}
                  sprintConfig={sprintConfig}
                  quarterConfig={quarterConfig}
                  onUpdateSprintConfig={handleUpdateSprintConfig}
                  onUpdateQuarterConfig={handleUpdateQuarterConfig}
                />

                {/* Quick Metrics Header - Only show for individual squad views */}
                <DashboardStats resources={resources} />

                {/* 3. VIEW TABS & FILTERS BAR */}
                <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm mb-8 space-y-4" id="controls-bar">
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {/* Tab Navigation */}
                    <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                      <button
                        onClick={() => setActiveTab('board')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'board' 
                            ? 'bg-white text-emanapay-green shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <LayoutDashboard size={14} />
                        <span>Quadro da Squad</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('backlog')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'backlog' 
                            ? 'bg-white text-emerald-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Layers size={14} className={activeTab === 'backlog' ? 'text-emerald-700' : 'text-slate-500'} />
                        <span>Backlog de Demandas</span>
                        {backlogItems.filter(i => i.status === 'Pendente').length > 0 && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 rounded-full ml-1">
                            {backlogItems.filter(i => i.status === 'Pendente').length}
                          </span>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('completed')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'completed' 
                            ? 'bg-white text-emanapay-orange shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <CheckCircle2 size={14} className={activeTab === 'completed' ? 'text-emanapay-orange' : 'text-slate-500'} />
                        <span>Concluídos</span>
                        {completedTasks.length > 0 && (
                          <span className="bg-emanapay-orange/10 text-emanapay-orange text-[10px] font-bold px-1.5 rounded-full ml-1">
                            {completedTasks.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeTab === 'logs' 
                            ? 'bg-white text-emanapay-pink shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <History size={14} />
                        <span>Histórico de Alinhamentos</span>
                        {meetingLogs.length > 0 && (
                          <span className="bg-emanapay-pink/10 text-emanapay-pink text-[10px] font-bold px-1.5 rounded-full ml-1">
                            {meetingLogs.length}
                          </span>
                        )}
                      </button>
                    </div>


                    {/* Action trigger for new resource (Only for Squad de Dados) */}
                    {activeTab === 'board' && currentSquadId === 'dados' && (
                      <button
                        onClick={handleOpenAddResource}
                        className="px-4 py-2 bg-emanapay-green hover:bg-emanapay-dark text-white text-xs font-bold rounded-xl shadow-md shadow-emanapay-green/10 hover:shadow-emanapay-green/20 transition-all flex items-center gap-1.5"
                        id="btn-add-resource"
                      >
                        <Plus size={16} />
                        <span>Adicionar Integrante</span>
                      </button>
                    )}
                  </div>

                  {/* Sub-Filters for Board View (Squad de Dados) */}
                  {activeTab === 'board' && currentSquadId === 'dados' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-slate-100/60" id="filters-row">
                      
                      {/* Search field */}
                      <div className="md:col-span-5 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nome, função ou demanda..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-emanapay-green focus:bg-white rounded-xl py-3 pl-10 pr-4 transition-all focus:ring-1 focus:ring-emanapay-green"
                        />
                      </div>

                      {/* Filter by Member Status */}
                      <div className="md:col-span-3 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Membro:</span>
                        <select
                          value={memberStatusFilter}
                          onChange={(e) => setMemberStatusFilter(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green"
                        >
                          <option value="all">Todos Integrantes ({resources.length})</option>
                          <option value="active">🟢 Apenas Ativos ({resources.filter(r => r.status !== 'Inativo').length})</option>
                          <option value="inactive">⏸️ Apenas Inativos ({resources.filter(r => r.status === 'Inativo').length})</option>
                        </select>
                      </div>

                      {/* Filter by Demand Status */}
                      <div className="md:col-span-4 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Demanda:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emanapay-green"
                        >
                          <option value="all">Todos os Status</option>
                          <option value="A Fazer">Status: A Fazer</option>
                          <option value="Em Andamento">Status: Em Andamento</option>
                          <option value="Impedido">Status: Impedido</option>
                          <option value="Concluído">Status: Concluído</option>
                        </select>
                      </div>

                    </div>
                  )}
                </div>

                {/* SQUAD SUB-TABS VIEWS */}
                {activeTab === 'board' ? (
                  currentSquadId === 'operacoes' || currentSquadId === 'rpa' ? (
                    <LinearDemandsView 
                      backlogItems={backlogItems}
                      currentSquadId={currentSquadId}
                      onAddBacklogItem={handleAddBacklogItem}
                      onEditBacklogItem={handleEditBacklogItem}
                      onDeleteBacklogItem={handleDeleteBacklogItem}
                    />
                  ) : (
                    <div>
                      {filteredResources.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 shadow-sm" id="empty-state">
                          <Users size={48} className="mx-auto text-slate-300 mb-4" />
                          <h4 className="font-bold text-slate-700 text-base">Nenhum integrante encontrado</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Tente ajustar os filtros de busca ou status de integrante para visualizar a {currentSquadInfo.name}.
                          </p>
                          <button
                            onClick={() => {
                              setSearchTerm('');
                              setMemberStatusFilter('all');
                              setStatusFilter('all');
                            }}
                            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                          >
                            Limpar Filtros
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="resources-grid">
                          {filteredResources.map((res) => (
                            <ResourceCard
                              key={res.id}
                              resource={res}
                              onEditResource={handleOpenEditResource}
                              onDeleteResource={handleDeleteResource}
                              onToggleStatus={handleToggleResourceStatus}
                              onEditTask={handleOpenEditTask}
                              onUpdateTaskStatus={handleUpdateTaskStatus}
                              onPromoteNextTask={handlePromoteNextTask}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : activeTab === 'backlog' ? (
                  currentSquadId === 'operacoes' || currentSquadId === 'rpa' ? (
                    <LinearDemandsView 
                      backlogItems={backlogItems}
                      currentSquadId={currentSquadId}
                      onAddBacklogItem={handleAddBacklogItem}
                      onEditBacklogItem={handleEditBacklogItem}
                      onDeleteBacklogItem={handleDeleteBacklogItem}
                    />
                  ) : (
                    <BacklogView 
                      backlogItems={backlogItems}
                      resources={resources}
                      currentSquadId={currentSquadId}
                      onAddBacklogItem={handleAddBacklogItem}
                      onAddBacklogItemsBatch={handleAddBacklogItemsBatch}
                      onEditBacklogItem={handleEditBacklogItem}
                      onDeleteBacklogItem={handleDeleteBacklogItem}
                      onAssignToSquad={handleAssignBacklogToSquad}
                    />
                  )
                ) : activeTab === 'completed' ? (
                  <CompletedTasksList 
                    completedTasks={completedTasks}
                    onUpdateTask={handleUpdateCompletedTask}
                    onDeleteCompletedTask={handleDeleteCompletedTask}
                  />
                ) : (
                  <DpoLogs 
                    logs={meetingLogs}
                    onDeleteLog={handleDeleteLog}
                  />
                )}
              </>
            )}

          </main>
        )}

        {/* Footer info line */}
        {!isDpoSyncMode && (
          <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-auto border-t border-slate-200 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <p className="flex items-center gap-1.5 justify-center">
              <Sparkles size={13} className="text-indigo-400" />
              Controle de Recursos {currentSquadInfo.name} • Visualização Objetiva
            </p>
            <div className="flex items-center gap-4">
              <span>DPO focal point sync system v2.5</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-500 font-medium">Multisquads Ativas</span>
            </div>
          </footer>
        )}
      </div>

      {/* 5. MODAL DIALOGS */}
      <ResourceFormModal
        isOpen={isResourceModalOpen}
        resource={editingResource}
        onSave={handleSaveResource}
        onClose={() => setIsResourceModalOpen(false)}
      />

      <TaskFormModal
        isOpen={isTaskModalOpen}
        resourceName={resources.find(r => r.id === selectedResIdForTask)?.name || ''}
        taskType={selectedTaskType}
        task={selectedTaskForEdit}
        onSave={handleSaveTask}
        onClose={() => setIsTaskModalOpen(false)}
      />

      {/* Modal de Confirmação para Limpar Demandas */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Limpar Demandas da {currentSquadInfo.shortName}?</h3>
                <p className="text-xs text-slate-500 font-medium">Esta ação prepara a squad para novos cadastros.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              Todas as demandas atribuídas aos integrantes da <strong>{currentSquadInfo.name}</strong>, o backlog geral e o histórico de concluídas desta squad serão <strong>removidos</strong>. Os membros da squad e seus dados de alocação serão preservados.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllDemands}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Confirmar Limpeza</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JIRA INTEGRATION & WEBHOOK HUB MODAL */}
      <JiraIntegrationModal
        isOpen={isJiraHubOpen}
        onClose={() => setIsJiraHubOpen(false)}
        onTriggerSimulatedWebhook={handleTriggerSimulatedWebhook}
        onConsultarCardsJira={sincronizarFilaJira}
      />

      {/* 6. PRINT PDF REPORT VIEW */}
      <PrintReport 
        resources={resources} 
        meetingLogs={meetingLogs} 
        completedTasks={completedTasks} 
      />
    </div>
  );
}
