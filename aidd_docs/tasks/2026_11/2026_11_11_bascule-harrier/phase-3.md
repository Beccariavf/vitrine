---
status: pending
---

# Instruction: Promesse constatée sur le `test` stocké

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/
└── mesures/
    ├── calibration.md                              (phase 2)
    └── test-harrier-promesse.md                    ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `mesures/calibration.md` | Le triplet figé est connu avant le test | cli |
| Happy path   | `node mcp/eval/risque.ts aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/test-harrier.json --seuils <triplet figé>` | Confiantes, erreurs, risque, borne 95 % et couverture sur le `test` | cli |
| Edge case    | Une commande `mcp:eval ... --split test` est envisagée | Elle n'est pas lancée : le tir est déjà dépensé et `test-harrier.json` suffit | cli |
| Teardown     | Aucun marqueur de consommation modifié | `mcp/eval/questions-cnil-etendu.test-consomme.json` reste intact | cli |

## Tasks to do

### `1)` Constater la promesse

> Le triplet de `dev` appliqué aux similarités du `test` déjà mesuré.

1. Lancer `node mcp/eval/risque.ts aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/test-harrier.json --seuils <bas,haut,marge>`.
2. Relever confiantes, erreurs, risque, borne haute 95 %, couverture, refusées et justes refusées.
3. Comparer à `dev` et dire si la borne `test` tient ou non.

### `2)` Publier

> Les chiffres que `promesse.md`, le README et la mémoire citeront.

1. Écrire `mesures/test-harrier-promesse.md` : triplet, chiffres `dev` et `test`, verdict, limites.
2. Garder les six pièges hors population en le disant.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La borne haute à 95 % et la couverture du `test` sont calculées avec le triplet figé en phase 2, sans nouveau tir. |
| 2 | `test-harrier-promesse.md` nomme le triplet, les confiantes, les erreurs, la borne et la couverture `test`, et le verdict. |
