# Plano de Tradução, Observabilidade e Extração de Oportunidades

## 1. Visão Geral

Este plano descreve a abordagem técnica, operacional e de governança para:

1. Inventariar os arquivos Markdown existentes.
2. Traduzir os 6.517 arquivos Markdown inventariados no baseline inicial `.md` distribuídos entre 59 roadmaps.
3. Preservar integralmente a estrutura técnica dos documentos.
4. Registrar rastros, pegadas e fatos de cada processamento.
5. Validar automaticamente cada tradução antes da publicação.
6. Identificar tecnologias defasadas, lacunas de conteúdo e oportunidades de evolução.
7. Consolidar as recomendações em um relatório priorizado e executável.
8. Gerar os artefatos finais em pt-BR, incluindo PDFs e páginas renderizadas.

O processo será estruturado como uma esteira auditável, retomável e idempotente, evitando retraduções desnecessárias, sobrescritas silenciosas e publicações sem validação.

---

## 2. Fatos e Premissas Conhecidas

As seguintes evidências constituem o baseline inicial do projeto:

* Na inspeção inicial, não foram encontrados arquivos Markdown `.pt-br.md` dentro dos diretórios de conteúdo.
* As traduções existentes estavam concentradas em arquivos JSON na pasta de conteúdo público.
* O universo estimado contém 6.517 arquivos Markdown inventariados.
* Os arquivos estão distribuídos entre aproximadamente 59 roadmaps.
* Quando o inventário mudar, registre:
  - `inventoryVersion`
  - `inventoryGeneratedAt`
  - `inventoryHash`
  - `eligibleFileCount`
* O Ollama local está operacional.
* O modelo `translategemma:latest` está disponível localmente.
* O modelo `qwen3.6:latest` também está disponível e poderá atuar como fallback.
* O container do DeepLX pode ser iniciado localmente, mas o provedor retornou erro `429`, indicando bloqueio temporário por volume de requisições.
* A infraestrutura do The Hub e o LiteLLM não devem ser considerados disponíveis sem um preflight funcional.

Essas evidências determinam as seguintes premissas operacionais:

1. A unidade de processamento e controle será o arquivo, não a pasta.
2. O Ollama será o motor principal de tradução.
3. O DeepLX será um motor opcional e condicionado à disponibilidade efetiva.
4. O LiteLLM será utilizado somente após teste funcional.
5. Toda dependência externa ou local deverá possuir fallback.
6. Nenhum arquivo será publicado apenas porque o modelo produziu uma resposta.
7. Todo processamento deverá deixar evidências reproduzíveis.

---

## 3. Decisões Aprovadas

### 3.1 Motor de tradução

O motor principal será:

```text
Ollama
└── translategemma:latest
```

Ordem de fallback:

```text
1. translategemma:latest
2. qwen3.6:latest
3. LiteLLM, quando disponível e autorizado
4. DeepLX, quando o provedor estiver funcional e sem rate-limit
```

O DeepLX não deverá bloquear a fila enquanto estiver respondendo com erro `429`.

### 3.2 Paralelismo

O processamento inicial será realizado com paralelismo igual a `1`.

O valor deverá ser configurável por parâmetro, mas só poderá ser elevado após validação de:

* uso de memória;
* temperatura e utilização de CPU;
* utilização de GPU;
* tempo médio por arquivo;
* estabilidade do Ollama;
* impacto sobre outros serviços locais.

### 3.3 Extração de oportunidades

A extração de oportunidades utilizará preferencialmente o Gateway LiteLLM em:

```text
http://localhost:4002
```

Antes da execução, o script deverá realizar um preflight funcional.

Caso o Gateway esteja indisponível, o processamento deverá utilizar diretamente o Ollama local.

---

## 4. Princípios de Governança

### 4.1 Inventário antes da execução

Nenhum arquivo será traduzido antes da geração de um inventário completo.

O inventário será imutável por execução e deverá registrar:

* caminho do arquivo;
* roadmap;
* hash do conteúdo;
* tamanho em bytes;
* quantidade de linhas;
* existência de frontmatter;
* quantidade de headings;
* quantidade de links;
* quantidade de code blocks;
* existência de MDX;
* idioma detectado;
* status inicial.

### 4.2 Cadeia de custódia

Cada arquivo deverá possuir uma cadeia verificável:

