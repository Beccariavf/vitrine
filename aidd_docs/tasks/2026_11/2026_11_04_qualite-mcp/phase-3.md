---
status: completed
---

# Instruction: Confiance calibrée

## Architecture projection

```txt
.
├── mcp/
│   ├── ✏ confidence.ts
│   └── eval/
│       └── ✏ run.ts
├── tests/
│   └── ✏ mcp.test.ts
└── aidd_docs/
    └── tasks/
        └── 2026_11/
            └── 2026_11_04_qualite-mcp/
                └── ✅ eval.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire les 35 questions de développement | Les seuils se calent sur elles seules | cli |
| Happy path   | Deux passages très proches, au-dessus du seuil haut | `incertain`, jamais `confiant` | cli |
| Happy path   | Premier passage nettement au-dessus du second | `confiant` | cli |
| Edge case    | Premier passage sous le seuil bas | `aucun_resultat_fiable`, aucun passage rendu | cli |
| Edge case    | Une question piège reçoit `confiant` sur le développement | La calibration échoue et nomme la question | cli |
| Teardown     | Mesurer sur les 15 questions tenues à l'écart | Aucun seuil ne change | cli |

## Tasks to do

### `1)` Exiger une marge

> Une proximité ne suffit pas ; il faut un écart.

1. Remplacer `MARGE = 0` par une marge non nulle dans `mcp/confidence.ts`.
2. Calibrer `SEUIL_BAS`, `SEUIL_HAUT` et `MARGE` sur les 35 questions `dev` uniquement.
3. Vérifier que `incertain` apparaît réellement sur le développement, et noter son taux.
4. Vérifier qu'aucune question piège n'est marquée `confiant` sur le développement.

### `2)` Mesurer l'effet sur le test

> Le test ne sert qu'à constater.

1. Rejouer `npm run mcp:eval -- --split test` avec les seuils figés.
2. Rapporter le taux d'`incertain`, les pièges cités et les pièges refusés.
3. Si un piège est marqué `confiant` sur `test`, corriger les seuils **sur `dev`** et rejouer, sans toucher aux questions `test`.
4. Noter les valeurs finales et leur fragilité dans `eval.md`.

### `3)` Clarifier le libellé

> « Confiant » ne veut pas dire « correct ».

1. Documenter dans `confidence.ts` et dans `eval.md` que le niveau porte sur la similarité du premier passage.
2. Indiquer que la marge sépare le premier du second, pas le vrai du faux.
3. Nommer la limite : une réponse `confiante` peut rester le mauvais article.

### `4)` Verrouiller par les tests

> Les cas limites se testent sans modèle.

1. Tester la frontière de la marge : à marge égale, `incertain` ; au-delà, `confiant`.
2. Tester le seuil bas et l'absence de résultat.
3. Tester qu'un piège calibré lève.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les seuils viennent des 35 questions `dev` ; `incertain` apparaît sur le développement, et aucun piège n'y est `confiant`. |
| 2 | Le rapport `test` donne le taux d'`incertain` et les pièges cités, avec les seuils figés avant la mesure. |
| 3 | `confidence.ts` et `eval.md` disent explicitement que `confiant` porte sur la similarité, pas sur la correction. |
| 4 | Les tests couvrent la marge, le seuil bas et le garde de calibration ; `npm test` et `npm run typecheck` passent. |
