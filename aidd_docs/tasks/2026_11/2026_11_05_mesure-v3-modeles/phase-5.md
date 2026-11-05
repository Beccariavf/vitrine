---
status: pending
---

# Instruction: Mesure unique et décision

## Architecture projection

```txt
.
├── ✅ aidd_docs/
│   ├── ✏ INSTALL.md
│   ├── ✅ memory/
│   │   ├── ✏ data.md
│   │   ├── ✏ testing.md
│   │   └── ✏ codebase-map.md
│   └── ✅ tasks/
│       └── ✅ 2026_11/
│           └── ✅ 2026_11_05_mesure-v3-modeles/
│               ├── ✅ mesure-test-0.6b.json
│               ├── ✅ mesure-test-4b.json
│               └── ✅ eval-v3.md
└── ✏ README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Relire `eval-v3.md` | Les deux commandes et la règle sont figées | cli |
| Happy path   | Mesurer le test avec `0.6b` | JSON + entrée de marqueur, aucune question réglée ensuite | cli |
| Happy path   | Mesurer le test avec `4b` | JSON + seconde entrée de marqueur | cli |
| Happy path   | Lancer `compare.ts` | Comptes appariés, p-value exacte, verdict | cli |
| Edge case    | Relancer le test avec `0.6b` | Refusé, en nommant le modèle | cli |
| Edge case    | Modifier un seuil après le test | Aucune mesure n'est rejouée ; l'écart est consigné | cli |
| Teardown     | Lancer la suite complète | `npm test`, `npm run typecheck`, `npm run build` passent | cli |

## Tasks to do

### `1)` Mesurer le test une fois par modèle

> La commande est celle écrite en phase 4, sans retouche.

1. Lancer la commande `0.6b` telle qu'écrite, avec `--json`, et rediriger le JSON vers `mesure-test-0.6b.json`.
2. Lancer la commande `4b` de la même façon vers `mesure-test-4b.json`.
3. Vérifier que le marqueur porte deux entrées, une par modèle, et que le même modèle est refusé une seconde fois.
4. Ne corriger aucun seuil, aucune question, aucune bande après ces deux passages.

### `2)` Comparer et trancher

> La règle décide, pas l'impression.

1. Lancer `node mcp/eval/compare.ts mesure-test-0.6b.json mesure-test-4b.json`.
2. Relever `b`, `c`, la p-value exacte, le top 5 et le top 1 rendus des deux modèles, et le verdict.
3. Écrire le verdict dans `eval-v3.md` : `4b` adopté, ou `0.6b` conservé et le modèle déclaré non-levier.
4. Si `b + c < 6`, écrire « non établi » et conserver `0.6b` sans interpréter.

### `3)` Documenter

> Ce qui est vrai, pas ce qui est espéré.

1. `eval-v3.md` : composition, règle, `dev` des deux modèles, test des deux modèles, comptes appariés, p-value, verdict, coûts, limites.
2. `README.md` : le jeu v3, la règle de décision et le résultat en une phrase honnête, sans mélanger avec v2.
3. `data.md` : le modèle retenu et, s'il change, la raison chiffrée.
4. `testing.md` et `codebase-map.md` : `--json`, `--seuils`, `compare.ts`, marqueur par modèle.
5. `INSTALL.md` : la construction d'un index alternatif reste possible, sans être le défaut.

### `4)` Vérifier

> Les preuves, pas les affirmations.

1. Lancer `npm test`, `npm run typecheck` et `npm run build`.
2. Vérifier que `git status` ne montre ni index ni fichier temporaire.
3. Vérifier que `eval-v2.md`, `eval-aiact.md` et le rapport v1 sont inchangés.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Deux mesures du test, une par modèle, chacune avec son JSON commité et son entrée de marqueur ; le même modèle relancé est refusé. |
| 2 | `compare.ts` rend `b`, `c`, la p-value et un verdict qui suit la règle ; `eval-v3.md` porte ce verdict. |
| 3 | `README.md`, `INSTALL.md`, `data.md`, `testing.md` et `codebase-map.md` décrivent le jeu v3, les options et le modèle retenu. |
| 4 | Les trois commandes passent, `git status` est propre et les rapports v1, v2 et AI Act sont intacts. |
