# Events & Permissions Matrix (RBAC)

O Agentic OS atua num regime federado onde camadas inferiores dependem das permissões validadas pelas camadas superiores.

## Global Event Stream

A malha de eventos emite os seguintes sinais que orquestram a coreografia do sistema:

- `workspace.created`
- `specification.approved` (L2)
- `plan.generated` (L2)
- `policy.violated` (L1)
- `swarm.started` (L4)
- `task.claimed` (L4)
- `task.completed` (L2/L4)
- `memory.created` (L4/L6)
- `artifact.generated` (L5)
- `artifact.approved` (L5)
- `verification.failed` (L1/L2)
- `run.completed`
- `knowledge.persisted` (L6)

## RBAC / Ownership Permissions

| Camada / Ator | Lê (Read) | Escreve (Write) | Bloqueia (Deny/Pushback) |
| :--- | :--- | :--- | :--- |
| **L1-guardrails** | Todo o diff, contexto | Logs de violação | Qualquer execução destrutiva, Overengineering |
| **L2-method** | Repositório | `spec.md`, `plan.md`, testes | Implementação sem Spec |
| **L3-harness** | Ambiente, pacotes | Rules, Profiles, Hooks | Instalação perigosa (Scan falho) |
| **L4-swarm** | Arquivos alocados | Suas Reservas, Memórias | Duplicação de tarefa |
| **L5-studio** | Design Systems | `.html`, `.pdf`, assets | Geração sem CSP (Sandboxed) |
| **L6-knowledge** | `.md` no Vault | Arquivos, Canvas, Web extract | Propriedades inválidas ou Links quebra |
