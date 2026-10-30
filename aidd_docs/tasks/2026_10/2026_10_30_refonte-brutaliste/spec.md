# Refonte visuelle brutaliste

## Target

Les pages d'accueil et de veille adoptent une identité brutaliste à palette Cité Radieuse, avec les modules de preuve du site de référence, sans changer le corpus ni le rendu statique.

## Hard constraints

- Palette exacte : béton `#E7E2D7`, papier `#F4F0E8`, encre `#121212`, rouge `#C62828`, bleu `#1E4E79`, jaune `#E0A82E`.
- 80 % béton et encre, 20 % couleur ; un seul aplat coloré par section.
- Angles vifs : aucun rayon d'arrondi, bordures de 2 px en encre, ombres dures sans flou.
- Aucun dégradé, aucun flou, aucune animation au-delà de l'état de survol.
- Aucune web font, aucun JavaScript côté client, aucune requête réseau au build.
- L'accueil conserve un hero, un bandeau de chiffres calculés depuis `data/`, un bloc de preuve du pipeline et trois produits.
- La veille conserve toutes les entrées, leurs titres, dates, liens sources et le filtre de redondance.
- Contraste AA sur tous les textes ; navigation et focus clavier toujours visibles.
- Rendu responsive : une colonne en mobile, grille multi-colonnes au-delà.

## Non-goals

- Nouvelles pages, nouvelle source, déploiement ou cron.
- Réécriture des textes éditoriaux, des données ou du contrat `Entry`.
- Mode sombre, images, illustrations, animations.
- Polices distantes, JavaScript client, dépendance UI supplémentaire.

## Done-when

- Deux variantes de la page d'accueil sont présentées en capture, et une est retenue.
- La variante retenue est appliquée à l'accueil et à la veille.
- Chaque page reste lisible et navigable à 375 px de large.
- Toutes les actualités restent affichées avec leur lien source ; les résumés redondants restent masqués.
- Les chiffres de l'accueil correspondent au contenu de `data/`, sans valeur codée en dur.
- Le site se construit sans réseau et ne livre aucun JavaScript.
- Typecheck, tests, build et CI passent.
- `aidd_docs/memory/design.md` porte la palette, la typographie et les règles de forme retenues.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt le site

## Context

- Direction et palette : [`brief.md`](./brief.md).
- Référence de structure : `https://www.ai-driven-dev.fr`.
- Design actuel : [`design.md`](../../../memory/design.md).
- Contrainte de coût : hébergement gratuit, site non déployé à ce stade.
