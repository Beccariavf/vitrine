---
status: completed
---

# Instruction: Mesure finale et documentation

## Architecture projection

```txt
.
├── ✅ aidd_docs/
│   ├── ✏ INSTALL.md
│   ├── ✅ memory/
│   │   ├── ✏ architecture.md
│   │   ├── ✏ data.md
│   │   ├── ✏ codebase-map.md
│   │   └── ✏ testing.md
│   └── ✅ tasks/
│       └── ✅ 2026_11/
│           └── ✅ 2026_11_05_qualite-v2-aiact/
│               ├── ✅ eval-v2.md
│               └── ✅ eval-aiact.md
└── ✏ README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Vérifier que le système est figé | Aucun seuil ni bande modifié après la phase 2 | cli |
| Happy path   | Lancer `--questions questions-v2.csv --split test --mesurer-test` | Mesure unique, rapport avec intervalle | cli |
| Happy path   | Lancer `--questions questions-aiact.csv` | Rapport AI Act séparé | cli |
| Edge case    | Relancer le test v2 | Refusé : le test est déjà consommé | cli |
| Edge case    | Chercher une promesse sans index | Aucun document ne la porte | cli |
| Teardown     | Lancer la suite complète | `npm test`, `npm run typecheck`, `npm run build` passent | cli |

## Tasks to do

### `1)` Mesurer le test v2 une fois

> Le test ne sert qu'à constater.

1. Vérifier que les seuils, la bande et la décision hybride sont figés.
2. Lancer `npm run mcp:eval -- --questions questions-v2.csv --split test --mesurer-test`.
3. Écrire dans `eval-v2.md` le top 5, le top 1, le MRR, les pièges et l'intervalle de confiance à 95 %.
4. Marquer le test comme consommé : une seconde exécution refuse.

### `2)` Figer le rapport AI Act

> Un corpus, un rapport.

1. Lancer `npm run mcp:eval -- --questions questions-aiact.csv`.
2. Écrire `eval-aiact.md` avec les mêmes métriques, sans seuil propre.
3. Comparer seulement la mécanique (ingestion, index, provenance), jamais les scores.

### `3)` Mettre la documentation à jour

> Ce qui est vrai, pas ce qui est espéré.

1. `README.md` : deux corpus, hybride si conservé, split v2 et commande `--questions`.
2. `INSTALL.md` : la construction suit les descripteurs, l'index couvre les deux corpus.
3. `architecture.md` : FTS5, RRF, second corpus, delta des deux tables.
4. `data.md`, `testing.md`, `codebase-map.md` : corpus, tests et entrées nouvelles.

### `4)` Vérifier

> Les preuves, pas les affirmations.

1. Lancer `npm test`, `npm run typecheck` et `npm run build`.
2. Vérifier que `git status` ne montre ni index ni temporaire.
3. Vérifier que le rapport v1 reste intact et distinct du v2.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `eval-v2.md` porte la mesure unique du test, l'intervalle à 95 % et un refus à la seconde exécution. |
| 2 | `eval-aiact.md` porte les métriques AI Act séparées, sans mélange ni seuil propre. |
| 3 | `README.md`, `INSTALL.md` et les quatre fichiers de mémoire décrivent les deux corpus et l'hybride. |
| 4 | Les trois commandes passent, `git status` est propre, et le rapport v1 reste distinct. |
