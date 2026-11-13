---
status: completed
---

# Instruction: Élargir la sélection CELLAR à la notion « données personnelles par les institutions de l'Union »

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp/
│   └── corpus/
│       └── cjue/
│           ├── descripteur.json ✏️
│           ├── liste.ts ✏️
│           └── sync.ts ✏️
└── tests/
    ├── cjue-corpus.test.ts ✏️
    └── fixtures/
        └── cjue/
            └── liste-204.json ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | écrire une réponse SPARQL de test contenant `62023CJ0413` classé seulement en `fd_578/2.04`, et fournir son XHTML par `reponsesXhtml` | la liste et la capture sont disponibles | cli |
| Happy path   | lancer `syncCjue` sur cette réponse | la décision est retenue et produit des unités | cli |
| Edge case    | dater ce CELEX avant `2014-01-01` | compté `avant_borne`, aucune capture lue | cli |
| Teardown     | supprimer la racine temporaire | état initial restauré | cli |

## Tasks to do

### `1)` Décrire la sélection comme une liste de notions

> Le descripteur nomme toutes les notions retenues, pas une seule.

1. Remplacer `notion` par `notions` dans `mcp/corpus/cjue/descripteur.json` : `fd_578/4.11.01` (« Protection des données à caractère personnel ») puis `fd_578/2.04` (« Protection des données à caractère personnel par les institutions de l'Union »).
2. Adapter `DescripteurCjue` et `Selection` dans `mcp/corpus/cjue/liste.ts`.

### `2)` Interroger toutes les notions

> La requête liste et la requête de comptage unissent chaque notion.

1. Dans `selection()`, produire un `UNION` par notion en plus de la matière `PDON`.
2. Vérifier que `requeteAvantBorne` réutilise la même sélection.

### `3)` Déclarer la couverture

> Le manifeste dit quelles notions ont été interrogées.

1. Remplacer `couverture.notion` par `couverture.notions` dans `mcp/corpus/cjue/sync.ts` et dans `CouvertureCjue`.

### `4)` Tester la sélection élargie

> Un CELEX classé seulement en 2.04 entre dans le corpus.

1. Ajouter `tests/fixtures/cjue/liste-204.json` avec `62023CJ0413` daté `2025-09-04`.
2. Dans `tests/cjue-corpus.test.ts`, asserter que `requeteListe` et `requeteAvantBorne` contiennent `fd_578/2.04` et `fd_578/4.11.01`.
3. Ajouter un cas de synchronisation sur cette fixture, capture fournie par `reponsesXhtml` : décision retenue, `couverture.notions` à deux entrées ; puis le même CELEX daté 2013 compté `avant_borne` sans capture lue.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | le descripteur se lit sans erreur et expose deux notions ordonnées |
| 2 | les deux requêtes SPARQL portent les deux URI de notion et la matière `PDON` |
| 3 | le manifeste écrit porte `couverture.notions` avec les deux libellés |
| 4 | `npm test` passe ; le CELEX 2.04 est retenu avec sa capture, puis écarté `avant_borne` quand il est daté 2013 |
