---
status: pending
---

# Instruction: Outils et questions CNIL

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✏ tools.ts
│   ├── ✏ server.ts
│   └── ✅ eval/
│       ├── ✏ run.ts
│       └── ✅ questions-cnil.csv
├── ✅ tests/
│   ├── ✏ mcp.test.ts
│   └── ✏ eval.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_corpus-cnil/
                └── ✅ eval-cnil.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions-cnil.csv` | 20 lignes, 12 par document, 6 conceptuelles, 2 pièges | cli |
| Happy path   | `get_decision` par identifiant | Tous les fragments, dans l'ordre | cli |
| Happy path   | `get_decision` par numéro `SAN-2026-015` | Le bon document, quel que soit le corpus | cli |
| Happy path   | Question dont la référence est un document | Succès si un fragment de ce document est rendu | cli |
| Edge case    | Un numéro présent dans deux documents | Rendus tous les deux, avec leur identifiant | cli |
| Edge case    | Une question mélangeant CNIL et RGPD | Refusée avant mesure | cli |
| Teardown     | Chercher avec `corpus: "cnil"` | Aucun fragment RGPD ou AI Act | cli |

## Tasks to do

### `1)` Servir une décision entière

> L'équivalent de `get_article`, pour un texte long.

1. Ajouter `get_decision` dans `mcp/tools.ts` : par `document` (identifiant `CNILTEXT…`) ou par `numero` (`SAN-2026-015`), avec `corpus` optionnel.
2. Rendre les fragments dans l'ordre de `ref`, avec identifiant, numéro, date, statut et URL.
3. Rendre une réponse explicite quand la décision est absente, sans inventer de fragment.
4. Déclarer l'outil dans `mcp/server.ts`, avec une description qui dit ce qu'il ne fait pas.

### `2)` Accepter une référence au document

> Une question sur une sanction vise un texte, pas un fragment.

1. Dans `mcp/eval/run.ts`, accepter une `sources_attendues` sans `#` : le succès est alors « au moins un fragment de ce document dans le top 5 ».
2. Garder la comparaison exacte quand un `#` est présent.
3. Refuser une question dont les références appartiennent à deux corpus.

### `3)` Écrire vingt questions

> Contre le texte, pas contre les résultats.

1. Créer `mcp/eval/questions-cnil.csv` : `question,type,sources_attendues,piege,corpus`.
2. 12 questions visant un document précis, 6 conceptuelles, 2 pièges ; `corpus` = `cnil` sur toutes.
3. Choisir des sanctions réelles du corpus, en lisant le texte ; vérifier chaque identifiant dans `unites.jsonl`.
4. Ne pas réutiliser les questions RGPD, et ne pas sélectionner les documents en fonction des résultats.

### `4)` Mesurer et rapporter

> Un rapport séparé, sans seuil propre.

1. Construire l'index, lancer la mesure sur les 20 questions avec `corpus: cnil`.
2. Écrire `eval-cnil.md` : date, modèle, corpus, nombre de documents et fragments, top 5, top 1, MRR, pièges cités, `incertain`.
3. Dire explicitement que 20 questions ne classent pas le corpus et que les seuils sont ceux du produit, sans calibration propre.
4. Ne rien fusionner avec les rapports RGPD ou AI Act.

### `5)` Verrouiller par les tests

> L'outil et la mesure se testent hors ligne.

1. Tester `get_decision` par identifiant, par numéro, et l'absence.
2. Tester la réussite au niveau document et le refus d'un mélange de corpus.
3. Vérifier que 20 lignes et chaque référence existent.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `get_decision` rend les fragments ordonnés avec provenance, ou une absence explicite. |
| 2 | Une référence sans `#` réussit dès qu'un fragment du document est au top 5 ; une référence avec `#` reste exacte. |
| 3 | Le CSV porte 20 lignes, 12 documents, 6 conceptuelles, 2 pièges, et chaque référence existe. |
| 4 | `eval-cnil.md` porte les métriques, dit que 20 questions ne classent pas le corpus, et reste séparé. |
| 5 | Les tests couvrent l'outil et la mesure ; `npm test` et `npm run typecheck` passent. |
