# Évaluation du serveur MCP RGPD

Mesure du 4 novembre 2026, sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local.

## Réglages mesurés

- Instruction de requête : « Instruction : retrouve les passages du RGPD qui répondent à la question\nRequête : ». Sans elle, « effacement et moteurs de recherche » plaçait `art_17` au rang 5 ; avec elle, au rang 1, et les similarités des pièges passaient sous celles des questions à référence. Les passages indexés ne portent aucune instruction.
- Seuils finaux, calibrés sur les 22 questions : `SEUIL_BAS = 0,65`, `SEUIL_HAUT = 0,70`, `MARGE = 0`.

## Résultats

Le tableau sépare ce que le serveur retrouve par le court-circuit déterministe de ce qu'il retrouve par les vecteurs : mélanger les deux gonflait les chiffres.

| Métrique | Valeur |
| --- | --- |
| Références exactes (8 questions) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (9 questions) | `recall@5` 0,889 (8/9), `MRR` 0,648 |
| Précision au rang 1, sémantique | 0,444 (4/9) |
| Pièges soumis aux seuils (4) | 4 |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Similarité maximale des 4 pièges par seuil | 0,631 |
| Similarité minimale des 9 questions sémantiques | 0,704 |
| Marge basse (piège max → `SEUIL_BAS`) | 0,019 |
| Marge haute (`SEUIL_HAUT` → premier passage sémantique le plus faible) | 0,004 |
| Questions sémantiques en `incertain` aux seuils finaux | 0 |
| Rang de « effacement » | 1 |
| Rang de « effacement et moteurs de recherche » | 1 |
| Paraphrase inédite « droit de récupérer mes données » → `art_20` | hors des cinq premiers (top 5 : non) |
| Citations invalides, pli 1 | 0,0 % (0/0) |
| Citations invalides, pli 2 | 0,0 % (0/1) |
| Citations invalides, pli 3 | 0,0 % (0/1) |
| Citations invalides, pli 4 | 0,0 % (0/2) |
| Moyenne des plis (min–max) | 0,0 % (0,0 %–0,0 %) |
| Pièges échoués aux seuils finaux | aucun |

## Qualité du premier passage

Le rang de la référence attendue ne dit pas tout : un considérant peut passer devant l'article attendu, et la similarité du premier passage peut rester haute alors que l'article est ailleurs. Les neuf questions sémantiques donnent :

| Question | Attendu | Rang attendu (similarité) | Premier passage |
| --- | --- | --- | --- |
| délai de conservation des données personnelles | `art_5` | 1 (0,730) | `art_5` |
| effacement et moteurs de recherche | `art_17` | 1 (0,775) | `art_17` |
| effacement | `art_17` | 1 (0,819) | `art_17` |
| conditions du consentement pour les services en ligne | `art_7` | 2 (0,701) | `rct_32` |
| droit de recevoir ses données dans un format structuré | `art_20` | 2 (0,700) | `rct_68` |
| droit de récupérer mes données | `art_20` | absent | `art_15` |
| obligations lorsqu'un traitement est confié à un prestataire | `art_28` | 3 (0,680) | `rct_81` |
| notification d'une violation de données à l'autorité de contrôle | `art_33` | 1 (0,876) | `art_33` |
| transfert de données vers un pays tiers hors Union européenne | `art_44`/`art_45` | 2 (0,833) | `art_48` |

La précision au rang 1 est donc de 4/9. Les cas observés sont ceux du contrôle : `art_7` battu par `rct_32`, `art_20` par `rct_68`, `art_28` par `rct_81`, et `art_44`/`art_45` battu par `art_48`. Trois questions sur neuf ont un considérant en tête alors que l'article est attendu (`art_7`, `art_20`, `art_28`).

La paraphrase inédite « droit de récupérer mes données » n'est pas dans les cinq premiers : le vecteur place `art_15` (droit d'accès) devant `art_20` (portabilité), et `art_20` n'apparaît pas. C'est la seule question sémantique qui fait baisser `recall@5` sous 1,000.

## Confiance

`confiant` ne veut dire qu'une chose : la similarité du premier passage dépasse `SEUIL_HAUT` (avec la marge demandée). Il ne dit jamais que l'article attendu est en tête, ni que la réponse est juste. La confiance est fragile : il ne reste que 0,004 entre `SEUIL_HAUT` (0,70) et le premier passage sémantique le plus faible (0,704), et 0,019 entre le piège le plus proche (0,631) et `SEUIL_BAS` (0,65).

`MARGE = 0` est conservé : aucune question mesurée ne tombe dans `incertain`, et un écart top-1/top-2 n'est donc pas exigé pour parler de confiance. C'est un choix assumé, pas une calibration confortable : les écarts top-1/top-2 descendent à 0,003 sur « obligations… » et « transfert… », deux questions où le premier passage est justement inattendu. Une marge non nulle basculerait ces questions en `incertain` ; elle n'a pas été retenue ici pour ne pas réduire la couverture sans mesure supplémentaire.

## Validation croisée

Chaque pli calibre les seuils sur les questions restantes et mesure les citations invalides sur les questions tenues à l'écart. Le piège déterministe « article 100 » est exclu des taux : il est refusé par le court-circuit des articles absents, pas par les seuils. Les quatre pièges restants sont ceux qui mesurent réellement la calibration ; le tableau des plis porte donc sur eux seuls, d'où un pli à 0/0.

## Limites

- Vingt-deux questions restent un échantillon étroit : les chiffres valent pour le RGPD, pas pour un corpus plus large ni pour la CNIL.
- Les seuils ont été ajustés sur ces 22 questions ; les chiffres rapportés sont ceux de la validation croisée, mais le jeu reste petit et les pièges peu nombreux dans chaque pli.
- Les 8 références exactes ne mesurent pas la recherche : elles passent par le court-circuit déterministe. Les métriques de retrieval ne valent que sur 9 questions conceptuelles.
- Quatre pièges seulement mesurent les seuils, avec 0,019 de marge sous `SEUIL_BAS` ; un piège à peine plus proche basculerait en citation. Le cinquième, « article 100 », est refusé par l'absence d'article, pas par les seuils.
- Les pièges diffèrent surtout par leur sujet. Un piège qui citerait un article réel du RGPD passerait par le court-circuit exact et ne mesurerait pas les seuils.
- La paraphrase inédite échoue : le jeu ne prouve pas que la recherche sémantique généralise au-delà des formulations mesurées.
