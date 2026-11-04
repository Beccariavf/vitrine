---
status: pending
---

# Instruction: Mémoire et documentation

## Architecture projection

```txt
.
├── ✅ aidd_docs/
│   ├── ✏ INSTALL.md
│   └── ✅ memory/
│       ├── ✏ architecture.md
│       ├── ✏ data.md
│       ├── ✏ codebase-map.md
│       ├── ✏ testing.md
│       └── ✏ coding-assertions.md
└── ✏ README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire les cinq fichiers de mémoire, `INSTALL.md` et le README | Aucun ne décrit `mcp/` ni `data/corpus/` ; `INSTALL.md` affirme même « Pas de SQLite » | cli |
| Happy path   | Lire la documentation après mise à jour | La zone `mcp/`, ses commandes, le corpus et l'index sont décrits | cli |
| Edge case    | Chercher une affirmation sur le site | Le site reste décrit comme lisant uniquement `data/` | cli |
| Teardown     | Lancer la suite complète | `npm test`, `npm run typecheck` et `npm run build` passent | cli |

## Tasks to do

### `1)` Décrire l'architecture

> Une quatrième zone, séparée du pipeline et du site.

1. Ajouter `mcp/` dans `architecture.md` : corpus, index, outils, transport stdio.
2. Décrire `corpus:build` et `corpus:index`, et le fait que l'index n'est pas commité.
3. Noter que `veille/` et `src/` sont inchangés, que `mcp/` ne fait que réutiliser `writeRaw` et le type `FetchLike`, et que le site ne lit aucune API.

### `2)` Décrire les données

> Un corpus versionné, un index dérivé.

1. Ajouter dans `data.md` la section du corpus : `data/corpus/<document>/`, le manifeste et `unites.jsonl`.
2. Décrire la provenance CELLAR, la licence, le nom du snapshot et l'index dérivé, reconstructible et ignoré par git.
3. Corriger la section `Models` de `data.md`, qui affirme encore « Aucun modèle, aucune inférence » : décrire l'embedding local, le modèle épinglé et le fait qu'il ne tourne qu'à l'indexation et à la requête.

### `3)` Mettre la carte à jour

> Naviguer vers la nouvelle zone.

1. Ajouter `mcp/` dans le diagramme et dans les zones de `codebase-map.md`.
2. Nommer les entrées : `mcp/corpus/build.ts`, `mcp/index/build.ts`, `mcp/server.ts`, `mcp/eval/run.ts`.

### `4)` Décrire les tests et les vérifications

> Ce qui tourne hors ligne et ce qui reste manuel.

1. Ajouter dans `testing.md` les tests du corpus, de l'index et des outils, et l'embedder factice.
2. Documenter que la fixture `tests/fixtures/eurlex/rgpd.xhtml` est la capture intégrale, exception à la règle des captures réduites.
3. Noter que `mcp:eval` est manuel et hors CI.
4. Ajouter `mcp/**/*.ts` au périmètre du typecheck dans `coding-assertions.md`.

### `5)` Documenter l'usage et réviser la décision d'installation

> Un lecteur clone et lance deux commandes.

1. Ajouter dans `aidd_docs/INSTALL.md` la révision de « Pas de SQLite » : SQLite + sqlite-vec pour le MCP local, aucun serveur, et les étapes d'installation (Ollama, `ollama pull qwen3-embedding:0.6b`).
2. Ajouter dans `README.md` : `npm run corpus:build`, `npm run corpus:index`, `npm run mcp:smoke`, puis la configuration MCP `node mcp/server.ts`.
3. Documenter la dépendance locale : Ollama écoute sur `127.0.0.1:11434` et `qwen3-embedding:0.6b` est tiré ; sans cela, `corpus:index` échoue avec un message actionnable.
4. Vérifier les trois commandes : `npm test`, `npm run typecheck`, `npm run build`.
5. Vérifier qu'aucun document ne promet une recherche par le sens sans index construit.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `architecture.md` décrit `mcp/`, les deux commandes, l'index non commité et la réutilisation de `writeRaw`. |
| 2 | `data.md` décrit le manifeste, `unites.jsonl`, la provenance, l'index dérivé et remplace « Aucun modèle ». |
| 3 | `codebase-map.md` nomme la zone et ses quatre entrées. |
| 4 | `testing.md` et `coding-assertions.md` couvrent les tests MCP, la fixture intégrale et le typecheck de `mcp/`. |
| 5 | `INSTALL.md` et `README.md` permettent de construire, de contrôler et de brancher le serveur avec Ollama ; les trois commandes passent. |
