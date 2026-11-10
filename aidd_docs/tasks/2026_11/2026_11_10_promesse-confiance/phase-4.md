---
status: completed
---

# Instruction: Mesurer la promesse sur les jeux dev

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/dev-apres.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Code de la phase 3, sept jeux `dev`, table de `promesse.md` | les mesures tournent hors réseau | cli |
| Happy path   | `node mcp/eval/run.ts … --regle produit` sur chaque jeu | niveaux calculés avec la table du corpus | cli |
| Edge case    | Un corpus dont le risque dépasse le plafond | il est nommé, avec son chiffre et son intervalle | cli |

## Tasks to do

### `1)` Re-mesurer les sept jeux

> Mêmes questions, même index, seule la règle a changé.

1. Rejouer en `dev` les jeux RGPD, AI Act, CNIL étendu, LIL, Conseil d'État, CEPD et doctrine avec `--regle produit`.
2. Conserver les JSON sous `mesures/`.
3. Vérifier que `refs` et `similarites` sont identiques à la phase 1 : seule la règle a bougé.

### `2)` Calculer la promesse tenue

> Couverture et risque, corpus par corpus.

1. Passer chaque JSON à `mcp/eval/risque.ts`.
2. Comparer au plafond de `promesse.md` : atteint, dépassé, ou non mesurable faute de questions.
3. Donner la couverture par corpus : combien de réponses le lecteur reçoit étiquetées `confiant`.

### `3)` Vérifier l'effet sur le rendu

> La promesse ne doit pas coûter plus de bonnes réponses qu'elle n'en protège.

1. Comparer le top 5 rendu avant et après, par corpus.
2. Lister les questions devenues muettes et celles rétablies par le plancher.
3. Écrire `mesures/dev-apres.md` avec les tableaux et le verdict par corpus, en rappelant que la passe sans `corpus` n'est pas mesurée et sort de la promesse.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | sept JSON re-mesurés, `refs` et `similarites` identiques à la phase 1 |
| 2 | chaque corpus a sa couverture et son risque comparés au plafond, ou son statut non mesurable |
| 3 | le rapport donne le top 5 rendu avant/après, nomme toute question muette ou rétablie, et rappelle la portée hors `corpus` |
