# Résumé des actualités et vérification continue

## Target

Chaque actualité de la page de veille affiche un résumé court et lisible, extrait de sa source officielle.

## Hard constraints

- Le résumé provient du champ de description de la source ; jamais inventé ni réécrit.
- Aucune balise HTML, aucune entité (même doublement encodée), espaces normalisés.
- 200 caractères maximum, coupé sur une frontière de mot ; ellipse seulement si le texte est tronqué.
- Une description absente ou vide donne `summary: null` et n'affiche aucun bloc vide.
- Aucune requête réseau supplémentaire : le résumé vient du flux déjà lu.
- Le contrat `Entry` expose `summary: string | null`.

## Non-goals

- Réécriture ou résumé par un modèle.
- Pages de détail, recherche, pagination.
- Une deuxième source.
- Déploiement et cron.

## Done-when

- Toute entrée dont la description est non vide affiche un résumé sur la page de veille.
- Aucun résumé ne contient `<`, `>`, `&nbsp;` ni double espace.
- Un texte de plus de 200 caractères est coupé sur un mot ; un texte plus court n'a pas d'ellipse.
- Une description vide laisse l'entrée affichée, sans résumé.
- `npm test` couvre le nettoyage, la troncature et le cas vide.
- Un push déclenche une vérification automatique des types, des tests et du build.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la veille

## Context

- Contrat actuel : [`veille/types.ts`](../../../veille/types.ts).
- Décisions d'architecture : [`aidd_docs/INSTALL.md`](../../../INSTALL.md).
- Les descriptions du flux CNIL contiennent des entités doublement encodées ; le nettoyage reste défensif face aux balises d'autres sources.
