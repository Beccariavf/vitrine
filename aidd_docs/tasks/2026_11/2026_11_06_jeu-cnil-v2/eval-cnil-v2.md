# Évaluation du jeu CNIL v2

Mesure du 6 novembre 2026 sur `data/corpus/cnil/` : 249 délibérations de sanction, 6 342 fragments, toutes d'origine DINUM. Index `qwen3-embedding:0.6b` (1024 dimensions), 6 907 unités au total. Ce rapport est indépendant de `eval-cnil.md` (jeu de 20 questions), de `eval.md` (v1), `eval-v2.md` (v2), `eval-v3.md` (v3) et `eval-aiact.md` : les jeux ne sont jamais fusionnés et les scores ne se comparent pas.

## Protocole

`mcp/eval/questions-cnil-v2.csv` porte 50 questions, toutes de type `reference` et toutes vers un document entier (`CNILTEXT…` sans `#`) : 25 `dev` et 25 `test`. Le jeu a été écrit contre le texte des décisions, avant toute mesure, puis figé.

Trois formes sont interdites dans une question, et un test les refuse : l'identifiant `CNILTEXT…` de la cible, son numéro `SAN-…`, et un numéro d'article. Les deux premières donneraient une recherche lexicale déguisée ; la troisième déclencherait le court-circuit déterministe et un rang 1 par construction. Aucune question ne réutilise le texte des jeux v1, v2, v3, AI Act ou CNIL de 20 questions.

Les seuils sont ceux du produit (`bas = 0,69`, `haut = 0,74`, `marge = 0,01`), passés explicitement aux deux splits. Aucun seuil n'est calibré sur ce jeu : il mesure le rappel documentaire, pas la bande de confiance. `test` a été mesuré une seule fois après la correction décrite ci-dessous, avec `--mesurer-test`, et laisse le marqueur `mcp/eval/questions-cnil-v2.test-consomme.json` (empreinte `f09bd68a…`).

### Correction avant la mesure retenue

Une première exécution du `test` a été annulée. La vérification d'après mesure a trouvé trois questions dont la prémisse factuelle ne correspondait pas à la cible :

- `CNILTEXT000051630617` était décrit comme un « annuaire en ligne » ; la décision porte sur une société qui adresse des courriels et des SMS de prospection pour environ 300 clients.
- `CNILTEXT000049382214` était décrit comme un « détaillant de chaussures » ; la décision porte sur une chaîne de boutiques de matériel de télécommunication.
- `CNILTEXT000050202759` était décrit comme un manquement au « secret des données de santé » ; la décision retient un manquement à l'article 66 de la loi Informatique et Libertés et au principe de licéité pour des données de santé.

Les cibles n'ont pas changé ; seules les prémisses ont été réécrites pour coller au texte. Le jeu corrigé a été mesuré une fois. Les chiffres de la première exécution (14/25) ne sont pas repris dans ce rapport. Cette correction est une réparation de données, pas un ajustement au score : aucun seuil, aucun classement et aucun composant du produit n'ont été touchés.

## Résultats

Le `test` est la mesure principale ; `dev` est donné comme contrôle de stabilité.

| Métrique | `test` (25) | `dev` (25) |
| --- | --- | --- |
| Top 5 document | **60,0 % (15/25)**, IC 95 % 40,7–76,6 | 56,0 % (14/25), IC 95 % 37,1–73,3 |
| Top 1 document | **36,0 % (9/25)**, IC 95 % 20,2–55,5 | 28,0 % (7/25) |
| `MRR` | **0,449** | 0,374 |
| Niveaux | 10 confiant, 15 incertain, 0 aucun_resultat_fiable | 9 confiant, 16 incertain, 0 aucun_resultat_fiable |

Rangs du `test` : 9 au rang 1, 3 au rang 2, 1 au rang 3, 0 au rang 4, 2 au rang 5, 10 absents. Le `dev` et le `test` donnent des chiffres compatibles : il n'y a pas de signe d'ajustement au `dev`. Les 50 questions mises bout à bout donnent 29/50 (58,0 %, IC 95 % 44,2–70,6), mais ce total est descriptif : la mesure qui engage est celle du `test`.

## Ce qui échoue

Dix questions du `test` ne rendent pas leur document dans les cinq passages. Les causes sont dans le corpus, pas dans l'index :

