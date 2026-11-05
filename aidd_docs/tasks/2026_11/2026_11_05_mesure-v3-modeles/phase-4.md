---
status: pending
---

# Instruction: Calibration des deux modèles

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       └── ✏ run.ts
├── ✅ tests/
│   └── ✏ eval.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_mesure-v3-modeles/
                └── ✅ eval-v3.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire l'index `4b` dans une racine temporaire | 565 unités, 2 560 dimensions | cli |
| Happy path   | `--split dev --modele qwen3-embedding:0.6b` | Seuils calibrés affichés, aucune question `test` | cli |
| Happy path   | `--split dev --modele qwen3-embedding:4b --dim 2560` | Seuils calibrés différents, affichés | cli |
| Edge case    | `--seuils` mal formé | Refus explicite, aucune mesure | cli |
| Edge case    | `--seuils` avec le test et le même modèle deux fois | Refusé par le marqueur | cli |
| Teardown     | Supprimer la racine temporaire | L'index du produit est intact | cli |

## Tasks to do

### `1)` Permettre des seuils figés explicites

> Pour qu'un modèle mesure le test avec ses propres seuils, venus de `dev`.

1. Ajouter `--seuils <bas>,<haut>,<marge>` à `mcp/eval/run.ts` ; absent, garder le comportement actuel (calibration sur `dev`, constantes sur `test`).
2. Refuser une valeur non numérique, hors de `[0, 1]`, ou une marge négative.
3. Journaliser les seuils retenus et leur origine.
4. Vérifier que `--seuils` ne change jamais la calibration `dev` quand elle est demandée.

### `2)` Calibrer chaque modèle sur `dev`

> Même corpus, même découpage, deux modèles.

1. Construire l'index `4b` : `node mcp/index/build.ts --root "$ROOT" --modele qwen3-embedding:4b --dim 2560`.
2. Lancer `--split dev` pour `0.6b` et pour `4b`, et relever les seuils calibrés, le top 5, le top 1, le MRR, les niveaux et les pièges cités.
3. Vérifier que les chiffres `0.6b` du jeu v3 ne réutilisent aucun seuil du jeu v2.
4. Écrire dans `eval-v3.md` les deux tableaux `dev`, les seuils retenus par modèle, et le coût d'indexation mesuré.

### `3)` Figer la commande de mesure

> La commande du test est écrite avant le test.

1. Écrire dans `eval-v3.md` les deux commandes exactes du test, seuils inclus, telles qu'elles seront lancées.
2. Écrire la règle de décision à côté, sans la modifier ensuite.
3. Indiquer qu'aucune question `test` n'a été lue par un humain pendant la calibration.

### `4)` Verrouiller par les tests

> L'analyse des seuils se teste sans modèle.

1. Tester la lecture de `--seuils` : forme valide, forme courte, valeur hors bornes, marge négative.
2. Tester que `--seuils` fonctionne avec `--split test` et `--mesurer-test`.
3. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `--seuils` accepte trois nombres dans `[0, 1]` et refuse le reste en nommant la valeur. |
| 2 | `eval-v3.md` porte les deux tableaux `dev`, les seuils de chaque modèle et le coût d'indexation. |
| 3 | Les deux commandes du test y figurent, seuils inclus, avec la règle de décision. |
| 4 | Les tests couvrent la lecture des seuils ; `npm test` et `npm run typecheck` passent. |
