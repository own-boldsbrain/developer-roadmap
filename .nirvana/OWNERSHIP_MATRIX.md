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
| `.translation-control/inventory/**` | A06 | ALL | Inventory manifests |
| `.translation-control/runs/translation/**` | A07 | ALL | Translation execution runs |
| `.translation-control/validations/**` | A08 | ALL | Quality validation logs |
| `.translation-control/opportunities/**` | A09 | ALL | Strategic opportunities |
| `.translation-control/manifests/**` | A10 | ALL | Telemetry and state |
| `.translation-control/reports/**` | A10 | ALL | Summarized reports |
| `.translation-control/releases/**` | A12 | ALL | Release artifacts |
| `.codegraph-reports/**` | A11 | A09, A14 | Graph indexes |
