import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface WebhookLog {
  id: string;
  timestamp: string;
  event: string;
  jiraKey: string;
  summary: string;
  squad?: string;
  status?: string;
  payloadSnippet: string;
}

interface JiraEvent {
  id: string;
  event: string; // 'jira:issue_created' | 'jira:issue_updated' | 'jira:issue_resolved'
  jiraKey: string;
  summary: string;
  description?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterArea?: string;
  issueType?: string;
  priority?: string;
  category?: string;
  squad?: string; // 'dados' | 'operacoes' | 'rpa'
  status?: string;
  receivedAt: string;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/plain', 'text/html', 'application/xml'] }));

// In-memory logs and events for live sync
const webhookLogs: WebhookLog[] = [];
const jiraEvents: JiraEvent[] = [];

function recordEventAndLog(
  event: string, 
  jiraKey: string, 
  summary: string, 
  squad?: string, 
  status?: string, 
  extraData: Partial<JiraEvent> = {},
  rawPayloadSnippet?: string
) {
  const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  const newLog: WebhookLog = {
    id: `log-${eventId}`,
    timestamp: nowStr,
    event,
    jiraKey,
    summary,
    squad,
    status,
    payloadSnippet: rawPayloadSnippet || JSON.stringify({ event, jiraKey, summary, squad, status })
  };
  webhookLogs.unshift(newLog);
  if (webhookLogs.length > 50) webhookLogs.pop();

  const newJiraEvent: JiraEvent = {
    id: eventId,
    event,
    jiraKey,
    summary,
    squad,
    status,
    description: extraData.description || 'Demanda recebida via automação do Jira.',
    requesterName: extraData.requesterName || 'Solicitante Jira',
    requesterEmail: extraData.requesterEmail || 'solicitante@empresa.com',
    requesterArea: extraData.requesterArea || 'Área Solicitante',
    issueType: extraData.issueType || 'Formulário Jira',
    priority: extraData.priority || '2 - Alta',
    category: extraData.category || 'Outros',
    receivedAt: nowStr
  };

  jiraEvents.unshift(newJiraEvent);
  if (jiraEvents.length > 50) jiraEvents.pop();

  return newJiraEvent;
}

// 1. Jira Webhook Listener Endpoint (Handles POST, GET, HEAD, OPTIONS and trailing slashes without redirects)
const handleJiraWebhook = (req: express.Request, res: express.Response) => {
  // CORS & Options Pre-flight support
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, HEAD");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return res.status(200).end();
  }

