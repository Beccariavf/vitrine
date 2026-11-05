# Évaluation du serveur MCP AI Act

Mesure du 5 novembre 2026 sur le corpus `data/corpus/aiact/` : 113 articles et 180 considérants (293 unités), ingérés par la même route CELLAR que le RGPD (CELEX `32024R1689`, XHTML français, 1 383 324 octets). L'index `data/corpus/index/index.db` porte les deux corpus : 272 unités RGPD et 293 unités AI Act, avec `qwen3-embedding:0.6b` (1024 dimensions) et Ollama 0.40.14 local.

Le jeu `mcp/eval/questions-aiact.csv` compte 12 questions écrites contre le texte : 7 références exactes, 3 conceptuelles et 2 pièges. Chaque question est cherchée avec `document = 32024R1689`, déduit du préfixe de ses références attendues : le RGPD ne concourt pas. Aucun seuil n'est propre à l'AI Act ; les seuils figés du RGPD s'appliquent (`SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`), et le jeu sans colonne `split` ne calibre rien.

**Douze questions ne classent pas le corpus.** Ce rapport prouve que l'ingestion, l'index, le filtrage par document et la provenance fonctionnent sur un second acte ; il ne donne ni un taux de qualité comparable au RGPD ni une base de réglage.

| Métrique | Valeur |
| --- | --- |
| Références exactes (7) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (3) | `recall@5` 0,667 (2/3), `MRR` 0,500 |
| Top-1 sémantique | 33,3 % (1/3) |
| Niveaux sémantiques | 0 confiant, 1 incertain, 2 aucun_resultat_fiable |
| Pièges cités par seuil (1) | 0/1 |
| Piège déterministe (1) | « Que prévoit l'article 120 du règlement sur l'intelligence artificielle ? », refusé par la branche article absent |

Détail des trois questions sémantiques :

- « évaluation ou classification des personnes selon leur comportement social » → `art_5` absent des cinq premiers ; `rct_31` passe en tête. La formulation attendue est celle de l'article 5, paragraphe 1, point c), mais le considérant 31 la précède dans l'index.
- « évaluation de la conformité d'un système d'IA à haut risque » → `art_43` au rang 2, derrière `art_42` (`0,851`, `incertain`).
- « analyse d'impact sur les droits fondamentaux avant le déploiement » → `art_27` au rang 1, mais sa similarité (`0,654`) reste sous le seuil bas : le passage est refusé plutôt que présenté comme fiable.

La capture CELLAR compte 13 chapitres (`cpt_I` à `cpt_XIII`), alors que le plan en annonçait 12. Le parseur ne valide que les comptes d'articles et de considérants ; le nombre de chapitres n'entre dans aucun contrôle.
