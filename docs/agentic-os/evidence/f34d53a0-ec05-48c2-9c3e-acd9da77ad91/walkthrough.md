# Walkthrough: Migração para a Arquitetura TO-BE (P0)

A reformulação geológica completa da fundação `.nirvana` foi concluída com sucesso no `feat/nirvana-agent-governance`. A arquitetura de software agora honra integralmente o blueprint TO-BE, separando rigorosamente a governança declarativa do runtime das camadas.

## O que foi realizado

1. **Separação Governance x Layers x Planes**
   - Injetamos a taxonomia mestre: `.nirvana/governance/`, `.nirvana/agentic-os/layers/`, e `.nirvana/agentic-os/shared/`.
   - Limpamos a raiz do `.nirvana/` para não mais servir como um amontoado de arquivos soltos.

2. **Migração para YAML Executável**
   - O `OWNERSHIP_MATRIX.md` foi digerido para `governance/ownership/path-owners.yaml` estruturado.
   - Os agentes (`agent.json`) foram transferidos para `governance/agents/profiles/` sob a nomenclatura `.yaml`.
   - Documentos-chave como o `COLLISION_POLICY` e o `TASK_ROUTING` tornaram-se YAML puros nas pastas de _policies_ e _routing_.

3. **Desacoplamento Universal de Schemas**
   - Schemas como _handoff_ e _event-envelope_ que são sistêmicos cruzaram para `.nirvana/agentic-os/shared/schemas/`.
   - Schemas proprietários de camadas específicas mergulharam nos seus respectivos domínios: `.nirvana/agentic-os/layers/L2-method/domain/schemas/spec.schema.json`.

4. **Isolamento de Estado (Runtime)**
   - Extraímos o `LOCKS.yaml` declarativo da zona de governança, injetando sua cópia mutável em `.agentic-state/locks/active-locks.jsonl`.
   - O `.gitignore` foi atualizado para barrar qualquer artefato dentro de `.agentic-state/` no versionamento.

## Status do PR
Com esse commit massivo, o **PR #2** materializou 100% da Fase P0 da _Revisão Canônica_ sugerida. O estado agora é perfeitamente _machine-readable_ e hierárquico.

> [!IMPORTANT]
> A esteira P0 de normalização e formatação encerrou aqui.
> Conforme acordado, a recomendação tática imediata é pularmos de volta para o repositório original (PR #1, `feat/nirvana-fase-0`), resolvendo o incêndio do CI (Quality Gates e Secret Scan) para garantirmos o `same-head GREEN` e pavimentarmos a estabilidade antes da integração formal dessa maravilhosa arquitetura.
