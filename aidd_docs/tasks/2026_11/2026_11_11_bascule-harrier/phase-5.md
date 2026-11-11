---
status: pending
---

# Instruction: Mesures `dev` des cinq autres corpus et de la doctrine

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/
└── mesures/
    ├── dev-rgpd-v2.json                            ✅
    ├── dev-aiact.json                              ✅
    ├── dev-lil.json                                ✅
    ├── dev-ce.json                                 ✅
    ├── dev-cepd.json                               ✅
    ├── dev-cnil-doctrine.json                      ✅
    └── autres-corpus.md                            ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | L'index produit est Harrier (phase 4) | `--modele leoipulsar/harrier-0.6b --dim 1024` accepte l'index sans le reconstruire | cli |
| Happy path   | Les cinq jeux hors CNIL en `dev` et le jeu doctrine | Top 5, rang 1 et MRR bruts par jeu, sans verdict de supériorité | cli |
| Happy path   | `--seuils <triplet figé>` pour la doctrine, `--seuils 0.69,0.74,0.01` pour les autres | La vue rendue est celle qu'appliquera le produit, sans attendre la phase 6 | cli |
| Edge case    | `questions-aiact.csv` n'a pas de colonne `split` | Il est mesuré sans `--split` ni calibration propre, et le rapport le dit | cli |
| Teardown     | Aucun `--mesurer-test` lancé | Aucun marqueur de consommation n'est écrit | cli |

## Tasks to do

### `1)` Mesurer les cinq corpus sans split `test`

> Le comportement de Harrier hors CNIL, publié sans promesse chiffrée.

1. `npm run mcp:eval -- --questions questions-v2.csv --split dev --modele leoipulsar/harrier-0.6b --dim 1024 --seuils 0.69,0.74,0.01 --json > aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-rgpd-v2.json`.
2. Même forme pour `questions-lil.csv`, `questions-ce.csv` et `questions-cepd.csv` ; `questions-aiact.csv` sans `--split`.
3. Mesurer `questions-cnil-doctrine.csv --split dev` avec `--seuils <triplet figé en phase 2>` ; le rapport est `dev-cnil-doctrine.json`.

### `2)` Publier les chiffres

> Ce que `promesse.md` §5 et la mémoire citeront.

1. Écrire `mesures/autres-corpus.md` : jeu, questions sémantiques, top 5, rang 1, MRR, confiantes sous la règle livrée, et la mention « aucune promesse chiffrée » hors CNIL.
2. Comparer aux chiffres qwen3 du 2026-11-09 sans en tirer de verdict : aucun jeu n'a la puissance de fixer une borne.
3. Pour la doctrine, appliquer la nouvelle table CNIL et la rapporter hors promesse.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les six mesures sont produites sur l'index produit Harrier, sans reconstruction ni tir `test`. |
| 2 | `autres-corpus.md` porte, par jeu, le top 5, le rang 1, le MRR et les confiantes, et ne promet aucune borne hors CNIL. |
