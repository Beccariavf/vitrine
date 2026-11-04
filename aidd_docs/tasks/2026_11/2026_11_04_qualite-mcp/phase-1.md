---
status: completed
---

# Instruction: Jeu de 50 questions

## Architecture projection

```txt
.
├── mcp/
│   └── eval/
│       ├── ✏ questions.csv
│       └── ✏ run.ts
├── tests/
│   └── ✏ eval.test.ts
└── aidd_docs/
    └── tasks/
        └── 2026_11/
            └── 2026_11_04_qualite-mcp/
                └── ✅ eval.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions.csv` | 50 lignes, colonne `split`, 10 pièges | cli |
| Happy path   | Compter les splits | 35 `dev`, 15 `test` | cli |
| Happy path   | Lancer `npm run mcp:eval -- --split dev` | Les métriques ne portent que sur les 35 questions de développement | cli |
| Edge case    | Calibrer sur une question `test` | Le script refuse et nomme la question | cli |
| Edge case    | Une `sources_attendues` absente du corpus | Le script échoue avant toute mesure | cli |
| Teardown     | Quitter le script | Aucun index ou modèle modifié | cli |

## Tasks to do

### `1)` Étendre le jeu à cinquante questions

> Chaque question est relue contre le texte, pas contre le code.

1. Ajouter la colonne `split` à `mcp/eval/questions.csv` : `dev` ou `test`.
2. Porter le jeu à 50 lignes : 12 références exactes, 28 conceptuelles, 10 pièges.
3. Répartir 35 en `dev` et 15 en `test` ; les 15 `test` ne servent jamais à régler un seuil.
4. Inclure la paraphrase « récupérer mes données » avec `32016R0679#art_20` attendu, en `test`.
5. Vérifier que chaque `sources_attendues` existe dans `unites.jsonl`.

### `2)` Séparer mesure et calibration

> Une seule règle : le test ne calibre pas.

1. Ajouter `--split dev|test|all` à `mcp/eval/run.ts`, `dev` par défaut.
2. Refuser toute calibration qui reçoit une question `test`, en nommant la question.
3. Rapporter séparément le nombre de questions, de références, de conceptuelles et de pièges.
4. Écrire le rapport de base dans `eval.md`, daté, avec les chiffres `dev` et `test` du code actuel.

### `3)` Verrouiller par les tests

> Le CSV et la règle de séparation sont testables sans modèle.

1. Vérifier 50 lignes, 35 `dev`, 15 `test`, 10 pièges et chaque référence présente.
2. Vérifier que `--split test` ne sert pas à la calibration et que le garde lève.
3. Vérifier que le calcul des métriques ignore les lignes de l'autre split.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le CSV porte 50 lignes, 35 `dev`, 15 `test`, 10 pièges, et chaque référence attendue existe dans `unites.jsonl`. |
| 2 | `--split dev` ne mesure que 35 questions ; une question `test` passée à la calibration lève en la nommant ; `eval.md` porte une base datée pour `dev` et `test`, sans réglage de seuil sur `test`. |
| 3 | Les tests couvrent les comptes, le garde de split et le filtrage ; `npm test` et `npm run typecheck` passent. |
