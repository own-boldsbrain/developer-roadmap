# scripts/inventory-markdown.ps1

$ErrorActionPreference = "Stop"

$StateDir = ".translation-state"
$ManifestPath = Join-Path $StateDir "manifest.jsonl"
$ContentRoot = "src\data\roadmaps"

if (-not (Test-Path $StateDir)) {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
}

$Files = Get-ChildItem -Path $ContentRoot -Filter "*.md" -Recurse | Where-Object {
    $_.FullName -match "\\content\\" -and 
    $_.Name -notmatch "pt-br\.md$" -and 
    $_.Name -notmatch "pt-BR\.md$" -and
    $_.FullName -notmatch "node_modules"
}

Write-Host "Found $($Files.Count) markdown files to inventory."

$Lines = [System.Collections.Generic.List[string]]::new()

$Count = 0
foreach ($File in $Files) {
    $RelativePath = $File.FullName.Substring((Get-Location).Path.Length).TrimStart('\')
    $RelativePath = $RelativePath -replace '\\', '/'
    
    $TargetRelativePath = $RelativePath -replace '\.md$', '.pt-br.md'

    # Compute SHA256
    $HashString = (Get-FileHash -Path $File.FullName -Algorithm SHA256).Hash.ToLower()

    $ManifestEntry = [ordered]@{
        source = $RelativePath
        target = $TargetRelativePath
        sourceHash = "sha256:$HashString"
        engine = "ollama"
        model = "translategemma:latest"
        status = "pending"
        attempts = 0
    }

    $JsonLine = $ManifestEntry | ConvertTo-Json -Compress
    $Lines.Add($JsonLine)
    $Count++
}

[System.IO.File]::WriteAllLines((Resolve-Path -Path ".").Path + "\" + $ManifestPath, $Lines)
Write-Host "Inventory complete. $Count files written to $ManifestPath"

