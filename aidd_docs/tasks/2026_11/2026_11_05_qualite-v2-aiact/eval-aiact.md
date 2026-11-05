# Évaluation du serveur MCP AI Act

Mesure du 5 novembre 2026 sur le corpus `data/corpus/aiact/` : 113 articles et 180 considérants (293 unités), ingérés par la même route CELLAR que le RGPD (CELEX `32024R1689`, XHTML français, 1 383 324 octets). L'index `data/corpus/index/index.db` porte les deux corpus : 272 unités RGPD et 293 unités AI Act, avec `qwen3-embedding:0.6b` (1024 dimensions) et Ollama 0.40.14 local.

Le jeu `mcp/eval/questions-aiact.csv` compte 12 questions écrites contre le texte : 7 références exactes, 3 conceptuelles et 2 pièges. Chaque question est cherchée avec `document = 32024R1689`, déduit du préfixe de ses références attendues : le RGPD ne concourt pas. Aucun seuil n'est propre à l'AI Act ; les seuils figés du RGPD s'appliquent (`SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`), et le jeu sans colonne `split` ne calibre rien.

La requête porte désormais sa propre instruction, choisie par document : le document RGPD garde mot pour mot l'instruction mesurée en v1, `32024R1689` reçoit « Instruction : retrouve les passages du règlement européen sur l'intelligence artificielle qui répondent à la question ». Le tableau ci-dessous est mesuré après ce changement ; l'instruction du RGPD n'a pas bougé, donc ses vecteurs de requête restent identiques.

**Douze questions ne classent pas le corpus.** Ce rapport prouve que l'ingestion, l'index, le filtrage par document et la provenance fonctionnent sur un second acte ; il ne donne ni un taux de qualité comparable au RGPD ni une base de réglage.

| Métrique | Avant l'instruction AI Act | Après l'instruction AI Act |
| --- | --- | --- |
| Références exactes (7) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 | identique |
| Recherche sémantique (3) | `recall@5` 0,667 (2/3), `MRR` 0,500 | `recall@5` 0,667 (2/3), `MRR` 0,278 |
| Top-1 sémantique | 33,3 % (1/3) | 0,0 % (0/3) |
| Niveaux sémantiques | 0 confiant, 1 incertain, 2 aucun_resultat_fiable | 0 confiant, 3 incertain, 0 aucun_resultat_fiable |
| Pièges cités par seuil (1) | 0/1 | 0/1 |
| Piège déterministe (1) | « Que prévoit l'article 120 du règlement sur l'intelligence artificielle ? », refusé par la branche article absent | identique |

Le changement d'instruction ne sauve pas la question « évaluation ou classification des personnes selon leur comportement social » (`art_5` reste absent, `rct_31` en tête) et fait reculer le top 1 : `art_43` passe du rang 2 au rang 3, `art_27` du rang 1 au rang 2. Il ne rend plus aucun résultat totalement refusé, mais il remonte `rct_48` devant `art_27` : le passage rendu reste `incertain`, et l'article attendu, à 0,685, est sous le seuil bas. Le `MRR` baisse de 0,500 à 0,278 ; le `recall@5` ne bouge pas.

Détail des trois questions sémantiques :

- « évaluation ou classification des personnes selon leur comportement social » → `art_5` absent des cinq premiers ; `rct_31` passe en tête. La formulation attendue est celle de l'article 5, paragraphe 1, point c), mais le considérant 31 la précède dans l'index. L'instruction AI Act ne change pas ce classement.
- « évaluation de la conformité d'un système d'IA à haut risque » → `art_43` au rang 3, derrière `art_42` (`0,859`, `incertain`) ; le rang recule d'un cran après le changement d'instruction.
- « analyse d'impact sur les droits fondamentaux avant le déploiement » → `art_27` au rang 2, derrière `rct_48` ; le premier passage rendu est `incertain`, et la similarité de `art_27` (`0,685`) reste sous le seuil bas. Avant le changement d'instruction, `art_27` était au rang 1 avec `0,654` et le passage était refusé.

La capture CELLAR compte 13 chapitres (`cpt_I` à `cpt_XIII`), alors que le plan en annonçait 12. Le parseur ne valide que les comptes d'articles et de considérants ; le nombre de chapitres n'entre dans aucun contrôle.
