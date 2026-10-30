---
status: completed
---

# Instruction: Lire les entrées de data/

## Architecture projection

```txt
.
├── src/
│   └── lib/
│       └── entries.ts ✅
└── tests/
    └── entries.test.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Lire le `data/` committé | Les fichiers d'entrée sont listés | cli |
| Happy path | Appeler le lecteur | Une entrée par fichier, triées par date décroissante | cli |
| Edge case | Deux entrées dont une sans date | L'entrée sans date vient en dernier | cli |
| Edge case | Un JSON illisible | Le lecteur lève une erreur explicite | cli |
| Teardown | Supprimer le répertoire temporaire | État initial restauré | cli |

## Tasks to do

### `1)` Lecteur d'entrées

> Le site lit la sortie du pipeline, jamais une API.

1. Créer `src/lib/entries.ts` : lister récursivement `data/entries/**/*.json`, lire et valider chaque entrée.
2. Trier par `publishedAt` décroissant ; les `null` en dernier ; départage par titre.
3. Lever une erreur explicite si `data/entries` est absent ou si un fichier est illisible.

### `2)` Tests du lecteur

> Le tri, les dates nulles et l'échec sont prouvés hors ligne.

1. Créer `tests/entries.test.ts` : le `data/` committé produit une entrée par fichier.
2. Tester le tri et le placement des dates nulles sur un répertoire temporaire.
3. Tester qu'un JSON illisible lève.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le lecteur rend toutes les entrées de `data/`, triées, avec les cinq champs validés |
| 2 | Les tests couvrent le tri, les dates nulles, l'entrée illisible et le nombre d'entrées |
