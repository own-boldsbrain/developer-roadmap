# Goal: Refactoring da Captura de Artefatos (V2) e Hardening P0

A sua revisão da V1 revelou que copiar arquivos diretamente de um diretório transiente (`brain`) para a árvore de documentação canônica (sem sanitização, cadeia de custódia, hashes ou verificação de vazamentos) cria uma ponte insegura entre a IDE e o repositório, violando o princípio de *Agent-Reported vs Verified*.

O objetivo agora é evoluir o `scripts/agent-capture.ps1` para a V2, implementando o fluxo correto de detecção, sanitização, cálculo de hash e criação de manifesto antes de formalizarmos a captura em `docs/agentic-os/executions/`.

## Proposed Changes

1. **Reestruturação do Script V2 (`scripts/agent-capture.ps1`)**:
   - Resolução segura do `$RepoRoot` usando `git rev-parse --show-toplevel`.
   - Validação de Regex do `ConversationId`.
   - Adição das flags `-DryRun`, `-Commit`, `-Redact`.

2. **Cadeia de Custódia e Hashes**:
   - Os arquivos copiados irão primeiro para `.agentic-state/captures/<capture-id>/raw/`.
   - Aplicação de `[System.Text.Encoding]::UTF8` (sem BOM) para ler/escrever arquivos.
   - Cálculo de hash SHA-256 (`Get-FileHash`) para os artefatos `sourceHash` e `publishedHash`.

3. **Redaction Engine Simples**:
   - Regex substituindo caminhos sensíveis do usuário, como `[REDACTED_USER_HOME]\.gemini\...` por `[REDACTED_LOCAL_PATH]`.
   - Os artefatos sanitizados vão para `.agentic-state/captures/<capture-id>/sanitized/`.

4. **Geração do Manifesto Mínimo (`manifest.json`)**:
   - Criação de um objeto PowerShell exportado para JSON, garantindo status `agent-reported`, `captureId`, e metadata do Git (`headSha`, `branch`).

5. **Publicação Atômica e Changelog**:
   - Movimentação atômica dos dados sanitizados e do manifesto para `docs/agentic-os/executions/<capture-id>/`.
   - O `CHANGELOG.md` não fará mais o *append* de todo o walkthrough. Ele receberá apenas uma entrada indexada e concisa: *Capture ID, Branch, Commit, Status, e link para o folder local*.

6. **Limpeza do Legado V1**:
   - Removeremos a pasta `docs/agentic-os/evidence/` que foi comitada equivocadamente no commit anterior.

## Verification Plan

1. Executar o V2 script em `-DryRun` primeiro para observar o comportamento.
2. Executar sem `-DryRun` para a nossa sessão atual, verificando se o *redaction* ocorreu no *implementation plan* e se o manifesto atesta "agent-reported".
3. Validar se o Git log, hashes e UTF-8 estão corretos antes de invocar o commit final deste hardening.

Aguardo seu "Go" para materializar o detector de fumaça V2, finalizar essa etapa estrutural e voltarmos à guerra no PR #1!
