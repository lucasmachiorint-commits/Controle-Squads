const express = require('express');
const path = require('path');
const fs = require('fs');

// Carregar .env se existir
if (fs.existsSync('.env')) {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Permite requisições CORS de qualquer origem (inclusive do GitHub Pages)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(__dirname));

// Parser para o formato ADF (Atlassian Document Format) do Jira v3
function parseADFDescription(doc) {
  if (!doc) return 'Sem descrição';
  if (typeof doc === 'string') return doc;
  if (doc.type === 'doc' && Array.isArray(doc.content)) {
    let texts = [];
    function traverse(node) {
      if (node.type === 'text' && node.text) texts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(traverse);
    }
    doc.content.forEach(traverse);
    return texts.join(' ') || 'Sem descrição';
  }
  return 'Sem descrição';
}

// Proxy para consultar cards do Jira Cloud em tempo real com paginação completa
app.get('/api/jira/consultar-cards-jira', async (req, res) => {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const domain = process.env.JIRA_DOMAIN || 'naturapay.atlassian.net';
    const email = process.env.JIRA_EMAIL || 'lucas.machiori.nt@naturapay.net';
    const token = process.env.JIRA_API_TOKEN || '';

    if (!email || !token) {
      return res.json({ success: false, message: 'Credenciais Jira ausentes no .env', cards: [] });
    }

    const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    
    let startAt = 0;
    let maxResults = 100;
    let allIssues = [];

    // Paginação para buscar todos os chamados do Jira
    while (true) {
      const jqlQuery = encodeURIComponent('project = GAU ORDER BY created DESC');
      const jiraUrl = `https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&startAt=${startAt}&maxResults=${maxResults}`;

      const response = await fetch(jiraUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Jira API Error]:', response.status, errText);
        break;
      }

      const json = await response.json();
      const issues = json.issues || [];
      if (!issues.length) break;

      allIssues = allIssues.concat(issues);
      startAt += issues.length;
      if (allIssues.length >= (json.total || 0) || issues.length < maxResults) break;
    }

    const cards = allIssues.map((issue, idx) => {
      const fields = issue.fields || {};
      const statusName = fields.status?.name || 'Aberto';
      const catStatus = fields.status?.statusCategory?.name || 'To Do';
      const summary = fields.summary || 'Demanda do Jira';
      const reporter = fields.reporter?.displayName || 'Solicitante Jira';

      // Identificar a Squad de Atendimento a partir do customfield_12475 (16005 = Operações NPay, 16006 = Dados Operações, 16007 = RPA)
      let squadId = 'dados';
      let squadName = 'Squad de Dados';

      const cfSquad = fields.customfield_12475 || fields.customfield_16005 || fields.customfield_16006 || fields.customfield_16007 || fields.customfield_squad;
      let cfStr = '';
      if (cfSquad) {
        if (typeof cfSquad === 'object') {
          cfStr = (cfSquad.id || cfSquad.value || JSON.stringify(cfSquad)).toString().toLowerCase();
        } else {
          cfStr = cfSquad.toString().toLowerCase();
        }
      }

      if (cfStr.includes('16005') || cfStr.includes('operac') || cfStr.includes('operaç')) {
        squadId = 'operacoes';
        squadName = 'Squad de Operações';
      } else if (cfStr.includes('16007') || cfStr.includes('rpa')) {
        squadId = 'rpa';
        squadName = 'Squad de RPA';
      } else if (cfStr.includes('16006') || cfStr.includes('dados')) {
        squadId = 'dados';
        squadName = 'Squad de Dados';
      }

      return {
        id: issue.id || `jira-${idx}`,
        key: issue.key,
        jiraKey: issue.key,
        title: summary,
        summary,
        status: statusName,
        categoriaStatus: catStatus,
        squad: squadName,
        squadTarget: squadId,
        customfield_12475: cfSquad,
        requester: reporter,
        priority: fields.priority?.name || '2 - Alta',
        category: 'Geral',
        description: parseADFDescription(fields.description)
      };
    });

    console.log(`[Jira Proxy] ${cards.length} cards reais obtidos do espaço GAU com sucesso.`);
    return res.json({ success: true, count: cards.length, cards });
  } catch (err) {
    console.error('Erro no Proxy Jira:', err);
    return res.status(500).json({ success: false, error: err.message, cards: [] });
  }
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Controle-Squads (Padrão Painel-OPS) rodando em http://localhost:${PORT}`);
});
