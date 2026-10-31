# Pagination de la veille

## Target

La page de veille affiche les entrées par pages de 9, avec des liens précédent/suivant, la grille, la liste et les filtres actifs, sans JavaScript.

## Hard constraints

- Neuf entrées par page ; `/veille` est la page 1 ; les suivantes sont `/veille/2`, `/veille/3`, etc. ; la dernière peut en avoir moins.
- Les entrées restent triées de la plus récente à la plus ancienne.
- Chaque page conserve la grille, la liste, les tags actifs, les références, les sources et l'attribution.
- Les liens « Plus récentes » et « Plus anciennes » encadrent la page courante ; `rel="prev"` et `rel="next"` sont posés ; `aria-current` marque la page.
- Le titre de l'onglet indique la page ; la page 1 reste `/veille`, jamais `/veille/1`.
- Les pages sont statiques, construites au build, sans JavaScript, sans serveur, 0 €.
- L'accueil pointe vers `/veille` et compte toutes les entrées, pas seulement la page 1.
- À 375 px, la grille passe en une colonne, la liste reste lisible et les liens de pagination ne débordent pas.
- Les tests couvrent le découpage 9/2 sur 11 entrées, les pages, les liens, la dernière page, le build et 375 px.

## Non-goals

- Le contenu des références CNIL : contrat séparé.
- Le scroll infini, un bouton JavaScript, un serveur, la recherche.
- Le changement du filtre de tags, des données ou de l'accueil.
- La pagination par mois ou par année.
- La conservation de l'état grille/liste entre deux pages.

## Done-when

- `/veille` affiche les 9 plus récentes ; `/veille/2` affiche les 2 plus anciennes, dont Jautiva.
- Les liens précédent/suivant fonctionnent, la page courante est marquée et la page 1 est `/veille`.
- La grille, la liste, les tags actifs, les références et l'attribution sont conservés sur chaque page.
- Aucune page publique ne contient de `<script>` ; 375 px ne déborde pas.
- Typecheck, tests, build et CI passent.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la veille

## Context

- La page actuelle fait environ 1824 px avec 11 entrées ; la fenêtre s'allonge à chaque passe.
- Le corpus de départ : 11 entrées, 10 CNIL et Jautiva C-798/24.
- La pagination statique est retenue : 9 par page, 3 × 3 sur desktop, sans JavaScript.
- Le contrat des références CNIL est séparé ; la pagination ne change pas les données.
