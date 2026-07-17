# Plano de Tradução de Roadmaps

## Objetivo

Traduzir integralmente os 59 roadmaps do projeto (JSON, Markdown) e atualizar as versões em PDF para o idioma português brasileiro (pt-BR).

## Estratégia de Tradução

1. **JSON**: Identificar campos translatáveis em `public/roadmap-content/`, traduzir mantendo a estrutura original e gerar arquivos `.pt-br.json`.
2. **Markdown**: Traduzir todo o conteúdo de `src/data/roadmaps/*/content/*.md` usando a skill `translate-en-pt-br`, criando arquivos `.pt-br.md`.
3. **PDFs**: Após a tradução, executar o script de geração (`scripts/generate-renderer.sh`) para atualizar os PDFs para a versão em pt-BR.

## Inventário & Escopo

- 59 Roadmaps listados em `src/data/roadmaps/`.
- Conteúdo JSON em `public/roadmap-content/`.
- Conteúdo Markdown em `src/data/roadmaps/*/content/`.
- PDFs em `public/pdfs/roadmaps/`.

## Plano de Execução (Fases)

### Fase 1: Setup & Ferramentas

- Validar a execução do script `scripts/generate-renderer.sh` para garantir que ele suporta a nova localização.
- Preparar script auxiliar para tradução de massa dos arquivos JSON.

### Fase 2: Tradução (JSON & Markdown)

- Tradução paralela dos arquivos JSON.
- Tradução paralela dos arquivos Markdown usando a skill `translate-en-pt-br`.

### Fase 3: Geração de PDFs & Validação

- Regenerar PDFs.
- Validação final de consistência e tradução.

## Riscos

- Scripts de geração de PDF podem não detectar automaticamente os novos arquivos `.pt-br.*`. Pode ser necessário ajuste manual nos scripts.
