# Évaluation du serveur MCP RGPD v2

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local. Ce rapport est distinct de celui de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) : les deux jeux ne sont jamais fusionnés.

Le jeu `mcp/eval/questions-v2.csv` compte 60 questions écrites contre le texte du corpus : 12 références exactes, 38 conceptuelles et 10 pièges. 30 questions servent au développement (`dev`) et règlent les seuils ; 30 questions sont tenues à l'écart (`test`) et ne seront mesurées qu'une fois, après la fin des corrections. La paraphrase « droit de récupérer mes données » est dans `test`, attendue sur `32016R0679#art_20`.

## Périmètre de l'évaluation : un document par jeu

L'index peut porter plusieurs corpus. Une question RGPD cherchée sur tout l'index concourrait donc aussi contre les unités de l'AI Act, et `dev` comme `test` mesureraient une tâche plus difficile que celle du rapport. Pour que les deux splits voient les mêmes conditions, le document de chaque jeu est déduit du préfixe des `sources_attendues` (avant `#`), puis passé à `search(..., { document })`. Un jeu qui mélange deux documents est refusé ; les pièges sans référence héritent du document des autres lignes. La recherche du produit, elle, ne filtre que si `document` ou la question nomme un corpus ; le banc d'évaluation, lui, est toujours filtré. **Cette recherche mixte par défaut n'est mesurée par aucun chiffre de ce rapport** : aucune mesure mêlant les deux corpus n'a été produite.

Le jeu `questions-aiact.csv` suit la même règle et se mesure avec `document = 32024R1689` ; son rapport est séparé.

## Base `dev` avant correction (phase 1)

Système d'avant la recherche hybride : voie dense seule, seuils calibrés sur les 30 questions `dev`. Le split `test` n'est pas mesuré ici.

| Métrique `dev` | Valeur |
| --- | --- |
| Références exactes (6) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (19), brut | `recall@5` 0,947 (18/19), `MRR` 0,860 |
| Top-1 sémantique, brut | 78,9 % (15/19) |
| `incertain` (rendu) | 2/19 (10,5 %) |
| Pièges par seuil (4, rendus) | 0 cité, 0 marqué confiant |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Seuils calibrés sur `dev` | `bas = 0,680`, `haut = 0,730`, `marge = 0,010` |

La question sémantique manquée est « autorité de contrôle chef de file » : `art_56` est absent des cinq premiers et `art_51` passe en tête. Trois têtes de considérant précèdent l'article attendu (`art_25` derrière `rct_78`, `art_47` derrière `rct_110`, `art_89` derrière `rct_159`) ; leurs écarts de similarité dépassent la bande article.

## Recherche hybride : mesure `dev` (phase 2)

La table `fts_unites` partage le `rowid` de `unites` et suit le même delta (ajout, modification, suppression) dans la même transaction. `rechercheHybride` prend jusqu'à 50 candidats denses et jusqu'à 50 lexicaux (davantage si `k` dépasse 50 ; sous filtre document, la voie dense interroge l'index global avant de filtrer et peut en rendre moins ; l'évaluation mesure `k = 5`), applique la bande article à l'ordre dense, puis fusionne par `1 / (60 + rang)`. La distance rendue reste la distance dense brute ; un candidat purement lexical reçoit sa distance cosinus calculée contre le vecteur de la requête.

| Métrique `dev` (19 questions sémantiques) | Dense seule | Hybride | Écart |
| --- | --- | --- | --- |
| `recall@5`, brut | 0,947 (18/19) | 1,000 (19/19) | +1 question |
| Top-1, brut | 78,9 % (15/19) | 52,6 % (10/19) | −26,3 points |
| `MRR`, brut | 0,860 | 0,732 | −0,128 |
| `incertain` (rendu) | 2/19 | 7/19 | +5 |
| Pièges cités par seuil (4, rendus) | 0/4 | 0/4 | inchangé |
| Pièges marqués confiant (rendus) | 0 | 0 | inchangé |
| Seuils calibrés sur `dev` | 0,680 / 0,730 / 0,010 | 0,640 / 0,690 / 0,010 | plus permissifs |

