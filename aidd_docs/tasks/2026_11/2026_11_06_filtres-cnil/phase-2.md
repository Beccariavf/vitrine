# Phase 2: Indexer et filtrer

## Acceptance

- `unites` porte `type_sanction`, `montant`, `injonction`, `date_num`, `numero_index`.
- `vec_unites` porte `corpus`, `document`, `date_num`, `type_sanction`, `montant`, `numero`, `injonction` ; les filtres sont poussés dans la requête `vec0`.
- `search` accepte `date_min`, `date_max`, `type_sanction`, `montant_min`, `montant_max`, `numero`, et rend `type_sanction`, `montant`, `injonction` dans chaque passage.
- La migration recopie les vecteurs sans ré-embarquer ; `meta_sha` décide de la recopie.
- Le second `corpus:index` embarque 0 unité ; le `dev` CNIL v2 reste à 14/25 et le `dev` RGPD v2 à 18/19.

## Evidence

- Migration réelle : 6 907 unités, 0 ajoutée, 0 modifiée, 0 supprimée, 6 907 inchangées, en 3 s.
- Tests : `filtre une décision CNIL par date, type, montant et numéro`, `n'affame pas un type minoritaire quand un autre le domine`, `dégrade un index puis le migre sans ré-embarquer`.
- `get_decision` rend aussi le type, le montant et l'injonction.
