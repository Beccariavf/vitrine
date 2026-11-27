# Consigne « la règle avant son interprétation » — #176

Mesure du 2026-11-27. Client simulé : un modèle Sonnet qui ne lit que ce que le serveur envoie à tout client MCP (instructions et description des outils, capturées par `tools/list`), sans skill ; il choisit au plus 2 appels `search` et leurs filtres pour les 60 questions de #164. Avant : instructions de `main` (26/11). v1 : second appel « sur la doctrine ou les décisions, ou sans `corpus` ». v2 (retenue) : second appel sans `corpus`, borné aux décisions seulement si la question nomme l'autorité ou la juridiction. Choix bruts : `choix-avant.jsonl`, `choix-v1.jsonl`, `choix-v2.jsonl`.

Rappel@5 estimé : un appel sur le bon corpus reprend le résultat mesuré avec ce filtre (#164) ; un appel sans filtre, celui du mode par défaut (#170) ; seulement des filtres faux = échec.

| | bon corpus | dont textes | seulement de mauvais filtres | rappel@5 estimé | textes | autres |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sans client qui filtre (mode par défaut) | — | — | — | 27/60 | 19/42 | 8/18 |
| avant (description actuelle) | 36/60 | 29/42 | 9 | 36/60 | 27/42 | 9/18 |
| consigne v1 | 48/60 | 41/42 | 12 | 41/60 | 36/42 | 5/18 |
| **consigne v2 (retenue)** | 43/60 | 38/42 | **1** | **42/60** | 33/42 | **9/18** |
| plafond (filtre toujours juste) | 60/60 | 42/42 | 0 | 50/60 | 37/42 | 13/18 |

## Lecture

- La consigne amène le client à chercher l'article : en v2, 38 textes sur 42 sont filtrés sur le bon corpus, et le rappel estimé passe de 36 à 42/60 (27 sans client qui filtre).
- v1 poussait le second appel vers un corpus de décisions deviné : 12 questions ne gardaient que des filtres faux, et les décisions et la doctrine tombaient à 5/18. v2 fait le second appel sans `corpus` : 1 seul filtre faux, décisions et doctrine à 9/18 comme avant. v2 est retenue : elle ne coûte rien aux décisions.
- L'écart de textes entre v1 (36/42) et v2 (33/42) tient à 3 choix de corpus sur un seul tirage : non significatif.
- Avec le reranker (#114) sur l'appel sans filtre, les décisions et la doctrine devraient progresser (bge : 8 → 14/18 en mode par défaut) ; non mesuré ensemble.
- Limites : un seul modèle client, un tirage par variante, estimation et non mesure de bout en bout ; 60 questions sans split.