L'hybride rattrape la seule question manquée par la voie dense (« autorité de contrôle chef de file », `art_56`, rang 1), mais il fait reculer sept articles attendus : six perdent le rang 1 — `art_5` du rang 1 au rang 2, `art_14` au rang 3, `art_30` au rang 3, `art_35` au rang 2, `art_39` au rang 2 et `art_58` du rang 1 au rang 2 — et `art_89` recule du rang 3 au rang 4. Les `OR` lexicaux ramènent des articles qui partagent un mot courant et le RRF les place devant l'article dense le plus proche. Le top 5 gagne une question, le top 1 et le MRR perdent nettement, et les seuils devraient descendre à `0,640 / 0,690` pour continuer à rendre des passages — donc `confiant` deviendrait plus permissif.

**Décision : l'hybride n'est pas retenu comme voie par défaut.** Le critère « top 5 ou top 1 progresse et pièges à zéro » est techniquement satisfait par le top 5, mais le système global dégrade : −26,3 points de top 1, −0,128 de MRR, cinq questions de plus en `incertain`, et des seuils plus bas. Le critère de sécurité « si l'hybride dégrade, revenir au dense » l'emporte. `search` garde la voie dense par défaut ; `rechercheHybride` et la table `fts_unites` restent dans le code et se mesurent avec `--recherche hybride`, sans être branchés sur le produit.

Les seuils du produit restent donc ceux figés par l'évaluation v1, `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01` : aucune recalibration n'est justifiée puisque l'hybride n'est pas conservé. La calibration `dev` v2 de la voie dense (0,680 / 0,730 / 0,010) est un résultat de mesure, pas un nouveau réglage : elle n'est pas écrite dans `mcp/confidence.ts`.

## Système figé avant la mesure `test`

Après l'ingestion de l'AI Act, l'index porte 565 unités (272 RGPD, 293 AI Act). La mesure `dev` v2 a été rejouée sur cet index final, avec le document `32016R0679` : les chiffres sont identiques à ceux du tableau ci-dessus (`recall@5` brut 0,947, top-1 brut 78,9 %, `MRR` brut 0,860, 2 `incertain` rendus, 0/4 pièges cités). L'hybride rejoué donne aussi les mêmes chiffres (1,000 / 52,6 % / 0,732 / 7 `incertain`). Le filtrage par document rend donc `dev` et `test` comparables malgré le second corpus.

État figé au moment de la mesure `test` : voie dense par défaut, bande article `0,02`, `SEUIL_BAS = 0,69`, `SEUIL_HAUT = 0,74`, `MARGE = 0,01`, aucune recalibration liée à l'hybride puisque celui-ci n'est pas retenu.

## Limite du banc : vivier tronqué sous filtre document

`search` demande `max(10 * k, 50)` candidats à `sqlite-vec` sur tout l'index, puis filtre par document. Sous `document = 32016R0679`, le vivier RGPD n'est donc pas garanti à 50 : mesuré sur `dev` avec les 19 questions sémantiques, il va de 41 à 50 candidats (moyenne 49,1) ; en incluant les quatre pièges par seuil, il va de 21 à 50. La part dépend de la question, pas seulement du nombre d'unités indexées.

Sur ces 19 questions sémantiques, une surlecture jetable à 200 candidats globaux, filtrée puis classée par la même bande article, rend 138 à 200 candidats RGPD. Les chiffres `dev` sont identiques : `recall@5` brut 0,947 (18/19), top-1 brut 78,9 % (15/19), `MRR` brut 0,860, 2 `incertain` rendus et 0/4 pièges cités. Le delta mesuré sur `dev` est donc nul ; il n'est pas publié comme correction des chiffres.

La mesure `test` publiée ci-dessous a été faite avec le vivier tronqué du chemin produit, pas avec cette surlecture. Le vivier `test` n'a pas été re-mesuré et peut être plus étroit que celui de `dev`. Ce choix peut sous-estimer ou déformer son top 5 ; seul un v3 mesuré sur un nouveau jeu tenu à l'écart pourrait trancher. Aucun chiffre `test` de ce rapport n'est corrigé. Ce n'est pas un défaut du produit : la recherche non filtrée ne tronque pas par document et rend bien ses cinq passages.

