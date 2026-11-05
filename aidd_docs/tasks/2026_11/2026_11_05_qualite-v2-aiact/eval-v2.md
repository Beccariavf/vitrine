# Évaluation du serveur MCP RGPD v2

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local. Ce rapport est distinct de celui de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) : les deux jeux ne sont jamais fusionnés.

Le jeu `mcp/eval/questions-v2.csv` compte 60 questions écrites contre le texte du corpus : 12 références exactes, 38 conceptuelles et 10 pièges. 30 questions servent au développement (`dev`) et règlent les seuils ; 30 questions sont tenues à l'écart (`test`) et ne seront mesurées qu'une fois, après la fin des corrections. La paraphrase « droit de récupérer mes données » est dans `test`, attendue sur `32016R0679#art_20`.

## Périmètre de l'évaluation : un document par jeu

L'index peut porter plusieurs corpus. Une question RGPD cherchée sur tout l'index concourrait donc aussi contre les unités de l'AI Act, et `dev` comme `test` mesureraient une tâche plus difficile que celle du rapport. Pour que les deux splits voient les mêmes conditions, le document de chaque jeu est déduit du préfixe des `sources_attendues` (avant `#`), puis passé à `search(..., { document })`. Un jeu qui mélange deux documents est refusé ; les pièges sans référence héritent du document des autres lignes. La recherche par défaut du produit, elle, peut toujours couvrir tous les corpus : seul le banc d'évaluation est filtré.

Le jeu `questions-aiact.csv` suit la même règle et se mesure avec `document = 32024R1689` ; son rapport est séparé.

## Base `dev` avant correction (phase 1)

Système d'avant la recherche hybride : voie dense seule, seuils calibrés sur les 30 questions `dev`. Le split `test` n'est pas mesuré ici.

| Métrique `dev` | Valeur |
| --- | --- |
| Références exactes (6) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (19) | `recall@5` 0,947 (18/19), `MRR` 0,860 |
| Top-1 sémantique | 78,9 % (15/19) |
| `incertain` | 2/19 (10,5 %) |
| Pièges par seuil (4) | 0 cité, 0 marqué confiant |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Seuils calibrés sur `dev` | `bas = 0,680`, `haut = 0,730`, `marge = 0,010` |

La question sémantique manquée est « autorité de contrôle chef de file » : `art_56` est absent des cinq premiers et `art_51` passe en tête. Trois têtes de considérant précèdent l'article attendu (`art_25` derrière `rct_78`, `art_47` derrière `rct_110`, `art_89` derrière `rct_159`) ; leurs écarts de similarité dépassent la bande article.

## Recherche hybride : mesure `dev` (phase 2)

La table `fts_unites` partage le `rowid` de `unites` et suit le même delta (ajout, modification, suppression) dans la même transaction. `rechercheHybride` prend 50 candidats denses et 50 candidats lexicaux, applique la bande article à l'ordre dense, puis fusionne par `1 / (60 + rang)`. La distance rendue reste la distance dense brute ; un candidat purement lexical reçoit sa distance cosinus calculée contre le vecteur de la requête.

| Métrique `dev` (19 questions sémantiques) | Dense seule | Hybride | Écart |
| --- | --- | --- | --- |
| `recall@5` | 0,947 (18/19) | 1,000 (19/19) | +1 question |
| Top-1 | 78,9 % (15/19) | 52,6 % (10/19) | −26,3 points |
| `MRR` | 0,860 | 0,732 | −0,128 |
| `incertain` | 2/19 | 7/19 | +5 |
| Pièges cités par seuil (4) | 0/4 | 0/4 | inchangé |
| Pièges marqués confiant | 0 | 0 | inchangé |
| Seuils calibrés sur `dev` | 0,680 / 0,730 / 0,010 | 0,640 / 0,690 / 0,010 | plus permissifs |

L'hybride rattrape la seule question manquée par la voie dense (« autorité de contrôle chef de file », `art_56`, rang 1), mais il fait reculer cinq articles attendus : `art_5` du rang 1 au rang 2, `art_14` au rang 3, `art_30` au rang 3, `art_35` au rang 2, `art_39` au rang 2. Les `OR` lexicaux ramènent des articles qui partagent un mot courant et le RRF les place devant l'article dense le plus proche. Le top 5 gagne une question, le top 1 et le MRR perdent nettement, et les seuils devraient descendre à `0,640 / 0,690` pour continuer à rendre des passages — donc `confiant` deviendrait plus permissif.

