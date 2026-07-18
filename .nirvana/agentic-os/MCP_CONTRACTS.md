# Model Context Protocol (MCP) Contracts

O Six-Repo Agentic Stack se materializa de forma agnóstica via MCP. Cada camada opera teoricamente como um servidor MCP.

## Server: `mcp-guardrails` (L1)

**Função**: Bloqueio ativo e checagem de premissas.

- **Resources**:
  - `policy://{id}`: Leitura das regras do projeto.
- **Tools**:
  - `analyze_complexity(prompt, files_targeted)` -> Returns `complexity_score`, `warnings`.
  - `register_assumption(statement, confidence, impact)` -> Registra no Ledger.

## Server: `mcp-superpowers` (L2)

**Função**: Metodologia TDD e Specs.

- **Resources**:
  - `spec://{id}`: Acesso aos documentos de especificação ativos.
- **Tools**:
  - `create_spec(objective)` -> Cria arquivo `.spec.md`.
  - `compile_plan(spec_id)` -> Gera `implementation-plan.md`.
  - `assert_evidence(task_id, command, result)` -> Grava evidência final do TDD.

## Server: `mcp-harness` (L3)

**Função**: Distribuição e Instalação.

- **Resources**:
  - `catalog://components`: Skills e agentes instaláveis.
- **Tools**:
  - `preview_install(profile_name)` -> Mostra dependências antes do commit de configuração.
  - `security_scan(path)` -> Scaneia regras e hooks em busca de segredos.

## Server: `mcp-swarm` (L4)

**Função**: Swarm orquestration.

- **Resources**:
  - `memory://shared/{namespace}`: Memórias e consensos.
- **Tools**:
  - `spawn_swarm(objective, topology, max_agents)` -> Retorna `swarm_id`.
  - `claim_task(task_id, agent_id)` -> Obtém lease exclusivo sobre arquivo/tarefa.

## Server: `mcp-studio` (L5)

**Função**: Geração visual.

- **Resources**:
  - `design://systems/{brand}`: Tokens de design.
- **Tools**:
  - `generate_artifact(brief, format)` -> Dispara pipeline de geração sandboxed.
  - `refine_artifact(artifact_id, selector, instruction)` -> Queue de refine.

## Server: `mcp-obsidian` (L6)

**Função**: Vault Management.

- **Resources**:
  - `vault://{path}`: Representação semântica do markdown.
- **Tools**:
  - `create_base(query, filters)` -> Gera arquivo JSON Canvas ou Base do Obsidian.
  - `extract_web(url)` -> Importa URL limpando ruídos para nota referenciável.