  // Handle GET (Jira validation ping or browser check)
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "Jira Webhook Endpoint Ativo e Pronto",
      timestamp: new Date().toISOString()
    });
  }

  // Handle POST (Actual Jira Webhook Event)
  try {
    const body = req.body || {};
    const event = body.webhookEvent || body.event || 'jira:issue_created';
    const issue = body.issue || {};
    const jiraKey = issue.key || body.key || `JIRA-${Math.floor(100 + Math.random() * 900)}`;
    const fields = issue.fields || {};
    const summary = fields.summary || body.summary || 'Nova solicitação do Jira';
    
    // Extract squad custom field or status if provided
    const squad = fields.customfield_squad || body.squad || body.suggestedSquad;
    const status = fields.status?.name || body.status || 'Triagem';

    const recordedEvent = recordEventAndLog(
      event,
      jiraKey,
      summary,
      squad,
      status,
      {
        description: fields.description || body.description,
        requesterName: fields.reporter?.displayName || body.requesterName,
        requesterEmail: fields.reporter?.emailAddress || body.requesterEmail,
        requesterArea: fields.customfield_area || body.requesterArea,
        issueType: fields.issuetype?.name || body.issueType,
        priority: fields.priority?.name || body.priority,
        category: fields.customfield_category || body.category
      },
      JSON.stringify(body)
    );

    return res.status(200).json({
      success: true,
      message: `Webhook processado com sucesso para a key ${jiraKey}`,
      receivedAt: new Date().toISOString(),
      event: recordedEvent
    });
  } catch (error: any) {
    console.error("Erro ao processar Webhook do Jira:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

app.all("/api/jira/webhook", handleJiraWebhook);
app.all("/api/jira/webhook/", handleJiraWebhook);

// 2. Fetch Recent Webhook Logs & Events Endpoint
app.get("/api/jira/logs", (req, res) => {
  res.json({
    success: true,
    totalLogs: webhookLogs.length,
    logs: webhookLogs
  });
});

app.get("/api/jira/events", (req, res) => {
  res.json({
    success: true,
    totalEvents: jiraEvents.length,
    events: jiraEvents
  });
});

// 3. Jira Simulator Endpoint for Testing
app.post("/api/jira/simulate", (req, res) => {
  const { eventType, jiraKey, title, requesterName, requesterArea, priority, category, squadId, statusName, description } = req.body;
  
  const key = jiraKey || `JIRA-${Math.floor(100 + Math.random() * 900)}`;
  const summary = title || 'Nova solicitação via Formulário Jira';

  const recordedEvent = recordEventAndLog(
    eventType || 'jira:issue_created',
    key,
    summary,
    squadId,
    statusName || (eventType === 'jira:issue_resolved' ? 'Concluído' : 'Triagem'),
    {
      description: description || 'Solicitação gerada no Jira para teste de integração passiva.',
      requesterName: requesterName || 'Mariana Costa (Jira)',
      requesterArea: requesterArea || 'Financeiro & CX',
      priority: priority || '2 - Alta',
      category: category || 'Dashboard'
    },
    JSON.stringify(req.body)
  );

  res.json({
    success: true,
    message: `Simulação de evento '${eventType}' realizada para ${key}`,
    simulatedAt: new Date().toISOString(),
    event: recordedEvent
  });
});

// 4. Supabase Edge Function consultar-cards-jira Simulator / Proxy Endpoint
app.all("/api/jira/consultar-cards-jira", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Sample cards mapping to the exact application rules
  const sampleCards = [
    {
      key: "KAN-201",
      title: "Nova Solicitação de Ingestão de Dados DW",
      status: "Aberto",
      squad: "Squad de Dados",
      requester: "Carolina Santos",
      description: "Ajuste e otimização na carga noturna do Data Warehouse",
      priority: "2 - Alta",
      category: "Ingestão"
    },
    {
      key: "KAN-202",
      title: "Validação de Processos de Pedidos em Triagem",
      status: "Triagem",
      squad: "Squad de Operações",
      requester: "Roberto Lima",
      description: "Análise de gargalos no fluxo de aprovações de novos pedidos",
      priority: "3 - Média",
      category: "Processos"
    },
    {
      key: "KAN-203",
      title: "Construção do Dashboard de Performance Q3",
      status: "Em Andamento",
      squad: "Squad de Dados",
      requester: "Juliana Andrade",
      description: "Desenvolvimento de painel consolidado para a diretoria comercial",
      priority: "1 - Urgente",
      category: "Dashboard"
    },
    {
      key: "KAN-204",
      title: "Automação RPA de Conciliação Bancária",
      status: "Em Andamento",
      squad: "Squad de RPA",
      requester: "Marcelo Faria",
      description: "Robô para extração e validação dos extratos bancários",
      priority: "2 - Alta",
      category: "Automação"
    },
    {
      key: "KAN-205",
      title: "Acompanhamento da Fila de Ordens de Serviço",
      status: "Aguardando Squads",
      squad: "Squad de Operações",
      requester: "Luciana Mello",
      description: "Gestão operacional das ordens de serviço pendentes",
      priority: "2 - Alta",
      category: "Processos"
    },
    {
      key: "KAN-206",
      title: "Integração API do Gateway de Pagamentos",
      status: "Concluído",
      squad: "Squad de Dados",
      categoriaStatus: "Done",
      requester: "Felipe Nogueira",
      description: "API de webhook configurada e testada em produção",
      priority: "2 - Alta",
      category: "API"
    },
    {
      key: "KAN-207",
      title: "Disparo Automático de Boletos em Lote",
      status: "Finalizado",
      squad: "Squad de RPA",
      categoriaStatus: "Done",
      requester: "Aline Castro",
      description: "Automação de envio concluída e validada",
      priority: "3 - Média",
      category: "Automação"
    }
  ];

  return res.status(200).json({
    success: true,
    source: "consultar-cards-jira",
    cards: sampleCards
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "EmanaPay Squads Integration Engine" });
});

// Explicit API 404 handler (prevents /api/ requests from falling through to Vite or index.html)
app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "API endpoint não encontrado" });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[EmanaPay Server] Servidor de Integração rodando na porta ${PORT}`);
  });
}

startServer();
