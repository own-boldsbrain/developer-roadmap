# Ownership Matrix

| Domain/Path | Writer | Reader | Description |
| :--- | :--- | :--- | :--- |
| `package.json` | A04 | ALL | Dependencies and scripts |
| `pnpm-lock.yaml` | A04 | ALL | Lockfile |
| `.gitignore` | A02 | ALL | Git exclusions |
| `.github/workflows/**` | A04 | ALL | CI Actions |
| `.gitleaks*` | A03 | ALL | Security scanning |
| `.nirvana/` | A01 | ALL | Governance and ontology |
| `src/data/**` | A07 | A06, A08, A09 | Markdown execution |
| `.translation-control/**` | A07, A09, A10 | ALL | Forensic logging |
| `.codegraph-reports/**` | A11 | A09, A14 | Graph indexes |