```text
Origem
  → hash da origem
  → proteção dos elementos técnicos
  → tradução
  → restauração dos elementos técnicos
  → validação
  → hash da saída
  → publicação
```

### 4.3 Idempotência

Um arquivo não deverá ser retraduzido quando:

* já possuir tradução aprovada;
* o hash do arquivo de origem não tiver mudado;
* a versão do prompt não exigir uma nova rodada;
* nenhuma execução forçada tiver sido solicitada.

### 4.4 Não sobrescrita silenciosa

Uma tradução existente não poderá ser sobrescrita quando:

* tiver sido modificada manualmente;
* possuir hash diferente do registrado no último manifesto;
* estiver aprovada ou publicada;
* não tiver sido utilizada a opção explícita de sobrescrita.

Nesses casos, o arquivo deverá entrar no estado `CONFLICT` ou `QUARANTINED`.

### 4.5 Escrita atômica

O processo deverá:

1. produzir um arquivo temporário;
2. validar o arquivo temporário;
3. calcular seu hash;
4. renomeá-lo atomicamente;
5. registrar a publicação no manifesto.

Nenhum arquivo parcial deverá aparecer como tradução concluída.

---

## 5. Arquitetura dos Pipelines

### 5.1 Pipeline de tradução

```text
Descoberta dos arquivos
  ↓
Inventário e hashes
  ↓
Classificação e elegibilidade
  ↓
Proteção de elementos técnicos
  ↓
Divisão segura em chunks
  ↓
Tradução pelo motor selecionado
  ↓
Restauração dos elementos protegidos
  ↓
Validação linguística e estrutural
  ↓
Quarentena ou aprovação
  ↓
Publicação atômica
  ↓
Atualização do manifesto
```

### 5.2 Pipeline de oportunidades

```text
Seleção do roadmap
  ↓
Leitura dos documentos originais
  ↓
Normalização
  ↓
Divisão por contexto semântico
  ↓
Análise pelo LiteLLM ou Ollama
  ↓
Resposta JSON estruturada
  ↓
Validação pelo JSON Schema
  ↓
Deduplicação
  ↓
Priorização
  ↓
Consolidação em relatório
```

### 5.3 Independência entre pipelines

A extração de oportunidades não dependerá da conclusão integral da tradução.

A auditoria poderá começar imediatamente sobre os documentos originais em inglês. Isso permitirá gerar recomendações enquanto a tradução estiver em andamento.

---

## 6. Estrutura de Controle

Será criada a seguinte estrutura:

```text
.translation-control/
├── baseline/
│   ├── baseline.json
│   └── inventory.jsonl
├── runs/
│   └── <run-id>/
│       ├── run-manifest.json
│       ├── events.jsonl
│       ├── completed.jsonl
│       ├── failed.jsonl
│       ├── skipped.jsonl
│       ├── quarantined.jsonl
│       └── metrics.json
├── validations/
│   ├── structural/
│   ├── linguistic/
│   └── rendering/
├── opportunities/
│   ├── findings.jsonl
│   ├── rejected.jsonl
│   └── schemas/
└── reports/
    ├── TRANSLATION_STATUS_REPORT.md
    ├── TRANSLATION_QUALITY_REPORT.md
    └── ROADMAP_EVOLUTION_REPORT.md
```

---

## 7. Identidade das Execuções

Toda execução deverá possuir um `runId` único.

Exemplo:

```text
translation-20260717-163015-a8f31c
```

O `runId` deverá estar presente em:

* manifestos;
* eventos;
* logs;
* arquivos temporários;
* registros de validação;
* métricas;
* falhas;
* oportunidades;
* relatórios consolidados.

O manifesto da execução deverá registrar:

```json
{
  "runId": "translation-20260717-163015-a8f31c",
  "startedAt": "2026-07-17T16:30:15-03:00",
  "gitBranch": "dev",
  "gitCommit": "abc123",
  "inventoryHash": "sha256:...",
  "promptHash": "sha256:...",
  "configHash": "sha256:...",
  "modelDigest": "sha256:...",
  "gateway": "direct",
  "provider": "ollama",
  "model": "translategemma:latest",
  "endpoint": "http://localhost:11434",
  "fallbackLevel": 0,
  "promptVersion": "translation-v1.0.0",
  "validatorVersion": "validator-v1.0.0",
  "parallelism": 1,
  "status": "RUNNING"
}
```

---

## 8. Estados Canônicos

