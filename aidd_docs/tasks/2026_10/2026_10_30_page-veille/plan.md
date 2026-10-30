---
objective: "Une page statique liste les actualités CNIL de data/, triées de la plus récente à la plus ancienne, avec un lien officiel par entrée."
status: in-progress
---

# Plan: Page de veille statique

Source: `aidd_docs/tasks/2026_10/2026_10_30_page-veille/spec.md`

## Phases

| #   | Phase             | File                         | Depends on |
| --- | ----------------- | ---------------------------- | ---------- |
| 1   | lire-les-entrees  | [`phase-1.md`](./phase-1.md) | none       |
| 2   | publier-la-page   | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL | What it settled |
| --- | --- |
| https://docs.astro.build/en/guides/static-site-generation/ | Rendu statique au build, lecture de fichiers locaux possible |
| https://tailwindcss.com/docs/installation/framework-guides/astro | Tailwind 4 s'installe via `@tailwindcss/vite`, pas `@astrojs/tailwind` |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | Nouveau : la génération lit `data/` et écrit `dist/`. Aucun serveur, aucune API. | phase 2 |
| regression | none — le pipeline et ses tests ne sont pas modifiés. | none |
| architecture | Ouvre la frontière `src/` (front) qui lit `data/` uniquement, conforme à `memory/architecture.md`. | phase 2 |
| documentation | `memory/codebase-map.md` gagne `src/` ; `memory/testing.md` gagne la couche du lecteur. | phase 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `data/` n'est jamais édité à la main | La page doit refléter la sortie du pipeline, pas une correction manuelle. |
| Le site ne lit aucune API au runtime | Le rendu statique et l'audit git en dépendent. |
| Versions épinglées | Une montée de version est une décision, pas une surprise. |
| Un commit par tâche validée | Convention VCS du projet. |

## Decisions

| Decision | Why |
| --- | --- |
| Astro en rendu statique, Tailwind 4 via `@tailwindcss/vite` | Respecte la décision d'architecture ; l'intégration `@astrojs/tailwind` est dépréciée. |
| Le lecteur lit `data/entries/**/*.json` au build, avec `process.cwd()` | Un seul chemin, stable, indépendant de l'emplacement du fichier compilé. |
| Tri sur la chaîne ISO UTC, dates nulles en dernier | Une chaîne ISO 8601 UTC se trie lexicographiquement sans conversion. |
| Aucune page de détail : le titre pointe vers la CNIL | Évite de dupliquer le contenu officiel et de créer une page par article. |
