import { Resource, DpoMeetingLog, CompletedTask, BacklogItem, SquadInfo, TriageItem } from './types';

export const SQUADS_CONFIG: SquadInfo[] = [
  {
    id: 'dados',
    name: 'Squad de Dados',
    shortName: 'Dados',
    description: 'Sprints Quinzenais (15 dias) • Engenharia & Analytics',
    iconName: 'Database',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    primaryColor: 'emerald',
    cadence: 'Sprint de 15 Dias',
    cadenceTag: 'Sprint 15d',
    cadenceBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    cadenceCycle: 'Sprint Quinzenal (15 dias)'
  },
  {
    id: 'operacoes',
    name: 'Squad de Operações',
    shortName: 'Operações',
    description: 'Atuação por Quarter (Trimestral) • Suporte & Processos',
    iconName: 'Cog',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    primaryColor: 'blue',
    cadence: 'Planejamento por Quarter',
    cadenceTag: 'Quarter (Trimestral)',
    cadenceBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    cadenceCycle: 'Quarter Atual (Q3 2026)'
  },
  {
    id: 'rpa',
    name: 'Squad de RPA',
    shortName: 'RPA & Automações',
    description: 'Atuação por Demanda (Fluxo Contínuo) • Bots & UiPath',
    iconName: 'Bot',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    primaryColor: 'purple',
    cadence: 'Atendimento por Demanda',
    cadenceTag: 'Por Demanda',
    cadenceBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    cadenceCycle: 'Fluxo Contínuo (SLA / On-Demand)'
  }
];

export const initialResourcesSquadDados: Resource[] = [
  {
    id: 'res-gustavo',
    name: 'Gustavo',
    role: 'Engenheiro de Dados',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-rafael',
    name: 'Rafael',
    role: 'Engenheiro de Dados',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-marilzon',
    name: 'Marilzon',
    role: 'Engenheiro de Dados',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-davy',
    name: 'Davy',
    role: 'Engenheiro de Dados',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-marcel',
    name: 'Marcel',
    role: 'Data Analytics',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-ian',
    name: 'Ian',
    role: 'Analista Engenheiro',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  }
];

export const initialResourcesSquadOperacoes: Resource[] = [
  {
    id: 'res-ana',
    name: 'Ana Paula',
    role: 'Coordenadora de Operações',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-bruno',
    name: 'Bruno Silva',
    role: 'Analista de Suporte Ops',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-carla',
    name: 'Carla Mendes',
    role: 'Especialista em Processos',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-diego',
    name: 'Diego Oliveira',
    role: 'Analista de Backoffice',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  }
];

export const initialResourcesSquadRPA: Resource[] = [
  {
    id: 'res-lucas',
    name: 'Lucas Ferreira',
    role: 'Desenvolvedor RPA Senior',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-mariana',
    name: 'Mariana Costa',
    role: 'Arquiteta de Automação',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-fernando',
    name: 'Fernando Rocha',
    role: 'Analista de Processos Bot',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  },
  {
    id: 'res-beatriz',
    name: 'Beatriz Lima',
    role: 'Desenvolvedora UiPath',
    allocationOps: 100,
    allocationFin: 0,
    status: 'Ativo',
    currentTask: null,
    nextTask: null
  }
];

export const initialTriageItems: TriageItem[] = [];

export const initialBacklogItemsSquadOperacoes: BacklogItem[] = [];

export const initialBacklogItemsSquadRPA: BacklogItem[] = [];

export const initialResources = initialResourcesSquadDados;
export const initialMeetingLogs: DpoMeetingLog[] = [];
export const initialCompletedTasks: CompletedTask[] = [];
export const initialBacklogItems: BacklogItem[] = [];




