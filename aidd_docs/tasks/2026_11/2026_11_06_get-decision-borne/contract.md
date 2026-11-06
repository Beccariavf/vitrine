---
objective: "`get_decision` rend par défaut la partie opératoire d'une décision, et la décision entière sur demande explicite, pour qu'aucun client MCP ne reçoive une charge qu'il tronque."
status: completed
---

# Contrat : borner `get_decision` par défaut

Source : la mesure de cette session. Sur les 249 décisions CNIL, 75 dépassent 10 000 tokens estimés (seuil d'avertissement des clients MCP) et 19 dépassent 25 000 (plafond par défaut de Claude Code) ; la plus grosse atteint 56 032 tokens. L'outil promettait la décision entière et ne pouvait donc pas tenir sa promesse dans un client.

## Comportement observable

- `get_decision({ numero })` rend la **partie opératoire** : `partie: "dispositif"`, `fragments_total` (nombre total de fragments du document) et `fragments` (ceux rendus, entiers, jamais coupés).
- `get_decision({ numero, partie: "tous" })` rend tous les fragments, comme avant.
- La réponse contient la formule de sanction (« prononcer … amende », « adresse un avertissement », etc.), y compris quand elle tombe dans un fragment qui commence plus haut.
- Aucun fragment n'est amputé : le serveur choisit des fragments entiers, il ne tronque pas de texte.

## Bornes vérifiables

Estimations en caractères/4 sur le JSON que le serveur envoie (pas un tokenizer : seul l'ordre de grandeur compte).

| Mesure | Défaut | `tous` |
| --- | --- | --- |
| Charge maximale | **1 705** | **56 032** |
| Charge médiane | 510 | 5 036 |
| Décisions au-dessus de 10 000 | 0 | 75 |
| Décisions au-dessus de 25 000 | 0 | 19 |

## Décisions prises

- Le défaut change de « tous » à « dispositif ». La description de l'outil et le README cessent de promettre la décision entière par défaut.
- La borne du dispositif vient d'une seule fonction, partagée avec l'extraction des métadonnées : deux règles divergentes donneraient deux vérités sur le même texte.
- Pas de pagination : `partie: "tous"` reste le seul moyen d'obtenir l'intégralité, et le client sait ce qu'il demande.

## Non-objectifs

- Ne pas toucher `search`, `get_article`, l'index ou les embeddings.
- Ne pas ré-embarquer quoi que ce soit : le changement est en lecture seule.
- Ne pas ajouter de champ `offset`/`limite` ; deux modes suffisent tant qu'aucun besoin réel ne les distingue.
