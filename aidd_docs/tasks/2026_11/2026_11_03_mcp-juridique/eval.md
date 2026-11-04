# Évaluation du serveur MCP RGPD

Mesure du 4 novembre 2026, sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local.

## Réglages mesurés

- Instruction de requête : « Instruction : retrouve les passages du RGPD qui répondent à la question\nRequête : ». Sans elle, « effacement et moteurs de recherche » plaçait `art_17` au rang 5 ; avec elle, au rang 1, et les similarités des pièges passaient sous celles des questions à référence. Les passages indexés ne portent aucune instruction.
- Seuils finaux, calibrés sur les 20 questions : `SEUIL_BAS = 0,65`, `SEUIL_HAUT = 0,70`, `MARGE = 0`.

## Résultats

| Métrique | Valeur |
| --- | --- |
| `recall@5` | 1,000 (15 questions à référence) |
| `MRR` | 0,856 |
| Rang de « effacement et moteurs de recherche » | 1 |
| Citations invalides, pli 1 | 0,0 % (0/1) |
| Citations invalides, pli 2 | 0,0 % (0/1) |
| Citations invalides, pli 3 | 0,0 % (0/1) |
| Citations invalides, pli 4 | 0,0 % (0/2) |
| Moyenne des plis (min–max) | 0,0 % (0,0 %–0,0 %) |
| Pièges échoués aux seuils finaux | aucun |

Chaque pli calibre les seuils sur 15 questions et mesure les citations invalides sur les 5 tenues à l'écart. `recall@5` et `MRR` portent sur les 15 questions à référence des 20 ; une question piège refusée ne compte pas comme échec de rappel.

## Limites

- Vingt questions restent un échantillon étroit : les chiffres valent pour le RGPD, pas pour un corpus plus large ni pour la CNIL.
- Les seuils ont été ajustés sur ces 20 questions ; les chiffres rapportés sont ceux de la validation croisée, mais le jeu reste petit et les pièges peu nombreux dans chaque pli.
- Les pièges diffèrent surtout par leur sujet. Un piège qui citerait un article réel du RGPD passerait par le court-circuit exact et ne mesurerait pas les seuils.
