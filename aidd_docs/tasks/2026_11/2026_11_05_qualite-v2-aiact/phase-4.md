---
status: pending
---

# Instruction: Questions AI Act

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       ├── ✅ questions-aiact.csv
│       └── ✏ run.ts
├── ✅ tests/
│   └── ✏ eval.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_qualite-v2-aiact/
                └── ✅ eval-aiact.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions-aiact.csv` | 12 lignes, 7 références, 3 conceptuelles, 2 pièges | cli |
| Happy path   | Chercher une question conceptuelle | Le document filtré est `32024R1689` | cli |
| Happy path   | Lancer `--questions questions-aiact.csv` | Rapport séparé, aucun mélange avec le RGPD | cli |
| Edge case    | Une référence absente de l'AI Act | Le script échoue avant mesure | cli |
| Edge case    | Une question RGPD dans le jeu AI Act | Le script refuse le mélange de documents | cli |
| Teardown     | Relancer | Résultat identique | cli |

## Tasks to do

### `1)` Écrire douze questions

> Une preuve d'extensibilité, pas un classement.

1. Créer `mcp/eval/questions-aiact.csv` avec `question,type,sources_attendues,piege`.
2. Écrire 7 références exactes, 3 conceptuelles et 2 pièges.
3. Vérifier chaque `ref` contre `data/corpus/aiact/unites.jsonl`.

### `2)` Filtrer par document

> Deux corpus, deux espaces.

1. Dériver le document d'une question du préfixe de `sources_attendues` (avant `#`).
2. Passer ce document à `search` pour ne pas mélanger RGPD et AI Act.
3. Refuser une question dont les références attendues appartiennent à deux documents.
4. Refuser une ref absente du corpus attendu.

### `3)` Rapporter séparément

> Aucun score moyen.

1. Écrire `eval-aiact.md` : date, modèle, index, 12 questions, top 5, top 1, MRR, pièges, `incertain`.
2. Écrire explicitement que 12 questions ne classent pas le corpus.
3. Ne pas toucher aux seuils ni à la bande : ils restent ceux du RGPD.

### `4)` Verrouiller par les tests

> Le filtrage et le refus se testent sans modèle.

1. Vérifier 12 lignes et chaque référence présente.
2. Vérifier le filtrage par document et le refus d'un mélange.
3. Vérifier que le rapport AI Act ne contient aucune question RGPD.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le CSV porte 12 lignes, 7 références, 3 conceptuelles, 2 pièges, et toutes les refs existent. |
| 2 | Une question conceptuelle est cherchée avec `document = 32024R1689` ; un mélange de documents est refusé. |
| 3 | `eval-aiact.md` donne les métriques séparées et dit que 12 questions ne classent pas le corpus. |
| 4 | Les tests couvrent le filtrage et le refus ; `npm test` et `npm run typecheck` passent. |
