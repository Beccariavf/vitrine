---
status: completed
---

# Instruction: Adaptateur CJUE

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   ├── normalize.ts ✏
│   ├── write.ts ✏
│   └── sources/
│       └── cjeu.ts ✅
├── tests/
│   ├── cjeu.test.ts ✅
│   ├── entries.test.ts ✏
│   ├── fixtures/
│   │   └── cjeu/
│   │       └── feed.xml ✅
│   └── write.test.ts ✏
└── aidd_docs/
    └── memory/
        ├── architecture.md ✏
        ├── data.md ✏
        └── ecosystem.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Charger `tests/fixtures/cjeu/feed.xml` | Le flux et ses items sont prêts | cli |
| Happy path   | Parser le flux | Jautiva avec titre, résumé, références, date, URL et source | cli |
| Edge case    | Parser un arrêt hors périmètre | Aucune entrée écrite | cli |
| Edge case    | Parser `_SUM` et `_RES` du même arrêt | Une seule entrée | cli |
| Edge case    | Parser un `_INF` | Ignoré | cli |
| Edge case    | Faire échouer le flux CJUE | Les entrées CNIL restent écrites, la passe échoue avec un message clair | cli |
| Teardown     | `npm run veille` réel | Jautiva dans `data/entries`, deux snapshots bruts, site construit | cli |

## Tasks to do

### `1)` Lire le flux de jurisprudence

> Le titre officiel porte tout : sujet, date, références et numéro d'affaire.

1. Créer `veille/sources/cjeu.ts` avec `FEED_URL`, `SOURCE_ID = "cjeu"` et `parseFeed(xml, tags)`.
2. Valider le XML, lire les `item`, retirer le préfixe `CELEX:...:` et refuser un item sans titre ou sans CELEX.
3. Parser les deux formats de titre : parties `#` et format `Affaire C-...: ... [sujet]` ; garder un fallback titre complet.
4. Extraire la date de décision française du titre, après normalisation des espaces insécables ; utiliser le `pubDate` en secours seulement.
5. Construire le titre lisible, le résumé depuis le sujet et les références via `extractReferences` sur le **titre officiel**, jamais sur le titre reconstruit.
6. Construire l'URL FR complète depuis le CELEX et hacher l'URL complète ou le CELEX ; ne pas passer par `canonicalUrl`, qui supprime la query.
7. Ignorer `_INF`, dédupliquer `_SUM`/`_RES` sur la base du CELEX et ne garder que les titres officiels qui correspondent à au moins un tag actif.
8. Tester le cas Jautiva, un arrêt hors périmètre, les doublons, `_INF`, un titre sans référence, les espaces insécables et un XML invalide.

### `2)` Orchestrer les deux sources

> CNIL et CJUE écrivent dans le même dépôt, mais une panne ne doit pas emporter l'autre.

1. Dans `veille/main.ts`, déclarer les deux sources et faire tourner `run` sur chacune.
2. Lire `veille/tags.json` depuis la racine, avec une option `tags` pour les tests, et le passer à l'adaptateur CJUE.
3. Écrire le snapshot brut avant le parse, puis les entrées de chaque source.
4. Ajouter `pruneSourceEntries` dans `veille/write.ts` : après une passe CJUE, retirer les entrées `cjeu` qui ne sont plus dans la sélection active ; ne jamais toucher aux entrées CNIL.
5. Rassembler les résultats par source ; en cas d'échec, conserver les écritures réussies et lever une erreur agrégée nommant la source.
6. Mettre à jour `tests/write.test.ts` : option `sources: [cnil]` pour les cas existants, puis un cas deux sources, un cas CJUE en panne et un cas de retrait d'un arrêt devenu inactif.
7. Garder le CLI lisible : une ligne par source, puis le total.

### `3)` Régénérer les données

> Les données publiées viennent du pipeline, jamais de la main.

1. Lancer `npm run veille` sur le vrai flux.
2. Vérifier Jautiva, ses références, sa date de décision et son URL ; vérifier que les entrées CNIL gardent `references: []`.
3. Vérifier les deux snapshots bruts et l'absence de doublon `_SUM`/`_RES`.
4. Mettre à jour `tests/entries.test.ts` pour accepter les URLs `cnil.fr` et `eur-lex.europa.eu`, et vérifier `references` sur les entrées CJUE.
5. Mettre à jour `data.md`, `architecture.md` et `ecosystem.md`.
6. Lancer `npm run typecheck`, `npm test` et `npm run build`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Jautiva est parsé avec ses références et sa date de décision ; un arrêt hors périmètre est rejeté ; `_SUM`/`_RES` ne font qu'une entrée ; `_INF` est ignoré ; deux arrêts ont deux identifiants distincts. |
| 2 | Une panne CJUE laisse les entrées CNIL et lève une erreur nommée ; une passe deux sources écrit les snapshots et les entrées des deux sources ; un arrêt devenu inactif est retiré sans toucher aux CNIL. |
| 3 | Jautiva est présent dans `data/entries` ; les entrées CNIL portent `references: []` ; `tests/entries.test.ts` accepte les deux sources ; typecheck, tests et build passent. |
