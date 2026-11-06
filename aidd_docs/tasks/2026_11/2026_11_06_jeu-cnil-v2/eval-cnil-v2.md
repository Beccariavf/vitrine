# Évaluation du jeu CNIL v2

Mesure du 6 novembre 2026 sur `data/corpus/cnil/` : 249 délibérations de sanction, 6 342 fragments, toutes d'origine DINUM. Index `qwen3-embedding:0.6b` (1024 dimensions), 6 907 unités au total. Ce rapport est indépendant de `eval-cnil.md` (jeu de 20 questions), de `eval.md` (v1), `eval-v2.md` (v2), `eval-v3.md` (v3) et `eval-aiact.md` : les jeux ne sont jamais fusionnés et les scores ne se comparent pas.

## Protocole

`mcp/eval/questions-cnil-v2.csv` porte 50 questions, toutes de type `reference` et toutes vers un document entier (`CNILTEXT…` sans `#`) : 25 `dev` et 25 `test`. Le jeu a été écrit contre le texte des décisions, avant toute mesure, puis figé.

Trois formes sont interdites dans une question, et un test les refuse : l'identifiant `CNILTEXT…` de la cible, son numéro `SAN-…`, et un numéro d'article. Les deux premières donneraient une recherche lexicale déguisée ; la troisième déclencherait le court-circuit déterministe et un rang 1 par construction. Aucune question ne reprend le texte exact des jeux v1, v2, v3, AI Act ou CNIL de 20 questions. Une question du `dev` (`CNILTEXT000048967251`) reste proche de la question de 10 M€ du jeu de 20 ; le `test` n'en contient aucune. Le test automatique ne compare que le texte exact et ne détecte pas une paraphrase : cette proximité est signalée ici, pas filtrée par le garde.

Les seuils sont ceux du produit (`bas = 0,69`, `haut = 0,74`, `marge = 0,01`), passés explicitement aux deux splits. Aucun seuil n'est calibré sur ce jeu : il mesure le rappel documentaire, pas la bande de confiance. Le `test` retenu a été mesuré une seule fois, avec `--mesurer-test`, et laisse le marqueur `mcp/eval/questions-cnil-v2.test-consomme.json` (empreinte `7d9595df…`).

### Trois exécutions, un seul split retenu

L'histoire du `test` est en trois temps, et le rapport la donne entière plutôt que de ne garder que le chiffre final.

1. **Premier split** (empreinte `aa32d105…`) : 25 questions, mesuré 14/25. La vérification d'après mesure y a trouvé deux prémisses fausses et une formulation ambiguë : `CNILTEXT000049382214` décrit comme un détaillant de chaussures alors que la décision vise une chaîne de boutiques de matériel de télécommunication ; `CNILTEXT000050202759` décrit comme un manquement au secret des données de santé alors que la décision retient un manquement à l'article 66 de la loi Informatique et Libertés et au principe de licéité ; `CNILTEXT000051630617` décrit comme un annuaire, formulation qui n'était pas fausse mais qui a été remplacée par les faits de la décision (courriels et SMS de prospection pour environ 300 clients). Aucune cible n'a changé.
2. **Deuxième split** (empreinte `f09bd68a…`, commit `b442d14`) : le même jeu corrigé, mesuré 15/25. Une revue indépendante y a ensuite trouvé une cible encore fausse (`CNILTEXT000046693390` est un opérateur de télécommunication qui achète auprès de courtiers, pas un courtier), une paraphrase de la question « dix millions d'euros contre un groupe américain pour ses cookies » du jeu de 20, et une correction (Solocal) qui reprenait « environ 300 clients » du texte cible. Ce split est archivé dans `b442d14` et n'est pas utilisé.
3. **Split retenu** (empreinte `7d9595df…`) : 25 questions neuves, visant 25 documents que le `dev` n'utilise pas et qui n'avaient jamais été mesurés. Il a été mesuré une fois, et c'est le seul chiffre repris ci-dessous.

Cette substitution a un prix, écrit ici : le `test` retenu n'est pas préenregistré. Il a été écrit après les deux premières exécutions, donc après que l'auteur a vu quels types de formulation échouaient. Les cibles sont disjointes du `dev`, mais la formulation n'est pas aveugle à l'historique. C'est un jeu tenu à l'écart de la mise au point du produit, pas un jeu tenu à l'écart de toute connaissance de l'auteur. Deux splits antérieurs ont été consommés puis abandonnés : c'est un défaut de procédure, pas une force, et il est compté dans les limites.

## Résultats

Le `test` est la mesure principale ; `dev` est donné comme contrôle de stabilité.

| Métrique | `test` (25) | `dev` (25) |
| --- | --- | --- |
| Top 5 document | **64,0 % (16/25)**, IC 95 % 44,5–79,8 | 56,0 % (14/25), IC 95 % 37,1–73,3 |
| Top 1 document | **48,0 % (12/25)**, IC 95 % 30,0–66,5 | 28,0 % (7/25) |
| `MRR` | **0,560** | 0,374 |
| Niveaux | 10 confiant, 15 incertain, 0 aucun_resultat_fiable | 9 confiant, 16 incertain, 0 aucun_resultat_fiable |

Rangs du `test` : 12 au rang 1, 4 au rang 2, 0 au rang 3, 0 au rang 4, 0 au rang 5, 9 absents. Le `dev` est plus faible ; le `test` contient plus de faits chiffrés (57 millions, 82 millions, 40 000 clients, 170 000 comptes), ce qui peut expliquer une partie de l'écart. Ce n'est pas une preuve d'absence d'ajustement, seulement une différence de composition. Les 50 questions mises bout à bout donnent 30/50 (60,0 %, IC 95 % 46,2–72,4), mais ce total est descriptif : la mesure qui engage est celle du `test`.

