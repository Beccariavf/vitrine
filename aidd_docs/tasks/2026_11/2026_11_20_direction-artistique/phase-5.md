---
status: completed
---

# Instruction: Retrait de l'ancien thème et mémoire design

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✏️ package.json
├── ✏️ package-lock.json
├── src/
│   ├── layouts/
│   │   └── ✏️ Base.astro
│   └── styles/
│       └── ✏️ global.css
├── tests/
│   ├── ✏️ contrastes.ts
│   └── ✏️ contrastes.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ design.md
        ├── ✏️ testing.md
        └── ✏️ codebase-map.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `grep` des anciens jetons (`concrete`, `paper`, `ink`, `red`, `blue`, `yellow`, `green`, `muted`, `stone`, `shadow-hard`, `font-display`, `font-mono` hors code) dans `src/` | liste des usages restants | cli |
| Happy path   | `npm run typecheck`, `npm test`, `npm run build` | tout passe | cli |
| Happy path   | Les trois pages à 375 et 1 440 px, clair et sombre | aucune trace de l'ancien thème (cadre 2 px, ombre dure, béton) | browser |
| Edge case    | Build après retrait d'Archivo | aucun `.woff2` Archivo dans `dist/` | cli |

## Tasks to do

### `1)` Retirer l'ancien thème

> Une seule palette dans le code.

1. Remplacer les derniers usages trouvés par le grep, puis retirer les anciens jetons, ombres dures, rayons forcés à 0 et `pleine-largeur` si plus utilisée.
2. Retirer `@fontsource-variable/archivo` et son import.
3. `tests/contrastes.ts` et son test : ne garder que les paires des nouveaux jetons.

### `2)` Mettre à jour la mémoire

> `design.md` décrit le site tel qu'il est.

1. Réécrire `design.md` (System, Tokens, Modules, Accessibility) depuis `decisions.md` et le code livré, contrastes mesurés des deux thèmes.
2. `testing.md` et `codebase-map.md` : jetons, polices et composants à jour.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le grep ne trouve plus aucun ancien jeton dans `src/` ; Archivo absent de `package.json` et de `dist/` ; `npm test` vert |
| 2 | `design.md` ne mentionne plus béton, loggia ni ombre dure ; chaque ratio cité correspond au test |
