---
status: pending
---

# Instruction: Comparaison appariée

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       ├── ✅ compare.ts
│       └── ✅ run.ts
├── ✅ tests/
│   └── ✅ compare.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_mesure-v3-modeles/
                └── ✅ eval-v3.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Deux JSON de six questions appariées | Les paires sont alignées par question | cli |
| Happy path   | A gagne 5, B gagne 1 | `b = 5`, `c = 1`, verdict favorable à A | cli |
| Happy path   | 9 contre 1 | p ≈ 0,021, verdict significatif | cli |
| Edge case    | 2 contre 1 | p = 1,0, verdict « non établi » | cli |
| Edge case    | Moins de six paires discordantes | Verdict « non établi », même si p est petit | cli |
| Edge case    | Les deux fichiers n'ont pas les mêmes questions | Refus, en nommant la question absente | cli |
| Teardown     | Rejouer sur les mêmes fichiers | Résultat identique | cli |

## Tasks to do

### `1)` Aligner les mesures

> Une paire par question, pas une moyenne par modèle.

1. Créer `mcp/eval/compare.ts`, hors du serveur MCP, sans écriture sur son `stdout`.
2. Lire deux JSON produits par `--json`, vérifier l'égalité des questions et de l'ordre.
3. Définir le succès d'une question : la référence attendue est parmi les passages rendus (top 5) et, séparément, au rang 1.
4. Classer chaque question en `gagne`, `perd`, `égal` pour chaque métrique.

### `2)` Calculer le test exact

> Le test de McNemar est un binomial sur les paires discordantes.

1. Compter `b` (modèle A réussit, B échoue) et `c` (l'inverse).
2. Calculer la p-value bilatérale exacte : `2 × P(X ≤ min(b, c))` avec `X ~ Binomial(b + c, 1/2)`, plafonnée à 1.
3. Refuser le calcul si `b + c = 0` et rendre « aucun désaccord ».
4. Écrire le verdict selon la règle du plan : gain significatif si `b > c`, `p < 0,05`, `b + c ≥ 6`, et top 5 rendu non dégradé de plus d'une question.
5. Afficher les comptes, les p-values, le top 5 et le top 1 rendus des deux modèles.

### `3)` Verrouiller par les tests

> Les valeurs de référence se calculent à la main.

1. Tester 5/1, 9/1, 2/1, 1/1 et 0/0 avec les p-values attendues.
2. Tester le plancher de six paires discordantes.
3. Tester le refus de deux fichiers non appariés.
4. Vérifier que le verdict suit la règle et non l'inverse.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les deux JSON sont alignés par question ; un désaccord de jeu lève en nommant la question. |
| 2 | `b`, `c` et la p-value exacte sont rendus ; 9/1 donne ≈ 0,021 et 2/1 donne 1,0. |
| 3 | Le verdict applique la règle pré-déclarée, y compris le plancher de six paires ; `npm test` et `npm run typecheck` passent. |
