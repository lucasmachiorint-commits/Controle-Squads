export type SquadId = 'dados' | 'operacoes' | 'rpa';

export interface SquadInfo {
  id: SquadId;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  badgeColor: string;
  primaryColor: string;
  cadence: string;        // e.g. 'Sprint de 15 Dias', 'Quarter (Trimestral)', 'Por Demanda'
  cadenceTag: string;     // e.g. 'Sprint 15d', 'Quarter', 'Por Demanda'
  cadenceBadge: string;   // e.g. 'bg-emerald-500/20 text-emerald-300'
  cadenceCycle: string;   // e.g. 'Sprint Quinzenal (15 dias)', 'Quarter Atual (Q3 2026)', 'Fluxo Contínuo'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'A Fazer' | 'Pendente' | 'Em Andamento' | 'Pausado' | 'Impedido' | 'Concluído';
  dueDate: string; // YYYY-MM-DD
  area: 'Operações' | 'Geral';
  requesterArea?: string; // Área Demandante
  progress?: number; // % de Evolução (0 a 100)
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  allocationOps: number; // 0 to 100
  allocationFin: number; // 0 to 100
  status?: 'Ativo' | 'Inativo';
  currentTask: Task | null;
  nextTask: Task | null;
}

export interface DpoMeetingLog {
  id: string;
  date: string; // YYYY-MM-DD
  summary: string;
  completedTasksCount: number;
  promotedTasksCount: number;
}

export interface JiraMetadata {
  jiraKey: string;             // Ex: "KAN-102"
  jiraUrl?: string;            // Ex: "https://empresa.atlassian.net/browse/KAN-102"
  reporterName?: string;       // Solicitante do formulário Jira
  reporterEmail?: string;
  issueType?: string;          // Ex: "Solicitação de Demanda", "Melhoria"
  jiraStatus?: string;         // Ex: "Triagem", "Em Andamento", "Concluído"
  squadTarget?: SquadId;       // 'dados' | 'operacoes' | 'rpa'
  receivedAt: string;          // YYYY-MM-DD HH:mm
}

export interface TriageItem {
  id: string;
  jiraKey: string;
  jiraUrl?: string;
  title: string;
  description: string;
  requesterName: string;
  requesterEmail?: string;
  requesterArea?: string;
  issueType?: string;
  priority: '1 - Urgente' | '2 - Alta' | '3 - Média' | '4 - Baixa';
  category: 'Ingestão' | 'Dashboard' | 'API' | 'Automação' | 'Processos' | 'Outros';
  suggestedSquad?: SquadId;
  createdAt: string;
  status: 'Pendente' | 'Triado' | 'Rejeitado';
  triagedSquadId?: SquadId;
  triagedAt?: string;
  triageNotes?: string;
}

export interface CompletedTask {
  id: string;
  taskTitle: string;
  taskDescription: string;
  area: 'Operações' | 'Geral';
  completedBy: string; // name of resource
  resourceId: string;
  dueDate: string;
  completionDate: string; // YYYY-MM-DD
  gains: string; // editable field for Ganhos
  requesterArea?: string; // Área Demandante
  jiraMetadata?: JiraMetadata;
}

export interface BacklogItem {
  id: string;
  gau: string;           // GAU (Ex: GAU-1024 ou KAN-102)
  title: string;         // NOME DA DEMANDA
  requester: string;     // SOLICITANTE / NOME
  requesterArea?: string; // ÁREA DEMANDANTE
  team: string;          // EQUIPE
  date: string;          // DATA / PRAZO (YYYY-MM-DD)
  dueDate?: string;      // PRAZO (YYYY-MM-DD)
  priority: '1 - Urgente' | '2 - Alta' | '3 - Média' | '4 - Baixa'; // PRIORIDADE NUMERADA
  category: 'Ingestão' | 'Dashboard' | 'API' | 'Automação' | 'Processos' | 'Outros'; // CATEGORIA DA DEMANDA
  treatmentOrder: number; // ORDEM DE TRATATIVA (1 a 100)
  status: 'Pendente' | 'Em Andamento' | 'Pausado' | 'Impedido' | 'Atribuído' | 'Concluído';
  progress?: number;     // % DE EVOLUÇÃO (0 a 100)
  assignedTo?: string;   // Nome do integrante se atribuído
  notes?: string;        // Observações / descrição
  jiraMetadata?: JiraMetadata;
}


