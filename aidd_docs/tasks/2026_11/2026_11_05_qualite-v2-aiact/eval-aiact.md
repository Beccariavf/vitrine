# Évaluation du serveur MCP AI Act

Mesure du 5 novembre 2026 sur le corpus `data/corpus/aiact/` : 113 articles et 180 considérants (293 unités), ingérés par la même route CELLAR que le RGPD (CELEX `32024R1689`, XHTML français, 1 383 324 octets). L'index `data/corpus/index/index.db` porte les deux corpus : 272 unités RGPD et 293 unités AI Act, avec `qwen3-embedding:0.6b` (1024 dimensions) et Ollama 0.40.14 local.

Le jeu `mcp/eval/questions-aiact.csv` compte 12 questions écrites contre le texte : 7 références exactes, 3 conceptuelles et 2 pièges. Chaque question est cherchée avec `document = 32024R1689`, déduit du préfixe de ses références attendues : le RGPD ne concourt pas. Aucun seuil n'est propre à l'AI Act ; les seuils figés du RGPD s'appliquent (`SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`), et le jeu sans colonne `split` ne calibre rien.

La requête porte désormais sa propre instruction, choisie par document : le document RGPD garde mot pour mot l'instruction mesurée en v1, `32024R1689` reçoit « Instruction : retrouve les passages du règlement européen sur l'intelligence artificielle qui répondent à la question ». Le tableau ci-dessous compare l'état avant ce changement (instruction RGPD appliquée à l'AI Act) et l'état après (instruction AI Act) ; l'instruction du RGPD n'a pas bougé, donc ses vecteurs de requête restent identiques.

**Douze questions ne classent pas le corpus.** Ce rapport prouve que l'ingestion, l'index, le filtrage par document et la provenance fonctionnent sur un second acte ; il ne donne ni un taux de qualité comparable au RGPD ni une base de réglage.

| Métrique | Avant, rendu au produit | Avant, brut | Après, rendu au produit | Après, brut |
| --- | --- | --- | --- | --- |
| Références exactes (7) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 | identique | identique | identique |
| `recall@5` sémantique (3) | 1/3 (0,333) | 0,667 (2/3) | 2/3 (0,667) | 0,667 (2/3) |
| `MRR` sémantique (3) | 0,167 | 0,500 | 0,278 | 0,278 |
| Top-1 sémantique | 0/3 (0,0 %) | 33,3 % (1/3) | 0/3 (0,0 %) | 0,0 % (0/3) |
| Niveaux sémantiques (rendus) | 0 confiant, 1 incertain, 2 aucun_resultat_fiable | — | 0 confiant, 3 incertain, 0 aucun_resultat_fiable | — |
| Pièges cités par seuil (1, rendus) | 0/1 | — | 0/1 | — |
| Piège déterministe (1, rendu) | « Que prévoit l'article 120 du règlement sur l'intelligence artificielle ? », refusé par la branche article absent | — | identique | — |

Le changement d'instruction ne sauve pas la question « évaluation ou classification des personnes selon leur comportement social » (`art_5` reste absent, `rct_31` en tête) et fait reculer le top 1 brut : `art_43` passe du rang 2 au rang 3, `art_27` du rang 1 au rang 2. Il ne rend plus aucun résultat totalement refusé : le rappel rendu passe de 1/3 à 2/3 et le MRR rendu de 0,167 à 0,278. Le MRR brut, lui, baisse de 0,500 à 0,278 ; le `recall@5` brut ne bouge pas (2/3). Le top 1 est 0/3 dans les deux lectures. Il remonte aussi `rct_48` devant `art_27` : le niveau rendu reste `incertain`, et l'article attendu, à 0,685, est sous le seuil bas.

**Trois questions sémantiques ne distinguent pas les deux instructions : aucune conclusion de qualité n'est tirée.** Le changement est une correction de justesse documentaire — une requête AI Act ne demande plus des « passages du RGPD » — pas une amélioration de qualité démontrable sur trois questions.

Détail des trois questions sémantiques :

- « évaluation ou classification des personnes selon leur comportement social » → `art_5` absent des cinq premiers ; `rct_31` passe en tête. La formulation attendue est celle de l'article 5, paragraphe 1, point c), mais le considérant 31 la précède dans l'index. L'instruction AI Act ne change pas ce classement.
- « évaluation de la conformité d'un système d'IA à haut risque » → `art_43` au rang 3, derrière `art_42` ; `art_43`, à `0,859`, reste `incertain` ; le rang recule d'un cran après le changement d'instruction.
- « analyse d'impact sur les droits fondamentaux avant le déploiement » → `art_27` au rang 2, derrière `rct_48` ; le niveau rendu est `incertain`, et la similarité de `art_27` (`0,685`) reste sous le seuil bas. Avant le changement d'instruction, `art_27` était au rang 1 avec `0,654` et le passage était refusé.

La capture CELLAR compte 13 chapitres (`cpt_I` à `cpt_XIII`), le nombre que le plan retient désormais. Le parseur ne valide que les comptes d'articles et de considérants ; le nombre de chapitres n'entre dans aucun contrôle.
