# Design

La langue visuelle : jetons, typographie et conventions. Ce que ça ressemble, pas comment c'est codé.

## System

- Tailwind via le plugin Vite d'Astro ; les jetons vivent dans le bloc `@theme` de `src/styles/global.css`.
- Aucune bibliothèque de composants : deux pages et un layout partagé (`src/layouts/Base.astro`).
- Aucune web font, aucun JavaScript côté client : le rendu vient du HTML et du CSS seuls.

## Tokens

- Couleurs : papier `#f7f5f0`, surface `#fffdf9`, encre `#1a1a1a`, gris `#6b6b6b`, bordeaux `#8a1c1c`, bordeaux clair `#f2e7e4`.
- Typographie : serif Georgia pour les titres et les jours de la veille, sans système pour le texte et les labels en majuscules, mono pour les numéros d'étape.
- Formes : coins `rounded-md`, bordures à 10 % d'encre, aucune ombre, aucune animation.

## Components

- Un seul layout : largeur `max-w-3xl`, en-tête avec navigation, pied de page.
- `aria-current="page"` sur le lien de la section courante.
- Veille : date en colonne, titre cliquable, résumé sur deux lignes, source en label.
- États : lien souligné au survol, focus visible en contour bordeaux de 2 px.

## Accessibility

- Contraste AA mesuré sur le papier : encre 15,97:1, gris 4,89:1, bordeaux 8,52:1.
- Focus clavier toujours visible (`:focus-visible`).
- Langue `fr` déclarée, navigation étiquetée, dernière publication portée par `<time>`.
