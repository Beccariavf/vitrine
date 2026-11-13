---
status: pending
---

# Instruction: Exposer les citations dans search et get_decision

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp/
│   ├── server.ts ✏️
│   └── tools.ts ✏️
└── tests/
    ├── mcp.test.ts ✏️
    └── server-stdio.test.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Écrire un corpus CNIL temporaire avec le helper `fragment()` (nature `Sanction`) dont un fragment porte `l'article 6 du règlement (UE) 2016/679 et l'article 82 de la loi n° 78-17`. | Le document est lisible par `getDecision` : `estSanction(nature)` le retient. | cli |
| Happy path   | Appeler `getDecision` sur ce document. | La décision porte `citations` : `RGPD · art. 6` et `loi 78-17 · art. 82`, chacune avec son URL. | cli |
| Happy path   | Chercher par le sens sur ce corpus CNIL et rendre le fragment. | Le passage porte les mêmes `citations`, y compris quand le fragment rendu ne nomme pas lui-même les articles. | cli |
| Edge case    | Chercher un article du RGPD. | Le passage RGPD ne porte pas de `citations` : le corpus n'est pas une décision. | cli |
| Edge case    | Lire une décision sans citation reconnue. | `citations` vaut `[]`, jamais une citation inventée. | cli |
| Teardown     | Supprimer la racine temporaire. | Aucun fichier résiduel. | cli |

## Tasks to do

### `1)` Brancher l'extraction sur le corpus

> Un seul chemin de lecture, réutilisable par #29.

1. Ajouter dans `mcp/corpus/citations.ts` `citationsDesUnites(unites)` et `citationsDuCorpus(rootDir, corpus)` avec un cache par chemin de fichier et date de modification, qui ne garde que les citations par document, jamais le texte.
2. Ne charger que les corpus de décisions (`cnil`, `ce`, `cc`, `cjue`, `cepd`) ; rendre une carte vide pour les autres.

### `2)` Enrichir get_decision

1. Ajouter `citations: Citation[]` à `DecisionTrouvee` dans `mcp/tools.ts`.
2. Extraire sur les fragments déjà lus, sans relire le fichier.
3. Rendre `[]` quand aucune citation n'est reconnue.

### `3)` Enrichir search

1. Ajouter `citations?: Citation[]` à `Passage`.
2. Après le classement, regrouper les passages par corpus et document, lire chaque corpus une fois, recopier les citations du document sur ses passages.
3. Laisser le champ absent hors des cinq corpus de décisions.

### `4)` Décrire le comportement dans le serveur

1. `mcp/server.ts` : ajouter une consigne `CONSIGNE_CITATIONS` aux descriptions de `search` et `get_decision`, sans modifier `CONSIGNE_PROVENANCE` partagée avec `get_article`.
2. Nommer les citations et le lien officiel, et rappeler qu'une liste vide dit l'absence de citation reconnue, jamais l'absence de base juridique.
3. Relire `tests/server-stdio.test.ts` et ajuster l'assertion de description si le texte ajouté la casse ; ne pas changer les schémas d'entrée.

### `5)` Écrire les tests d'intégration

1. Étendre `tests/mcp.test.ts` avec les cas du Test Scope, en réutilisant `ecrireCorpus` et l'embedder factice.
2. Vérifier la forme exacte d'une citation (`reference`, `url`) et l'absence de `citations` sur un passage RGPD.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Deux appels successifs sur le même corpus ne relisent pas le fichier ; modifier le fichier change le résultat au appel suivant. |
| 2 | Une décision CNIL citant le RGPD et la LIL rend deux citations ordonnées avec leurs URL ; une décision sans citation rend `[]`. |
| 3 | Un passage CNIL porte les citations du document ; un passage RGPD n'a pas le champ. |
| 4 | `tools/list` expose les mêmes schémas d'entrée et des descriptions qui nomment « citations » ; `tests/server-stdio.test.ts` passe. |
| 5 | `npm test` et `npm run typecheck` passent. |
