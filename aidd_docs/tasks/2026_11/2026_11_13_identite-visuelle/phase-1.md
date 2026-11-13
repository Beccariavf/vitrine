---
status: completed
---

# Instruction: Fondations : palette, police, marque, contrastes testés

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
│   └── ✅ contrastes.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ design.md
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Avant tout changement : captures de `/`, `/connecteur`, `/veille` à 375 et 1 280 px | référence pour mesurer le reflux des titres et le premier écran de la veille | browser |
| Happy path   | `npm test` | `tests/contrastes.test.ts` lit les jetons de `global.css` ; chaque paire autorisée passe son seuil, chaque paire interdite est sous le sien | cli |
| Happy path   | `npm run build` puis chargement d'une page | aucune URL externe ; un seul `.woff2` Archivo chargé (sous-ensemble latin, onglet réseau) ; titres et marque en Archivo condensée | browser |
| Edge case    | Vert remplacé par `#3a7d44` | le test échoue en nommant la paire et le ratio | cli |
| Edge case    | Police non chargée | repli Helvetica Neue puis sans système (`font-display: swap`) | browser |
| Edge case    | Mots longs à 375 px (« personnelles », « jurisprudence ») | aucun débordement du `h1` | browser |

## Tasks to do

### `1)` Étendre la palette

> Ajouter le vert, le socle sombre et son texte secondaire.

1. Dans `@theme` de `src/styles/global.css` : `--color-green: #2f6b4f`, `--color-concrete-dark: #2b2a27`, `--color-stone: #b8b2a7` ; mettre à jour le commentaire d'en-tête.

### `2)` Installer la police de titre

> Échelle monumentale, aucune requête tierce.

1. Ajouter `@fontsource-variable/archivo` épinglé à `5.3.0`.
2. Importer `@fontsource-variable/archivo/wdth.css` dans le frontmatter de `src/layouts/Base.astro`.
3. Lire dans `wdth.css` le nom de famille et vérifier l'axe `wght` ; à défaut importer aussi l'index.
4. `--font-display: "<famille lue>", "Helvetica Neue", Helvetica, Arial, sans-serif` ; `h1` condensé (`font-stretch` ~72 %), graisse ~850, interlettrage serré, taille plafonnée en mobile ; `h2`/`h3` en largeur moyenne.

### `3)` Monter la marque en gamme

> Que l'en-tête parle comme le reste du site.

1. Dans `Base.astro`, le wordmark `VITRINE_` en mono devient « VITRINE » en `font-display` condensée ; le nom reste provisoire.

### `4)` Verrouiller les contrastes

> Qu'aucune couleur ne passe sous AA sans casser la suite.

1. Écrire `tests/contrastes.test.ts` : lit les hex de `global.css`, calcule le ratio WCAG 2.x.
2. Paires autorisées 4,5:1 : encre et gris sur béton et papier ; papier sur bleu, vert, rouge ; encre sur jaune ; papier, jaune et pierre sur béton sombre. 3:1 : rouge sur papier.
3. Paires interdites vérifiées sous le seuil : gris sur béton sombre, rouge sur béton sombre.
4. Un jeton absent lève en le nommant.

### `5)` Mettre la mémoire à jour

> Que la mémoire dise la nouvelle règle.

1. `design.md` : jetons, police (version, licence OFL, chargée depuis `Base.astro`) à la place de « aucune web font », marque, contrastes.
2. `testing.md` : le test de contrastes.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `global.css` porte les trois jetons. |
| 2 | `npm run build` passe ; une page charge un seul `.woff2` Archivo ≤ 100 ko ; aucune URL externe ; capture comparée à la référence. |
| 3 | `dist/index.html` affiche « VITRINE » sans tiret bas, en police de titre. |
| 4 | `npm test` passe ; le vert `#3a7d44` fait échouer le test. |
| 5 | `design.md` ne contient plus « Aucune web font » et nomme Archivo, le vert, le béton sombre et la pierre. |
