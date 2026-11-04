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

## Bande article à 0,02 (phase 2)

À pertinence comparable, un article passe devant un considérant : le score de classement vaut la similarité brute, plus `BANDE_ARTICLE = 0,02` pour un `niveau` `article`. La similarité rendue reste la valeur brute et aucun considérant n'est retiré.

Mesure sur `dev` uniquement, avec les seuils recalibrés par le code de l'époque :

| Métrique `dev` | Avant la bande | Avec 0,02 |
| --- | --- | --- |
| `recall@5` sémantique (20) | 1,000 (20/20) | 1,000 (20/20) |
| `MRR` sémantique | 0,829 | 0,858 |
| Top-1 sémantique | 70,0 % (14/20) | 75,0 % (15/20) |
| Têtes considérant pour un article attendu | 4/20 | 2/20 |
| Pièges cités par seuil (6) | 0/6 | 0/6 |

La bande est conservée : le top-1 progresse de 5 points et le top-5 ne perd rien. Les deux têtes considérant restantes sont `art_20` derrière `rct_68` et `art_25` derrière `rct_78` ; leurs similarités ne sont pas dans la bande.

## Confiance calibrée sur dev (phase 3)

Les seuils sont calibrés sur les 35 questions `dev` uniquement, puis figés avant toute mesure `test` : `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`. La marge est non nulle et l'écart doit être strictement supérieur à 0,01 pour parler de confiance.

`confiant` ne porte que sur la similarité du premier passage et son avance sur le second ; il ne dit jamais que l'article attendu est en tête, ni que la réponse est juste. La marge sépare le premier du second passage, pas le vrai du faux : une réponse `confiante` peut rester le mauvais article.

### Développement (réglage)

| Métrique `dev` | Valeur |
| --- | --- |
| Recherche sémantique (20) | `recall@5` 1,000 (20/20), `MRR` 0,858, top-1 75,0 % |
| Niveaux sémantiques | 14 confiant, 6 incertain (30,0 %), 0 aucun_resultat_fiable |
| Pièges par seuil (6) | 0 cité, 0 marqué confiant |

### Test (constat, seuils figés)

| Métrique `test` | Valeur |
| --- | --- |
| Recherche sémantique (8) | `recall@5` 0,750 (6/8), `MRR` 0,750, top-1 75,0 % |
| Niveaux sémantiques | 4 confiant, 4 incertain (50,0 %), 0 aucun_resultat_fiable |
| Pièges par seuil (3) | 0 cité, 0 marqué confiant |
| Paraphrase « droit de récupérer mes données » → `art_20` | hors des cinq premiers (top 5 : non) |

Quatre des huit questions sémantiques `test` tombent en `incertain` : leur premier passage est proche du second ou reste entre les deux seuils. Aucun seuil n'a été retouché après la mesure `test`.


