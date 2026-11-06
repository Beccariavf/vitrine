# Phase 1: Extraire les métadonnées

## Acceptance

- `mcp/corpus/cnil/meta.ts` lit le dernier « PAR CES MOTIFS » et rend `type_sanction`, `montant`, `injonction`.
- Les montants en chiffres (`6 000 000`, `2,5 millions`, `50 (cinquante) millions`) et en mots (`six millions`, `cinq cent mille`) sont lus.
- Une astreinte quotidienne n'entre pas dans le montant ; un total suivi de sa décomposition n'est pas additionné à ses composantes ; un montant répété entre parenthèses n'est pas compté deux fois.
- Les 249 décisions sont étiquetées ; une seule amende reste sans montant (dispositif masqué).
- `unitesDinum` et `unitesDila` posent les mêmes métadonnées sur tous les fragments d'une décision.

## Evidence

| Type | Documents |
| --- | --- |
| Amende | 134 (133 avec montant, 1 masquée) |
| Avertissement | 95 |
| Liquidation | 12 |
| Rappel à l'ordre | 6 |
| Interruption | 2 |

Trente-cinq décisions prononcent une injonction.

Contrôles manuels : FNAC 7 M€, Google 325 M€ (200 + 125), Google 2021 150 M€ (90 + 60), Free Mobile 27 M€, Free 15 M€, Orange 50 M€, hôpital 500 k€, EXTIA 300 k€, IQVIA 5 M€, liquidation 5,2 M€, 1 € symbolique. La seule amende sans montant est `CNILTEXT000046907077` (dispositif `[…]`).