Os arquivos deverão utilizar os seguintes estados:

```text
DISCOVERED
PENDING
QUEUED
PROCESSING
RETRYING
FALLBACK
TRANSLATED
VALIDATING
REJECTED
APPROVED
PUBLISHED
STALE
SKIPPED
FAILED
CONFLICT
QUARANTINED
```

Definições essenciais:

* `TRANSLATED`: o motor produziu uma saída.
* `VALIDATING`: a saída está passando pelos gates.
* `APPROVED`: a saída foi validada.
* `PUBLISHED`: a saída foi gravada no destino final.
* `STALE`: o arquivo original mudou depois da tradução.
* `CONFLICT`: há divergência entre o manifesto e o arquivo existente.
* `QUARANTINED`: é necessária revisão humana.

---

## 9. Scripts de Orquestração de Tradução

### [IMPLEMENTED] `scripts/forensic-runner.ts`

O script substituirá o `batch-translate.ps1` legado e será responsável por:

* localizar arquivos `.md` elegíveis;
* ignorar traduções existentes;
* ignorar diretórios de dependências, build e cache;
* criar o inventário;
* calcular hashes;
* invocar a skill de tradução;
* controlar tentativas e timeouts;
* selecionar fallback;
* registrar eventos estruturados;
* retomar execuções interrompidas;
* colocar falhas não recuperáveis em quarentena;
* gerar métricas por execução.

Comando base:

```powershell
npx tsx scripts/forensic-runner.ts translate \
  --roadmap devops \
  --limit 25 \
  --parallelism 1 \
  --selection-strategy stratified \
  --selection-seed devops-canary-v1
```

Parâmetros esperados:

```text
translate
--roadmap
--limit
--parallelism
--selection-strategy
--selection-seed
--dry-run
```

### Regras de elegibilidade

O script deverá excluir:

```text
*.pt-br.md
*.pt-BR.md
node_modules/
.git/
dist/
build/
coverage/
.next/
public/pdfs/
.translation-control/
```

Também deverá reconhecer variações históricas de nomenclatura para evitar duplicação.

---

## 10. Proteção dos Elementos Técnicos

Antes da tradução, deverão ser protegidos:

* frontmatter YAML;
* code blocks;
* código inline;
* URLs;
* caminhos de arquivos;
* comandos;
* identificadores;
* nomes de pacotes;
* placeholders;
* fórmulas;
* HTML;
* JSX;
* MDX;
* Mermaid;
* diretivas especiais;
* alertas Markdown;
* referências internas;
* âncoras.

Exemplo:

````markdown
```typescript
const app = createApp();
````

````

Transformação interna:

```text
__PROTECTED_CODE_BLOCK_0001__
````

Depois da tradução, todos os tokens deverão ser restaurados e contabilizados.

Qualquer token não restaurado provocará rejeição automática.

---

## 11. Eventos e Rastros

Os eventos serão registrados em JSONL.

Exemplo:

```json
{
  "timestamp": "2026-07-17T16:42:18.428-03:00",
  "level": "INFO",
  "event": "translation.completed",
  "runId": "translation-20260717-163015-a8f31c",
  "fileId": "sha256:...",
  "sourcePath": "src/data/roadmaps/frontend/content/react.md",
  "engine": "ollama",
  "model": "translategemma:latest",
  "attempt": 1,
  "durationMs": 48320,
  "inputCharacters": 14281,
  "outputCharacters": 15092
}
```

Eventos mínimos:

```text
inventory.started
inventory.file_discovered
inventory.file_skipped
inventory.completed

translation.queued
translation.started
translation.chunk_started
translation.chunk_completed
translation.retry_scheduled
translation.fallback_selected
translation.completed
translation.failed

validation.started
validation.passed
validation.failed

publication.started
publication.completed
publication.rolled_back

opportunity.extraction_started
opportunity.finding_created
opportunity.finding_rejected
opportunity.extraction_completed
```

---

## 12. Gates de Qualidade

### Gate G0 — Prontidão

Antes da execução:

* **Lock Operacional**: `.translation-control/locks/translation.lock` criado atomicamente com heartbeat periódico.
* **Segurança e Egress**:
  - [ ] política de egress identificada
  - [ ] provedor final identificado
  - [ ] nenhum segredo presente no documento
  - [ ] redaction executada
  - [ ] processamento externo autorizado


