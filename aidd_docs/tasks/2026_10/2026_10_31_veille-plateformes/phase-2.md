---
status: pending
---

# Instruction: Source Commission DMA

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   ├── themes.ts ✏
│   └── sources/
│       └── commission-dma.ts ✅
├── src/
│   └── lib/
│       └── sources.ts ✏
└── tests/
    ├── commission-dma.test.ts ✅
    ├── entries.test.ts ✏
    └── fixtures/
        └── commission-dma/
            └── rss.xml ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `tests/fixtures/commission-dma/rss.xml` | Trois items datés, dont un sans « DMA » dans le titre | cli |
| Happy path   | Parser la fixture | Trois entrées `commission-dma`, dates ISO, résumés nettoyés | cli |
| Happy path   | Rattacher l'item sans terme DMA | `plateformes` par défaut de source | cli |
| Edge case    | Remplacer un lien par `https://example.com/` | Le parseur refuse l'hôte | cli |
| Edge case    | Dupliquer un item et invalider le XML | Une seule entrée pour l'URL dupliquée ; XML invalide refusé | cli |

## Tasks to do

### `1)` Créer l'adaptateur DMA

> Le flux DMA est une source Commission à part entière, avec son hôte et ses règles.

1. Créer `veille/sources/commission-dma.ts` sur le modèle de `veille/sources/commission.ts`.
2. Exporter `SOURCE_ID = "commission-dma"` et `FEED_URL = "https://digital-markets-act.ec.europa.eu/node/2/rss_en?prefLang=fr"`.
3. Limiter les liens à `digital-markets-act.ec.europa.eu`, en `https` ; un lien hors hôte lève.
4. Parser `<rss><channel><item>` : titre et lien obligatoires, date via `toIsoUtc`, résumé via `toSummary`, identifiant via `hashId` et `canonicalUrl`.
5. Ne filtrer aucun item par type : décisions, communications, rapports, tables rondes et fiches sont retenus.
6. Dédupliquer par URL canonique et conserver `themes: []` ; le rattachement reste central.

### `2)` Brancher la source et son libellé

> La passe complète doit voir le nouvel adaptateur sans toucher aux autres.

1. Dans `veille/main.ts`, importer `FEED_URL` et `parseFeed` de `./sources/commission-dma.ts`, puis ajouter l'entrée `kind: "rss"`, `id: "commission-dma"` au registre `SOURCES`.
2. Dans `veille/themes.ts`, ajouter `"commission-dma": ["plateformes"]` à `SOURCE_DEFAULT_THEMES`.
3. Dans `src/lib/sources.ts`, ajouter `"commission-dma": "Commission européenne — DMA"`.

### `3)` Fixer le comportement par la fixture

> Un item sans sigle DMA reste dans la matière par défaut de sa source.

1. Créer `tests/fixtures/commission-dma/rss.xml` avec trois items : une sanction Google, une table ronde cloud, un atelier sans « DMA » dans le titre ni le résumé.
2. Créer `tests/commission-dma.test.ts` : trois entrées, source `commission-dma`, dates ISO, résumés sans balise.
3. Tester `assignThemes` : les trois entrées portent `plateformes`, y compris l'atelier par défaut de source.
4. Tester le refus d'un lien hors `digital-markets-act.ec.europa.eu`, le XML invalide et la déduplication d'un item répété.
5. Dans `tests/entries.test.ts`, ajouter `"commission-dma": "digital-markets-act.ec.europa.eu"` à la table des hôtes.

### `4)` Passer les portes

> L'adaptateur est terminé quand les tests et le typage passent.

1. Lancer `npm run typecheck`.
2. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le parseur rend trois entrées datées, sourcées `commission-dma`, dédupliquées, avec `themes` vide. |
| 2 | `SOURCES` contient `commission-dma` ; une entrée de cette source porte `plateformes` par défaut ; le badge affiche « Commission européenne — DMA ». |
| 3 | La fixture produit trois entrées ; un lien hors hôte et un XML invalide lèvent ; un item dupliqué ne crée pas de doublon. |
| 4 | Typecheck et tests passent. |
