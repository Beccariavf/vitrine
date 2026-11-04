# Évaluation du serveur MCP RGPD : qualité mesurée

Mesure du 4 novembre 2026, sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local.

Le jeu compte 50 questions écrites contre le texte du corpus : 12 références exactes, 28 conceptuelles et 10 pièges. 35 questions servent au développement (`dev`) et règlent les seuils ; 15 questions sont tenues à l'écart (`test`) et ne servent qu'à constater. La paraphrase « droit de récupérer mes données » est dans `test`, attendue sur `32016R0679#art_20`.

## Base avant réglage (phase 1)

Code d'avant la bande article et avant la marge de confiance. Les seuils `dev` sont calibrés sur les 35 questions de développement ; le `test` est mesuré avec les seuils figés `bas = 0,65`, `haut = 0,70`, `marge = 0`.

### Développement (35 questions, réglage)

| Métrique | Valeur |
| --- | --- |
| Références exactes (8) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (20) | `recall@5` 1,000 (20/20), `MRR` 0,829 |
| Top-1 sémantique | 70,0 % (14/20) |
| Niveaux sémantiques | 20 confiant, 0 incertain, 0 aucun_resultat_fiable |
| Pièges par seuil (6) | 0 cité |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Pièges marqués confiant | 0 |

### Test (15 questions, constat)

| Métrique | Valeur |
| --- | --- |
| Références exactes (4) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (8) | `recall@5` 0,750 (6/8), `MRR` 0,688 |
| Top-1 sémantique | 62,5 % (5/8) |
| Niveaux sémantiques | 8 confiant, 0 incertain, 0 aucun_resultat_fiable |
| Pièges par seuil (3) | 0 cité |
| Pièges marqués confiant | 0 |
| Paraphrase « droit de récupérer mes données » → `art_20` | hors des cinq premiers (top 5 : non) |

Les deux questions sémantiques manquées au `test` sont « autorité de contrôle chef de file » (`art_56` absent, `art_51` en tête) et la paraphrase `art_20` (`art_15` en tête, `art_20` absent). Ce sont des constats, pas des réglages : aucune question `test` n'entre dans la calibration.
