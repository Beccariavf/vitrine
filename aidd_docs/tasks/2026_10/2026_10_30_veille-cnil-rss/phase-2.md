---
status: completed
---

# Instruction: Écrire et prouver une passe

## Architecture projection

```txt
.
├── veille/
│   ├── write.ts ✅
│   └── main.ts ✅
├── tests/
│   ├── write.test.ts ✅
│   └── fixtures/
│       └── cnil/
│           └── feed-reduced.xml ✅
└── aidd_docs/
    └── memory/
        └── coding-assertions.md ✏
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Fetch simulé sur la fixture, répertoire temporaire vide | Source et sortie prêtes | cli |
| Happy path | Exécuter une passe | Un snapshot brut et 10 fichiers d'entrée écrits | cli |
| Edge case | Exécuter une seconde passe sur le même flux | Fichiers identiques, aucun doublon | cli |
| Edge case | Rejouer une passe sur un flux réduit après la passe complète | Les entrées des autres actualités restent sur disque | cli |
| Edge case | Rejouer une passe avec une date de publication corrigée | Une seule copie de l'entrée, à son nouveau chemin | cli |
| Edge case | Parser un flux illisible | Le snapshot brut est conservé, aucune entrée écrite | cli |
| Edge case | Fetch en échec | Code de sortie non nul, aucun fichier écrit | cli |
| Teardown | Supprimer le répertoire temporaire | État initial restauré | cli |

## Tasks to do

### `1)` Écriture adressée par contenu

> Le snapshot et les entrées atterrissent à un chemin stable.

1. Créer `veille/write.ts` : `writeRaw` vers `data/raw/<2 hex>/<sha256>.xml`, `writeEntries` vers `data/entries/<yyyy>/<mm>/<id>.json`, `unknown/` si la date est nulle.
2. Créer les répertoires manquants, écrire en UTF-8, terminer par un saut de ligne.

### `2)` Passe complète

> Une commande fait tout, et échoue proprement.

1. Créer `veille/main.ts` : fetch, parse, write ; `fetch` injectable pour les tests.
2. Sortir avec un code non nul si le fetch ou le parse échoue : le snapshot brut précède le parse, aucune entrée n'est écrite après un parse en échec.

### `3)` Tests de persistance

> L'idempotence et l'absence d'écriture partielle sont prouvées.

1. Créer `tests/write.test.ts` : deux passes identiques, comparaison des fichiers, passe sur `feed-reduced.xml` après la passe complète, fetch en échec.

### `4)` Documentation

> La mémoire dit la vérité sur les commandes.

1. Dans `Before commit`, remplacer la ligne `1` par la commande `npm run typecheck`.
2. Dans `Before push`, remplacer la ligne `1` par la commande `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Un contenu de flux donné produit toujours le même chemin de snapshot |
| 2 | Une source indisponible ne produit aucun fichier ; un flux illisible conserve le snapshot brut et aucune entrée |
| 3 | Deux passes identiques produisent les mêmes fichiers ; une passe sur un flux réduit ne supprime aucune autre entrée |
| 4 | `Before commit` porte `npm run typecheck` et `Before push` porte `npm test` |