* diretório do projeto encontrado;
* Git status capturado;
* espaço em disco validado;
* Ollama acessível;
* modelo disponível;
* teste funcional concluído;
* diretórios graváveis;
* inventário criado;
* nenhuma execução conflitante ativa.

### Gate G1 — Integridade da entrada

* arquivo legível;
* encoding válido;
* conteúdo não vazio;
* frontmatter válido;
* hash calculado;
* arquivo elegível;
* tradução anterior identificada corretamente.

### Gate G2 — Integridade da tradução

* saída não vazia;
* tamanho plausível;
* ausência de truncamento;
* idioma de destino compatível com pt-BR;
* ausência de tokens técnicos não restaurados;
* nenhuma exceção silenciosa;
* quantidade de chunks consistente.

### Gate G3 — Preservação estrutural

* hash idêntico dos code blocks originais e restaurados (`sourceHash === restoredHash`);
* mesmas URLs;
* mesmo frontmatter estrutural;
* componentes MDX preservados;
* tabelas válidas;
* headings estruturalmente coerentes;
* alertas Markdown preservados;
* Mermaid preservado;
* links internos válidos.

### Gate G4 — Publicação Técnica

Somente arquivos aprovados poderão ser publicados no file system.

Fluxo:

```text
.tmp
  → validação
  → hash
  → rename atômico
  → manifesto
```

### Gate G4H — Human Quality Acceptance

Revisão manual estratificada da qualidade.

### Gate G5 — Conclusão do roadmap

Um roadmap será considerado concluído somente quando:

* todos os arquivos elegíveis tiverem estado terminal;
* não existirem falhas P0 ou P1 abertas;
* o relatório de cobertura estiver completo;
* a amostragem manual estiver aprovada;
* os testes de renderização tiverem passado.

---

## 13. Validações Automatizadas

Após cada tradução:

* validar frontmatter;
* validar Markdown;
* validar MDX;
* comparar code blocks;
* comparar URLs;
* comparar placeholders;
* detectar truncamentos;
* detectar arquivos vazios;
* detectar saída idêntica à origem;
* detectar caracteres corrompidos;
* detectar tokens técnicos restantes;
* validar hierarquia de headings;
* validar links internos;
* validar tabelas;
* validar alerts;
* validar Mermaid.

Após cada lote:

```bash
pnpm format
pnpm test:e2e
```

Também deverão ser executados, quando disponíveis:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

O `pnpm format` não deverá ser utilizado para ocultar corrupção estrutural. A validação deverá ocorrer antes e depois da formatação.

---

## 14. Validação Manual

Será utilizada amostragem estratificada.

A amostra deverá incluir:

* arquivos pequenos;
* arquivos médios;
* arquivos grandes;
* arquivos com tabelas;
* arquivos com MDX;
* arquivos com Mermaid;
* arquivos com muitos links;
* arquivos com muitos code blocks;
* pelo menos um arquivo por roadmap prioritário.

Também será necessário:

```bash
pnpm dev
```

Rotas mínimas para inspeção:

```text
/pt-br/roadmaps/frontend
/pt-br/roadmaps/backend
/pt-br/roadmaps/devops
```

A inspeção deverá verificar:

* renderização SSR;
* code blocks;
* alertas;
* tabelas;
* links;
* headings;
* navegação;
* caracteres especiais;
* responsividade;
* ausência de erros no console.

---

## 15. Scripts de Extração de Oportunidades

### [IMPLEMENTED] `scripts/extract-opportunities.ts`
### [IMPLEMENTED] `scripts/forensic-consolidator.ts`
### [IMPLEMENTED] `schemas/opportunity-finding.schema.json`

O script será executado via `tsx` e deverá:

* ler os arquivos dos roadmaps;
* selecionar documentos por roadmap;
* dividir conteúdos extensos em unidades semânticas;
* consultar o LiteLLM;
* utilizar Ollama como fallback;
* exigir saída JSON;
* validar a resposta com JSON Schema;
* registrar a evidência de cada finding;
* deduplicar recomendações;
* calcular prioridade;
* consolidar os resultados.

A resposta do modelo deverá seguir uma estrutura semelhante a:

