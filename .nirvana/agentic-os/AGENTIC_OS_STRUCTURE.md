# Agentic Development OS: Structure

Este manifesto define o alicerce físico (Frame Canônico) da infraestrutura de "Six-Repo Agentic Stack". As 6 camadas abstraídas atuam em conjunto para forçar governança, metodologia, isolamento e qualidade sobre agentes LLM autônomos.

## Topologia de Camadas

### L1-guardrails (Karpathy)
- **Função**: Controla a tomada de decisão (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven).
- **Domain Entitities**: Assumptions, Scope Items, Guardrail Violations.

### L2-method (Superpowers)
- **Função**: Controla a execução (Discovery, Specification, Planning, TDD, Review).
- **Domain Entitities**: Specifications, Plans, Tasks, Evidences.

### L3-harness (Everything Code)
- **Função**: Plataforma de performance do agente (Instalação de profiles, Rules, Hooks, Security Scans).
- **Domain Entitities**: Components, Installations, Hook Events, Instincts.

### L4-swarm (Ruflo)
- **Função**: Orquestração Multiagente (Swarms, Task Claiming, Consensus, Federation).
- **Domain Entitities**: Swarms, Agent Roles, Shared Memories, Task Graphs.

### L5-studio (Open Design)
- **Função**: Geração de artefatos visuais isolada (Sandboxed generation, Design Systems).
- **Domain Entitities**: Projects, Design Systems, Generations, Artifacts.

### L6-knowledge (Obsidian)
- **Função**: Ponte e Memória Semântica (Bases estruturadas, Json Canvas, Graph Indexing).
- **Domain Entitities**: Vaults, Markdown Files, Base Queries, Web Sources.

## Integração com a `Living Skill Factory`
A Factory (módulo evolutivo, A00-A99) consome as Trajetórias geradas por estas 6 camadas operacionais, extraindo e promovendo skills de volta para a Camada 3 (Harness) através dos pipelines G0-G8 de Governança.
