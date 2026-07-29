import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Zap, 
  Code, 
  Server, 
  Terminal, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Layers,
  Sparkles,
  Database,
  Cog,
  Bot,
  AlertTriangle
} from 'lucide-react';
import { SquadId } from '../types';

interface JiraIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSimulatedWebhook: (eventType: string, squadId: SquadId, title: string) => void;
  onConsultarCardsJira?: (cards: any[]) => void;
}

export default function JiraIntegrationModal({
  isOpen,
  onClose,
  onTriggerSimulatedWebhook,
  onConsultarCardsJira
}: JiraIntegrationModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'api' | 'simulator' | 'logs'>('instructions');

  // Supabase Edge Function states
  const [edgeFunctionUrl, setEdgeFunctionUrl] = useState(() => 
    localStorage.getItem('supabase_edge_function_url') || '/api/jira/consultar-cards-jira'
  );
  const [isConsultingEdge, setIsConsultingEdge] = useState(false);

  // Direct Jira REST API states
  const [jiraDomain, setJiraDomain] = useState(() => localStorage.getItem('jira_domain') || '');
  const [jiraEmail, setJiraEmail] = useState(() => localStorage.getItem('jira_email') || '');
  const [jiraApiToken, setJiraApiToken] = useState(() => localStorage.getItem('jira_api_token') || '');
  const [jiraJql, setJiraJql] = useState(() => localStorage.getItem('jira_jql') || 'order by created DESC');
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [apiSyncStatus, setApiSyncStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleConsultarEdgeFunction = async () => {
    setIsConsultingEdge(true);
    setApiSyncStatus(null);
    localStorage.setItem('supabase_edge_function_url', edgeFunctionUrl.trim());

    try {
      const res = await fetch(edgeFunctionUrl.trim(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Falha na chamada da Edge Function (HTTP ${res.status})`);
      }

      const data = await res.json();
      const cards = data.cards || data.data || (Array.isArray(data) ? data : []);

      if (onConsultarCardsJira) {
        onConsultarCardsJira(cards);
      }

      setApiSyncStatus({
        type: 'success',
        message: `Sucesso! ${cards.length} cards foram recebidos da Supabase Edge Function 'consultar-cards-jira'. Novos cards foram incluídos e todo o histórico existente foi totalmente preservado.`
      });
    } catch (err: any) {
      console.error(err);
      setApiSyncStatus({
        type: 'error',
        message: err.message || 'Erro ao conectar à Supabase Edge Function consultar-cards-jira.'
      });
    } finally {
      setIsConsultingEdge(false);
    }
  };

  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Simulation form states
  const [simTitle, setSimTitle] = useState('Relatório Automatizado de Faturamento Mensal');
  const [simSquad, setSimSquad] = useState<SquadId>('dados');
  const [simEventType, setSimEventType] = useState<'jira:issue_created' | 'jira:issue_updated' | 'jira:issue_resolved'>('jira:issue_created');
  const [simKey, setSimKey] = useState(`KAN-${Math.floor(100 + Math.random() * 900)}`);

  const rawHost = typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com';
  // ais-dev is the internal dev frame container URL which requires AI Studio browser cookies (returns 302 to external callers).
  // ais-pre is the public app container URL which handles direct external HTTP POST calls returning HTTP 200.
  const publicHost = rawHost.replace(/^http:\/\//, 'https://').replace('ais-dev-', 'ais-pre-');
  const webhookEndpoint = `${publicHost}/api/jira/webhook`;

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/jira/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const sampleJson = `{
  "webhookEvent": "jira:issue_created",
  "issue": {
    "key": "KAN-105",
    "fields": {
      "summary": "Desenvolvimento de Robô RPA para Conciliação de Vendas",
      "reporter": { "displayName": "Luciana Santos", "emailAddress": "luciana@empresa.com" },
      "priority": { "name": "2 - Alta" },
      "customfield_squad": "rpa",
      "status": { "name": "Triagem" }
    }
  }
}`;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(sampleJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleSaveAndSyncApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingApi(true);
    setApiSyncStatus(null);

    localStorage.setItem('jira_domain', jiraDomain.trim());
    localStorage.setItem('jira_email', jiraEmail.trim());
    localStorage.setItem('jira_api_token', jiraApiToken.trim());
    localStorage.setItem('jira_jql', jiraJql.trim());

    if (!jiraDomain || !jiraEmail || !jiraApiToken) {
      setApiSyncStatus({
        type: 'error',
        message: 'Por favor, preencha o Domínio, E-mail e Token de API do Jira.'
      });
      setIsSyncingApi(false);
      return;
    }

    try {
      const cleanDomain = jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authHeader = 'Basic ' + btoa(`${jiraEmail.trim()}:${jiraApiToken.trim()}`);
      const searchUrl = `https://${cleanDomain}/rest/api/3/search?jql=${encodeURIComponent(jiraJql.trim() || 'order by created DESC')}&maxResults=20`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Credenciais do Jira inválidas. Verifique seu E-mail e Token.');
        }
        throw new Error(`Erro ao consultar o Jira (HTTP ${response.status})`);
      }

      const data = await response.json();
      const issues = data.issues || [];

      if (issues.length === 0) {
        setApiSyncStatus({
          type: 'info',
          message: 'Conexão estabelecida com sucesso! Nenhuma demanda encontrada para a consulta JQL informada.'
        });
      } else {
        issues.forEach((issue: any) => {
          const key = issue.key;
          const summary = issue.fields?.summary || 'Demanda do Jira';
          onTriggerSimulatedWebhook('jira:issue_created', 'dados', `[${key}] ${summary}`);
        });

        setApiSyncStatus({
          type: 'success',
          message: `Sincronização realizada com sucesso! ${issues.length} demandas do Jira foram importadas para a Fila de Triagem.`
        });
      }
    } catch (err: any) {
      console.error(err);
      setApiSyncStatus({
        type: 'error',
        message: err.message || 'Falha na conexão com o Jira Cloud. Verifique suas credenciais.'
      });
    } finally {
      setIsSyncingApi(false);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    onTriggerSimulatedWebhook(simEventType, simSquad, simTitle);
    
    // Also post to backend endpoint
    try {
      await fetch('/api/jira/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: simEventType,
          jiraKey: simKey,
          title: simTitle,
          squadId: simSquad,
          requesterName: 'Simulador Jira',
          requesterArea: 'Jira Automation'
        })
      });
      fetchLogs();
      setSimKey(`KAN-${Math.floor(100 + Math.random() * 900)}`);
      setActiveTab('logs');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-scale-up my-8">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004D36] text-[#00B074] flex items-center justify-center shrink-0 shadow-xs">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                Central de Integração Jira Webhooks
              </h3>
              <p className="text-xs text-slate-500">Conecte o formulário e automações do Jira diretamente à aplicação</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'instructions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code size={14} />
            <span>Guia Webhooks</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'api'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ExternalLink size={14} />
            <span>API Direta (Sincronizar)</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-[#004D36] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap size={14} className="text-[#00B074]" />
            <span>Simulador</span>
          </button>

          <button
            onClick={() => { setActiveTab('logs'); fetchLogs(); }}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'logs'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity size={14} />
            <span>Logs</span>
          </button>
        </div>

        {/* TAB 1: INSTRUCTIONS */}
        {activeTab === 'instructions' && (
          <div className="space-y-6">
            
            {/* Webhook Endpoint Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  1. URL Pública do Endpoint (Sem Redirecionamento 302)
                </label>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  HTTP 200 Direto
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-slate-800 truncate">
                  {webhookEndpoint}
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedUrl ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                <strong className="text-slate-700">Atenção para o Jira:</strong> Utilize obrigatoriamente a URL acima com o prefixo <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-700 font-bold">ais-pre-</code>. Ela garante respostas HTTP 200 diretas para as automações do Jira, sem redirecionamentos 302 da interface de preview.
              </p>
            </div>

            {/* Authentication Details Box */}
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                <ShieldCheck size={16} className="text-amber-600" />
                <span>Credenciais & Autenticação para o Jira</span>
              </div>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">
                Nossa API é flexível: aceita requisições diretas (Sem Autenticação) e também aceita tokens customizados caso o Jira exija um cabeçalho configurado.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Tipo de Autenticação</span>
                  <span className="text-xs font-extrabold text-slate-900">Bearer Token (ou Nenhuma)</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Token / Secret de Acesso</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <code className="text-xs font-mono font-bold text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded">
                      natura-squads-jira-key-2026
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('natura-squads-jira-key-2026');
                        alert('Token copiado para a área de transferência!');
                      }}
                      className="text-[11px] font-extrabold text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      <Copy size={12} />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Cabeçalho (Header Name)</span>
                  <code className="text-xs font-mono font-bold text-slate-800">Authorization</code>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Valor do Cabeçalho</span>
                  <code className="text-xs font-mono font-bold text-slate-800 truncate block">
                    Bearer natura-squads-jira-key-2026
                  </code>
                </div>
              </div>
            </div>

            {/* Jira Automation Steps */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                2. Passos para criar a regra no Jira (Jira Automation)
              </h4>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#004D36] text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                  <p>
                    No seu projeto do Jira, vá em <strong>Configurações do Projeto &gt; Automação (Automation) &gt; Criar Regra</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#004D36] text-white flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                  <p>
                    Escolha o Gatilho (Trigger): <strong>Issue Created</strong> (Gera card na Fila de Triagem) ou <strong>Issue Transitioned / Status Updated</strong> (Movimenta o card para Squad / Concluído).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#004D36] text-white flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                  <p>
                    Adicione a Ação (Action): <strong>Send Webhook</strong>. Cole a URL copiada acima e selecione o método <code>POST</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Sample JSON Payload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  3. Exemplo de Payload JSON Enviado pelo Jira
                </label>
                <button
                  onClick={handleCopyJson}
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                >
                  {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedJson ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>

              <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed">
                {sampleJson}
              </pre>
            </div>
          </div>
        )}

        {/* TAB: DIRECT JIRA API & SUPABASE EDGE FUNCTION SYNC */}
        {activeTab === 'api' && (
          <div className="space-y-5">
            {/* Supabase Edge Function Section */}
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/80 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#004D36] font-extrabold text-xs uppercase tracking-wider">
                  <Zap size={16} className="text-[#00B074]" />
                  <span>Supabase Edge Function: <code className="text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono">consultar-cards-jira</code></span>
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Mapeamento Automático
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Consulte os cards direto da Edge Function. O sistema importa e sincroniza novos cards mantendo integralmente o histórico de dados existente:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-semibold text-slate-700">
                <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200">
                  <span className="block font-black text-[#004D36] mb-0.5">1. Fila 'Aberto'</span>
                  <span>Cards com status <strong>Aberto</strong> ou <strong>Triagem</strong>.</span>
                </div>
                <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200">
                  <span className="block font-black text-[#004D36] mb-0.5">2. Filas de Squads</span>
                  <span>Distribuídos por <code>card.squad</code> (Dados, Operações ou RPA).</span>
                </div>
                <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200">
                  <span className="block font-black text-[#004D36] mb-0.5">3. Fila 'Concluídos'</span>
                  <span>Status <strong>Concluído</strong>, <strong>Finalizado</strong> ou <code>categoriaStatus === 'Done'</code>.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={edgeFunctionUrl}
                  onChange={(e) => setEdgeFunctionUrl(e.target.value)}
                  placeholder="https://<projeto>.supabase.co/functions/v1/consultar-cards-jira"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleConsultarEdgeFunction}
                  disabled={isConsultingEdge}
                  className="px-5 py-2.5 bg-[#004D36] hover:bg-[#003B27] text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={isConsultingEdge ? 'animate-spin' : ''} />
                  <span>{isConsultingEdge ? 'Consultando Edge Function...' : 'Consultar & Sincronizar'}</span>
                </button>
              </div>
            </div>

            <hr className="border-slate-200 my-4" />

            <form onSubmit={handleSaveAndSyncApi} className="space-y-4">
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 font-medium leading-relaxed">
              <strong className="font-extrabold text-blue-900 block mb-0.5">🌐 Importação Direta via API do Jira Cloud (Modo Estático)</strong>
              Conecte sua conta do Jira Cloud utilizando um Token de API do Atlassian. O aplicativo fará buscas diretas no Jira e importará as tarefas abertas para a Fila de Triagem.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Domínio do Jira Cloud
                </label>
                <input
                  type="text"
                  placeholder="suaempresa.atlassian.net"
                  value={jiraDomain}
                  onChange={(e) => setJiraDomain(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail do Atlassian
                </label>
                <input
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  API Token do Atlassian Jira
                </label>
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Gerar Token no Jira</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <input
                type="password"
                placeholder="Cole o token de API da Atlassian aqui..."
                value={jiraApiToken}
                onChange={(e) => setJiraApiToken(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Filtro JQL (Opcional - Ex: order by created DESC)
              </label>
              <input
                type="text"
                placeholder="project = KAN AND status != Done order by created DESC"
                value={jiraJql}
                onChange={(e) => setJiraJql(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {apiSyncStatus && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                apiSyncStatus.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                apiSyncStatus.type === 'error' ? 'bg-rose-50 text-rose-900 border border-rose-200' :
                'bg-blue-50 text-blue-900 border border-blue-200'
              }`}>
                {apiSyncStatus.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                {apiSyncStatus.type === 'error' && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                {apiSyncStatus.type === 'info' && <Sparkles size={16} className="text-blue-600 shrink-0" />}
                <span>{apiSyncStatus.message}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSyncingApi}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                <RefreshCw size={15} className={isSyncingApi ? 'animate-spin' : ''} />
                <span>{isSyncingApi ? 'Sincronizando com o Jira...' : 'Salvar & Sincronizar Demandas Agora'}</span>
              </button>
            </div>
          </form>
          </div>
        )}

        {/* TAB 2: SIMULATOR */}
        {activeTab === 'simulator' && (
          <form onSubmit={handleRunSimulation} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium leading-relaxed">
              ⚡ Teste a automação em tempo real sem precisar abrir o Jira! Envie eventos simulados para verificar o comportamento da Fila de Triagem e dos Backlogs.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Chave do Jira (Key)
                </label>
                <input
                  type="text"
                  value={simKey}
                  onChange={(e) => setSimKey(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Evento Jira
                </label>
                <select
                  value={simEventType}
                  onChange={(e: any) => setSimEventType(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="jira:issue_created">1. Nova Solicitação (Entra na Triagem)</option>
                  <option value="jira:issue_updated">2. Atribuição de Squad (Vai para Backlog)</option>
                  <option value="jira:issue_resolved">3. Card Concluído (Move para Concluídos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Título / Resumo da Demanda
              </label>
              <input
                type="text"
                value={simTitle}
                onChange={(e) => setSimTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Squad Alvo
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSimSquad('dados')}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
                    simSquad === 'dados'
                      ? 'bg-[#00B074]/20 text-[#00B074] border-[#00B074]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Database size={14} />
                  <span>Dados</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimSquad('operacoes')}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
                    simSquad === 'operacoes'
                      ? 'bg-[#FF5E00]/20 text-[#FF5E00] border-[#FF5E00]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Cog size={14} />
                  <span>Operações</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimSquad('rpa')}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 ${
                    simSquad === 'rpa'
                      ? 'bg-[#E31C79]/20 text-[#E31C79] border-[#E31C79]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Bot size={14} />
                  <span>RPA</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-[#004D36] hover:bg-[#003B27] text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Zap size={16} className="text-[#00B074]" />
                <span>Disparar Evento Webhook Simuladon</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: LIVE LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Histórico Recente de Disparos ({logs.length})
              </span>
              <button
                onClick={fetchLogs}
                disabled={isLoadingLogs}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} />
                <span>Atualizar</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                Nenhum webhook recebido recentemente. Utilize o <strong>Simulador</strong> para testar um disparo.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono border border-slate-800 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-emerald-400 font-bold">{log.jiraKey}</span>
                        <span className="text-[10px] text-slate-400">[{log.timestamp}]</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {log.event}
                        </span>
                      </div>
                      <p className="text-slate-300 font-sans text-xs font-semibold">{log.summary}</p>
                    </div>

                    {log.squad && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                        {log.squad}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-6">
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Integrador Ativo (200 OK)</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
