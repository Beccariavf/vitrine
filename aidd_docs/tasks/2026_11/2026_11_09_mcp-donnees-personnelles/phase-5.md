---
status: pending
---

# Instruction: Réindexer, mesurer et consigner la couverture

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs
│   ├── memory
│   │   ├── architecture.md
│   │   ├── codebase-map.md
│   │   ├── data.md
│   │   └── testing.md
│   └── tasks
│       └── 2026_11
│           └── 2026_11_09_mcp-donnees-personnelles
│               └── coverage.md
├── data
│   └── corpus
│       ├── cnil
│       │   └── manifest.json
│       ├── lil
│       │   └── manifest.json
│       ├── ce
│       │   └── manifest.json
│       └── cepd
│           └── manifest.json
└── README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire les six corpus et l'index | `lireUnites` rend toutes les unités | cli |
| Happy path   | Rejouer `npm run corpus:index` | Zéro unité embarquée, vecteurs identiques | cli |
| Edge case    | Interroger une question RGPD sans `corpus` | Aucun fragment CE ou CEPD ne remplace le RGPD attendu | cli |
| Teardown     | Rejouer `npm test` et `npm run build` | La suite et le site passent sans réseau | cli |

## Tasks to do

### `1)` Réindexer et vérifier l'idempotence

> L'index porte les six corpus et ne se reconstruit pas sans raison.

1. Lancer `npm run corpus:index` sur l'ensemble des corpus.
2. Le relancer et vérifier que le journal annonce zéro unité ajoutée ou modifiée, vecteurs identiques.
3. Vérifier que la dimension, le modèle et le compte d'unités du manifeste d'index correspondent aux six corpus.

### `2)` Vérifier les évaluations par corpus

> Chaque corpus a son jeu `dev` et ses rangs sont rapportés.

1. Rejouer les jeux existants (RGPD, AI Act, CNIL v2, CNIL doctrine, LIL, CE, CEPD) et consigner les rangs.
2. Vérifier qu'un filtre `corpus` ne rend jamais un fragment d'un autre corpus, et qu'un filtre `nature` ne rend que la nature demandée.
3. Consigner une mesure absente comme absente, jamais comme un succès.

### `3)` Vérifier la couverture de chaque corpus

> Un lecteur sait ce que le corpus contient et ce qu'il exclut ; les manifestes sont écrits par leur synchronisation.

1. Vérifier que chaque `manifest.json` porte le bloc `couverture` émis par sa synchronisation : source, date ou archive, bornes, natures ou types retenus, exclusions et comptes.
2. Si un bloc manque, corriger la synchronisation du corpus concerné, puis la relancer ; ne jamais éditer un manifeste à la main.
3. Écrire `coverage.md` dans le dossier de la tâche : tableau des six corpus, documents, fragments, période, source, licence.
4. Vérifier que les comptes de `coverage.md` sont ceux des manifestes, sans recopie approximative.

### `4)` Mettre à jour la mémoire et le README

> La documentation nomme les corpus, les commandes et les limites.

1. Mettre à jour `aidd_docs/memory/data.md` : six corpus, sources, bornes, commandes de synchronisation, licences.
2. Mettre à jour `aidd_docs/memory/architecture.md` : JADE devient la source du corpus Conseil d'État (la veille garde PISTE), trois dossiers de corpus, filtre `nature`.
3. Mettre à jour `aidd_docs/memory/testing.md` et `codebase-map.md` : nouveaux tests, fixtures et dossiers.
4. Mettre à jour `README.md` : commandes `lil:sync`, `ce:sync`, `cepd:sync`, description des corpus et de leur couverture.

### `5)` Passer la suite complète

> Le candidat est propre avant la revue.

1. Lancer `npm run typecheck`, `npm test` et `npm run build`.
2. Vérifier qu'aucun test ne touche le réseau et qu'aucun secret n'est versionné.
3. Vérifier que `data/corpus/index/` reste ignoré par git et que les six corpus sont commités.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le second passage n'embarque aucune unité et laisse les vecteurs identiques. |
| 2 | Chaque jeu mesuré a ses rangs rapportés ; un filtre `corpus` ou `nature` isole réellement les résultats. |
| 3 | Chaque manifeste porte un bloc `couverture` émis par sa synchronisation ; `coverage.md` reprend les six corpus et leurs comptes. |
| 4 | Le README et les quatre fichiers de mémoire nomment les nouveaux corpus et leurs commandes. |
| 5 | `npm run typecheck`, `npm test` et `npm run build` passent hors ligne ; l'index reste non versionné. |
