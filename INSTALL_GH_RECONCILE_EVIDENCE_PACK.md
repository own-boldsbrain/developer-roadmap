# Instalação automatizada do GH Reconcile Evidence Pack

Este instalador PowerShell é autocontido. O ZIP está embutido no próprio script.

## Execução

```powershell
Set-ExecutionPolicy -Scope Process Bypass

& ".\install-gh-reconcile-evidence-pack.ps1" -Force
```

Destino padrão:

```text
C:\Users\fjuni\.gemini\config\skills\github\gh-reconcile\
```

## Simulação

```powershell
& ".\install-gh-reconcile-evidence-pack.ps1" -Force -WhatIf
```

## Destino personalizado

```powershell
& ".\install-gh-reconcile-evidence-pack.ps1" `
  -Destination "C:\caminho\customizado\gh-reconcile" `
  -Force
```

## Sem backup

```powershell
& ".\install-gh-reconcile-evidence-pack.ps1" -Force -SkipBackup
```

O instalador:

1. decodifica o ZIP embutido;
2. verifica SHA-256 `bd16a85bce0c3548b7b9011a2ea0eda4550391a069107d0fc824cc8f232b8739`;
3. valida os artefatos obrigatórios;
4. cria backup da skill existente;
5. integra o pack sem apagar `SKILL.md` ou scripts atuais;
6. grava `EVIDENCE_PACK_INSTALLATION.json`.