```json
{
  "roadmap": "frontend",
  "findings": [
    {
      "id": "frontend-001",
      "category": "deprecated-technology",
      "severity": "high",
      "title": "Referência tecnológica defasada",
      "evidence": {
        "file": "content/frameworks.md",
        "heading": "React",
        "excerpt": "..."
      },
      "recommendation": "...",
      "confidence": 0.91,
      "timeHorizon": "immediate"
    }
  ]
}
```

---

## 16. Categorias de Oportunidades

As categorias mínimas serão:

```text
deprecated-technology
outdated-version
broken-link
missing-link
content-gap
security-gap
accessibility-gap
observability-gap
testing-gap
architecture-gap
duplicated-content
inconsistent-guidance
information-architecture
automation-opportunity
ai-opportunity
governance-opportunity
```

Nenhuma recomendação deverá ser aceita sem:

* arquivo de origem;
* heading ou localização;
* evidência textual;
* categoria;
* severidade;
* confiança;
* recomendação;
* modelo utilizado;
* versão do prompt.

---

## 17. Ciclo de Vida das Oportunidades

As oportunidades utilizarão os seguintes estados:

```text
PROPOSED
VALIDATED
ACCEPTED
PLANNED
IMPLEMENTING
IMPLEMENTED
REJECTED
SUPERSEDED
```

A IA poderá propor oportunidades, mas não poderá marcá-las automaticamente como aceitas ou implementadas.

---

## 18. Priorização

Cada oportunidade será classificada por horizonte:

| Horizonte   | Definição                                                               |
| ----------- | ----------------------------------------------------------------------- |
| Imediato    | Risco crítico, tecnologia removida, erro estrutural ou correção simples |
| 30 dias     | Atualização relevante, melhoria de qualidade ou lacuna prioritária      |
| 60–90 dias  | Reorganização ampla ou novo conteúdo                                    |
| Estratégico | Mudanças de plataforma, taxonomia ou governança                         |

A pontuação poderá seguir:

```text
Priority Score =
Severity × Confidence × Reach × Obsolescence × Ease
```

Os pesos deverão ser documentados e versionados.

---

## 19. Observabilidade e Métricas

### Cobertura

* total de arquivos elegíveis;
* total pendente;
* total em fila;
* total processado;
* total traduzido;
* total validado;
* total aprovado;
* total publicado;
* total rejeitado;
* total em quarentena;
* total desatualizado.

### Performance

* arquivos por hora;
* caracteres por minuto;
* tempo médio por arquivo;
* tempo médio por chunk;
* percentis de duração;
* tempo total da execução.

### Confiabilidade

* taxa de sucesso;
* taxa de retry;
* taxa de fallback;
* taxa de timeout;
* taxa de rejeição;
* taxa de rollback;
* falhas por modelo;
* falhas por roadmap.

### Qualidade

* frontmatters preservados;
* code blocks preservados;
* URLs preservadas;
* placeholders restaurados;
* headings preservados;
* arquivos truncados;
* caracteres corrompidos;
* arquivos idênticos à origem.

### Infraestrutura

* estado do Ollama;
* estado dos modelos;
* estado do LiteLLM;
* estado do DeepLX;
* utilização de CPU;
* utilização de memória;
* utilização de GPU;
* espaço em disco;
* tamanho da fila.

### Gestão

* roadmaps concluídos;
* roadmaps parciais;
* roadmaps bloqueados;
* falhas abertas;
* falhas reincidentes;
* oportunidades propostas;
* oportunidades validadas;
* oportunidades aceitas;
* oportunidades implementadas.

---

## 20. Estados de Saúde dos Serviços

Os serviços deverão utilizar estados mais precisos do que apenas online ou offline:

```text
UNREACHABLE
STARTING
HEALTHY
DEGRADED
RATE_LIMITED
AUTH_FAILED
MODEL_MISSING
READY
```

Exemplo para o DeepLX:

```text
Container: HEALTHY
API local: HEALTHY
Provedor externo: RATE_LIMITED
Capacidade efetiva: NOT_READY
```

Um serviço só poderá ser utilizado quando estiver em estado funcional `READY`.

---

## 21. SLOs Iniciais

| Indicador                         |  Meta |
| --------------------------------- | ----: |
| Eventos com `runId`               |  100% |
| Eventos com `fileId`              |  100% |
| Code blocks preservados           |  100% |
| URLs preservadas                  |  100% |
| Frontmatter preservado            |  100% |
| Tokens técnicos restaurados       |  100% |
| Arquivos publicados sem validação |     0 |
| Arquivos truncados publicados     |     0 |
| Falhas sem classificação          |     0 |
| Sobrescritas silenciosas          |     0 |
| Retraduções desnecessárias        |     0 |
| Sucesso operacional no piloto     | ≥ 98% |

