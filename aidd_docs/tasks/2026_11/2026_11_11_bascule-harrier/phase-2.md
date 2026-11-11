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
| Teardown     | Aucun test lu, aucune table du code modifiée | `mcp/confidence.ts` reste inchangé ; aucune ligne de `test-harrier.json` n'est lue | cli |

## Tasks to do

### `1)` Mesurer la grille du risque et le refus

> La même sortie que celle qui a produit la promesse du 2026-11-10.

1. `node mcp/eval/risque.ts aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-harrier-ollama.json > aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/risque-dev-harrier.txt`.
2. Fixer `bas` sur la courbe du refus : aucun refus ne doit porter sur une réponse confiante ni sur une bonne réponse tue.
3. Vérifier que le plancher retenu ne cite aucun piège supplémentaire.

### `2)` Appliquer la règle et figer la règle

> Le triplet est écrit avant toute lecture du `test`.

1. Appliquer dans l'ordre : couverture maximale sous borne ≤ 10 % ; sinon borne minimale à couverture ≥ 20/54 ; sinon borne minimale atteignable.
2. Écrire `mesures/calibration.md` : date, modèle, index, population, triplet figé, confiantes, erreurs, risque, borne, couverture, refus, et la phrase « règle figée avant lecture du test ».
3. Ne pas ouvrir `test-harrier.json` dans cette phase.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La grille et la courbe du refus sont produites hors ligne, sur les 54 questions sémantiques `dev`. |
| 2 | `calibration.md` porte un triplet unique, la règle appliquée, et la borne et la couverture `dev` ; le `test` n'a pas été lu. |
