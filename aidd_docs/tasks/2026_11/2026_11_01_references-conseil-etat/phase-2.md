---
status: pending
---

# Instruction: Lecture du texte et enrichissement

## Architecture projection

```txt
.
├── ✏️ veille/piste.ts
├── ✏️ veille/themes.ts
├── ✏️ veille/sources/judilibre.ts
├── ✏️ veille/sources/cetat.ts
├── ✏️ tests/piste.test.ts
├── ✏️ tests/cetat.test.ts
└── ✅ tests/fixtures/cetat/consult.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Secrets PISTE simulés et journal remis à zéro | La session est prête | cli |
| Happy path   | Rechercher puis enrichir une décision CETAT | L'entrée porte les articles et la réponse est snapshotée | cli |
| Edge case    | Plafond atteint, instrument hors matières ou texte vide | Aucun appel inutile, références vides, entrée différée si le texte n'est pas lu | cli |
| Teardown     | Restaurer l'environnement et vider le journal | État initial | cli |

## Tasks to do

### `1)` Lire le texte d'une décision

> Un seul appel par décision, sous la garde existante.

1. Ajouter `consultJuri(fetchImpl, id)` à `PisteSession` : `POST /consult/juri`, `{ textId: id }`, jeton Bearer, journal `legifrance` / `consult`.
2. Vérifier le plafond et le renouvellement du jeton comme pour `legifrance`.
3. Tester l'URL, l'en-tête, le journal et le plafond.

### `2)` Partager le filtrage par matière

> Judilibre et CETAT doivent utiliser la même règle.

1. Déplacer `followedInstruments` de `veille/sources/judilibre.ts` vers `veille/themes.ts`, exporté.
2. Faire importer Judilibre depuis `themes.ts` ; les tests Judilibre restent verts.

### `3)` Brancher le Conseil d'État

> La recherche ne porte pas le texte ; les références se lisent après le rattachement.

1. Dans `toEntry`, rendre `references: []` et retirer l'extraction depuis le titre et le résumé.
2. Retourner un `enrich` qui rend `null` quand le budget restant est réservé aux recherches Judilibre ou nul (avertissement), sinon appelle `consultJuri`, pousse la réponse dans `raw`, lit `response.text.texte`, applique `extractCetatReferences`, puis filtre sur `followedInstruments(entry, themes)`.
3. Ajouter `JUDILIBRE_SEARCH_RESERVE = 6` dans `cetat.ts` : CETAT passe avant Judilibre dans la passe et ne doit pas consommer les six recherches qui suivent. Un commentaire nomme la raison.
4. Laisser `main.ts` différer l'entrée sur `null` et sur une exception ; ne pas le modifier.

### `4)` Verrouiller les tests

> Le fixture de consultation et les cas de panne.

1. Ajouter `tests/fixtures/cetat/consult.json` avec une réponse réelle de `/consult/juri`.
2. Adapter `tests/cetat.test.ts` : enrichissement, filtrage hors matières, texte vide, plafond atteint ou réservé, absence de secrets.
3. Lancer `npm test` et vérifier que les tests CNIL, CJUE, DMA, ARCOM, Judilibre et PISTE restent verts.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Un appel `/consult/juri` porte le jeton, le `textId` et apparaît au journal comme `consult`. |
| 2 | Judilibre et CETAT filtrent les instruments avec la même fonction, et les tests Judilibre passent. |
| 3 | Une décision CETAT enrichie expose ses articles ; un texte sans formule laisse `[]` ; un budget réservé aux recherches Judilibre ou épuisé rend `null` et avertit, sans consommer leur part. |
| 4 | Les tests PISTE et CETAT passent hors ligne, sans appel réseau ; les autres sources restent vertes. |
