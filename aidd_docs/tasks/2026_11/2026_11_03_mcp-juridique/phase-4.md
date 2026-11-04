---
status: completed
---

# Instruction: Jeu d'évaluation

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       ├── ✅ questions.csv
│       └── ✅ run.ts
├── ✅ tests/
│   └── ✅ eval.test.ts
├── ✅ aidd_docs/
│   └── ✅ tasks/
│       └── ✅ 2026_11/
│           └── ✅ 2026_11_03_mcp-juridique/
│               └── ✅ eval.md
└── ✏ package.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions.csv` | 22 lignes, 8 références, 9 conceptuelles, 5 pièges | cli |
| Happy path   | Calculer les métriques sur un classement connu | `recall@5`, `MRR` et taux de citations invalides exacts | cli |
| Happy path   | Lancer `npm run mcp:eval` | Métriques datées, avec le modèle, les seuils et la validation croisée | cli |
| Edge case    | Une question piège refusée | Elle compte comme non citée, pas comme un échec de rappel | cli |
| Edge case    | Une référence attendue absente du corpus | Le script échoue en nommant la référence, avant toute mesure | cli |
| Teardown     | Quitter le script | Aucun index ou modèle modifié | cli |

## Tasks to do

### `1)` Écrire les vingt-deux questions

> Le jeu se relit à la main ; il ne se génère pas à l'aveugle.

1. Créer `mcp/eval/questions.csv` avec `question,type,sources_attendues,piege`.
2. Écrire 8 questions à référence exacte (« article 17 »), 9 conceptuelles (« effacement et moteurs de recherche ») et 5 pièges (article inexistant, notion absente du RGPD, texte abrogé).
3. Inclure la question « effacement » avec `32016R0679#art_17` attendu au rang 1.
4. Relire chaque ligne contre le corpus : chaque `sources_attendues` est une `ref` présente dans `unites.jsonl`.

### `2)` Calculer les métriques

> Deux métriques sans seuil, une métrique avec seuil.

1. Écrire `recallAt5`, `mrr` et `tauxCitationsInvalides` dans `mcp/eval/run.ts`.
2. `recall@5` : part des questions dont une référence attendue est dans les cinq premiers passages. Aucun seuil : mesurable sur les 22 questions.
3. `MRR` : moyenne de l'inverse du rang de la première référence attendue. Aucun seuil.
4. Taux de citations invalides : part des pièges où un passage est rendu au lieu de `aucun_resultat_fiable`. Dépend des seuils.

### `3)` Mesurer sans fuite

> Les seuils se calent sur une partie, se mesurent sur l'autre.

1. Découper les 22 questions en 4 plis aussi égaux que possible (6, 6, 6, 4).
2. Pour chaque pli : calibrer `SEUIL_BAS`, `SEUIL_HAUT` et `MARGE` sur les autres questions, mesurer le taux de citations invalides sur le pli tenu à l'écart.
3. Rapporter `recall@5` et `MRR` sur les 22 (sans seuil), et le taux de citations invalides en moyenne des 4 plis, avec l'intervalle min–max.
4. Ajuster ensuite les seuils finaux sur les 22 et le noter ; les chiffres rapportés restent ceux de la validation croisée.

### `4)` Câbler la commande

> Une commande manuelle, hors CI.

1. Ajouter `"mcp:eval": "node mcp/eval/run.ts"` dans `package.json`.
2. Ne pas ajouter la commande au workflow CI : elle lit un index non commité et appelle Ollama.

### `5)` Verrouiller et rapporter

> Les métriques se testent à part du modèle.

1. Écrire `tests/eval.test.ts` sur des classements synthétiques : rappel parfait, rappel nul, rang deux, piège refusé, piège cité.
2. Vérifier que le CSV porte 22 lignes et que chaque `sources_attendues` existe.
3. Écrire le rapport daté `aidd_docs/tasks/2026_11/2026_11_03_mcp-juridique/eval.md` : date, modèle, seuils finaux, `recall@5`, `MRR`, précision au rang 1, taux de citations invalides par pli, rang de « effacement », pièges échoués.
4. Écrire dans le rapport que 22 questions restent un échantillon étroit : les chiffres valent pour le RGPD, pas pour un corpus plus large.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le CSV porte 22 lignes, 5 pièges, et chaque référence attendue existe dans `unites.jsonl`. |
| 2 | Sur un classement connu, `recall@5` et `MRR` valent les valeurs calculées à la main. |
| 3 | Chaque pli calibre sur les autres questions et mesure sur le pli tenu à l'écart ; le rapport donne la moyenne et l'intervalle des 4 plis. |
| 4 | La commande n'apparaît pas dans `.github/workflows/ci.yml`. |
| 5 | Un piège refusé ne compte pas comme citation invalide ; un piège cité compte ; le rapport nomme la limite d'échantillon. |