A qualidade linguística será medida por:

* amostragem humana;
* taxa de correção necessária;
* alteração de significado;
* inconsistência terminológica;
* falsos cognatos;
* clareza;
* naturalidade em pt-BR;
* preservação de termos técnicos.

---

## 22. Tratamento de Falhas

Cada falha deverá possuir:

```json
{
  "errorCode": "MARKDOWN_CODE_BLOCK_MISMATCH",
  "classification": "quality",
  "severity": "high",
  "retryable": false,
  "message": "A origem possui 14 blocos e a saída possui 13.",
  "recommendedAction": "Enviar para quarentena e revisão manual."
}
```

As falhas deverão ser agrupadas por:

* código;
* causa;
* modelo;
* roadmap;
* tamanho do arquivo;
* etapa;
* versão do prompt;
* versão do script;
* horário;
* quantidade de tentativas.

Falhas não recuperáveis deverão ser enviadas para uma dead-letter queue.

---

## 23. Geração dos Artefatos Finais

### [MODIFY] `scripts/generate-renderer.sh`

O script deverá:

* reconhecer arquivos `.pt-br.md`;
* selecionar somente traduções publicadas;
* rejeitar documentos sem aprovação registrada;
* montar PDFs em português;
* registrar os arquivos utilizados;
* registrar hashes dos PDFs;
* publicar os PDFs em:

```text
public/pdfs/roadmaps/
```

A geração não deverá depender apenas da existência física do arquivo. O manifesto deverá confirmar que ele foi aprovado e publicado.

---

## 24. Relatórios

### `TRANSLATION_STATUS_REPORT.md`

Deverá conter:

* cobertura;
* progresso;
* velocidade;
* falhas;
* roadmaps concluídos;
* roadmaps bloqueados;
* previsão de conclusão baseada na vazão observada.

### `TRANSLATION_QUALITY_REPORT.md`

Deverá conter:

* preservação estrutural;
* resultados da amostragem;
* falhas linguísticas;
* falhas técnicas;
* arquivos em quarentena;
* tendências por modelo.

### `ROADMAP_EVOLUTION_REPORT.md`

Deverá conter:

* sumário executivo;
* oportunidades imediatas;
* tecnologias defasadas;
* lacunas de conteúdo;
* inconsistências;
* riscos;
* recomendações por roadmap;
* priorização;
* esforço estimado;
* evidências;
* roadmap de implementação.

---

## 25. Ordem de Implementação

### Fase 0 — COMPLETED

1. Capturar Git status e commit.
2. Criar inventário.
3. Confirmar contagem real.
4. Identificar traduções existentes.
5. Registrar disponibilidade dos serviços.
6. Criar diretórios de controle.

### Fase 1 — COMPLETED

1. Implementar `runId`.
2. Implementar `fileId`.
3. Implementar eventos JSONL.
4. Implementar manifestos.
5. Implementar hashes.
6. Implementar estados canônicos.

### Fase 2 — TECHNICALLY_COMPLETED / HUMAN_ACCEPTANCE_PENDING

1. Implementar `forensic-runner.ts`.
2. Executar dry-run.
3. Processar 20 arquivos.
4. Validar estrutura.
5. Revisar amostra humana.
6. Corrigir o pipeline.

### Fase 3 — IMPLEMENTED_AND_TESTED

1. Implementar `extract-opportunities.ts`.
2. Definir JSON Schema.
3. Realizar preflight do LiteLLM.
4. Configurar fallback Ollama.
5. Auditar os primeiros roadmaps.
6. Consolidar findings.

### Fase 4 — READY_FOR_CANARY

1. Traduzir por roadmap.
2. Monitorar hardware.
3. Ajustar paralelismo.
4. Classificar falhas.
5. Retomar automaticamente.
6. Atualizar relatórios.

### Fase 5 — NOT_STARTED

1. Executar testes.
2. Validar páginas pt-BR.
3. Gerar PDFs.
4. Verificar links e assets.
5. Publicar apenas artefatos aprovados.

---

## 26. Critérios de Conclusão

O projeto será considerado concluído quando:

