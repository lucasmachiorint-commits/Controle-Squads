$ErrorActionPreference = "Stop"

$envFile = "C:\Users\331262\.gemini\antigravity\scratch\Controle-Squads\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "Arquivo .env não encontrado em $envFile"
    exit 1
}

$domain = "naturapay.atlassian.net"
$email = ""
$token = ""

foreach ($line in Get-Content $envFile) {
    if ($line -match '^JIRA_DOMAIN="?([^"]+)"?') { $domain = $matches[1].Trim() }
    if ($line -match '^JIRA_EMAIL="?([^"]+)"?') { $email = $matches[1].Trim() }
    if ($line -match '^JIRA_API_TOKEN="?([^"]+)"?' -or $line -match '^JIRA_TOKEN="?([^"]+)"?') { $token = $matches[1].Trim() }
}

if (-not $email -or -not $token) {
    Write-Error "ERRO: JIRA_EMAIL ou JIRA_API_TOKEN não definidos no .env"
    exit 1
}

Write-Host "Conectando ao Jira em $domain com usuário $email..." -ForegroundColor Cyan

$base64Auth = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("${email}:${token}"))
$headers = @{
    "Authorization" = "Basic $base64Auth"
    "Accept"        = "application/json"
}

$jqlQuery = [System.Uri]::EscapeDataString("project = GAU ORDER BY created DESC")
$maxResults = 100
$startAt = 0
$nextPageToken = $null
$pageCount = 0
$allIssues = [System.Collections.Generic.List[Object]]::new()

function Parse-ADF($doc) {
    if ($null -eq $doc) { return "Sem descrição" }
    if ($doc -is [string]) { return $doc }
    
    $texts = [System.Collections.Generic.List[string]]::new()
    function Traverse-Node($node) {
        if ($null -eq $node) { return }
        if ($node.type -eq "text" -and $node.text) {
            $texts.Add($node.text)
        }
        if ($node.type -eq "hardBreak" -or $node.type -eq "paragraph") {
            $texts.Add("`n")
        }
        if ($node.content) {
            foreach ($child in $node.content) {
                Traverse-Node $child
            }
        }
    }
    
    Traverse-Node $doc
    $result = ($texts -join "").Trim()
    if (-not $result) { return "Sem descrição" }
    return $result
}

while ($pageCount -lt 25) {
    $pageCount++
    $url = "https://${domain}/rest/api/3/search/jql?jql=${jqlQuery}&fields=*all&maxResults=${maxResults}&startAt=${startAt}"
    if ($nextPageToken) {
        $url += "&nextPageToken=" + [System.Uri]::EscapeDataString($nextPageToken)
    }

    try {
        $res = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
    } catch {
        Write-Error "Falha na chamada Jira: $_"
        break
    }

    if ($null -eq $res.issues -or $res.issues.Count -eq 0) {
        break
    }

    foreach ($iss in $res.issues) {
        $allIssues.Add($iss)
    }
    $startAt += $res.issues.Count

    Write-Host "Página $pageCount - Obtidos $($res.issues.Count) chamados. Total acumulado: $($allIssues.Count)" -ForegroundColor Green

    if ($res.isLast -or -not $res.nextPageToken -or $res.issues.Count -lt $maxResults) {
        break
    }
    $nextPageToken = $res.nextPageToken
}

if ($allIssues.Count -eq 0) {
    Write-Warning "Nenhum chamado retornado pelo Jira."
    exit 0
}

Write-Host "Total final: $($allIssues.Count) cards extraídos. Formatando estrutura..." -ForegroundColor Cyan

$cards = [System.Collections.Generic.List[Object]]::new()
$idx = 0

foreach ($issue in $allIssues) {
    $fields = $issue.fields
    $statusName = if ($fields.status.name) { $fields.status.name } else { "Aberto" }
    $catStatus = if ($fields.status.statusCategory.name) { $fields.status.statusCategory.name } else { "To Do" }
    $summary = if ($fields.summary) { $fields.summary } else { "Demanda do Jira" }
    $reporter = if ($fields.reporter.displayName) { $fields.reporter.displayName } else { "Solicitante Jira" }

    $createdFormatted = (Get-Date).ToString("dd/MM/yyyy")
    if ($fields.created) {
        try {
            $createdFormatted = ([DateTime]$fields.created).ToString("dd/MM/yyyy")
        } catch {
            $createdFormatted = [string]$fields.created
        }
    }

    $cfSquad = if ($fields.customfield_12475) { $fields.customfield_12475 } else { $fields.customfield_squad }
    $finalDescription = Parse-ADF $fields.description

    $card = [ordered]@{
        id                 = if ($issue.id) { [string]$issue.id } else { "jira-$idx" }
        key                = [string]$issue.key
        jiraKey            = [string]$issue.key
        title              = [string]$summary
        summary            = [string]$summary
        status             = [string]$statusName
        categoriaStatus    = [string]$catStatus
        customfield_12475  = $cfSquad
        customfield_11010  = $fields.customfield_11010
        squad              = $cfSquad
        requester          = [string]$reporter
        priority           = if ($fields.priority.name) { [string]$fields.priority.name } else { "2 - Alta" }
        category           = "Geral"
        createdDate        = [string]$createdFormatted
        description        = [string]$finalDescription
    }
    $cards.Add($card)
    $idx++
}

$payload = [ordered]@{
    updatedAt  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    totalCards = $cards.Count
    cards      = $cards
}

$jsonOutput = $payload | ConvertTo-Json -Depth 10

$rootPrd = "C:\Users\331262\.gemini\antigravity\scratch\Controle-Squads"
[System.IO.File]::WriteAllText((Join-Path $rootPrd "jira-data.json"), $jsonOutput, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $rootPrd "docs\jira-data.json"), $jsonOutput, [System.Text.Encoding]::UTF8)

$rootHml = "C:\Users\331262\.gemini\antigravity\scratch\Controle-Squads-HML"
if (Test-Path $rootHml) {
    [System.IO.File]::WriteAllText((Join-Path $rootHml "jira-data.json"), $jsonOutput, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText((Join-Path $rootHml "docs\jira-data.json"), $jsonOutput, [System.Text.Encoding]::UTF8)
}

Write-Host "✅ SUCESSO! $($cards.Count) cards gravados com sucesso em jira-data.json e docs/jira-data.json!" -ForegroundColor Green
