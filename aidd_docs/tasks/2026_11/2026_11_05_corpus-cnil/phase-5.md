---
status: pending
---

# Instruction: Index complet et documentation

## Architecture projection

```txt
.
├── ✅ aidd_docs/
│   ├── ✏ INSTALL.md
│   ├── ✅ memory/
│   │   ├── ✏ architecture.md
│   │   ├── ✏ codebase-map.md
│   │   ├── ✏ data.md
│   │   └── ✏ testing.md
│   └── ✅ tasks/
│       └── ✅ 2026_11/
│           └── ✅ 2026_11_05_corpus-cnil/
│               └── ✅ eval-cnil.md
└── ✏ README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `npm run cnil:sync -- --tout` | 6 342 fragments, deux origines déclarées | cli |
| Happy path   | `npm run corpus:index` | 6 907 unités (565 + 6 342), delta seul | cli |
| Happy path   | Relancer l'index | 0 unité embarquée, vecteurs identiques | cli |
| Edge case    | Rejouer `cnil:sync` | 0 archive, 0 unité réécrite | cli |
| Edge case    | Lancer la mesure CNIL | 20 questions, rapport séparé | cli |
| Teardown     | `git status` | Ni parquet ni index suivis | cli |

## Tasks to do

### `1)` Construire pour de vrai

> Les preuves, pas les affirmations.

1. Lancer `npm run cnil:sync -- --tout` et relever les comptes (documents, fragments, doublons remplacés, archives lues).
2. Lancer `npm run corpus:index` ; vérifier 6 907 unités et le delta exact.
3. Relancer l'index : 0 unité embarquée, vecteurs identiques octet pour octet.
4. Relancer `cnil:sync` : aucune archive récente, aucune unité réécrite.

### `2)` Mesurer et figer le rapport

> Un corpus, un rapport.

1. Lancer `npm run mcp:eval -- --questions questions-cnil.csv`.
2. Écrire `eval-cnil.md` avec les chiffres et les limites : 20 questions, seuils du produit, URL non vérifiée, double découpage.
3. Vérifier que les rapports v1, v2, v3 et AI Act sont intacts.

### `3)` Documenter

> Ce que le lecteur peut vérifier.

1. `README.md` : troisième corpus, deux origines, commande `cnil:sync`, ce qu'elle télécharge, et la limite « sanctions d'abord ».
2. `INSTALL.md` : le parquet n'est pas commité, il est récupéré au premier `cnil:sync` ; l'index suit par delta.
3. `architecture.md` : `corpus` distinct de `document`, deux origines, `get_decision`.
4. `data.md` : comptes, licences, dates, empreintes, URL non vérifiée.
5. `testing.md` et `codebase-map.md` : `cnil:sync`, fixtures, `get_decision`, évaluation au niveau document.

### `4)` Vérifier

> Les commandes, pas les intentions.

1. Lancer `npm test`, `npm run typecheck` et `npm run build`.
2. Vérifier `git status` : ni `data/raw/cnil/`, ni `data/corpus/index/`.
3. Vérifier que `questions-v2.csv`, `questions-v3.csv` et leurs marqueurs sont inchangés.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le corpus porte 249 documents et 6 342 fragments ; l'index 6 907 unités ; le second passage embarque zéro unité ; la resynchronisation ne réécrit rien. |
| 2 | `eval-cnil.md` porte les métriques et les quatre limites nommées, séparé des autres rapports. |
| 3 | `README.md`, `INSTALL.md` et les quatre fichiers de mémoire décrivent les deux origines et les commandes. |
| 4 | Les trois commandes passent, `git status` est propre, les jeux et marqueurs existants sont intacts. |