## Ce qui échoue

Neuf questions du `test` ne rendent pas leur document dans les cinq passages. Les causes sont dans le corpus, pas dans l'index :

- **Motifs factuels presque identiques.** Une association de cours de français dont un défaut d'URL exposait des factures est confondue avec une autre association sanctionnée pour une fuite de factures (`CNILTEXT000028711042`) ; un détaillant d'électroménager dont une URL exposait des données est confondu avec une plateforme vidéo (`CNILTEXT000037273346`) ; une entreprise d'étanchéité qui filmait une salariée est confondue avec une autre affaire de vidéosurveillance (`CNILTEXT000029302625`). Ces décisions partagent le grief et le vocabulaire ; le vecteur ne les sépare pas.
- **Faits partagés.** Un service de livraison de repas qui prospecte des non-clients est confondu avec une ancienne décision de prospection (`CNILTEXT000029298773`) ; une société qui ne respecte pas le droit d'opposition est confondue avec une autre décision de droits des personnes (`CNILTEXT000024654305`) ; une société qui ne garantit pas le droit d'accès est confondue avec une décision qui traite des droits des personnes (`CNILTEXT000055022778`) ; un distributeur optique dont le site compte 170 000 comptes est confondu avec une décision sur un système mobile (`CNILTEXT000046907077`).
- **Formulations proches.** Une plateforme de VTC est confondue avec la décision sur un opérateur de télécommunication qui achète des données à des courtiers (`CNILTEXT000046693390`) ; une décision d'avertissement après une fuite d'adhésions est confondue avec un autre avertissement (`CNILTEXT000035272571`).

Aucun de ces échecs n'est un faux passage : le système rend un passage d'une autre décision réelle, jamais un document inexistant. Mais la citation reste fausse pour la question posée.

## Ce que le jeu de 20 questions disait

Le jeu de 20 questions (`eval-cnil.md`) rapportait 9/12 (75,0 %) sur les questions qui visent un document, et 1/6 sur les questions conceptuelles. Le jeu v2 ne reproduit pas ce 75 % : sur 25 questions documentaires, le `test` donne 64,0 %. Les deux intervalles se recouvrent (46,8–91,1 contre 44,5–79,8) : le 75 % n'est donc pas contredit, mais il n'est pas non plus établi, et il reposait sur douze questions dont plusieurs nommaient la partie et le montant.

Le jeu de 20 contient par ailleurs une question mal ciblée : « Quelle amende de 800 000 euros […] contre l'exploitant d'un site d'annonces immobilières ? » pointe `CNILTEXT000050202759`, qui est une décision contre un éditeur de logiciels médicaux, pas un site d'annonces immobilières. Le jeu v2 ne réutilise aucune des vingt questions et remplace cette mesure pour les questions documentaires. Le jeu de 20 reste la seule mesure des pièges et des questions conceptuelles.

## Limites

- **25 questions test ne classent pas le corpus.** L'intervalle du top 5 va de 44 % à 80 % : il interdit de dire si la recherche CNIL est « bonne » ou « mauvaise », et il ne permet pas de départager deux systèmes sans comparaison appariée.
- **Le `test` retenu n'est pas préenregistré.** Il a été écrit après une première exécution annulée ; les cibles sont neuves, la formulation ne l'est pas. Ce point est détaillé plus haut et n'est pas corrigeable a posteriori : seul un nouveau jeu écrit par quelqu'un qui n'a pas vu les résultats serait aveugle.
- **Questions écrites depuis le corpus.** Elles partagent des termes avec les décisions, ce qui peut gonfler le rappel par rapport à la formulation d'un utilisateur qui découvre le corpus. Les identifiants, numéros et articles sont exclus, pas le vocabulaire métier.
- **Succès au document, pas au fragment.** Une question réussit si un fragment de la bonne décision figure dans les cinq passages ; elle ne dit pas si le fragment cité répond à la question. Le jeu ne mesure pas la citation exacte.
- **Aucun piège.** Le comportement sur une question sans réponse reste mesuré par le jeu de 20 questions, pas par celui-ci.
- **Confiance non calibrée.** Les seuils sont ceux du produit ; aucune question n'est refusée par le seuil bas, car les similarités CNIL restent hautes même quand le document est faux. Les 10 questions `confiant` ne sont pas toutes justes : le rapport ne prétend pas le contraire.
- **Analyse des échecs manuelle.** Les causes ci-dessus sont lues dans les passages rendus, pas produites par une métrique.
- **Deux splits de test abandonnés.** Les deux splits antérieurs ont été mesurés puis abandonnés (14/25 et 15/25) ; le second est archivé dans `b442d14`, le premier n'a jamais été commité. Seule la mesure du split retenu est reprise ici, et le marqueur ne porte qu'elle.

## Provenance

- Corpus : `https://huggingface.co/datasets/AgentPublic/cnil`, snapshot du 30 octobre 2026, deux parquet lus sans la colonne `bge-m3`, texte ré-embarqué avec `qwen3-embedding:0.6b` ; 249 documents, 6 342 fragments.
- Jeu : `mcp/eval/questions-cnil-v2.csv`, empreinte `7d9595dff538a9b6631eff11c44dd226cc62042ea8dc5ad124f5c2dcf59abd17`, 50 documents distincts.
- Commandes :
  - `npm run mcp:eval -- --questions questions-cnil-v2.csv --split dev --seuils 0.690,0.740,0.010`
  - `npm run mcp:eval -- --questions questions-cnil-v2.csv --split test --mesurer-test --seuils 0.690,0.740,0.010`
- Marqueur : `mcp/eval/questions-cnil-v2.test-consomme.json`. Une seconde exécution du `test` est refusée pour le modèle `qwen3-embedding:0.6b`.
