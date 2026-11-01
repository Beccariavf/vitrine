---
status: completed
---

# Instruction: Journal quotidien

## Architecture projection

```txt
.
├── ✏️ veille/piste.ts
└── ✏️ tests/piste.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Journaliser une passe de deux appels | `data/usage/<date>.json` porte deux appels | cli |
| Happy path   | Journaliser une seconde passe le même jour | Le fichier porte les deux passes | cli |
| Edge case    | Journaliser dans un fichier absent ou illisible | Un fichier neuf, sans erreur | cli |

## Tasks to do

### `1)` Fusionner au lieu d'écraser

> Le journal du jour garde toutes les passes.

1. Dans `flushUsage`, lire le fichier du jour s'il existe et concaténer ses `calls` avec ceux de la passe.
2. Écrire l'ensemble, puis vider le journal mémoire.
3. Un fichier absent ou invalide repart de zéro, sans lever.

### `2)` Verrouiller

1. Tester deux `flushUsage` successifs : le fichier porte les quatre appels, dans l'ordre.
2. Tester un fichier invalide : la passe écrit ses seuls appels.
3. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Deux passes du même jour laissent leurs appels dans le même fichier. |
| 2 | Un fichier corrompu n'empêche pas d'écrire le nouveau journal. |
