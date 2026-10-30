---
status: pending
---

# Instruction: Publier la page

## Architecture projection

```txt
.
├── package.json ✏
├── tsconfig.json ✏
├── astro.config.mjs ✅
├── src/
│   ├── layouts/
│   │   └── Base.astro ✅
│   ├── pages/
│   │   ├── index.astro ✅
│   │   └── veille/
│   │       └── index.astro ✅
│   └── styles/
│       └── global.css ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Lancer `npm run build` | Le site statique est généré dans `dist/` | cli |
| Happy path | Ouvrir `dist/veille/index.html` | Tous les titres de `data/` sont présents et liés | cli |
| Edge case | Afficher une entrée sans date | Aucune date inventée, l'entrée reste listée | cli |
| Edge case | Générer sans `data/` | La génération échoue explicitement | cli |
| Teardown | Supprimer `dist/` | Aucun artefact de build versionné | cli |

## Tasks to do

### `1)` Installer Astro et Tailwind

> Le site se génère en statique, sans serveur.

1. Ajouter `astro`, `tailwindcss` et `@tailwindcss/vite` en versions exactes, plus les scripts `build` et `preview`.
2. Créer `astro.config.mjs` avec le plugin Tailwind et une sortie statique.
3. Ajouter `src/lib/**/*.ts` à l'`include` de `tsconfig.json`.

### `2)` Poser la coquille visuelle

> Une page sobre, lisible, qui inspire la rigueur.

1. Créer `src/styles/global.css` : `@import "tailwindcss"` et les jetons de thème (papier, encre, accent, typographie).
2. Créer `src/layouts/Base.astro` : `lang="fr"`, titre, description, en-tête, `<main>`, pied de page.

### `3)` Rendre les pages

> La vitrine et la liste, sans page de détail.

1. Créer `src/pages/index.astro` : présentation courte et lien vers la veille.
2. Créer `src/pages/veille/index.astro` : liste des entrées via le lecteur, date, source, lien officiel.
3. Ne jamais inventer de date : une entrée sans date s'affiche sans date.

### `4)` Vérifier le build

> La preuve que la page contient réellement les données.

1. Lancer `npm run build` et vérifier la présence de chaque titre et de chaque lien dans `dist/veille/index.html`.
2. Vérifier qu'une génération sans `data/` échoue avec un message explicite.

### `5)` Mettre la mémoire à jour

> La carte du code et la stratégie de test restent vraies.

1. Ajouter `src/` à `aidd_docs/memory/codebase-map.md`.
2. Ajouter la couche du lecteur à `aidd_docs/memory/testing.md`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `npm run build` s'exécute et produit `dist/` |
| 2 | Le layout porte `lang="fr"`, un titre, une description et un `<main>` |
| 3 | La page liste toutes les entrées, triées, chaque titre lié à l'URL officielle ; une date nulle n'affiche aucune date |
| 4 | `dist/veille/index.html` contient tous les titres ; sans `data/`, le build échoue |
| 5 | La mémoire mentionne `src/` et les tests du lecteur |
