---
status: pending
---

# Instruction: Jeu RGPD v2

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       ├── ✅ questions-v2.csv
│       └── ✏ run.ts
├── ✅ tests/
│   └── ✏ eval.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_qualite-v2-aiact/
                └── ✅ eval-v2.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions-v2.csv` | 60 lignes, 30 `dev`, 30 `test`, 10 pièges | cli |
| Happy path   | Lancer `--questions questions-v2.csv --split dev` | 30 questions mesurées, aucune `test` | cli |
| Happy path   | Lancer `--questions questions-v2.csv --split test` | Refusé tant que le test n'est pas autorisé explicitement | cli |
| Edge case    | Une `sources_attendues` absente du corpus | Le script échoue avant toute mesure | cli |
| Edge case    | Calibrer sur une question `test` | Le garde lève et nomme la question | cli |
| Teardown     | Quitter le script | Aucun index ou modèle modifié | cli |

## Tasks to do

### `1)` Écrire soixante questions

> Chaque question est relue contre le texte, pas contre le code.

1. Créer `mcp/eval/questions-v2.csv` avec `question,type,sources_attendues,piege,split`.
2. Écrire 12 références exactes, 38 conceptuelles et 10 pièges.
3. Répartir 30 `dev` et 30 `test` ; inclure les paraphrases difficiles, dont « récupérer mes données » (`art_20`).
4. Vérifier que chaque `sources_attendues` existe dans `unites.jsonl`.

### `2)` Rendre le jeu sélectionnable

> Le runner ne doit pas supposer un seul fichier.

1. Ajouter `--questions <chemin>` à `mcp/eval/run.ts`, valeur par défaut `questions.csv`.
2. Refuser `--split test` sans l'option explicite `--mesurer-test` ; le test ne s'exécute qu'en phase 5.
3. Conserver le garde qui interdit une question `test` dans la calibration.
4. Écrire dans `eval-v2.md` la base `dev` du système actuel, sans mesurer `test`.

### `3)` Verrouiller par les tests

> Le CSV et le garde se testent sans modèle.

1. Vérifier 60 lignes, 30 `dev`, 30 `test`, 10 pièges et chaque référence présente.
2. Vérifier que `--mesurer-test` est requis pour le split `test`.
3. Vérifier que le calcul filtre le split demandé.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le CSV porte 60 lignes, 30 `dev`, 30 `test`, 10 pièges, et chaque référence existe dans `unites.jsonl`. |
| 2 | `--questions questions-v2.csv --split dev` mesure 30 questions ; `--split test` sans `--mesurer-test` refuse. |
| 3 | Les tests couvrent les comptes, le verrou de test et le filtrage ; `npm test` et `npm run typecheck` passent. |
