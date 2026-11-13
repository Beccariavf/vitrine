# Revue : périmètre et fraîcheur (#34)

Deux revues indépendantes.

## Première revue — refusée

- Bloquant : `a_jour_au` global appliqué aux corpus statiques (`rgpd`, `aiact`, `lil`, `cepd`) que `corpus:sync` ne revérifie pas. Corrigé : fraîcheur par corpus (`veille`, `a_jour_au`, `arrete_le`), décision 2 révisée.
- Bloquant : RGPD et AI Act sans date. Corrigé en partie : dits « instantané fixe non daté » ; l'écriture de `date_extraction` par `corpus:build` est un ticket suivant.
- Non bloquants corrigés : clés d'exclusion variables nommées, test `incertain`, borne de recherche unique, lecture des manifestes mise en commun, branche morte.

## Seconde revue — claire (85/100)

- Corrigés : corpus demandé inconnu dit `inconnu` (I1), réexport mort retiré (I2), date d'arrêté gardée sans passe réussie (C2), spec et plan réalignés (C3, C4).
- Notes laissées ouvertes :
  - C1 : le renvoi ne mène pas à `etat_corpus.manquants` ; un corpus « à jour » peut avoir des documents connus manquants.
  - I3 : `get_article` reste sensible à la casse de l'identifiant, antérieur à la branche.
