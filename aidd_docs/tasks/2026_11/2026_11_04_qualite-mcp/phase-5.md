---
status: completed
---

# Instruction: Rapport et documentation

## Architecture projection

```txt
.
├── aidd_docs/
│   ├── ✏ INSTALL.md
│   ├── ✅ memory/
│   │   ├── ✏ architecture.md
│   │   ├── ✏ data.md
│   │   ├── ✏ codebase-map.md
│   │   └── ✏ testing.md
│   └── ✅ tasks/
│       └── ✅ 2026_11/
│           └── ✅ 2026_11_04_qualite-mcp/
│               └── ✅ eval.md
└── ✏ README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire le rapport existant | Les chiffres de développement et de test y figurent séparément | cli |
| Happy path   | Lire l'expérience 4b | Le rang de l'article 20 et les temps des deux modèles sont donnés | cli |
| Edge case    | Chercher une promesse de recherche sans index | Aucun document ne la porte | cli |
| Teardown     | Lancer la suite complète | `npm test`, `npm run typecheck` et `npm run build` passent | cli |

## Tasks to do

### `1)` Figer le rapport

> Développement et test ne se mélangent pas.

1. Dans `eval.md`, séparer les résultats `dev` (réglage) des résultats `test` (constat).
2. Donner pour chaque split : top 5, top 1, MRR, pièges cités, taux d'`incertain`.
3. Rapporter l'expérience 4b : article 20 au rang 2, 2 560 dimensions, 129,6 s pour 272 unités contre 19,3 s avec 0.6b.
4. Nommer les limites restantes : paraphrase, précision au rang 1, échantillon de 15 questions.

### `2)` Mettre la mémoire à jour

> L'architecture décrit l'incrémental et la préférence.

1. `architecture.md` : empreinte, diff, `rowid` stable, bande article.
2. `data.md` : l'index incrémental ne réécrit que le delta ; les vecteurs inchangés restent identiques.
3. `testing.md` : jeu de 50 questions, split `dev`/`test`, embedder compteur.
4. `codebase-map.md` : les fonctions de diff et de classement.

### `3)` Mettre l'usage à jour

> Un lecteur sait ce que le produit garantit.

1. `README.md` : le jeu de 50 questions, la commande `--split`, et la limite de paraphrase.
2. `INSTALL.md` : l'index incrémental se relance sans tout recalculer.
3. Ne promettre la recherche sémantique qu'avec un index construit.

### `4)` Vérifier

> Les preuves, pas les affirmations.

1. Lancer `npm test`, `npm run typecheck` et `npm run build`.
2. Lancer `npm run mcp:eval -- --split test` et vérifier que le rapport correspond.
3. Vérifier que `git status` ne montre ni index ni fichier temporaire.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `eval.md` sépare `dev` et `test`, donne top 5, top 1, MRR, pièges et `incertain`, et documente l'expérience 4b. |
| 2 | La mémoire décrit l'empreinte, le diff, le `rowid` stable et la préférence article. |
| 3 | `README.md` et `INSTALL.md` décrivent le jeu de 50 questions, le split et l'index incrémental sans surpromettre. |
| 4 | Les trois commandes passent, le rapport `test` correspond, et `git status` est propre. |
