---
status: completed
---

# Instruction: Sources institutionnelles

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   └── sources/
│       ├── anssi.ts ✅
│       └── cepd.ts ✅
├── src/
│   └── lib/
│       └── sources.ts ✏
└── tests/
    ├── anssi.test.ts ✅
    ├── cepd.test.ts ✅
    └── fixtures/
        ├── anssi/
        │   └── actualite.xml ✅
        └── cepd/
            └── news.xml ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Charger une capture CERT-FR et une capture CEPD | Les flux et leurs items sont prêts | cli |
| Happy path   | Parser une actualité CERT-FR | Entrée `anssi`, date, résumé, URL officielle, matière cybersécurité | cli |
| Happy path   | Parser une actualité CEPD | Entrée `cepd`, date, résumé, URL officielle, matière données personnelles | cli |
| Edge case    | Parser un lien hors domaine | Erreur nommée, aucune entrée | cli |
| Edge case    | Parser un XML invalide | Erreur nommée, aucune entrée | cli |
| Teardown     | Lancer la passe avec les quatre sources | Chaque source écrit son snapshot et ses entrées | cli |

## Tasks to do

### `1)` Lire les actualités ANSSI

> Le flux « actualité » seul, pas les alertes ni les avis techniques.

1. Créer `veille/sources/anssi.ts` avec `FEED_URL`, `SOURCE_ID = "anssi"` et `parseFeed(xml)`.
2. Valider le XML, lire les items, exiger un titre et un lien https sur `cert.cyber.gouv.fr` ou `www.cert.ssi.gouv.fr`.
3. Utiliser le `pubDate` RFC 822, construire le résumé depuis la description, hacher l'URL canonique et rendre `references: []`.
4. Ne retenir que les actualités des 90 derniers jours et dédupliquer par identifiant.
5. Tester la capture réelle, un lien hors domaine, un XML invalide et une actualité ancienne.

### `2)` Lire les actualités CEPD

> Le CEPD apporte le niveau européen de la protection des données.

1. Créer `veille/sources/cepd.ts` avec `FEED_URL`, `SOURCE_ID = "cepd"` et `parseFeed(xml)`.
2. Valider le XML, lire les items, exiger un titre et un lien https sur `edpb.europa.eu`.
3. Nettoyer les descriptions HTML, convertir le `pubDate` en ISO UTC, hacher l'URL canonique et rendre `references: []`.
4. Tester une capture réelle, un lien hors domaine et un item sans date.

### `3)` Brancher les deux sources

> Chaque source garde son adaptateur et son snapshot.

1. Ajouter `anssi` et `cepd` à `SOURCES` dans `veille/main.ts`.
2. Ajouter leurs libellés dans `src/lib/sources.ts` et leurs matières par défaut dans `veille/themes.ts` : cybersécurité pour ANSSI, données personnelles pour CEPD.
3. Écrire les tests d'intégration : une panne ANSSI laisse CEPD écrire, et réciproquement ; les entrées portent la bonne matière.
4. Vérifier que le bloc matières et les badges affichent ANSSI et CEPD sans changement de mise en page.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une actualité CERT-FR est écrite avec sa date, son résumé, son URL et la matière cybersécurité ; un lien hors domaine lève ; une actualité de plus de 90 jours est ignorée. |
| 2 | Une actualité CEPD est écrite avec sa date, son résumé, son URL et la matière données personnelles ; un lien hors domaine lève. |
| 3 | Les deux sources écrivent leur snapshot et leurs entrées ; une panne de l'une n'empêche pas l'autre ; `npm run typecheck`, `npm test` et `npm run build` passent. |
