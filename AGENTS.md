# AGENTS.md

Instrucoes para agentes de codigo neste repositorio.

## Contexto Rapido
- Stack principal: Astro 5 (SSR) + React 19 + TailwindCSS 4.
- Gerenciador de pacotes preferido: pnpm.
- Conteudo principal vive em `src/data` e espelhos JSON em `public/roadmap-content`.

## Comandos Essenciais
- Instalar dependencias: `pnpm install`
- Rodar app local: `pnpm dev` (porta 3000)
- Build producao: `pnpm build`
- Preview build: `pnpm preview`
- Formatar codigo: `pnpm format`
- Testes E2E: `pnpm test:e2e`

## Onde Mexer (Por Tipo de Tarefa)
- Páginas e UI: `src/pages`, `src/components`, `src/layouts`, `src/styles`
- APIs server-side: `src/api`
- Logica compartilhada/utilitarios: `src/lib`
- Dados de roadmap/guia/projeto: `src/data/**`
- Scripts de manutencao/conteudo: `scripts/**`
- Testes E2E e snapshots: `tests/**`

## Convencoes do Projeto
- Use o estilo Prettier do repo (aspas simples e `semi: true`).
- Mantenha alteracoes focadas; evite reformatar arquivos nao relacionados.
- Para contribuicoes de conteudo, respeite o formato e limites de links definidos em `contributing.md`.
- Para skeleton de roadmap, siga nomes de grupos com ordenacao numerica (`[sort]-[slug]`) conforme `scripts/readme.md`.

## Pitfalls Importantes
- `roadmap-dirs` depende de grupos nomeados corretamente no arquivo do roadmap no editor.
- Mudancas visuais podem quebrar snapshots do Playwright em `tests/*-snapshots`.
- `@roadmapsh/editor` e tratado como `noExternal` no SSR (ver `astro.config.mjs`); evite alterar isso sem necessidade.
- Scripts de geracao de conteudo com IA podem exigir variaveis de ambiente (ex.: chave de API).

## Checklist Antes de Encerrar
- Rodar `pnpm format` quando houver mudancas de codigo.
- Rodar `pnpm test:e2e` para mudancas de UI/comportamento.
- Se alterou conteudo de roadmap, validar estrutura e links com scripts em `scripts/` quando aplicavel.

## Documentacao de Referencia (Link, Nao Duplique)
- Visao geral e desenvolvimento local: [readme.md](readme.md)
- Regras de contribuicao e estilo de conteudo: [contributing.md](contributing.md)
- Convencoes dos scripts e estrutura de roadmaps: [scripts/readme.md](scripts/readme.md)
- Configuracao Astro/SSR: [astro.config.mjs](astro.config.mjs)
- Configuracao de testes E2E: [playwright.config.ts](playwright.config.ts)
