---
status: pending
---

# Instruction: Resynchroniser le corpus et corriger la couverture déclarée

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── data/
│   └── corpus/
│       └── cjue/
│           ├── etat.json ✏️
│           ├── manifest.json ✏️
│           └── unites.jsonl ✏️
├── README.md ✏️
└── aidd_docs/
    ├── memory/
    │   ├── data.md ✏️
    │   ├── architecture.md ✏️
    │   ├── codebase-map.md ✏️
    │   └── testing.md ✏️
    └── tasks/
        └── 2026_11/
            └── 2026_11_11_corpus-cassation-cjue/
                └── coverage.md ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | lancer `npm run cjue:sync` | `data/corpus/cjue/` réécrit, comptes affichés sur `stderr` | cli |
| Happy path   | lire le manifeste et `unites.jsonl` | 15 décisions 2.04 nouvelles, dont `62023CJ0413` avec son point 20 | cli |
| Edge case    | couper le réseau puis relancer | échec de téléchargement, corpus existant intact | cli |
| Teardown     | relancer `npm run corpus:index` | index à jour, recherche sémantique opérante | cli |

## Tasks to do

### `1)` Resynchroniser la CJUE

> Le corpus commité porte les décisions 2.04 joignables.

1. Lancer `npm run cjue:sync` depuis la racine.
2. Contrôler les 15 CELEX joignables relevés le 2026-11-12 : `62014TJ0363`, `62015TJ0639`, `62015TJ0533`, `62016TJ0903`, `62016TJ0314`, `62020TJ0265`, `62021TJ0710`, `62022CJ0479`, `62021TJ0401`, `62022CJ0130`, `62022TJ0375`, `62021TJ0761`, `62023CJ0529`, `62023CJ0413`, `62025TO0144`.
3. Relever dans `data/corpus/cjue/manifest.json` : `documents` (attendu 166 = 151 + 15), `fragments`, `exclusions` (`xhtml_absent` attendu 55 = 27 héritées + 28 nouvelles), `documents_lus` (non prédit : il inclut les exclusions nouvelles non dénombrées), `couverture.notions`, `couverture.langues` ; si un compte diffère, expliquer l'écart dans `coverage.md`, ne pas l'arrondir.

### `2)` Reconstruire l'index

> La recherche sémantique voit les nouveaux fragments.

1. Lancer `npm run corpus:index`.
2. Vérifier que le delta annoncé correspond aux fragments ajoutés.
3. Relever le total d'unités de l'index et le reporter là où le total précédent (74 891) est écrit : `aidd_docs/memory/data.md` §Évaluations dev et `coverage.md` §Évaluations `dev`.

### `3)` Corriger la documentation

> Le corpus déclare ce qu'il couvre vraiment.

1. `aidd_docs/memory/data.md` §Corpus CJUE : sélection `PDON` + `4.11.01` + `2.04`, lecture `fra` puis `eng`, `langueCapture`, motif `xhtml_absent`, nouveaux comptes, limite déclarée (55 exclusions `xhtml_absent`, dont 32 dans la sélection `2.04`).
2. `aidd_docs/memory/architecture.md` : remplacer « XHTML français » et le compte de 151 décisions.
3. `aidd_docs/memory/codebase-map.md` (deux entrées) et `aidd_docs/memory/testing.md` (deux entrées) : même sélection, même lecture, même compte.
4. `README.md` §corpus `cjue` : sélection, langues, motif, comptes et mesure.
5. `aidd_docs/tasks/2026_11/2026_11_11_corpus-cassation-cjue/coverage.md` : ligne `cjue`, détail `cjue`, la phrase sur les « versions françaises absentes », `couverture.notion` → `notions` et le total d'unités de l'index.
6. `README.md` bloc de commandes, ligne `cjue:sync` : remplacer « SPARQL + XHTML français » par la sélection et les langues réelles.

### `4)` Éprouver la recherche

> L'arrêt est interrogeable par le sens, pas seulement par identifiant.

1. Appeler `search` avec « données pseudonymisées identifiables par le destinataire », `corpus: "cjue"`, `k: 5`.
2. Constater que `62023CJ0413` figure dans les passages et que la provenance rendue porte l'URL EUR-Lex correspondante.
3. Consigner le résultat dans `coverage.md` si l'évaluation `cjue` bouge.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | le manifeste porte les trois notions, les comptes de langue, 166 décisions et `62023CJ0413` dans `unites.jsonl`, tout écart expliqué |
| 2 | `npm run corpus:index` se termine sans erreur et l'index compte les nouveaux fragments |
| 3 | `npm test` passe sur le corpus commité ; aucun document vivant (`aidd_docs/memory/`, `README.md`, `coverage.md`) ne parle plus de « version française absente », de 151 décisions ni de `couverture.notion` ; les dossiers de tâches passées et les fixtures de test gardent leurs chiffres d'époque |
| 4 | une recherche sémantique sur la pseudonymisation rend un passage de C-413/23 P |