## Mesure `test` (une seule fois)

Mesure du 5 novembre 2026, après la fin des corrections, avec les seuils figés `0,69 / 0,74 / 0,01`, la bande article `0,02`, la voie dense par défaut et `document = 32016R0679`. L'index porte 565 unités (272 RGPD, 293 AI Act). Aucune question `test` n'a servi à régler un seuil, la décision hybride, le nombre de candidats lexicaux ou la bande article ; aucune mesure `test` n'a été rejouée. Le split `dev` avait été rejoué sur l'index final avant cette mesure (section précédente).

Deux lectures des mêmes 19 questions sémantiques sont distinguées :

- **brute** : le rang avant le filtre de confiance, celui que mesurent `recall@5`, le top 1 et le `MRR` ;
- **rendue** : ce que `search` rend réellement — aucun passage si le premier est sous `SEUIL_BAS`, sinon les cinq passages, y compris ceux dont la similarité est sous le seuil.

| Métrique `test` | Rendu au produit | Brut (classement) |
| --- | --- | --- |
| Références exactes (6) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 | identique |
| Recherche sémantique (19) | `recall@5` 0,895 (17/19), `MRR` 0,853 | `recall@5` 0,947 (18/19), `MRR` 0,905 |
| Top-1 sémantique | 84,2 % (16/19) | 89,5 % (17/19) |
| Niveaux sémantiques | 14 confiant, 4 incertain, 1 aucun_resultat_fiable | — |
| Top 5 global, hors pièges (25) | 92,0 % (23/25), IC 95 % de Wilson 75,0 %–97,8 % | 96,0 % (24/25), IC 95 % de Wilson 80,5 %–99,3 % |
| Top 5 sémantique seul (19) | 89,5 % (17/19), IC 95 % de Wilson 68,6 %–97,1 % | 94,7 % (18/19), IC 95 % de Wilson 75,4 %–99,1 % |
| Pièges cités par seuil (5) | 1/5 (20,0 %), IC 95 % de Wilson 3,6 %–62,4 % | — |
| Piège déterministe | aucun dans ce split | identique |
| Pièges marqués confiant | 0 | — |

**La paraphrase `art_20` n'est pas seulement hors du top 5 : elle est rendue `confiant`.** « droit de récupérer mes données » place `art_15` en tête à `0,770` ; `art_20` est absent. Avec `SEUIL_HAUT = 0,74` et `MARGE = 0,01`, l'écart de `0,027` avec le deuxième passage suffit : le niveau rendu est `confiant`. Une réponse fausse a donc atteint l'utilisateur avec l'étiquette de confiance la plus forte dans le split tenu à l'écart. C'est le même échec de classement que dans l'évaluation v1 avec `0.6b`, mais la couche de confiance ne le rattrape pas ici.

**L'unique `aucun_resultat_fiable` est `art_80`, « représentation des personnes concernées par un organisme ».** Son rang brut est 1, mais sa similarité de tête est `0,677`, sous `SEUIL_BAS = 0,69` : le produit ne rend aucun passage. Le classement brut le compte pourtant comme un succès top 5, d'où les 18/19 bruts ; la lecture rendue tombe à 17/19. C'est la deuxième défaillance visible, et elle n'apparaissait pas dans la narration précédente.

Détail par question, dans l'ordre du fichier. Le rang, la similarité du 1er passage et la similarité de la référence attendue sont ceux du classement brut ; le niveau est celui que `search` rend.

