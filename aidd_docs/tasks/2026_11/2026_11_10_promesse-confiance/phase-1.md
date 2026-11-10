---
status: completed
---

# Instruction: Mesurer le risque et la couverture des seuils actuels

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ mcp/eval/risque.ts
├── ✅ tests/risque.test.ts
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/risque-couverture.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Un `--json` de mesure existant, 54 questions sémantiques et 6 pièges | les pièges sont écartés du calcul | cli |
| Happy path   | `node mcp/eval/risque.ts <json>` | une table de couples (haut, marge) avec couverture, risque et borne | cli |
| Edge case    | Un couple qui ne laisse aucune question confiante | la couverture vaut 0 et le risque est déclaré non mesuré, sans erreur | cli |

## Tasks to do

### `1)` Écrire l'outil de risque

> Le harnais mesure le rappel ; il manque la qualité de la promesse.

1. Créer `mcp/eval/risque.ts` : lire un `--json` de `run.ts`, garder les questions sémantiques (ni piège, ni référence exacte), et calculer, pour chaque couple `haut × marge`, `haut` parcourant `0,30` à `0,95` par pas de `0,01` et `marge` prenant `0,01`, `0,02` et `0,05` ; le balayage se fait sans refus (`bas = 0`), puisque sous `haut` une question n'est de toute façon jamais `confiant` : la couverture et le risque de l'étiquette ne dépendent pas de `bas`, la couverture (part étiquetée `confiant`) et le risque (part dont la référence attendue n'est pas satisfaite au top 5, au sens de `refSatisfaite` : document entier pour la CNIL, `#art_N` pour le RGPD et l'AI Act).
2. Calculer la borne haute de Wilson du risque **sur le nombre de réponses étiquetées `confiant`**, jamais sur la taille du jeu, et l'afficher à côté du point d'estime.
3. Ajouter une courbe séparée du plancher `bas` : pour chaque valeur, combien de questions ne rendent rien, et combien d'entre elles satisfaisaient la référence attendue dans le top 5 brut.
4. `--seuils bas,haut,marge` affiche une seule ligne pour un triplet donné.

### `2)` Produire un JSON par jeu `dev`

> Un seul jeu ne dit pas si la promesse tient ailleurs.

1. Mesurer en `dev` les jeux RGPD (`questions-v2.csv --split dev`), AI Act, CNIL étendu, LIL, Conseil d'État, CEPD et doctrine, chacun en `--json`.
2. Conserver ces JSON sous `mesures/` dans le dossier de la tâche.
3. Ne jamais utiliser un split `test`.

### `3)` Rapporter l'état actuel

> Ce que le produit promet aujourd'hui, chiffré.

1. Appliquer l'outil aux seuils du produit (`0,69 / 0,74 / 0,01`) puis aux seuils calibrés de chaque jeu.
2. Écrire `mesures/risque-couverture.md` : par jeu, couverture, risque, borne, et la courbe du plancher.
3. Donner pour chaque jeu le nombre de confiantes réellement obtenu, puisque c'est lui qui dimensionne la borne.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `tests/risque.test.ts` prouve couverture, risque, borne calculée sur les confiantes, exclusion des pièges, effet de la marge, grille reproductible, cas sans question confiante et coût du plancher |
| 2 | sept JSON existent, chacun avec son `split` = `dev` |
| 3 | le rapport donne, par jeu, couverture, risque, borne et nombre de confiantes, plus la courbe du plancher |
