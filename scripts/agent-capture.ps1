param (
    [Parameter(Mandatory=$true)]
    [string]$ConversationId
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PWD.Path
$BrainDir = Join-Path $env:USERPROFILE ".gemini\antigravity-ide\brain\$ConversationId"

if (-not (Test-Path $BrainDir)) {
    Write-Error "Brain directory for conversation $ConversationId not found at $BrainDir"
}

$EvidenceDir = Join-Path $RepoRoot "docs\agentic-os\evidence\$ConversationId"
$DocsDir = Join-Path $RepoRoot "docs\agentic-os"
$ChangelogPath = Join-Path $DocsDir "CHANGELOG.md"

# Ensure directories exist
if (-not (Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
}
if (-not (Test-Path $DocsDir)) {
    New-Item -ItemType Directory -Force -Path $DocsDir | Out-Null
}

Write-Host "Capturing artifacts for conversation $ConversationId..."

# Copy artifacts
$Artifacts = @("implementation_plan.md", "walkthrough.md", "task.md")
foreach ($Artifact in $Artifacts) {
    $Source = Join-Path $BrainDir $Artifact
    if (Test-Path $Source) {
        $Dest = Join-Path $EvidenceDir $Artifact
        Copy-Item -Path $Source -Destination $Dest -Force
        Write-Host "Copied $Artifact"
    }
}

# Update CHANGELOG.md
$WalkthroughPath = Join-Path $EvidenceDir "walkthrough.md"
if (Test-Path $WalkthroughPath) {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $WalkthroughContent = Get-Content $WalkthroughPath -Raw

    $ChangelogEntry = @"

## Agent Execution: [$Timestamp]
**Conversation ID**: $ConversationId
**Evidence**: `docs/agentic-os/evidence/$ConversationId/`

$WalkthroughContent

---
"@

    if (-not (Test-Path $ChangelogPath)) {
        Set-Content -Path $ChangelogPath -Value "# Agentic OS Changelog`n$ChangelogEntry" -Encoding UTF8
    } else {
        $ExistingContent = Get-Content $ChangelogPath -Raw
        $ExistingContent = $ExistingContent -replace "# Agentic OS Changelog\n?", "# Agentic OS Changelog`n$ChangelogEntry"
        Set-Content -Path $ChangelogPath -Value $ExistingContent -Encoding UTF8
    }
    Write-Host "Appended to CHANGELOG.md"
}

Write-Host "Artifact capture complete."