**Décision : l'hybride n'est pas retenu comme voie par défaut.** Le critère « top 5 ou top 1 progresse et pièges à zéro » est techniquement satisfait par le top 5, mais le système global dégrade : −26,3 points de top 1, −0,128 de MRR, cinq questions de plus en `incertain`, et des seuils plus bas. Le critère de sécurité « si l'hybride dégrade, revenir au dense » l'emporte. `search` garde la voie dense par défaut ; `rechercheHybride` et la table `fts_unites` restent dans le code et se mesurent avec `--recherche hybride`, sans être branchés sur le produit.

Les seuils du produit restent donc ceux figés par l'évaluation v1, `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01` : aucune recalibration n'est justifiée puisque l'hybride n'est pas conservé. La calibration `dev` v2 de la voie dense (0,680 / 0,730 / 0,010) est un résultat de mesure, pas un nouveau réglage : elle n'est pas écrite dans `mcp/confidence.ts`.

## Système figé avant la mesure `test`

Après l'ingestion de l'AI Act, l'index porte 565 unités (272 RGPD, 293 AI Act). La mesure `dev` v2 a été rejouée sur cet index final, avec le document `32016R0679` : les chiffres sont identiques à ceux du tableau ci-dessus (`recall@5` 0,947, top-1 78,9 %, `MRR` 0,860, 2 `incertain`, 0/4 pièges cités). L'hybride rejoué donne aussi les mêmes chiffres (1,000 / 52,6 % / 0,732 / 7 `incertain`). Le filtrage par document rend donc `dev` et `test` comparables malgré le second corpus.

État figé au moment de la mesure `test` : voie dense par défaut, bande article `0,02`, `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`, aucune recalibration liée à l'hybride puisque celui-ci n'est pas retenu.

## Mesure `test` (une seule fois)

Mesure du 5 novembre 2026, après la fin des corrections, avec les seuils figés `0,69 / 0,74 / 0,01`, la bande article `0,02`, la voie dense par défaut et `document = 32016R0679`. L'index porte 565 unités (272 RGPD, 293 AI Act). Aucune question `test` n'a servi à régler un seuil, la décision hybride, le nombre de candidats lexicaux ou la bande article ; aucune mesure n'a été rejouée.

| Métrique `test` | Valeur |
| --- | --- |
| Références exactes (6) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (19) | `recall@5` 0,947 (18/19), `MRR` 0,905 |
| Top-1 sémantique | 89,5 % (17/19) |
| Niveaux sémantiques | 14 confiant, 4 incertain, 1 aucun_resultat_fiable |
| Top 5 global, hors pièges (25) | 96,0 % (24/25), IC 95 % de Wilson 80,5 %–99,3 % |
| Top 5 sémantique seul (19) | 94,7 % (18/19), IC 95 % de Wilson 75,4 %–99,1 % |
| Pièges cités par seuil (5) | 1/5 (20,0 %), IC 95 % de Wilson 3,6 %–62,4 % |
| Piège déterministe | aucun dans ce split |
| Pièges marqués confiant | 0 |

La question sémantique manquée est la paraphrase « droit de récupérer mes données » : `art_20` reste hors des cinq premiers, `art_15` passe en tête. C'est le même échec que dans l'évaluation v1 avec `0.6b`, constaté ici sur une question nouvelle du jeu v2. « Transfert vers un pays tiers sans décision d'adéquation » place `art_46` au rang 5, derrière `art_45` en tête : la référence attendue reste dans le top 5.

Un piège est cité : « Quelles sanctions prévoit la directive 95/46/CE ? » rend au moins un passage au-dessus du seuil bas. Aucun piège n'est marqué `confiant`. Ce résultat est rapporté tel quel : le taux de citations invalides passe de 0/4 en `dev` à 1/5 en `test`, avec un intervalle large (3,6 %–62,4 %) qui interdit d'en tirer une tendance.

La mesure est consommée : `mcp/eval/questions-v2.test-consomme.json` enregistre la date, l'empreinte `sha256` du fichier de questions (`1795dbd1…`), le modèle, la voie dense et les chiffres ci-dessus. Une seconde exécution de `--split test --mesurer-test` refuse avant tout appel au modèle. Le marqueur est commité : il est la preuve de la mesure unique.

Le marqueur est un engagement, pas une preuve d'exécution : supprimer le fichier ou copier le CSV sous un autre nom contourne le garde. C'est délibéré. Le garde arrête une seconde exécution accidentelle ; il ne prouve pas la bonne foi de l'opérateur.

Ce rapport ne fusionne jamais ses chiffres avec ceux de l'évaluation v1 : 50 questions d'un côté, 60 de l'autre, deux dates et deux jeux distincts.
