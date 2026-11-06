# Phase 3: Vérifier les charges et documenter

## Acceptance

- Sur les 249 décisions, un appel par défaut contient toujours la formule de sanction.
- La charge par défaut reste très en dessous du plafond des clients.
- Le démonstrateur montre le dispositif, pas l'argumentaire qui le précède.
- Le README et la mémoire disent le nouveau défaut.

## Evidence

Estimations en caractères/4 sur le JSON rendu par le serveur, pas un tokenizer.

| Mesure | `tous` | Défaut |
| --- | --- | --- |
| Charge maximale | 56 032 | **1 705** |
| Charge médiane | 5 036 | 510 |
| Décisions au-dessus de 10 000 | 75 | **0** |
| Décisions au-dessus de 25 000 | 19 | **0** |

- **249/249** réponses par défaut contiennent la formule de sanction ; aucune ne perd le montant.
- Sept décisions sont si courtes que le dispositif est le document entier.

Deux cas méritent d'être dits :

- `SAN-2017-002` n'a pas de « PAR CES MOTIFS » ; la borne se replie sur « sanction d'un montant de 15 000 euros », donc les 2 derniers fragments sur 15. Sans la variante typographique de l'apostrophe (`d’un`), la borne tombait sur un « injonctions » du raisonnement et rendait 8 fragments d'argumentaire.
- `98-045` (`CNILTEXT000017653658`, 1998) n'a ni marqueur ni conclusion ni formule reconnue : la borne remonte à un « injonction » du raisonnement, et 5 fragments sur 7 sont rendus. La sanction y figure, la charge reste faible ; c'est la limite assumée du repli sur les vieilles décisions.

Le premier fragment rendu peut commencer avant le « PAR CES MOTIFS » : sur `SAN-2026-015`, le fragment #52 s'ouvre sur les observations des sociétés et porte le dispositif plus loin. C'est voulu — la citation est le fragment, on ne coupe pas son texte. Le démonstrateur part de la borne pour montrer la partie opératoire.
