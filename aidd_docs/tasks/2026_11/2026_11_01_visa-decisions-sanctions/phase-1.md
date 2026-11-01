---
status: completed
---

# Instruction: Extraction du visa

## Architecture projection

```txt
.
├── ✏️ veille/references.ts
└── ✏️ tests/references.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Charger le visa réel de la décision 25-10.664 | Les chaînes sont prêtes | cli |
| Happy path   | Extraire les références du visa | `Règlement (UE) 2016/679 · art. 4, 5, 6` | cli |
| Edge case    | Fournir un visa sans article, un code de justice administrative ou un code non suivi | Aucune référence inventée | cli |

## Tasks to do

### `1)` Nettoyer le texte d'un visa

> Retirer le HTML et les paragraphes pour laisser une liste d'articles lisible.

1. Ajouter `cleanVisaItem` dans `veille/references.ts` : `toPlainText`, suppression de `§ N`, virgules doubles et virgule avant l'instrument.
2. Garder la fonction interne, testée via `extractVisaReferences`.

### `2)` Extraire les références

> Combiner les instruments français nommés et les actes européens génériques.

1. Ajouter `extractVisaReferences(items)` qui nettoie chaque visa, applique `extractCnilReferences` et `extractReferences`, puis fusionne par instrument.
2. Documenter que seuls les instruments suivis et les visas avec article sont rendus : LIL, CPCE, ePrivacy, Code de la consommation, RGPD, AI Act, DSA, DMA, DORA, NIS2, CRA et Data Act.

### `3)` Verrouiller les cas

> Des tests hors ligne, sans réseau.

1. Ajouter le visa réel de 25-10.664 : code du travail ignoré, RGPD articles 4, 5, 6.
2. Ajouter LIL, CPCE, directive, AI Act, DMA, DSA, DORA, NIS2, doublon, visa sans article, `code de justice administrative` et balises HTML.
3. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Un visa avec `§ 1` et des balises rend une liste d'articles sans bruit. |
| 2 | Le visa 25-10.664 rend `Règlement (UE) 2016/679 · art. 4, 5, 6`, ignore le code du travail et reconnaît l'AI Act, le DMA, le DSA, DORA et NIS2. |
| 3 | Les tests de `tests/references.test.ts` passent hors ligne, y compris l'exclusion du code de justice administrative. |
