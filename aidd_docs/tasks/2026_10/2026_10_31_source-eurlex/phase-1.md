---
status: completed
---

# Instruction: Contrat `references`

## Architecture projection

```txt
.
├── veille/
│   ├── types.ts ✏
│   ├── references.ts ✅
│   └── sources/
│       └── cnil.ts ✏
├── src/
│   └── lib/
│       └── entries.ts ✏
└── tests/
    ├── references.test.ts ✅
    ├── cnil.test.ts ✏
    ├── entries.test.ts ✏
    └── write.test.ts ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Lire `veille/types.ts` et `src/lib/entries.ts` | Le contrat et le lecteur sont prêts | cli |
| Happy path   | Extraire les références du titre Jautiva | Règlement 2016/679 articles 5 et 6 ; directive 2017/1132 article 14 | cli |
| Happy path   | `npm run veille` | Chaque entrée CNIL porte `references: []` | cli |
| Edge case    | Lire une entrée sans `references` | Le lecteur lève une erreur nommée | cli |
| Edge case    | Extraire un titre sans instrument | `references` vaut `[]` | cli |
| Teardown     | `npm run build` | Le site rend les entrées régénérées | cli |

## Tasks to do

### `1)` Étendre le contrat

> Les références deviennent une donnée de première classe, sans casser les entrées CNIL.

1. Ajouter `references: string[]` au type `Entry` et ajuster les commentaires `id`/`url` : l'identité peut être portée par la query quand la source l'exige (CELEX EUR-Lex).
2. Dans l'adaptateur CNIL, écrire `references: []` pour chaque actualité.
3. Dans le lecteur `src/lib/entries.ts`, ajouter le champ aux champs obligatoires et vérifier un tableau de chaînes non vides.
4. Mettre à jour les fixtures et littéraux de `tests/cnil.test.ts`, `tests/entries.test.ts` et `tests/write.test.ts`.
5. Vérifier qu'une entrée sans `references` ou avec un champ non-tableau lève une erreur claire.

### `2)` Extraire les références

> Le titre officiel dit les instruments et les articles ; on les structure, on ne les invente pas.

1. Créer `veille/references.ts` avec `extractReferences(title: string): string[]`.
2. Repérer les instruments : règlement, directive, décision, avec leur numéro et leur année.
3. Rattacher les articles à l'instrument qui les précède ; grouper les listes et les plages.
4. Produire des libellés lisibles, par exemple `Règlement (UE) 2016/679 · art. 5, 6`.
5. Rendre `[]` quand aucun instrument n'est reconnu ; ne jamais inventer.
6. Normaliser les espaces insécables (`\u00a0`) et les espaces multiples avant les regex.
7. Tester le format Jautiva, le format `#`, un titre sans référence, un titre à plusieurs instruments et un titre avec espaces insécables.

### `3)` Régénérer les données

> Le contrat change, la sortie aussi.

1. Lancer `npm run veille` pour réécrire les entrées CNIL avec `references: []`.
2. Vérifier que le snapshot brut et les entrées restent cohérents.
3. Lancer `npm run typecheck`, `npm test` et `npm run build`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `Entry` porte `references` ; les entrées CNIL portent `[]` ; le lecteur refuse un champ absent ou non-tableau. |
| 2 | Le titre Jautiva rend les deux références attendues ; un titre sans instrument rend `[]` ; rien n'est inventé. |
| 3 | Les données régénérées portent toutes `references` ; typecheck, tests et build passent. |
