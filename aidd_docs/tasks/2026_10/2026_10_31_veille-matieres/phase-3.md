---
status: completed
---

# Instruction: Sources sectorielles

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   └── sources/
│       ├── arcep.ts ✅
│       └── commission.ts ✅
├── src/
│   └── lib/
│       └── sources.ts ✏
└── tests/
    ├── arcep.test.ts ✅
    ├── commission.test.ts ✅
    └── fixtures/
        ├── arcep/
        │   └── avis.xml ✅
        └── commission/
            └── rss.xml ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Charger une capture ARCEP et une capture Commission | Les flux et leurs items sont prêts | cli |
| Happy path   | Parser une décision ARCEP sur les données | Entrée `arcep`, identifiant stable, matière données non personnelles ou personnelles | cli |
| Happy path   | Parser une actualité Commission sur l'AI Act | Entrée `commission`, matière IA | cli |
| Edge case    | Parser un event ou une consultation Commission | Item ignoré | cli |
| Edge case    | Deux décisions ARCEP de même titre | Deux identifiants distincts grâce au guid ou à la query | cli |
| Teardown     | Lancer la passe avec les six sources | Chaque source écrit son snapshot, aucune entrée sans matière | cli |

## Tasks to do

### `1)` Lire les décisions ARCEP

> Le flux est large et la query porte l'identité : ne jamais hacher l'URL canonique sans query.

1. Créer `veille/sources/arcep.ts` avec `FEED_URL`, `SOURCE_ID = "arcep"` et `parseFeed(xml)`.
2. Valider le XML, lire les items, exiger un titre et un lien https sur `arcep.fr` ; nettoyer les espaces de tête et les entités.
3. Construire l'identifiant sur le `guid` ou l'URL complète, jamais sur l'URL canonique sans query ; conserver l'URL complète.
4. Nettoyer la description, convertir le `pubDate` avec offset, rendre `references: []`.
5. Tester deux items de même titre, un item sans guid, un lien hors domaine.

### `2)` Lire les actualités de la Commission

> Le flux mélange actualités, événements et consultations : seules les actualités intéressent la veille.

1. Créer `veille/sources/commission.ts` avec `FEED_URL`, `SOURCE_ID = "commission"` et `parseFeed(xml)`.
2. Valider le XML, lire les items, exiger un titre et un lien https sur `digital-strategy.ec.europa.eu`.
3. Ignorer les liens d'événement et de consultation ; ne garder que les actualités.
4. Nettoyer la description, convertir le `pubDate`, hacher l'URL canonique, rendre `references: []`.
5. Tester une actualité AI Act, un événement ignoré, une consultation ignorée et un lien hors domaine.

### `3)` Brancher les deux sources

> ARCEP et Commission ne publient que ce qui correspond à une matière.

1. Ajouter `arcep` et `commission` à `SOURCES` dans `veille/main.ts`.
2. Ajouter leurs libellés dans `src/lib/sources.ts` ; ne pas leur donner de matière par défaut.
3. Vérifier le rattachement : ARCEP peut relever des données personnelles (ePrivacy) ou non personnelles (Data Act) ; Commission peut relever de l'IA ou des données non personnelles.
4. Écrire les tests d'intégration : une source sans correspondance n'écrit aucune entrée mais garde son snapshot ; une panne n'emporte pas les autres.
5. Vérifier le rendu du bloc matières avec six sources.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Deux décisions ARCEP ont deux identifiants distincts ; l'URL complète est conservée ; un lien hors domaine lève ; le résumé est nettoyé. |
| 2 | Une actualité AI Act de la Commission est écrite avec la matière IA ; un événement et une consultation sont ignorés ; un lien hors domaine lève. |
| 3 | ARCEP et Commission n'écrivent que les entrées rattachées à une matière ; leur snapshot reste écrit sans correspondance ; `npm run typecheck`, `npm test` et `npm run build` passent. |
