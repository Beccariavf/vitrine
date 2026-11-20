---
status: completed
---

# Instruction: Fondations : polices, jetons clair et sombre, contrastes

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
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Captures de `/`, `/connecteur`, `/veille` à 375 et 1 440 px avant tout changement | référence pour comparer chaque phase | browser |
| Happy path   | `npm test` | chaque nouvelle paire passe son seuil en clair et en sombre ; les anciennes paires passent toujours | cli |
| Happy path   | `npm run build` puis chargement d'une page | les `.woff2` Instrument Serif et Inter sont servis par le site, aucune URL externe (onglet réseau) ; rendu des pages inchangé | browser |
| Edge case    | Jeton sombre `--color-encre-douce` remplacé par une valeur trop sombre | le test échoue en nommant le thème, la paire et le ratio | cli |
| Edge case    | Jeton absent du bloc sombre | `jeton` lève en nommant le jeton et le thème | cli |

## Tasks to do

### `1)` Installer les polices

> Instrument Serif et Inter, auto-hébergées.

1. Ajouter `@fontsource/instrument-serif` et `@fontsource-variable/inter` épinglés à `5.3.0`.
2. Lire dans chaque paquet le fichier d'import (sous-ensemble latin) et le nom de famille CSS ; importer les deux dans le frontmatter de `Base.astro` à côté d'Archivo (retiré en phase 5).

### `2)` Ajouter les jetons clair

> Rôles de la planche, à côté des anciens.

1. Dans `@theme` : `--color-fond`, `--color-surface`, `--color-encre`, `--color-encre-douce`, `--color-filet`, `--color-accent`, `--color-sur-accent`, `--color-textes`, `--color-autorites`, `--color-ue`, `--color-juridictions`, valeurs de `planche.html`, sauf `juridictions` clair `#C2922B` (2,58:1 sur surface, calculé) remplacé par `#9C7419` (4,26:1 sur fond, 3,90:1 sur surface, calculé) ; `encre-douce` = encre à 64 % et `filet` = encre à 10 %, convertis en hex opaques sur `fond`.
2. `--font-serif` (Instrument Serif, repli Times New Roman, serif) et `--font-texte` (Inter, repli Helvetica Neue, Arial, sans-serif).
3. `--radius-carte: 2rem`, `--radius-bloc: 1.5rem`, `--shadow-douce` de la planche ; ne pas toucher aux rayons à 0 existants avant la phase 5.

### `3)` Ajouter les jetons sombres

> Le sombre suit le système, sans JavaScript.

1. `@media (prefers-color-scheme: dark) { :root { … } }` redéfinissant chaque nouveau jeton avec les valeurs sombres de la planche (`encre-douce` = encre sombre `#ECEEF2` à 66 %, `filet` = à 12 %, convertis en hex opaques sur fond sombre `#0C111A`), `color-scheme: dark`.

### `4)` Tester les contrastes des deux thèmes

> Toute paire nouvelle est verrouillée.

1. `tests/contrastes.ts` : `jeton(css, nom, theme = "clair")` lit `@theme` ou le bloc sombre ; message d'erreur avec le thème.
2. Paires texte 4,5:1 dans chaque thème : `encre` et `encre-douce` sur `fond` et `surface`, `sur-accent` sur `accent`, `accent` sur `fond`.
3. Paires non textuelles 3:1 (WCAG 1.4.11) dans chaque thème : chaque famille sur `fond` et `surface`.
4. Cas d'échec nommé (thème, paire, ratio) et jeton sombre absent.
5. Mettre à jour la ligne contrastes de `testing.md`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `npm run build` sert les deux polices depuis le site ; aucune requête vers un autre domaine |
| 2 | Les nouveaux jetons existent dans `@theme` ; les pages s'affichent comme avant |
| 3 | Système en sombre : les variables `--color-*` nouvelles prennent les valeurs sombres (outil de développement) |
| 4 | `npm test` vert ; une valeur sombre dégradée fait échouer le test en nommant thème, paire et ratio |