| Question sémantique (`test`) | Référence attendue | Rang | Similarité du 1er passage | Similarité de la référence attendue | Niveau rendu |
| --- | --- | --- | --- | --- | --- |
| droit de récupérer mes données | `art_20` | absent | 0,770 | — (absente) | `confiant` |
| accès à une copie des données détenues par une entreprise | `art_15` | 1 | 0,770 | 0,770 | `incertain` |
| effacement des données et retrait des liens des moteurs de recherche | `art_17` | 1 | 0,846 | 0,846 | `confiant` |
| limitation du traitement pendant une vérification | `art_18` | 1 | 0,770 | 0,770 | `incertain` |
| notification d'une violation à l'autorité de contrôle | `art_33` | 1 | 0,774 | 0,774 | `confiant` |
| communication d'une violation aux personnes concernées | `art_34` | 1 | 0,776 | 0,776 | `confiant` |
| certification des traitements de données | `art_42` | 1 | 0,854 | 0,854 | `confiant` |
| transfert vers un pays tiers sans décision d'adéquation | `art_46` | 5 | non enregistrée | 0,719 | `confiant` |
| indépendance des autorités de contrôle | `art_52` | 1 | 0,768 | 0,768 | `incertain` |
| coopération entre autorités de contrôle | `art_60` | 1 | 0,801 | 0,801 | `confiant` |
| comité européen de la protection des données | `art_68` | 1 | 0,809 | 0,809 | `confiant` |
| recours effectif devant une juridiction contre une autorité | `art_78` | 1 | 0,803 | 0,803 | `confiant` |
| représentation des personnes concernées par un organisme | `art_80` | 1 brut (aucun passage rendu) | 0,677 | 0,677 | `aucun_resultat_fiable` |
| traitement des données dans le cadre de l'emploi | `art_88` | 1 | 0,858 | 0,858 | `confiant` |
| liberté d'expression et protection des données | `art_85` | 1 | 0,877 | 0,877 | `confiant` |
| accès du public aux documents officiels | `art_86` | 1 | 0,799 | 0,799 | `incertain` |
| numéro d'identification national | `art_87` | 1 | 0,862 | 0,862 | `confiant` |
| églises et associations religieuses | `art_91` | 1 | 0,845 | 0,845 | `confiant` |
| entrée en vigueur du règlement | `art_99` | 1 | 0,833 | 0,833 | `confiant` |

« Transfert vers un pays tiers sans décision d'adéquation » place `art_46` au rang 5, derrière `art_45` en tête : la référence attendue reste dans le top 5 brut, avec une similarité de `0,719`, et le niveau rendu est `confiant` parce que le premier passage dépasse le seuil haut. La similarité du premier passage n'est pas enregistrée dans la mesure.

Un piège est cité : « Quelles sanctions prévoit la directive 95/46/CE ? » rend au moins un passage au-dessus du seuil bas. Aucun piège n'est marqué `confiant`. Ce résultat est rapporté tel quel : le taux de citations invalides passe de 0/4 en `dev` à 1/5 en `test`, avec un intervalle large (3,6 %–62,4 %) qui interdit d'en tirer une tendance.

La mesure est consommée : `mcp/eval/questions-v2.test-consomme.json` en est la trace de consommation. Il enregistre la date, l'empreinte `sha256` du fichier de questions (`1795dbd1…`), le modèle, la voie dense, les agrégats bruts (`top5_semantique_brut`, `top1_semantique_brut`, `mrr_semantique_brut`, `top5_global_brut`), les agrégats rendus sémantiques (`top5_rendu`, `top1_rendu`, `mrr_rendu`) et global (`top5_global_rendu`), les niveaux, les pièges confiants, les seuils, la bande article, les intervalles de Wilson, les snapshots des deux corpus et le nombre d'unités. Il ne porte pas le détail par question. Ses champs ont été transcrits de cette mesure unique, pas d'une nouvelle exécution : le champ `note` le dit. Les agrégats rendus sont dérivés du tableau par question : l'unique refus (`art_80`, rang brut 1) retire 1 au top 5 sémantique (18 → 17), 1 au top 1 (17 → 16), 1 au top 5 global (24 → 23) et 1 au MRR brut (17,2 → 16,2 sur 19). Une seconde exécution de `--split test --mesurer-test` refuse avant tout appel au modèle. Le marqueur est commité : c'est une trace de consommation.

Le marqueur est une trace de consommation, pas une preuve d'exécution : supprimer le fichier ou copier le CSV sous un autre nom contourne le garde. C'est délibéré. Le garde arrête une seconde exécution accidentelle ; il ne prouve pas la bonne foi de l'opérateur.

Ce rapport ne fusionne jamais ses chiffres avec ceux de l'évaluation v1 : 50 questions d'un côté, 60 de l'autre, deux dates et deux jeux distincts.