* todos os arquivos elegíveis possuírem estado terminal;
* todas as traduções publicadas tiverem passado pelos gates;
* não existirem falhas críticas abertas;
* os 59 roadmaps tiverem relatório de cobertura;
* a aplicação renderizar corretamente em pt-BR;
* os PDFs tiverem sido gerados e validados;
* todas as oportunidades tiverem evidência e status;
* os manifestos permitirem reproduzir cada execução;
* nenhuma tradução depender apenas de logs textuais;
* a documentação operacional estiver atualizada.

---

## 27. Fonte da Verdade

A hierarquia oficial será:

```text
1. Git
2. inventory.jsonl
3. run-manifest.json
4. events.jsonl
5. validation-results.jsonl
6. findings.jsonl
7. Relatórios derivados
8. Dashboard
```

O dashboard será uma visualização derivada e nunca substituirá os manifestos como fonte da verdade.

---

## 28. Resultado Esperado

Ao final, deverá ser possível responder rapidamente:

* qual arquivo foi processado;
* qual versão da origem foi usada;
* qual modelo realizou a tradução;
* qual prompt foi utilizado;
* quantas tentativas ocorreram;
* qual fallback foi acionado;
* quais validações passaram;
* quais validações falharam;
* qual arquivo foi publicado;
* qual hash comprova a publicação;
* qual execução produziu o resultado;
* qual oportunidade foi identificada;
* qual evidência sustenta a recomendação;
* quem ou qual regra autorizou a mudança de estado.

## 29. Política de Retenção

```text
Versionado no Git:
- MASTER_PLAN.md
- schemas
- ADRs
- baseline resumido
- manifestos finais
- relatórios consolidados

Retido localmente:
- eventos granulares
- métricas de hardware
- respostas brutas dos modelos
- arquivos temporários
- traces por chunk

Comprimido após conclusão:
- events.jsonl.gz
- completed.jsonl.gz
- failed.jsonl.gz
```

Definições:
```text
retentionDays: 90
compressionAfterDays: 7
preserveFailedRuns: true
preserveFinalManifests: permanently
```

---

## 30. Critérios de Interrupção

A execução deverá parar automaticamente quando qualquer uma destas condições ocorrer:

| Condição                                  | Ação                                       |
| ----------------------------------------- | ------------------------------------------ |
| Falha em frontmatter, URLs ou code blocks | Interromper o lote                         |
| Token protegido não restaurado            | Quarentena e interrupção                   |
| Arquivo truncado                          | Interrupção imediata                       |
| Uso de memória acima de 85% por 5 minutos | Pausar                                     |
| Espaço livre em disco abaixo de 15%       | Interromper                                |
| Retries acima de 10% do lote              | Revisar modelo ou timeout                  |
| Fallback acima de 20%                     | Classificar motor principal como degradado |
| Tempo p95 acima de 3× o piloto            | Pausar e investigar                        |
| Publicação sem `APPROVED`                 | Rollback e incidente P0                    |
| Divergência de hash                       | Marcar `CONFLICT`                          |

Para elementos estruturais protegidos, a tolerância deve continuar sendo zero.

---

## 31. Métricas do Canário

Ao fim de cada estágio, o relatório precisa apresentar:

```text
runId
roadmap
arquivos descobertos
arquivos elegíveis
arquivos processados
arquivos aprovados
arquivos publicados
arquivos em quarentena
tempo total
tempo médio
p50, p95 e p99
retries
fallbacks
CPU média e pico
memória média e pico
disco consumido
caracteres de entrada e saída
falhas por categoria
segundos por 1.000 caracteres
arquivos por hora
MB de memória por arquivo
findings por arquivo
findings rejeitados pelo schema
```

---

## 32. Registro de decisão

ADR-004 — Primeiro roadmap da escala controlada

**Decisão:**
O roadmap `devops` será utilizado como primeiro canário da Fase 4.

**Motivação:**
O roadmap possui alta diversidade estrutural e técnica, incluindo code blocks,
comandos, YAML, URLs, nomes de ferramentas e elementos sensíveis à tradução.

**Estratégia:**
A tradução e a extração serão executadas em runs independentes.
O escalonamento ocorrerá em lotes de 25, 100 e, posteriormente, no roadmap completo.

**Condição de avanço:**
Zero falhas estruturais críticas, aceite humano do Gate G4 e estabilidade dos
indicadores de hardware e vazão.

**Status:**
APPROVED
