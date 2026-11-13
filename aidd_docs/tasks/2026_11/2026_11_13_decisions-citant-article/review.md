# Revue : décisions qui citent un article (#29)

Deux revues indépendantes.

## Première revue — refusée

- Bloquant : la renumérotation de la LIL (ordonnance 2018-1125, 2019-06-01) était ignorée ; 736 des 744 citants de l'article 15 visaient l'ancienne numérotation. Corrigé : décisions antérieures écartées des comptes, comptées dans `ecartees_numerotation_anterieure` (décision 6).
- Corrigés : `via_plage`, suffixe `bis` refusé, plages à bornes composées, branche morte, test aller-retour par le client.
- Laissés : champ `nature` pour le CEPD, lecteurs JSONL et manifestes partagés avec `citations.ts`.

## Seconde revue — claire (85/100)

- Corrigés : description de l'alinéa, « autre texte » remplacé par « numérotation antérieure, donc un autre article », message contradictoire quand tous les citants sont écartés, tests de la date limite et de la date inconnue.
- Notes ouvertes :
  - `premieresUnites` relit les cinq corpus de décisions à chaque appel (240 ms à chaud) : garder la première unité dans le cache de `citationsDuCorpus`.
  - Les citants LIL antérieurs à 2019 sont comptés mais inaccessibles, sans renvoi vers l'ancien numéro (l'actuel art. 6 était l'art. 8) : ticket suivant possible, paramètre `numerotation: "anterieure"`.
  - Une décision postérieure à 2019 qui cite la rédaction antérieure reste comptée (environ 5 % ou plus mesuré sur les art. 6 et 8).