- **Motifs factuels presque identiques.** « Vanity Fair » est confondu avec un autre site d'actualités qui dépose des cookies avant consentement (`CNILTEXT000043867129`) ; un éditeur de newsletters est confondu avec un service de livraison de repas qui prospecte des non-clients (`CNILTEXT000042848036`) ; un grand groupe de distribution est confondu avec le même éditeur de newsletters ; une chaîne de boutiques de télécommunication est confondue avec une ancienne décision de démarchage téléphonique. Ces décisions partagent le vocabulaire et le grief ; le vecteur ne les sépare pas.
- **Décisions anonymisées.** La sanction contre une enseigne de magasins qui transmet des données à un groupe étranger (`CNILTEXT000053391342`) remplace les noms par `X`, `Y` ou `[…]`. La question ne peut s'appuyer sur aucune entité nommée.
- **Collision de vocabulaire.** Un logiciel de messagerie vocale et de salons (`CNILTEXT000046562676`) est devancé par `Mail Orange`, parce que « messagerie » pèse plus que « vocale » et « salons ».
- **Faits partagés.** La conservation des données revient dans plusieurs décisions : la question sur un opérateur mobile qui conserve les données de clients résiliés depuis dix ans (`CNILTEXT000053352594`) rend d'abord une décision de distribution qui traite aussi de conservation. Un courtier en données (`CNILTEXT000046693390`) est devancé par une décision de liquidation qui parle aussi de demandes de personnes concernées.

Aucun de ces échecs n'est un faux passage : le système rend un passage d'une autre décision réelle, jamais un document inexistant. Mais la citation reste fausse pour la question posée.

## Ce que le jeu de 20 questions disait

Le jeu de 20 questions (`eval-cnil.md`) rapportait 9/12 (75,0 %) sur les questions qui visent un document, et 1/6 sur les questions conceptuelles. Le jeu v2 ne reproduit pas ce 75 % : sur 25 questions documentaires, le `test` donne 60,0 %. Les deux intervalles se recouvrent largement (46,8–91,1 contre 40,7–76,6) ; le 75 % était donc une estimation fragile sur douze questions, dont plusieurs nommaient la partie et le montant.

Le jeu de 20 contient par ailleurs une question mal ciblée : « Quelle amende de 800 000 euros […] contre l'exploitant d'un site d'annonces immobilières ? » pointe `CNILTEXT000050202759`, qui est une décision contre un éditeur de logiciels médicaux, pas un site d'annonces immobilières. Le jeu v2 ne réutilise aucune des vingt questions et remplace cette mesure pour les questions documentaires. Le jeu de 20 reste la seule mesure des pièges et des questions conceptuelles.

## Limites

- **25 questions test ne classent pas le corpus.** L'intervalle du top 5 va de 41 % à 77 % : il interdit de dire si la recherche CNIL est « bonne » ou « mauvaise », et il ne permet pas de départager deux systèmes sans comparaison appariée.
- **Questions écrites depuis le corpus.** Elles partagent des termes avec les décisions, ce qui peut gonfler le rappel par rapport à la formulation d'un utilisateur qui découvre le corpus. Les identifiants, numéros et articles sont exclus, pas le vocabulaire métier.
- **Succès au document, pas au fragment.** Une question réussit si un fragment de la bonne décision figure dans les cinq passages ; elle ne dit pas si le fragment cité répond à la question. Le jeu ne mesure pas la citation exacte.
- **Aucun piège.** Le comportement sur une question sans réponse reste mesuré par le jeu de 20 questions, pas par celui-ci.
- **Confiance non calibrée.** Les seuils sont ceux du produit ; aucune question n'est refusée par le seuil bas, car les similarités CNIL restent hautes même quand le document est faux. Les 10 questions `confiant` ne sont pas toutes justes : le rapport ne prétend pas le contraire.
- **Analyse des échecs manuelle.** Les causes ci-dessus sont lues dans les passages rendus, pas produites par une métrique.
- **Une exécution annulée.** La première mesure du `test` est voidée par trois prémisses factuelles corrigées avant la mesure retenue ; l'incident est documenté ci-dessus, et non caché.

## Provenance

- Corpus : `https://huggingface.co/datasets/AgentPublic/cnil`, snapshot du 30 octobre 2026, deux parquet lus sans la colonne `bge-m3`, texte ré-embarqué avec `qwen3-embedding:0.6b` ; 249 documents, 6 342 fragments.
- Jeu : `mcp/eval/questions-cnil-v2.csv`, empreinte `f09bd68a73ff39fb0129437323eb4c7c42df8b22301da1e8745f2da6b51a4281`, 50 documents distincts.
- Commandes :
  - `npm run mcp:eval -- --questions questions-cnil-v2.csv --split dev --seuils 0.690,0.740,0.010`
  - `npm run mcp:eval -- --questions questions-cnil-v2.csv --split test --mesurer-test --seuils 0.690,0.740,0.010`
- Marqueur : `mcp/eval/questions-cnil-v2.test-consomme.json`. Une seconde exécution du `test` est refusée pour le modèle `qwen3-embedding:0.6b`.
