---
status: pending
---

# Instruction: Vérification continue

## Architecture projection

```txt
.
├── .github/
│   └── workflows/
│       └── ci.yml ✅
└── aidd_docs/
    └── memory/
        ├── vcs.md ✏
        └── coding-assertions.md ✏
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Pousser la branche | Le workflow est déclenché | cli |
| Happy path | Attendre la fin du run | Typecheck, tests et build passent au vert | cli |
| Edge case | Un test échoue | Le run échoue et bloque la fusion | cli |
| Teardown | Aucun artefact local | Dépôt inchangé | cli |

## Tasks to do

### `1)` Workflow de CI

> La même porte que la locale, à chaque push.

1. Créer `.github/workflows/ci.yml` : déclencheurs `push` et `pull_request`.
2. `actions/checkout`, puis Node 24 avec cache npm, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
3. Permissions `contents: read`, timeout de 10 minutes.

### `2)` Mémoire

> La convention de validation dit désormais qui l'exécute.

1. Dans `aidd_docs/memory/vcs.md`, indiquer que la CI exécute typecheck, tests et build à chaque push.
2. Dans `aidd_docs/memory/coding-assertions.md`, rappeler que la CI rejoue les mêmes commandes.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le workflow se déclenche sur la branche et passe au vert |
| 2 | La mémoire mentionne la CI et ses commandes |
