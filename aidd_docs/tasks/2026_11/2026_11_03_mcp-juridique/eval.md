# Évaluation du serveur MCP RGPD

Mesure du 4 novembre 2026, sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local.

## Réglages mesurés

- Instruction de requête : « Instruction : retrouve les passages du RGPD qui répondent à la question\nRequête : ». Sans elle, « effacement et moteurs de recherche » plaçait `art_17` au rang 5 ; avec elle, au rang 1, et les similarités des pièges passaient sous celles des questions à référence. Les passages indexés ne portent aucune instruction.
- Seuils finaux, calibrés sur les 20 questions : `SEUIL_BAS = 0,65`, `SEUIL_HAUT = 0,70`, `MARGE = 0`.

## Résultats

Le tableau sépare ce que le serveur retrouve par le court-circuit déterministe de ce qu'il retrouve par les vecteurs : mélanger les deux gonflait les chiffres.

| Métrique | Valeur |
| --- | --- |
| Références exactes (8 questions) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (7 questions) | `recall@5` 1,000 (7/7), `MRR` 0,690 |
| Pièges soumis aux seuils (4) | 4 |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Similarité maximale des 4 pièges par seuil | 0,631 |
| Similarité minimale des 7 questions sémantiques | 0,704 |
| Marge sous `SEUIL_BAS` (0,65) | 0,019 |
| Questions sémantiques en `incertain` aux seuils finaux | 0 |
| Rang de « effacement et moteurs de recherche » | 1 |
| Citations invalides, pli 1 | 0,0 % (0/1) |
| Citations invalides, pli 2 | 0,0 % (0/1) |
| Citations invalides, pli 3 | 0,0 % (0/1) |
| Citations invalides, pli 4 | 0,0 % (0/2) |
| Moyenne des plis (min–max) | 0,0 % (0,0 %–0,0 %) |
| Pièges échoués aux seuils finaux | aucun |

Les 8 questions à référence contiennent toutes `article N` et sont servies à similarité 1,000 par `mcp/tools.ts` sans interroger l'index : leur rang 1 ne mesure pas la recherche. Les chiffres de retrieval portent donc sur les 7 questions conceptuelles. Sur les 5 pièges, seul « article 100 » cite un article : il est refusé par la branche article absent, pas par les seuils ; les 4 autres sont les seuls à mesurer la calibration.

Chaque pli calibre les seuils sur 15 questions et mesure les citations invalides sur les 5 tenues à l'écart. La séparation est étroite : 0,019 seulement entre le piège le plus proche (0,631) et `SEUIL_BAS` (0,65). `MARGE = 0` ne laisse aucune question mesurée dans `incertain` ; les 7 questions sémantiques dépassent toutes `SEUIL_HAUT` (minimum 0,704).

## Limites

- Vingt questions restent un échantillon étroit : les chiffres valent pour le RGPD, pas pour un corpus plus large ni pour la CNIL.
- Les seuils ont été ajustés sur ces 20 questions ; les chiffres rapportés sont ceux de la validation croisée, mais le jeu reste petit et les pièges peu nombreux dans chaque pli.
- Les 8 références exactes ne mesurent pas la recherche : elles passent par le court-circuit déterministe. Les métriques de retrieval ne valent que sur 7 questions conceptuelles.
- Quatre pièges seulement mesurent les seuils, avec 0,019 de marge sous `SEUIL_BAS` ; un piège à peine plus proche basculerait en citation. Le cinquième, « article 100 », est refusé par l'absence d'article, pas par les seuils.
- Les pièges diffèrent surtout par leur sujet. Un piège qui citerait un article réel du RGPD passerait par le court-circuit exact et ne mesurerait pas les seuils.
