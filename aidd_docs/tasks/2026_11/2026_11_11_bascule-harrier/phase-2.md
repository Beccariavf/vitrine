---
status: completed
---

# Instruction: Calibration sur `dev` et plancher de refus

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/
└── mesures/
    ├── dev-harrier-ollama.json                     (phase 1)
    ├── risque-dev-harrier.txt                      ✅
    └── calibration.md                              ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-harrier-ollama.json` | 54 questions sémantiques, 6 pièges écartés | cli |
| Happy path   | `node mcp/eval/risque.ts aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-harrier-ollama.json` | Grille `haut × marge` et courbe du refus dans la même sortie | cli |
| Happy path   | Appliquer la règle de `promesse.md` §1 | Triplet retenu, nombre de confiantes, erreurs, borne et couverture écrits | cli |
| Edge case    | Plusieurs couples à borne égale | Le plus exigeant à résultat égal est retenu, comme `haut = 0,67` en 2026-11-10 | cli |
| Teardown     | Aucun test lu dans cette phase, aucune table du code modifiée | `mcp/confidence.ts` reste inchangé ; `calibration.md` dit que `confirmation.md` avait pré-publié le triplet | cli |

## Tasks to do

### `1)` Mesurer la grille du risque et le refus

> La même sortie que celle qui a produit la promesse du 2026-11-10.

1. `node mcp/eval/risque.ts aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-harrier-ollama.json > aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/risque-dev-harrier.txt`.
2. Fixer `bas` sur la courbe du refus : aucun refus ne doit porter sur une réponse confiante ni sur une bonne réponse tue.
3. Vérifier que le plancher retenu ne cite aucun piège supplémentaire.

### `2)` Appliquer la règle et écrire le triplet

> Le triplet est écrit avant de rouvrir le test ; sa pré-publication est dite.

1. Appliquer dans l'ordre : couverture maximale sous borne ≤ 10 % ; sinon borne minimale à couverture ≥ 20/54 ; sinon borne minimale atteignable.
2. Écrire `mesures/calibration.md` : date, modèle, index, population, triplet retenu, confiantes, erreurs, risque, borne, couverture, refus, et la pré-publication du triplet dans `confirmation.md` (2026-11-10).
3. Ne pas ouvrir `test-harrier.json` dans cette phase ; `calibration.md` date la pré-publication de `confirmation.md` (2026-11-10) et montre que le résultat est stable sur tout le plateau `dev`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La grille et la courbe du refus sont produites hors ligne, sur les 54 questions sémantiques `dev`. |
| 2 | `calibration.md` porte un triplet unique, la règle appliquée, la borne et la couverture `dev`, et dit que le test avait été pré-publié ; il n'a pas servi à choisir le triplet. |
