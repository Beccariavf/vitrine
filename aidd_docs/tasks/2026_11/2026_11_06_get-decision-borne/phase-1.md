# Phase 1: Exposer la borne du dispositif

## Acceptance

- `mcp/corpus/cnil/meta.ts` expose `debutDispositif(texte): number`.
- `extraireMetaSanction` s'en sert ; il n'existe qu'une règle de borne.
- La position rendue est valable dans le texte d'origine, espaces insécables compris.
- L'extraction des 249 décisions ne bouge pas : même type, même montant, même injonction.

## Evidence

- Recalcul des 249 décisions avec le nouveau `extraireMetaSanction` contre les valeurs déjà indexées : **0 écart**.
- Tests : `la borne du dispositif` (dernier « PAR CES MOTIFS », repli « En conséquence », repli formule de sanction puis 2 500 derniers caractères, position valable avec espace insécable).
