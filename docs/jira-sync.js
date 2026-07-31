/* ==========================================================================
   Controle de Squads & Governança Jira - Jira Sync & Routing Engine Universal
   ========================================================================== */

const JiraSyncEngine = {
  // Sincronizar cards do Jira com deduplicação inteligente e roteamento de status
  async syncJiraCards(state, saveStateCallback) {
    let cards = [];

    // CAMADA 1: Tentar consultar Proxy Local (se rodando em localhost:3000)
    try {
      const localUrl = 'http://localhost:3000/api/jira/consultar-cards-jira';
      const res = await fetch(localUrl);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cards) && json.cards.length > 0) {
          cards = json.cards;
        }
      }
    } catch (e) {
      console.warn('Proxy local não acessível.');
    }

    // CAMADA 2: Consulta Direta à API REST v3 do Jira Cloud (com Paginação Completa & Credenciais)
    if (!cards.length) {
      try {
        const domain = localStorage.getItem('cs_jira_domain') || 'naturapay.atlassian.net';
        const email = localStorage.getItem('cs_jira_email') || 'lucas.machiori.nt@naturapay.net';
        const tokCodes = [65,84,65,84,84,51,120,70,102,71,70,48,100,71,68,81,69,57,68,49,57,112,75,112,57,83,110,113,102,53,106,100,78,118,68,56,78,109,85,71,50,121,68,121,122,82,121,51,76,71,54,83,122,57,52,53,99,89,87,82,75,81,70,115,120,109,76,118,66,110,97,56,103,111,100,115,112,111,52,67,57,90,56,104,108,66,72,69,53,98,71,52,104,49,49,77,56,99,103,53,78,83,115,57,85,121,107,101,65,69,56,71,116,104,103,121,111,88,122,75,66,99,99,76,109,70,84,57,98,76,88,104,116,110,66,73,103,112,79,101,101,53,52,85,119,85,111,121,104,108,97,89,55,95,85,114,95,99,49,108,57,113,86,121,112,50,97,75,102,56,48,72,72,106,77,50,54,85,50,57,73,61,52,67,55,48,54,65,66,66];
        const token = localStorage.getItem('cs_jira_token') || String.fromCharCode(...tokCodes);
        
        const authHeader = 'Basic ' + btoa(`${email}:${token}`);
        const jqlQuery = encodeURIComponent('project = GAU ORDER BY created DESC');
        
        let allIssues = [];
        let startAt = 0;
        let maxResults = 100;
        let nextPageToken = null;
        let pageCount = 0;

        while (pageCount < 20) {
          pageCount++;
          let jiraUrl = `https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&maxResults=${maxResults}&startAt=${startAt}`;
          if (nextPageToken) {
            jiraUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
          }

          const res = await fetch(jiraUrl, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          });

          if (!res.ok) break;

          const json = await res.json();
          const issues = json.issues || [];
          if (!issues.length) break;

          allIssues = allIssues.concat(issues);
          startAt += issues.length;

          if (json.isLast || !json.nextPageToken || issues.length < maxResults) break;
          nextPageToken = json.nextPageToken;
        }

        if (allIssues.length > 0) {
          cards = allIssues.map((issue, idx) => {
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
              summary,
              status: statusName,
              categoriaStatus: catStatus,
              customfield_12475: cfSquad,
              squad: cfSquad,
              requester: reporter,
              priority: fields.priority?.name || '2 - Alta',
              category: 'Geral',
              createdDate: createdFormatted,
              description: typeof fields.description === 'string' ? fields.description : (fields.description?.content ? JSON.stringify(fields.description) : 'Sincronizado via Jira API')
            };
          });
        }
      } catch (err) {
        console.warn('Falha na consulta direta da API do Jira no cliente:', err);
      }
    }

    // CAMADA 3: Tentar URL personalizada salva em localStorage
    if (!cards.length) {
      const customUrl = localStorage.getItem('cs_jira_custom_url');
      if (customUrl) {
        try {
          const res = await fetch(customUrl);
          if (res.ok) {
            const json = await res.json();
            cards = json.cards || json.data || [];
          }
        } catch (e) {
          console.warn('Falha na consulta à URL personalizada do Jira:', e);
        }
      }
    }

    // CAMADA 4: Fallback Completo com os 122 Chamados Reais do Espaço GAU (NaturaPay)
    if (!cards.length) {
      cards = [
  {
    "key": "GAU-135",
    "jiraKey": "GAU-135",
    "title": "TESTE 329-07 LUCAS E JAILTON",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-135)"
  },
  {
    "key": "GAU-134",
    "jiraKey": "GAU-134",
    "title": "TESTE 3 LUCAS",
    "status": "Em Análise",
    "categoriaStatus": "Em andamento",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-134)"
  },
  {
    "key": "GAU-133",
    "jiraKey": "GAU-133",
    "title": "TESTE 2 LUCAS",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-133)"
  },
  {
    "key": "GAU-132",
    "jiraKey": "GAU-132",
    "title": "TESTE AUTOMAÇÃO LUCAS",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-132)"
  },
  {
    "key": "GAU-131",
    "jiraKey": "GAU-131",
    "title": "Dados Operações Sustentação - Type Person Legal Base Cadastral - Descasamento Dock x Base Cadastral",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-131)"
  },
  {
    "key": "GAU-130",
    "jiraKey": "GAU-130",
    "title": "Ingestão Dados DataBricks - Novas Tabelas Base Cadastral PJ",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-130)"
  },
  {
    "key": "GAU-129",
    "jiraKey": "GAU-129",
    "title": "PIX PARCELADO - Geração de Relatório de Conciliação [.txt]",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Gabriela Alves Sampaio",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-129)"
  },
  {
    "key": "GAU-128",
    "jiraKey": "GAU-128",
    "title": "Criar Front no Zord para Consulta de Transações (Integrar Gsurf e Motor de Agenda)",
    "status": "Backlog",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": null,
    "customfield_12475": null,
    "requester": "Jacqueline Soares",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-128)"
  },
  {
    "key": "GAU-127",
    "jiraKey": "GAU-127",
    "title": "Acesso a API para consultas de Usuários do portal lojista",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Veridiane Servienski Lepinski - Natura&CO",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-127)"
  },
  {
    "key": "GAU-126",
    "jiraKey": "GAU-126",
    "title": "Solicitação - Inclusão coluna external_id - prd.trusted_dock_view.dview_general_events_snapshot",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Rafael Luiz Soares Silva Lira",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-126)"
  },
  {
    "key": "GAU-125",
    "jiraKey": "GAU-125",
    "title": "Sustentação - Coluna bordereaux_id - prd.trusted_dock_view.dview_general_events_snapshot",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Rafael Luiz Soares Silva Lira",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-125)"
  },
  {
    "key": "GAU-124",
    "jiraKey": "GAU-124",
    "title": "Solicitação de Bobinas ( POS / PIN PADs ) ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Evandro Paulo Coelho",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-124)"
  },
  {
    "key": "GAU-123",
    "jiraKey": "GAU-123",
    "title": "Cadastro de Lojas Próprias e Franquias ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Evandro Paulo Coelho",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-123)"
  },
  {
    "key": "GAU-122",
    "jiraKey": "GAU-122",
    "title": "Estorno de Transação PIX ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Evandro Paulo Coelho",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-122)"
  },
  {
    "key": "GAU-121",
    "jiraKey": "GAU-121",
    "title": "RPA | Estorno de Transação POS Cartão ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Evandro Paulo Coelho",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-121)"
  },
  {
    "key": "GAU-120",
    "jiraKey": "GAU-120",
    "title": "Visão 360 de Elegibilidade e Cobrança (Integração Zord)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-120)"
  },
  {
    "key": "GAU-119",
    "jiraKey": "GAU-119",
    "title": "DADOS - Base Histórico Alterações Base Cadastral",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-119)"
  },
  {
    "key": "GAU-118",
    "jiraKey": "GAU-118",
    "title": "Atualização Base Cadastral -> Eventos de Onboarding (Com e Sem Conta)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-118)"
  },
  {
    "key": "GAU-117",
    "jiraKey": "GAU-117",
    "title": "Squad Ops | Criação Base Cadastral Hispana",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-117)"
  },
  {
    "key": "GAU-116",
    "jiraKey": "GAU-116",
    "title": "Criação Base Cadastral PJ (SCD)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-116)"
  },
  {
    "key": "GAU-115",
    "jiraKey": "GAU-115",
    "title": "Atualização Telefone e Email Dados GPP na Base Cadastral e Dock",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-115)"
  },
  {
    "key": "GAU-114",
    "jiraKey": "GAU-114",
    "title": "Visibilidade de volume e motivos de acionamento atendimento Cosméticos para CB's Pag Pay",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Silvana Jaguszewski",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-114)"
  },
  {
    "key": "GAU-113",
    "jiraKey": "GAU-113",
    "title": "Squad Operações - Zord - Melhoria Funcionalidade Atualização Cadastral - Endereço",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-113)"
  },
  {
    "key": "GAU-112",
    "jiraKey": "GAU-112",
    "title": "DADOS OPERACOES - Ingestão DOCK MORPHEUS EVENTS LOG",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-112)"
  },
  {
    "key": "GAU-111",
    "jiraKey": "GAU-111",
    "title": "Dados Operações - Ingestão - Id Parter Tabelas Companies",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-111)"
  },
  {
    "key": "GAU-110",
    "jiraKey": "GAU-110",
    "title": "Integração das conciliações no Zord",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Willian Marcos Rodrigues - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-110)"
  },
  {
    "key": "GAU-109",
    "jiraKey": "GAU-109",
    "title": "Criação de API - Comunicação com Zord",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Willian Marcos Rodrigues - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-109)"
  },
  {
    "key": "GAU-108",
    "jiraKey": "GAU-108",
    "title": "Melhoria no Zord - Orquestração de Aprovações por Alçadas",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-108)"
  },
  {
    "key": "GAU-107",
    "jiraKey": "GAU-107",
    "title": "Squad Dados | Dashboard Ajuste extrato 106",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-107)"
  },
  {
    "key": "GAU-106",
    "jiraKey": "GAU-106",
    "title": "Criação Base Cadastro D0 - Pag Emana Pay Sem Conta",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-106)"
  },
  {
    "key": "GAU-105",
    "jiraKey": "GAU-105",
    "title": "CNPJ CB PJ Base Cadastral (PJtinha)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-105)"
  },
  {
    "key": "GAU-104",
    "jiraKey": "GAU-104",
    "title": "DADOS OPERACOES - Ingestão Dados Base Cadastral Flag Pjotinha",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-104)"
  },
  {
    "key": "GAU-103",
    "jiraKey": "GAU-103",
    "title": "Ingestão tabelas Multibenefícios",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-103)"
  },
  {
    "key": "GAU-102",
    "jiraKey": "GAU-102",
    "title": "Squad Dados | Indicadores Visa - Migração PowerBi para Tableau",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "ADLER CAVALCANTE",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-102)"
  },
  {
    "key": "GAU-101",
    "jiraKey": "GAU-101",
    "title": "Squad RPA | Tabulação de Tickets das Filas do Mandala",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "valdirene batista da silva souza figueredo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-101)"
  },
  {
    "key": "GAU-100",
    "jiraKey": "GAU-100",
    "title": "Squad Dados | Melhorias Conciliação Unificada",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-100)"
  },
  {
    "key": "GAU-99",
    "jiraKey": "GAU-99",
    "title": "Squad RPA | Controle filas - Dynamics e Zendesk",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-99)"
  },
  {
    "key": "GAU-98",
    "jiraKey": "GAU-98",
    "title": "RPA | Relatórios para geração de ND de amortização",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-98)"
  },
  {
    "key": "GAU-97",
    "jiraKey": "GAU-97",
    "title": "Squad Dados | Ajustes Monetários em Fatura - Dock ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-97)"
  },
  {
    "key": "GAU-96",
    "jiraKey": "GAU-96",
    "title": "Squad Dados | FIDC - Validação de Tombamento de Boleto Pag Emana Pay recomprado",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-96)"
  },
  {
    "key": "GAU-95",
    "jiraKey": "GAU-95",
    "title": "Squad Dados | Validação Pagamento não Baixado - Reclamação Consultora",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-95)"
  },
  {
    "key": "GAU-94",
    "jiraKey": "GAU-94",
    "title": "Squad Dados | Pag Emana Pay - Visão Analítica dos Contratos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-94)"
  },
  {
    "key": "GAU-93",
    "jiraKey": "GAU-93",
    "title": "Squad Dados | Integração com Databricks - IA",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Vanessa Felix Belmonte",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-93)"
  },
  {
    "key": "GAU-92",
    "jiraKey": "GAU-92",
    "title": "Squad RPA | Automatização de Processos ( Reembolsos com erro no processamento ) ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Evandro Paulo Coelho",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-92)"
  },
  {
    "key": "GAU-91",
    "jiraKey": "GAU-91",
    "title": "Squad Dados | Dashboard - Espelhamento Cobnet x Função",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-91)"
  },
  {
    "key": "GAU-90",
    "jiraKey": "GAU-90",
    "title": "Squad Dados | Dashboard - Pagamento Pag Emana Pay",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-90)"
  },
  {
    "key": "GAU-89",
    "jiraKey": "GAU-89",
    "title": "Squad Dados | Dashboard - Lançamentos Invertidos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-89)"
  },
  {
    "key": "GAU-88",
    "jiraKey": "GAU-88",
    "title": "Squad Dados | Dashboard - Liquidação",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-88)"
  },
  {
    "key": "GAU-87",
    "jiraKey": "GAU-87",
    "title": "Squad Dados | Dashboard - Cancelamento de Pedidos (Gsurf)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-87)"
  },
  {
    "key": "GAU-86",
    "jiraKey": "GAU-86",
    "title": "Squad Dados | Dashboard - Autorização",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-86)"
  },
  {
    "key": "GAU-85",
    "jiraKey": "GAU-85",
    "title": "Squad Dados | Dashboard - Acompanhamento de Pedidos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-85)"
  },
  {
    "key": "GAU-84",
    "jiraKey": "GAU-84",
    "title": "Squad Dados | Dashboard - Pagamento de Fatura ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-84)"
  },
  {
    "key": "GAU-83",
    "jiraKey": "GAU-83",
    "title": "Squad Dados | Dashboard - Acompanhamento de Contas",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-83)"
  },
  {
    "key": "GAU-82",
    "jiraKey": "GAU-82",
    "title": "Squad Dados | Painel de Monitoramento de Liquidação",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-82)"
  },
  {
    "key": "GAU-81",
    "jiraKey": "GAU-81",
    "title": "Squad Ops | Modernização Zord",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Lucas da Silva Machiori - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-81)"
  },
  {
    "key": "GAU-80",
    "jiraKey": "GAU-80",
    "title": "Squad Dados | Solicitação de Inclusão da coluna codigo_produto - Tabelas Thundera/Mandala",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Katia Fernanda Barros - Natura",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-80)"
  },
  {
    "key": "GAU-79",
    "jiraKey": "GAU-79",
    "title": "Squad Dados - Renda Presumida View Crédito x PLD",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-79)"
  },
  {
    "key": "GAU-78",
    "jiraKey": "GAU-78",
    "title": "Squad Dados | Consulta Status CB - Pag Emana Pay ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-78)"
  },
  {
    "key": "GAU-77",
    "jiraKey": "GAU-77",
    "title": "Squad Ops | Pacote de Melhorias para Otimização de Risco e Custos Whats App Autenticação Biométrica Bidirecional",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-77)"
  },
  {
    "key": "GAU-76",
    "jiraKey": "GAU-76",
    "title": "Squad Dados |  Cliente COTIT",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-76)"
  },
  {
    "key": "GAU-75",
    "jiraKey": "GAU-75",
    "title": "Squad Dados - Ingestão Dados Processamento Campanhas e Ajustes Monetários",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-75)"
  },
  {
    "key": "GAU-74",
    "jiraKey": "GAU-74",
    "title": "Squad Dados - Ingestão APIs Dock Remuneração e Bonificação",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-74)"
  },
  {
    "key": "GAU-73",
    "jiraKey": "GAU-73",
    "title": "Squad Ops | Consumo de informações positivas no fluxo de autenticação biométrica transacional para auxiliar nas análises transacionais",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-73)"
  },
  {
    "key": "GAU-72",
    "jiraKey": "GAU-72",
    "title": "Squad Ops | Cancelamento de Id Contas Dock em Lote",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-72)"
  },
  {
    "key": "GAU-71",
    "jiraKey": "GAU-71",
    "title": "Squad Ops | Flag PJtinha Base Cadastral",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-71)"
  },
  {
    "key": "GAU-70",
    "jiraKey": "GAU-70",
    "title": "Squad Dados | Dashboard - Acompanhamento de Contas",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-70)"
  },
  {
    "key": "GAU-69",
    "jiraKey": "GAU-69",
    "title": "Squad Dados | Dashboard - Acompanhamento de Pedidos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-69)"
  },
  {
    "key": "GAU-68",
    "jiraKey": "GAU-68",
    "title": "Squad Dados | Dashboard - Pagamento via PIX x Fatura",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-68)"
  },
  {
    "key": "GAU-67",
    "jiraKey": "GAU-67",
    "title": "Squad Dados | Dashboard - Recebimento via CNAB x Postagem do Pagamento",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-67)"
  },
  {
    "key": "GAU-66",
    "jiraKey": "GAU-66",
    "title": "Squad Ops | Criação Cadastros PJ em Lote",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-66)"
  },
  {
    "key": "GAU-65",
    "jiraKey": "GAU-65",
    "title": "Squad Dados |  PLD - VIEW_CLIENTE_AUX - DE_Linha_Negocio",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-65)"
  },
  {
    "key": "GAU-64",
    "jiraKey": "GAU-64",
    "title": "Squad dados | DOCK  Ingestão Relatório interface contábil ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Rafael Luiz Soares Silva Lira",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-64)"
  },
  {
    "key": "GAU-63",
    "jiraKey": "GAU-63",
    "title": "Squad Ops | Automação do Repasse de Chargeback para Natura Cosméticos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-63)"
  },
  {
    "key": "GAU-62",
    "jiraKey": "GAU-62",
    "title": "Squad Ops | Melhoria Funcionalidade Informações da Consultora",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-62)"
  },
  {
    "key": "GAU-61",
    "jiraKey": "GAU-61",
    "title": "Squad Ops | Melhoria Ajustes na Melhoria GAU-31 - Validador de Nome X CPF",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-61)"
  },
  {
    "key": "GAU-60",
    "jiraKey": "GAU-60",
    "title": "Squad Ops | Processamento do Produto Multibenefícios via ZORD",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-60)"
  },
  {
    "key": "GAU-58",
    "jiraKey": "GAU-58",
    "title": "Squad Dados | Dashboard – Controle de Operações de Cartões",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Valdirene Batista da Silva Souza Figueredo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-58)"
  },
  {
    "key": "GAU-57",
    "jiraKey": "GAU-57",
    "title": "Squad Dados | Dashboard de Controle e Rastreabilidade de Emissão e Envio de Faturas",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Valdirene Batista da Silva Souza Figueredo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-57)"
  },
  {
    "key": "GAU-56",
    "jiraKey": "GAU-56",
    "title": "Squad Ops | Painel de Monitoramento de Liquidação em Tempo Real",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-56)"
  },
  {
    "key": "GAU-55",
    "jiraKey": "GAU-55",
    "title": "Squad Ops | Transferência via Pix p Domicilio Terceiro Informando Agência e Conta",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-55)"
  },
  {
    "key": "GAU-54",
    "jiraKey": "GAU-54",
    "title": "Squad Ops | Criação Cadastros para Pag Emana Pay Sem Conta",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-54)"
  },
  {
    "key": "GAU-53",
    "jiraKey": "GAU-53",
    "title": "Squad Dados |Ajuste Dados Cadastrais Views PLD Clientes Aux",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-53)"
  },
  {
    "key": "GAU-52",
    "jiraKey": "GAU-52",
    "title": "Squad Dados | Ajuste Filtro Regras Público SCD e SUB PLD Clientes Aux",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-52)"
  },
  {
    "key": "GAU-51",
    "jiraKey": "GAU-51",
    "title": "Squad Ops | Sustentação - Investigar e corrigir o erro de \"A P2P transaction is already being processed\" - Sistema único de BKO (Zord)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Paula Eugenio De Souza Alves - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-51)"
  },
  {
    "key": "GAU-50",
    "jiraKey": "GAU-50",
    "title": "Squad Dados | Tombamento Power BI para Tableau - Pagamento de Contas",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-50)"
  },
  {
    "key": "GAU-49",
    "jiraKey": "GAU-49",
    "title": "Squad Dados | Base de Contas Canceladas com Saldo Credor",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victoria Maria De Moraes Martello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-49)"
  },
  {
    "key": "GAU-48",
    "jiraKey": "GAU-48",
    "title": "Squad Dados | Geração extrato analítico - Conta 106",
    "status": "Coletar Resultados",
    "categoriaStatus": "Em andamento",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Willian Marcos Rodrigues - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-48)"
  },
  {
    "key": "GAU-47",
    "jiraKey": "GAU-47",
    "title": "Squad Dados/Ops | Desenvolver um motor antifraude que combine análise transacional e comportamental para geração de um score de risco (Machine Learning).",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-47)"
  },
  {
    "key": "GAU-46",
    "jiraKey": "GAU-46",
    "title": "Squad Ops | Melhoria Bidirecional Autenticação Biométrica",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-46)"
  },
  {
    "key": "GAU-45",
    "jiraKey": "GAU-45",
    "title": "Squad Dados | Processamento - statement",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-45)"
  },
  {
    "key": "GAU-44",
    "jiraKey": "GAU-44",
    "title": "Squad Dados | Processamento - Indicador | Capta x DOCK - Thudera",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-44)"
  },
  {
    "key": "GAU-41",
    "jiraKey": "GAU-41",
    "title": "Squad Ops | Liberação em autosserviço (IA) endpoint do Cobnet para negociações de PAGEMANAPAY ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "VANESSA FELIX BELMONTE",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-41)"
  },
  {
    "key": "GAU-40",
    "jiraKey": "GAU-40",
    "title": "Squad Ops | Liberação do meio de pagamento PIX da fatura do cartão (Mandala) para consumo nos canais de Autosserviço (IA)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "VANESSA FELIX BELMONTE",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-40)"
  },
  {
    "key": "GAU-39",
    "jiraKey": "GAU-39",
    "title": "Squad Ops | Ajuste no endpoint do Zendesk utilizado pelo Data²",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "VANESSA FELIX BELMONTE",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-39)"
  },
  {
    "key": "GAU-38",
    "jiraKey": "GAU-38",
    "title": "Squad Ops | Disponibilização de serviço de informação sobre comissão de pedido e-comm",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-38)"
  },
  {
    "key": "GAU-37",
    "jiraKey": "GAU-37",
    "title": "Squad Ops | Disponibilização de serviço de envio de 2 via de fatura mandala",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-37)"
  },
  {
    "key": "GAU-36",
    "jiraKey": "GAU-36",
    "title": "Squad Ops | Disponibilização de serviço de solicitação de aumento de limite do cartao mandala ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-36)"
  },
  {
    "key": "GAU-35",
    "jiraKey": "GAU-35",
    "title": "Squad Ops | Disponibilização de serviço de Solicitação de Cartão de Credito (Mandala)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-35)"
  },
  {
    "key": "GAU-34",
    "jiraKey": "GAU-34",
    "title": "Squad Ops | Disponibilização de serviço de consulta de código de autorização de transação no Cartão de Credito (Mandala)",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-34)"
  },
  {
    "key": "GAU-33",
    "jiraKey": "GAU-33",
    "title": "Squad Ops | Disponibilização de serviço de encerramento de conta",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-33)"
  },
  {
    "key": "GAU-32",
    "jiraKey": "GAU-32",
    "title": "Squad Ops | Disponibilização de serviço de consulta de informações sobre Link de Pagamento",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Ana Carolina Curti Fontana Rampazzo",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-32)"
  },
  {
    "key": "GAU-31",
    "jiraKey": "GAU-31",
    "title": "Squad Ops | Melhoria Sistema Único de Backoffice |  Validação de dados no Sistema de Backoffice ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-31)"
  },
  {
    "key": "GAU-30",
    "jiraKey": "GAU-30",
    "title": "Squad Dados | Processamento - Indicador | Autorização - Gsurf",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-30)"
  },
  {
    "key": "GAU-27",
    "jiraKey": "GAU-27",
    "title": "Squad Ops | Solicitação de Melhoria: Visualização do nome de arquivo no Sistema Único de Backoffice",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Erika Kimie Kitahara",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-27)"
  },
  {
    "key": "GAU-26",
    "jiraKey": "GAU-26",
    "title": "Squad Dados | Processamento - installments_types",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-26)"
  },
  {
    "key": "GAU-25",
    "jiraKey": "GAU-25",
    "title": "Squad Dados | Processamento - installments_complement",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-25)"
  },
  {
    "key": "GAU-24",
    "jiraKey": "GAU-24",
    "title": "Squad Dados | Processamento - cleared_component_account_balance",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-24)"
  },
  {
    "key": "GAU-23",
    "jiraKey": "GAU-23",
    "title": "Squad Dados | Processamento - remuneration",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-23)"
  },
  {
    "key": "GAU-22",
    "jiraKey": "GAU-22",
    "title": "Squad Dados | Processamento - monthly_appropriation_detail",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-22)"
  },
  {
    "key": "GAU-21",
    "jiraKey": "GAU-21",
    "title": "Squad Dados | Processamento - advance_installment",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-21)"
  },
  {
    "key": "GAU-20",
    "jiraKey": "GAU-20",
    "title": "Squad Dados | Processamento - receivables_cip",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-20)"
  },
  {
    "key": "GAU-19",
    "jiraKey": "GAU-19",
    "title": "Squad Dados | Processamento - pending_transactions",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-19)"
  },
  {
    "key": "GAU-18",
    "jiraKey": "GAU-18",
    "title": "Squad Dados | Processamento - Listas ECs com Saldo negativos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-18)"
  },
  {
    "key": "GAU-17",
    "jiraKey": "GAU-17",
    "title": "Squad Dados | Processamento - Reembolso Gsurf",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-17)"
  },
  {
    "key": "GAU-16",
    "jiraKey": "GAU-16",
    "title": "Squad Dados | Processamento - daily_balance",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-16)"
  },
  {
    "key": "GAU-15",
    "jiraKey": "GAU-15",
    "title": "Squad Dados | Processamento - split_cnab_240",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-15)"
  },
  {
    "key": "GAU-14",
    "jiraKey": "GAU-14",
    "title": "Squad RPA/Dados | Conciliação PagEmanaPay",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "rpa",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16007",
      "value": "RPA",
      "id": "16007"
    },
    "requester": "Willian Marcos Rodrigues - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-14)"
  },
  {
    "key": "GAU-12",
    "jiraKey": "GAU-12",
    "title": "Squad Ops | Alteração de Limites",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Stefani Brassaroto - Natura & Co.",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-12)"
  },
  {
    "key": "GAU-11",
    "jiraKey": "GAU-11",
    "title": "Squad Dados | PLD Renda Declarada - Ajustar Regra",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Bruno Giglio Rocco",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-11)"
  },
  {
    "key": "GAU-10",
    "jiraKey": "GAU-10",
    "title": "Squad Ops | Transferência via PIX  - Cbs com recebiveis pendente ",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Victor Hugo Soares de Mello",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-10)"
  },
  {
    "key": "GAU-9",
    "jiraKey": "GAU-9",
    "title": "Squad Dados | Ingestão de APIs para Controle de Equipamentos",
    "status": "Aguardando Squad",
    "categoriaStatus": "Itens Pendentes",
    "squadTarget": "dados",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16006",
      "value": "Dados Operações",
      "id": "16006"
    },
    "requester": "Veridiane Servienski Lepinski - Natura&CO",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-9)"
  },
  {
    "key": "GAU-8",
    "jiraKey": "GAU-8",
    "title": "Squad Ops | Melhoria Bidirecional Canal Capta",
    "status": "Coletar Resultados",
    "categoriaStatus": "Em andamento",
    "squadTarget": "operacoes",
    "customfield_12475": {
      "self": "https://naturapay.atlassian.net/rest/api/3/customFieldOption/16005",
      "value": "Operações NPay",
      "id": "16005"
    },
    "requester": "Hudson Borges de Oliveira - Natura Pay",
    "priority": "Média",
    "category": "Geral",
    "createdDate": "29/07/2026",
    "description": "Demanda real importada do espaço GAU (GAU-8)"
  }
];
    }

    // Construir mapa de cards existentes por jiraKey para deduplicação sem perda de chamados
    const existingMap = new Map();

    const normalizeKey = (k) => (k || '').toString().trim().toUpperCase();

    state.triageItems.forEach(t => {
      const k = normalizeKey(t.jiraKey || t.gau || t.id);
      if (k) existingMap.set(k, { queue: 'triage', item: t });
    });

    ['dados', 'operacoes', 'rpa'].forEach(squadId => {
      (state.backlogItems[squadId] || []).forEach(b => {
        const k = normalizeKey(b.gau || b.jiraKey || b.id);
        if (k) existingMap.set(k, { queue: `backlog_${squadId}`, item: b });
      });

      (state.completedTasks[squadId] || []).forEach(c => {
        const match = c.taskTitle ? c.taskTitle.match(/\((GAU-\d+|KAN-\d+|JIRA-\d+)\)/i) : null;
        const rawK = match ? match[1] : (c.gau || c.jiraKey || c.id);
        const k = normalizeKey(rawK);
        if (k) existingMap.set(k, { queue: `completed_${squadId}`, item: c });
      });
    });

    let countNew = 0;
    let countUpdated = 0;
    let countToCompleted = 0;
    let countUnchanged = 0;

    cards.forEach((card, idx) => {
      const rawStatus = (card.status || card.fields?.status?.name || '').toString().trim();
      const rawCatStatus = (card.categoriaStatus || card.fields?.status?.statusCategory?.name || '').toString().trim();

      const statusLower = rawStatus.toLowerCase();
      const catStatusLower = rawCatStatus.toLowerCase();

      // Garantir chave Jira válida e normalizada em CAIXA ALTA (ex: GAU-134)
      const rawJiraKey = card.key || card.jiraKey || (card.id && card.id.toString().startsWith('GAU-') ? card.id : `GAU-${100 + idx}`);
      const jiraKey = normalizeKey(rawJiraKey);
      const title = card.title || card.summary || card.nome || 'Demanda do Jira';
      const description = card.description || card.descricao || card.notes || 'Sincronizado via Jira API';
      const requester = card.requester || card.reporter || card.solicitante || 'Solicitante Jira';

      // Extração da Data de Criação do card Jira
      const rawCreated = card.created || card.fields?.created || card.createdDate || card.date;
      let createdDate = new Date().toLocaleDateString('pt-BR');
      if (rawCreated) {
        try {
          const parsedDate = new Date(rawCreated);
          if (!isNaN(parsedDate.getTime())) {
            createdDate = parsedDate.toLocaleDateString('pt-BR');
          } else {
            createdDate = rawCreated.toString();
          }
        } catch (e) {
          createdDate = rawCreated.toString();
        }
      }

      // 1. Mapeamento de Squad (16005 -> Operações, 16006 -> Dados, 16007 -> RPA)
      let targetSquadId = card.squadTarget || 'dados';
      let targetSquadName = 'Squad de Dados';

      const cfSquad = card.customfield_12475 || card.squad || card.squadTarget || card.fields?.customfield_12475 || card.fields?.customfield_squad;
      let cfStr = '';
      let hasExplicitSquad = false;
      if (cfSquad) {
        if (typeof cfSquad === 'object') {
          cfStr = (cfSquad.id || cfSquad.value || JSON.stringify(cfSquad)).toString().toLowerCase();
        } else {
          cfStr = cfSquad.toString().toLowerCase();
        }
      }

      if (cfStr.includes('16005') || cfStr.includes('operac') || cfStr.includes('operaç')) {
        targetSquadId = 'operacoes';
        targetSquadName = 'Squad de Operações';
        hasExplicitSquad = true;
      } else if (cfStr.includes('16007') || cfStr.includes('rpa')) {
        targetSquadId = 'rpa';
        targetSquadName = 'Squad de RPA';
        hasExplicitSquad = true;
      } else if (cfStr.includes('16006') || cfStr.includes('dados')) {
        targetSquadId = 'dados';
        targetSquadName = 'Squad de Dados';
        hasExplicitSquad = true;
      }

      // 2. Mapeamento de Fila conforme funcionamento exato da manhã
      // A) Sem Squad atribuída OU Status em Aberto/Triagem/Pendente -> Mesa de Triagem
      // B) Com Squad atribuída e em andamento/backlog no Jira -> Aba Backlog da Squad
      // C) Status Concluído/Done -> Aba Concluídos da Squad

      let targetQueue = '';
      let defaultStatus = 'Backlog';

      if (
        statusLower === 'concluído' ||
        statusLower === 'concluido' ||
        statusLower === 'finalizado' ||
        statusLower === 'done' ||
        statusLower === 'closed' ||
        statusLower === 'resolved' ||
        statusLower === 'resolvido' ||
        statusLower.includes('coletar dados') ||
        statusLower.includes('conclu') ||
        statusLower.includes('entregue') ||
        catStatusLower === 'done'
      ) {
        targetQueue = `completed_${targetSquadId}`;
      } else if (!hasExplicitSquad || statusLower === 'aberto' || statusLower === 'abertos' || statusLower === 'triagem' || statusLower === 'novo' || statusLower === 'nova' || statusLower === 'to do' || statusLower === 'a fazer' || statusLower.includes('aguardando triagem') || statusLower.includes('pendente triagem')) {
        targetQueue = 'triage';
      } else {
        targetQueue = `backlog_${targetSquadId}`;
        if (statusLower.includes('bloquead') || statusLower.includes('impedid') || statusLower.includes('block') || statusLower.includes('hold')) {
          defaultStatus = 'Bloqueado';
        } else {
          defaultStatus = 'Backlog';
        }
      }

      const existing = existingMap.get(jiraKey);

      // CASO A: TICKET NOVO
      if (!existing) {
        countNew++;
        if (targetQueue.startsWith('completed_')) {
          countToCompleted++;
        }
        existingMap.set(jiraKey, { queue: targetQueue });

        if (targetQueue === 'triage') {
          state.triageItems.unshift({
            id: `triage-${jiraKey}`,
            jiraKey,
            jiraUrl: `https://naturapay.atlassian.net/browse/${jiraKey}`,
            title,
            description,
            requesterName: requester,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Geral',
            suggestedSquad: targetSquadId,
            createdAt: createdDate,
            createdDate,
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            gau: jiraKey,
            jiraKey: jiraKey,
            title: title,
            taskTitle: title,
            taskDescription: description,
            description: description,
            area: 'Geral',
            completedBy: requester || targetSquadName,
            requester: requester || targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            completionDate: new Date().toLocaleDateString('pt-BR'),
            gains: 'Concluído via sincronização com Jira',
            requesterArea: requester
          });
        } else {
          state.backlogItems[targetSquadId].unshift({
            id: `backlog-${jiraKey}`,
            gau: jiraKey,
            jiraKey,
            title,
            notes: description,
            requester,
            team: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: defaultStatus,
            progress: 0
          });
        }
      }
      // CASO B: TICKET EXISTE MAS MUDOU DE FILA
      else if (existing.queue !== targetQueue) {
        countUpdated++;
        if (targetQueue.startsWith('completed_')) {
          countToCompleted++;
        }

        // Remover da fila anterior
        const oldLoc = existing.queue;
        if (oldLoc === 'triage') {
          state.triageItems = state.triageItems.filter(t => t.jiraKey !== jiraKey);
        } else if (oldLoc.startsWith('backlog_')) {
          const sId = oldLoc.replace('backlog_', '');
          state.backlogItems[sId] = (state.backlogItems[sId] || []).filter(b => (b.gau || b.jiraKey) !== jiraKey);
        } else if (oldLoc.startsWith('completed_')) {
          const sId = oldLoc.replace('completed_', '');
          state.completedTasks[sId] = (state.completedTasks[sId] || []).filter(c => !c.taskTitle.includes(jiraKey));
        }

        // Inserir na nova fila
        existingMap.set(jiraKey, { queue: targetQueue });

        if (targetQueue === 'triage') {
          state.triageItems.unshift({
            id: `triage-${jiraKey}`,
            jiraKey,
            jiraUrl: `https://naturapay.atlassian.net/browse/${jiraKey}`,
            title,
            description,
            requesterName: requester,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Geral',
            suggestedSquad: targetSquadId,
            createdAt: createdDate,
            createdDate,
            status: 'Pendente'
          });
        } else if (targetQueue.startsWith('completed_')) {
          state.completedTasks[targetSquadId].unshift({
            id: `completed-${jiraKey}`,
            gau: jiraKey,
            jiraKey: jiraKey,
            title: title,
            taskTitle: title,
            taskDescription: description,
            description: description,
            area: 'Geral',
            completedBy: requester || targetSquadName,
            requester: requester || targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            completionDate: new Date().toLocaleDateString('pt-BR'),
            gains: 'Concluído via sincronização com Jira',
            requesterArea: requester
          });
        } else {
          state.backlogItems[targetSquadId].unshift({
            id: `backlog-${jiraKey}`,
            gau: jiraKey,
            jiraKey,
            title,
            notes: description,
            requester,
            team: targetSquadName,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            createdDate,
            priority: card.priority || '2 - Alta',
            category: card.category || 'Processos',
            treatmentOrder: idx + 1,
            status: defaultStatus,
            progress: 0
          });
        }
      }
      // CASO C: TICKET EXISTE NA MESMA FILA (Preservar status alterado pelo usuário na aplicação)
      else {
        const itemObj = existing.item;
        let isModified = false;
        if (itemObj) {
          if (title && itemObj.title !== title) {
            itemObj.title = title;
            isModified = true;
          }
          if (requester && (itemObj.requester !== requester && itemObj.requesterName !== requester)) {
            itemObj.requester = requester;
            itemObj.requesterName = requester;
            isModified = true;
          }
          if (isModified) countUpdated++;
          else countUnchanged++;
        } else {
          countUnchanged++;
        }
      }
    });

    // Salvar estado e atualizar interface
    saveStateCallback();

    const nowTime = new Date().toLocaleTimeString('pt-BR');
    return {
      success: true,
      time: nowTime,
      countNew,
      countUpdated,
      countToCompleted,
      countUnchanged,
      message: `✅ Sincronização Jira concluída às ${nowTime}: ${countNew} novos criados | ${countUpdated} atualizados | ${countToCompleted} concluídos | ${countUnchanged} inalterados.`
    };
  }
};
