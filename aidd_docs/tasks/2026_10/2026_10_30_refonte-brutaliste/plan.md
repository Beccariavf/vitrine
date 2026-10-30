---
objective: "Les deux pages publiques portent l'identité brutaliste Cité Radieuse, une variante d'accueil est retenue et la CI reste verte."
status: completed
---

# Plan: Refonte visuelle brutaliste

Source: aidd_docs/tasks/2026_10/2026_10_30_refonte-brutaliste/spec.md

## Phases

| #   | Phase               | File                         | Depends on |
| --- | ------------------- | ---------------------------- | ---------- |
| 1   | socle-visuel        | [`phase-1.md`](./phase-1.md) | none       |
| 2   | accueil-variantes   | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | application-et-veille | [`phase-3.md`](./phase-3.md) | 1, 2       |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.ai-driven-dev.fr | Types de modules : wordmark terminal, bandeau de chiffres, bloc de preuve, sections numérotées, cartes produits. |

## Impact

| Category       | Verdict and evidence | Handled in |
| -------------- | -------------------- | ---------- |
| runtime        | Aucun : rendu statique, aucune API, aucune dépendance ajoutée. | none |
| regression     | Faible : markup et styles seulement, `data/` intact ; les tests d'entrées couvrent le lecteur et le filtre ; pas de phase filet, le build et la revue visuelle suffisent. | none |
| architecture   | Aucune connexion changée ; les jetons restent centralisés dans `src/styles/global.css`. | none |
| documentation  | `aidd_docs/memory/design.md` doit porter la décision finale. | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Brief et palette fixés | La refonte reste atténuée, pas une copie marketing de la référence. |
| Aucune web font, aucun JS client, aucune requête réseau au build | Contrainte de coût et de sobriété du projet. |
| `data/` jamais édité à la main | La refonte ne touche que le rendu. |
| CI comme porte | Typecheck, tests et build rejoués à chaque push. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Deux variantes sur deux routes temporaires, la perdante supprimée avant la PR | Permet un choix visuel réel sans laisser de page morte. |
| Arrêt de choix après la phase 2 : Val retient A ou B, la phase 3 applique ce choix | Le goût ne se délègue pas à l'exécutant ; aucune phase 3 ne démarre sans cette décision. |
| Aucune bibliothèque de composants ; markup local aux deux pages | Deux pages ne justifient pas une abstraction prématurée. |
| La grille de veille est une carte par entrée, en-tête coloré et corps papier | Le texte long reste lisible ; la couleur ne porte que le jour et la source. |
| Cycle de quatre teintes, béton compris | Trois couleurs pour trois colonnes recréaient des colonnes uniformes ; la quatrième casse l'alignement. |
| Liste de lecture centrée à 56rem dans une page de 76rem | La grille a besoin de largeur, la liste a besoin d'une mesure de lecture courte. |
