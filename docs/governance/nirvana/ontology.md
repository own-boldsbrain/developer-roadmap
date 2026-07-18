# Ontologia Canônica Nirvana

O desenho canônico separa quatro conceitos fundamentais para rastreabilidade e governança forense:

- **Lane**: domínio de responsabilidade.
- **Stage**: etapa ordenada do fluxo.
- **State**: posição persistente da entidade no ciclo de vida.
- **Status**: condição observada ou resultado de uma execução.

## Regra-mãe

- **Lane** responde: onde isso pertence?
- **Stage** responde: em qual etapa está?
- **State** responde: em que posição persistente está?
- **Status** responde: está saudável, aprovado ou falhando?
- **ReasonCode** responde: por quê?

---

## 1. Lanes Canônicas

L00 Governance & Change Control
L10 Git & Reconciliation
L20 Security & Secrets
L30 CI, Quality & Testing
L40 Provider Readiness
L50 Inventory & Selection
L60 Processing: Translation / Mirroring
L70 Validation & Publication
L80 Opportunity Intelligence
L90 Evidence & Observability
L100 Release & Operations

---

## 2. Status Universais

### executionStatus

NOT_STARTED, QUEUED, RUNNING, PASSED, PASSED_WITH_WARNINGS, FAILED, BLOCKED, CANCELLED, SKIPPED, UNKNOWN, NOT_APPLICABLE

### healthStatus

HEALTHY, DEGRADED, UNHEALTHY, UNAVAILABLE, UNKNOWN

### evidenceStatus

NOT_CAPTURED, CAPTURED, PARTIALLY_VERIFIED, VERIFIED, TAMPER_EVIDENT, INVALID, EXPIRED

### completenessStatus

COMPLETE, PARTIAL, INCOMPLETE, EMPTY, UNKNOWN

---

## 3. Contrato Canônico Mínimo (Exemplo L60/L70)

```json
{
  "schemaVersion": "1.0.0",
  "entityType": "translation-file",
  "entityId": "sha256:...",
  "lane": "PROCESSING",
  "stage": "VALIDATION",
  "state": "VALIDATING",
  "executionStatus": "RUNNING",
  "healthStatus": "HEALTHY",
  "evidenceStatus": "CAPTURED",
  "completenessStatus": "PARTIAL",
  "processingMode": "LLM_TRANSLATION",
  "reasonCode": null,
  "runId": "translation-20260717-...",
  "updatedAt": "2026-07-17T23:50:00-03:00"
}
```

_Nota: Referenciar a documentação de cada Lane específica para a máquina de estados exata._
