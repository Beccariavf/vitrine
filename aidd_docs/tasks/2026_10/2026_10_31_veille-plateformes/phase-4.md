---
status: pending
---

# Instruction: Filtres de jurisprudence

## Architecture projection

```txt
.
├── veille/
│   ├── themes.ts ✏
│   ├── piste.ts ✏
│   └── sources/
│       ├── cetat.ts ✏
│       └── judilibre.ts ✏
└── tests/
    ├── cetat.test.ts ✏
    └── judilibre.test.ts ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Activer la seule matière `plateformes` avec un `fetch` simulé | Deux requêtes attendues | cli |
| Happy path   | Lancer CETAT | Deux recherches `2022/2065` et `2022/1925`, un seul jeton, une entrée dédupliquée | cli |
| Happy path   | Lancer Judilibre | Les deux mêmes recherches, une entrée dédupliquée | cli |
| Edge case    | Activer seulement `donnees-personnelles` | Une seule recherche, sur son premier terme | cli |
| Edge case    | Activer les cinq matières | Au plus treize appels, sous le plafond de seize | cli |
| Teardown     | Restaurer les variables PISTE | Environnement initial | cli |

## Tasks to do

### `1)` Nommer les requêtes d'une matière

> Une matière peut porter plusieurs instruments ; la recherche doit toutes les couvrir.

1. Dans `veille/themes.ts`, exporter `themeQueries(theme) : string[]`.
2. Rendre `theme.queries` quand elle est présente et non vide ; sinon rendre le premier terme, puis le premier instrument, puis le libellé.
3. Ne pas modifier `matchesTheme` : les requêtes ne servent qu'à interroger PISTE.

### `2)` Boucler sur les requêtes dans CETAT

> Une décision trouvée par les deux requêtes n'est écrite qu'une fois.

1. Dans `veille/sources/cetat.ts`, remplacer la requête unique `theme.terms[0]` par une boucle sur `themeQueries(theme)`.
2. Construire un corps Légifrance par requête, pousser chaque réponse brute dans `raw`, et dédupliquer les entrées par identifiant dans `byId`.
3. Conserver la fenêtre de 90 jours et le filtre de date par entrée.

### `3)` Boucler sur les requêtes dans Judilibre

> Le même contrat s'applique à la Cour de cassation.

1. Dans `veille/sources/judilibre.ts`, remplacer la requête unique par une boucle sur `themeQueries(theme)`.
2. Construire les paramètres par requête, pousser chaque réponse brute, dédupliquer par identifiant.
3. Conserver la fenêtre de 30 jours, les guillemets autour de la requête et l'opérateur `and`.

### `4)` Aligner le plafond et les tests

> Le plafond PISTE reste la garde ; la cinquième matière ajoute une requête, pas un dépassement.

1. Dans `veille/piste.ts`, mettre à jour le commentaire de `MAX_CALLS_PER_RUN` : un jeton, une recherche par requête de matière et par source ; le plafond reste seize.
2. Dans `tests/cetat.test.ts`, ajouter un cas `plateformes` : deux recherches, un jeton, une entrée malgré deux réponses identiques.
3. Dans `tests/judilibre.test.ts`, ajouter le même cas.
4. Ajouter dans les deux fichiers un cas à cinq matières qui vérifie que le nombre d'appels reste inférieur ou égal à treize.
5. Lancer `npm run typecheck` et `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `themeQueries` rend les deux requêtes de `plateformes` et le premier terme des quatre autres matières. |
| 2 | CETAT émet deux recherches pour `plateformes`, réutilise un seul jeton et ne rend qu'une entrée pour deux réponses identiques. |
| 3 | Judilibre émet deux recherches pour `plateformes` et déduplique de la même façon. |
| 4 | Une matière sans `queries` garde une seule recherche ; cinq matières actives restent sous le plafond de seize appels ; typecheck et tests passent. |
