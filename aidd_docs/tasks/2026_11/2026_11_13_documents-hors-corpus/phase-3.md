---
status: completed
---

# Instruction: Relever les documents absents et documenter le comportement

## Architecture projection

```txt
.
├── mcp/eval/
│   └── citations.ts            ✏️ marque les citations et compte les absentes
├── aidd_docs/
│   ├── tasks/2026_11/2026_11_13_documents-hors-corpus/
│   │   └── mesure.md           ✅ relevé reproductible par corpus
│   └── memory/
│       ├── architecture.md     ✏️ présence et refus
│       ├── codebase-map.md     ✏️ citations, tools
│       └── testing.md          ✏️ tests et commande de relevé
└── README.md                   ✏️ ce que rendent les outils
```

## Test Scope

| Scenario     | Action                                                       | Observable outcome                                                              | Actor  |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------ |
| Setup        | corpus réel dans `data/corpus/`                              | manifestes RGPD et LIL présents, ePrivacy absent                                | system |
| Happy path   | `node mcp/eval/citations.ts cnil --taille 5` deux fois       | sorties identiques, chaque citation hors corpus porte la mention                 | cli    |
| Happy path   | relevé sur `cnil`, `ce`, `cc`, `cjue`, `cepd`                | un compte par instrument absent et par corpus, reporté dans `mesure.md`          | cli    |
| Edge case    | `node mcp/eval/citations.ts rgpd`                            | refus inchangé : les citations ne se lisent que sur les corpus de décisions      | cli    |
| Teardown     | `git status --short data/`                                   | aucun fichier de `data/` modifié                                                | system |

## Tasks to do

### `1)` Rendre le relevé reproductible

1. Dans `rendreEchantillon`, marquer les citations avec `avecPresence(rootDir, …)` et afficher la mention pour une citation hors corpus.
2. Ajouter une ligne finale par corpus : compte des citations hors corpus par instrument, sur tous les documents, pas seulement l'échantillon.
3. Ne rien écrire sur disque.

### `2)` Consigner la preuve

1. Lancer le relevé sur les cinq corpus de décisions et noter, pour chacun, documents lus, citations rendues, citations hors corpus par instrument.
2. Écrire `mesure.md` : commande, date, dénominateur et ce que le relevé prouve — la mention apparaît partout où l'instrument est cité, ce n'est pas une mesure de précision.

### `3)` Mettre la documentation à jour

1. `README.md` : les citations portent `document` et `hors_corpus`, un instrument absent répond « absent de mon corpus (périmètre : …) ».
2. `architecture.md` : présence lue dans les manifestes, refus partagé par les trois outils, citations entre décisions toujours réservées à `#30`.
3. `codebase-map.md` et `testing.md` : fonctions nouvelles, tests et commande de relevé.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 1... | deux exécutions rendent la même sortie, sans écriture dans `data/`                                    |
| 1... | chaque citation d'un instrument absent porte la mention, et le compte final couvre tous les documents |
| 2... | `mesure.md` nomme la commande, la date, les corpus et les comptes, sans extrapolation                 |
| 3... | `npm run typecheck`, `npm test` et `npm run build` passent                                            |
