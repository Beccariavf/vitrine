---
status: pending
---

# Instruction: Mémoire et README

## Architecture projection

```txt
.
├── README.md ✏
├── tools/
│   └── README.md ✏
└── aidd_docs/
    └── memory/
        ├── data.md ✏
        ├── architecture.md ✏
        ├── design.md ✏
        ├── testing.md ✏
        ├── codebase-map.md ✏
        ├── project-brief.md ✏
        └── ecosystem.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Chercher « quatre matières » et « huit sources » dans la mémoire et le README | Les mentions périmées sont localisées | cli |
| Happy path   | Mettre à jour les documents | Cinq matières, dix adaptateurs, deux flux Commission, ARCOM et requêtes PISTE décrits | cli |
| Edge case    | Rechercher à nouveau les mentions périmées | Aucune occurrence | cli |
| Teardown     | Lancer `npm test` | La suite passe | cli |

## Tasks to do

### `1)` Mettre à jour les données

> La mémoire des données décrit ce que le pipeline lit réellement.

1. Dans `aidd_docs/memory/data.md`, ajouter ARCOM (flux presse filtré DSA) et la Commission DMA (flux dédié, tous types de publications).
2. Passer les matières à cinq et ajouter `commission-dma → plateformes` aux défauts de source.
3. Décrire `queries` : requêtes propres à une matière, repli sur le premier terme, deux requêtes pour `plateformes`.
4. Mettre le plafond à treize appels observés sous la garde de seize.

### `2)` Mettre à jour l'architecture et la carte

> Les documents de structure doivent nommer les nouveaux adaptateurs.

1. Dans `aidd_docs/memory/architecture.md`, passer à dix adaptateurs, cinq matières et deux flux Commission ; décrire `queries`.
2. Dans `aidd_docs/memory/codebase-map.md`, remplacer « huit sources » et « quatre matières » ; ajouter les deux fichiers d'adaptateur et leurs fixtures.
3. Dans `aidd_docs/memory/ecosystem.md`, ajouter ARCOM et Commission DMA au diagramme.

### `3)` Mettre à jour le produit et le design

> Le vocabulaire métier et la description du sélecteur suivent le contrat.

1. Dans `aidd_docs/memory/project-brief.md`, passer la définition de « Matière » à cinq blocs et la ligne des sources à neuf autorités et dix adaptateurs.
2. Dans `aidd_docs/memory/design.md`, décrire cinq pastilles et le repli sur deux lignes à 375 px.

### `4)` Mettre à jour les tests et les guides

> Un lecteur doit retrouver les nouveaux tests et les nouveaux gestes.

1. Dans `aidd_docs/memory/testing.md`, passer à cinq matières ; ajouter les tests DMA, ARCOM, requêtes multiples et le cas 375 px.
2. Dans `README.md`, passer à cinq matières et dix adaptateurs, et nommer ARCOM et le flux DMA.
3. Dans `tools/README.md`, passer la validation à cinq matières et mentionner la conservation de `queries`.
4. Lancer `rg -n "quatre matières|huit sources|exactly four" README.md tools aidd_docs/memory src veille` et corriger les occurrences qui décrivent encore l'ancien état.

### `5)` Passer les portes

> La documentation ne change pas le code, mais elle ne doit pas casser la suite.

1. Lancer `npm run typecheck`.
2. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `data.md` nomme ARCOM, le flux DMA, cinq matières, le défaut `commission-dma`, `queries` et le plafond réel. |
| 2 | `architecture.md`, `codebase-map.md` et `ecosystem.md` décrivent dix adaptateurs et cinq matières, sans mention périmée. |
| 3 | `project-brief.md` définit cinq matières et neuf autorités ; `design.md` décrit cinq pastilles et le repli mobile. |
| 4 | `testing.md`, `README.md` et `tools/README.md` sont à jour ; aucune occurrence de « quatre matières », « huit sources » ou « exactly four » ne subsiste. |
| 5 | Typecheck et tests passent. |
