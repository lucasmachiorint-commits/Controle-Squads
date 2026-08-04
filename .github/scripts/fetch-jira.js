const fs = require('fs');

const JIRA_DOMAIN = process.env.JIRA_DOMAIN || 'naturapay.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

if (!JIRA_EMAIL || !JIRA_TOKEN) {
  console.error("ERRO: Faltam variáveis de ambiente (JIRA_EMAIL ou JIRA_TOKEN).");
  process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
const jqlQuery = encodeURIComponent('project = GAU ORDER BY created DESC');
const maxResults = 100;

async function fetchJiraAndSaveJson() {
  let allIssues = [];
  let startAt = 0;
  let nextPageToken = null;
  let pageCount = 0;

  console.log(`Iniciando extração do Jira em ${JIRA_DOMAIN}...`);

  while (pageCount < 20) {
    pageCount++;
    let jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&maxResults=${maxResults}&startAt=${startAt}`;
    if (nextPageToken) {
      jiraUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    try {
      const res = await fetch(jiraUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        console.error(`Erro Jira: ${res.status} - ${res.statusText}`);
        const text = await res.text();
        console.error(text);
        break;
      }

      const json = await res.json();
      const issues = json.issues || [];
      if (!issues.length) break;

      allIssues = allIssues.concat(issues);
      startAt += issues.length;

      console.log(`Página ${pageCount} - Obtidos ${issues.length} chamados. Total: ${allIssues.length}`);

      if (json.isLast || !json.nextPageToken || issues.length < maxResults) break;
      nextPageToken = json.nextPageToken;
    } catch (e) {
      console.error(`Falha na conexão com Jira:`, e.message);
      break;
    }
  }

  if (allIssues.length === 0) {
    console.warn("Nenhum chamado retornado pelo Jira.");
    process.exit(0);
  }

  console.log(`Total final: ${allIssues.length} cards extraídos. Transformando...`);

  const cards = allIssues.map((issue, idx) => {
    const fields = issue.fields || {};
    const statusName = fields.status?.name || 'Aberto';
    const catStatus = fields.status?.statusCategory?.name || 'To Do';
    const summary = fields.summary || 'Demanda do Jira';
    const reporter = fields.reporter?.displayName || 'Solicitante Jira';

    let createdFormatted = new Date().toLocaleDateString('pt-BR');
    if (fields.created) {
      try {
        const d = new Date(fields.created);
        createdFormatted = d.toLocaleDateString('pt-BR');
      } catch (e) {
        createdFormatted = fields.created;
      }
    }

    const cfSquad = fields.customfield_12475 || fields.customfield_squad;

    return {
      id: issue.id || `jira-${idx}`,
      key: issue.key,
      jiraKey: issue.key,
      title: summary,
      summary: summary,
      status: statusName,
      categoriaStatus: catStatus,
      customfield_12475: cfSquad,
      squad: cfSquad,
      requester: reporter,
      priority: fields.priority?.name || '2 - Alta',
      category: 'Geral',
      createdDate: createdFormatted,
      description: typeof fields.description === 'string' 
                   ? fields.description 
                   : (fields.description?.content ? JSON.stringify(fields.description) : 'Sincronizado via Jira API')
    };
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    totalCards: cards.length,
    cards: cards
  };

  fs.writeFileSync('jira-data.json', JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ SUCESSO! ${cards.length} cards gravados com sucesso em jira-data.json.`);
}

fetchJiraAndSaveJson();
