# Consigne « la règle avant son interprétation » — #176

Mesure du 2026-11-27. Client simulé : un modèle Sonnet qui ne lit que ce que le serveur envoie à tout client MCP (instructions et description des outils, capturées par `tools/list`), sans skill ; il choisit au plus 2 appels `search` et leurs filtres pour les 60 questions de #164. Avant : instructions de `main` (26/11) ; après : instructions avec `methodeRecherche()`. Choix bruts : `choix-avant.jsonl`, `choix-apres.jsonl`.

Rappel@5 estimé : un appel sur le bon corpus reprend le résultat mesuré avec ce filtre (#164) ; un appel sans filtre, celui du mode par défaut (#170) ; seulement des filtres faux = échec.

| | bon corpus | dont textes | seulement de mauvais filtres | rappel@5 estimé | textes |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans client qui filtre (mode par défaut) | — | — | — | 27/60 | 19/42 |
| avant (description actuelle) | 36/60 | 29/42 | 9 | 36/60 | 27/42 |
| **après (consigne)** | **48/60** | **41/42** | 12 | **41/60** | **36/42** |
| plafond (filtre toujours juste) | 60/60 | 42/42 | 0 | 50/60 | 37/42 |

## Lecture

- La consigne amène le client à chercher l'article : 41 textes sur 42 sont filtrés sur le bon corpus, et les textes atteignent 36/42, à une question du plafond.
- Le coût porte sur les questions de décisions et de doctrine : 12 questions n'ont plus que des filtres faux (contre 9), surtout une question CJUE, Cour de cassation ou CNIL dirigée vers le texte qu'elle applique, sans appel aux décisions. Le second appel « interprétation » n'a pas été fait vers le bon corpus de décisions.
- Limites : un seul modèle client, un seul tirage, estimation et non mesure de bout en bout ; 60 questions sans split.
