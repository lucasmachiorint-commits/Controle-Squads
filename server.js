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
app.use(express.static(__dirname));

// Proxy para consultar cards do Jira Cloud (com SSL bypass se necessário)
app.get('/api/jira/consultar-cards-jira', async (req, res) => {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const domain = process.env.JIRA_DOMAIN || 'naturapay.atlassian.net';
    const email = process.env.JIRA_EMAIL || '';
    const token = process.env.JIRA_API_TOKEN || '';

    if (!email || !token) {
      return res.json({ success: false, message: 'Credenciais Jira ausentes no .env', cards: [] });
    }

    const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
    const jqlQuery = encodeURIComponent('project = GAU ORDER BY created DESC');
    const jiraUrl = `https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&maxResults=100`;

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
      return res.status(response.status).json({ success: false, error: errText, cards: [] });
    }

    const json = await response.json();
    const issues = json.issues || [];

    const cards = issues.map((issue, idx) => {
      const fields = issue.fields || {};
      const statusName = fields.status?.name || 'Aberto';
      const catStatus = fields.status?.statusCategory?.name || 'To Do';
      const summary = fields.summary || 'Demanda sem título';
      const reporter = fields.reporter?.displayName || 'Solicitante Jira';

      let squadName = 'Squad de Dados';
      if (fields.customfield_16005 || fields.customfield_squad === '16005') squadName = 'Squad de Operações';
      else if (fields.customfield_16007 || fields.customfield_squad === '16007') squadName = 'Squad de RPA';

      return {
        id: issue.id || `jira-${idx}`,
        key: issue.key,
        jiraKey: issue.key,
        title: summary,
        summary,
        status: statusName,
        categoriaStatus: catStatus,
        squad: squadName,
        requester: reporter,
        priority: fields.priority?.name || '2 - Alta',
        category: 'Geral',
        description: typeof fields.description === 'string' ? fields.description : 'Importado via API REST do Jira'
      };
    });

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
