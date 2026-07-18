# Agentic OS: Execution Backlog

Backlog estratégico para a implementação das 6 camadas do "Agentic Development OS" no repositório. O roteamento (Task Routing) será orquestrado pelo Orchestrator (A00).

## P0: Fundações Estruturais (Camadas 1 e 2)
>
> [!IMPORTANT]
> Sem as amarras de Governança e Metodologia, escalar o swarm (L4) criaria caos e regressão de código.

1. `[ ]` **L1: Karpathy Guardrails**: Injetar o manifesto de premissas (Think Before Coding).
2. `[ ]` **L1: Complexity Assessor**: Construir script (ou MCP) que analisa o diff vs Escopo.
3. `[ ]` **L2: Superpowers Specs**: Forçar TDD e a etapa de `spec.md` antes da implementação de tasks complexas.
4. `[ ]` **L2: Evidence Gate**: Implantar script que bloqueia Pull Requests que não tenham evidência reproduzível no payload.

## P1: Escala e Orquestração (Camadas 3 e 4)

1. `[ ]` **L3: Harness Configuration**: Centralizar regras de agentes (incluindo security scans sobre MCPs não confiáveis).
2. `[ ]` **L3: Hook Runtime**: Monitorar pré-commits e pré-pushes com checagem de "Gitleaks" (conectando com o histórico da Fase 0).
3. `[ ]` **L4: Ruflo Swarm (Basic)**: Provar o conceito de Task Claiming local usando os `LOCKS.yaml` do Nirvana.
4. `[ ]` **L4: Shared Memory**: Habilitar que o agente de qualidade (A04) leia o plano do planejador (A11) sem repassar contexto gigante.

## P2: Especialização Opcional (Camadas 5 e 6)

1. `[ ]` **L6: Obsidian Indexing**: Conectar o repositório como um Vault, resolvendo wikilinks entre documentos de governança (`.nirvana/`).
2. `[ ]` **L5: Studio Previews**: (Fora do escopo atual, voltado a projetos com UI rica).
3. `[ ]` **L6: Knowledge Bridge**: Extração limpa de artigos web para alimentar o contexto do Agente de Oportunidades (A09).
