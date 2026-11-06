# Phase 3: Vérifier les charges et documenter

## Acceptance

- Sur les 249 décisions, un appel par défaut contient toujours une formule de sanction.
- La charge par défaut reste très en dessous du plafond des clients.
- Le démonstrateur montre le dispositif, pas l'argumentaire qui le précède.
- Le README et la mémoire disent le nouveau défaut.

## Evidence

| Mesure | Avant (`tous`) | Après (défaut) |
| --- | --- | --- |
| Charge maximale | 47 562 tokens | **2 771 tokens** |
| Charge médiane | 4 688 tokens | ~700 tokens |
| Décisions sans mot de sanction dans le rendu par défaut | 0 | **0** |
| Décisions dépassant 10 000 tokens | 73 | **0** |
| Décisions dépassant 25 000 tokens | 17 | **0** |

La pire décision par défaut est `SAN-2017-002` (`CNILTEXT000034473080`) : elle n'a pas de « PAR CES MOTIFS », donc la borne se replie sur la formule de sanction, plus haut dans le texte. Sept décisions sont si courtes que le dispositif est le document entier.

Le premier fragment rendu peut commencer avant le « PAR CES MOTIFS » : sur `SAN-2026-015`, le fragment #52 s'ouvre sur les observations des sociétés et porte le dispositif plus loin. C'est voulu — la citation est le fragment, on ne coupe pas son texte. Le démonstrateur part du marqueur pour montrer la partie opératoire.
