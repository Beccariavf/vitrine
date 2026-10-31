---
status: completed
---

# Instruction: Jurisprudence PISTE

## Architecture projection

```txt
.
├── veille/
│   ├── main.ts ✏
│   ├── piste.ts ✅
│   ├── write.ts ✏
│   └── sources/
│       ├── cetat.ts ✅
│       └── judilibre.ts ✅
├── src/
│   └── lib/
│       └── sources.ts ✏
├── tests/
│   ├── piste.test.ts ✅
│   ├── cetat.test.ts ✅
│   ├── judilibre.test.ts ✅
│   └── fixtures/
│       ├── cetat/
│       │   └── search.json ✅
│       └── judilibre/
│           └── search.json ✅
├── .env.example ✅
└── package.json ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Charger les captures CETAT et Judilibre, injecter un `fetch` | Les réponses et les secrets sont prêts | cli |
| Happy path   | Parser une décision CETAT citant le RGPD | Entrée `cetat`, date, résumé, URL Légifrance, matière données personnelles | cli |
| Happy path   | Parser une décision Judilibre citant le RGPD | Entrée `judilibre`, date, résumé, URL Cour de cassation, matière données personnelles | cli |
| Edge case    | Aucun secret PISTE | Avertissement nommé, sources PISTE ignorées, les autres sources écrivent | cli |
| Edge case    | Jeton expiré pendant la passe | Jeton redemandé une fois, puis erreur claire | cli |
| Edge case    | Deux décisions de même identifiant sur deux matières | Une seule entrée, deux matières | cli |
| Teardown     | `npm test` | Aucun appel réseau, les quotas sont journalisés | cli |

## Tasks to do

### `1)` Poser le client PISTE

> Un seul jeton par passe, un compteur d'appels, aucun secret dans le dépôt.

1. Créer `veille/piste.ts` : lire `PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`, `PISTE_KEY_ID` depuis l'environnement, demander un jeton OAuth et le garder jusqu'à expiration.
2. Ajouter les appels POST Légifrance et GET Judilibre avec un `fetch` injectable, un délai borné et un message d'erreur qui nomme la source et le statut.
3. Journaliser chaque appel dans `data/usage/<date>.json` : source, endpoint, statut, durée, compteur ; plafonner les appels par passe.
4. Créer `.env.example` avec les trois variables, sans valeur réelle ; vérifier que `.env` reste ignoré.
5. Tester le jeton, le cache, l'expiration, le 401, le 429 et l'absence de secret.

### `2)` Lire la jurisprudence du Conseil d'État

> Une recherche par matière, triée par date, sans consultation inutile.

1. Créer `veille/sources/cetat.ts` avec `SOURCE_ID = "cetat"` et `fetchEntries(ctx)`.
2. Pour chaque matière active, interroger le fonds CETAT avec ses termes principaux, trier par date décroissante et prendre les 20 premiers.
3. Construire l'entrée : titre officiel, date `JJ/MM/AAAA` du titre, résumé `resumePrincipal`, URL `legifrance.gouv.fr/ceta/id/<id>`, références extraites du résumé, indice de matière.
4. Dédupliquer par identifiant ; écrire chaque réponse brute en JSON ; ignorer une décision sans titre ou sans identifiant.
5. Tester une capture réelle, une date illisible, un doublon sur deux matières et une réponse vide.

### `3)` Lire la jurisprudence de la Cour de cassation

> La publication décale les décisions : chercher sur 30 jours, pas sur 7.

1. Créer `veille/sources/judilibre.ts` avec `SOURCE_ID = "judilibre"` et `fetchEntries(ctx)`.
2. Pour chaque matière active, interroger Judilibre avec les termes de la matière, `date_start` à J-30, `date_end` à J, tri date décroissante, 50 résultats maximum.
3. Construire l'entrée : titre `Cour de cassation, <chambre>, <date>, <numéro>`, résumé officiel, URL `courdecassation.fr/decision/<id>`, références extraites du résumé, indice de matière.
4. Dédupliquer par identifiant, paginer si nécessaire, écrire chaque réponse brute en JSON.
5. Tester une capture réelle, la fenêtre de 30 jours, un doublon sur deux matières, une chambre inconnue et une réponse vide.

### `4)` Brancher les sources API

> Le registre de sources accepte deux familles sans casser les flux existants.

1. Étendre le type `Source` de `veille/main.ts` avec une variante API : `fetchEntries(ctx)` rend des entrées et des réponses brutes.
2. Faire écrire chaque réponse brute par `writeRaw(..., "json")` et ajouter `rawPaths` au résultat par source, sans perdre `rawPath` pour les flux.
3. Ajouter `cetat` et `judilibre` à `SOURCES` ; si les secrets manquent, ajouter un avertissement et ignorer les deux sources, sans faire échouer les autres.
4. Ajouter les libellés `Conseil d'État` et `Cour de cassation` dans `src/lib/sources.ts`.
5. Mettre à jour les tests d'intégration : une panne PISTE laisse les flux RSS écrire ; deux matières sur une décision ne créent qu'une entrée.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un jeton est demandé une fois et réutilisé ; un 401 le redemande une fois ; l'absence de secret produit un avertissement ; chaque appel est journalisé ; aucun secret n'est versionné. |
| 2 | Une décision CETAT citant le RGPD est écrite avec sa date, son résumé, son URL et la matière ; une décision sans identifiant est ignorée ; un doublon ne crée qu'une entrée. |
| 3 | Une décision Judilibre citant le RGPD est écrite avec sa date, son résumé, son URL et la matière ; la fenêtre couvre 30 jours ; un doublon ne crée qu'une entrée. |
| 4 | Les sources API écrivent leurs snapshots JSON ; une panne ou une absence de secret n'empêche pas les sources RSS d'écrire ; `npm run typecheck`, `npm test` et `npm run build` passent. |
