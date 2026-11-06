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

## Index incrémental (phase 4)

Chaque unité porte une empreinte `sha256` du modèle, de la dimension et du passage contextualisé (`chemin` + `texte`). La construction compare `ref → rowid, empreinte` avant d'embarquer : seules les unités ajoutées ou modifiées reçoivent un vecteur ; les unités supprimées perdent leur ligne et leur vecteur ; les autres gardent leurs octets.

Sur le corpus réel (272 unités), avec `qwen3-embedding:0.6b` et Ollama 0.40.14 :

| Passage | Mode | Embarquées | Delta | Durée |
| --- | --- | --- | --- | --- |
| Premier après la migration (index sans empreinte) | complet | 272 | 272 ajoutées, 0 modifiée, 0 supprimée, 0 inchangée | 19,6 s |
| Deuxième, corpus inchangé | incrémental | 0 | 0 ajoutée, 0 modifiée, 0 supprimée, 272 inchangées | 0,12 s |
| Troisième, corpus inchangé | incrémental | 0 | 0 ajoutée, 0 modifiée, 0 supprimée, 272 inchangées | 0,12 s |

L'empreinte `sha256` de la concaténation des 272 vecteurs vaut `e58dffad232bf139d088b69fe5af4abb1a1e5b5b7d8da5954387c256b10bdafc` avant et après le troisième passage : les vecteurs inchangés sont identiques octet pour octet. Les nouveaux `rowid` sont attribués après le maximum existant, jamais par position ; changer de modèle ou de dimension reconstruit l'index complet avec une raison explicite.

## Résultats finaux

Seuils figés : `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01` ; bande article `0,02`.

| Métrique | `dev` (35, réglage) | `test` (15, constat) |
| --- | --- | --- |
| Références exactes | 8, rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 | 4, rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique | 20, `recall@5` 1,000 (20/20), `MRR` 0,858 | 8, `recall@5` 0,750 (6/8), `MRR` 0,750 |
| Top-1 sémantique | 75,0 % (15/20) | 75,0 % (6/8) |
| `incertain` | 6/20 (30,0 %) | 4/8 (50,0 %) |
| Pièges par seuil | 6, 0 cité, 0 confiant | 3, 0 cité, 0 confiant |
| Piège déterministe | 1 (« article 100 ») refusé | 0 |

Le critère de 90 % n'est pas atteint sur `test` : 10 des 12 questions hors piège (83,3 %) ont leur référence attendue dans les cinq premiers — 4/4 en exact et 6/8 en sémantique. En revanche, aucune question piège n'est citée ni marquée `confiant`. La paraphrase « droit de récupérer mes données » reste hors des cinq premiers avec `0.6b`.

## Expérience `qwen3-embedding:4b` (hors produit)

Le produit garde `qwen3-embedding:0.6b` (1024 dimensions). L'expérience `4b` est reproduite dans une racine temporaire, sans toucher l'index du produit.

| Modèle | Dimensions | Indexation des 272 unités | Rang de `art_20` sur « droit de récupérer mes données » |
| --- | --- | --- | --- |
| `qwen3-embedding:0.6b` | 1024 | 19,3 s | absent du top 5 (`art_15`, `art_13`, `rct_65`, `rct_63`, `art_17`) |
| `qwen3-embedding:4b` | 2560 | 129,6 s | rang 2 (`art_15`, `art_20`, `rct_68`, `art_12`, `art_13`) |

Le rang 2 confirme que la limite de paraphrase vient du modèle, pas de l'architecture : la même recherche, le même corpus et la même bande article placent `art_20` au rang 2 avec `4b` et l'absentent du top 5 avec `0.6b`. En revanche, `4b` indexe 6,7 fois plus lentement et rend 2560 dimensions, pas 1024 comme l'annonçait la source externe du plan ; il n'est donc pas le modèle du produit. Le plan citait 138 s pour `4b` et 10 s pour `0.6b` : la mesure du jour donne 129,6 s et 19,3 s, avec le même rang.

## Limites

- La paraphrase reste un échec mesuré avec `0.6b` : `art_15` (droit d'accès) devance `art_20` (portabilité), et `art_20` sort des cinq premiers.
- La précision au rang 1 reste de 75 % sur `dev` et `test` : un article attendu peut être derrière un considérant ou un autre article.
- L'échantillon `test` ne compte que 15 questions, dont 8 sémantiques : les taux valent pour le RGPD, pas pour un corpus plus large ni pour la CNIL.
- Les seuils sont calibrés sur 35 questions `dev` ; la bande article est mesurée sur `dev` et `0,02` est retenue pour rester minimale. La marge de 0,01 est étroite et `incertain` dépend d'écarts de similarité faibles.
- `confiant` porte sur la similarité du premier passage, pas sur la correction : une réponse `confiante` peut citer le mauvais article.
- La recherche sémantique exige un index construit ; sans index, seul le court-circuit d'un article exact fonctionne.
