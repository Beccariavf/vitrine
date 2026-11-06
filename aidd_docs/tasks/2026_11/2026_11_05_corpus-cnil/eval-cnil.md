# Évaluation du corpus CNIL

Mesure du 6 novembre 2026 sur `data/corpus/cnil/` : 249 délibérations de sanction, 6 342 fragments, toutes d'origine DINUM. Index `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local, 6 907 unités au total (RGPD et AI Act compris). Ce rapport est indépendant de `eval.md` (v1), `eval-v2.md` (v2), `eval-v3.md` (v3) et `eval-aiact.md` : les jeux ne sont jamais fusionnés et les scores ne se comparent pas — la tâche change de corpus.

## Composition du jeu

`mcp/eval/questions-cnil.csv` porte 20 questions : 12 visant un document précis, 6 conceptuelles, 2 pièges. Chaque ligne porte `corpus = cnil`. Le jeu n'a pas de split : il n'a servi à régler ni seuil, ni bande, ni découpage.

Une référence attendue est un identifiant de document (`CNILTEXT…`), sans `#` : le succès est « au moins un fragment de cette délibération dans les cinq passages rendus ». Ce choix suit la citation : on cite une décision, pas un fragment choisi par un tiers.

## Résultats

Seuils du produit, sans calibration propre : `bas = 0,69`, `haut = 0,74`, `marge = 0,01` ; bande article `0,02` ; voie dense ; `corpus = cnil`.

| Métrique | Valeur |
| --- | --- |
| Top 5, 18 questions sémantiques | **55,6 % (10/18)**, IC 95 % 33,7–75,4 |
| Top 1, 18 questions sémantiques | **38,9 % (7/18)**, IC 95 % 20,3–61,4 |
| `MRR` sémantique | 0,472 |
| Niveaux | 11 confiant, 7 incertain, 0 aucun_resultat_fiable |
| Pièges cités (2) | **1/2** (50,0 %, IC 95 % 9,5–90,5) |
| Pièges marqués confiant | 0 |

Par type de question, ce qui est le vrai enseignement :

| Type | Top 5 | Top 1 |
| --- | --- | --- |
| Document visé (12) | **9/12 (75,0 %)**, IC 95 % 46,8–91,1 | 7/12 (58,3 %) |
| Conceptuelle (6) | 1/6 (16,7 %), IC 95 % 3,0–56,4 | 0/6 |

## Ce qui échoue

- **Les trois documents manqués** : l'amende de 800 000 € contre un site d'annonces immobilières (`CNILTEXT000050202759`), les 10 M€ contre un groupe américain pour ses cookies (`CNILTEXT000048967251`), les 50 M€ contre Google le 21 janvier 2019 (`CNILTEXT000038032552`). Trois sanctions très médiatisées, noyées parmi 249 décisions aux faits proches ; la première place revient souvent à une autre sanction du même secteur.
- **Un piège est cité** : « La CNIL a-t-elle sanctionné une commune pour des caméras de vidéosurveillance installées dans une crèche municipale ? ». Vérification faite, aucun fragment du corpus ne mentionne une crèche ni cette configuration : le système rend un passage d'une autre décision, pour une décision qui n'existe pas. Le niveau est `incertain`, jamais `confiant`, mais la citation est fausse.
- **Le piège déterministe est refusé** : « article 84 du RGPD » ne renvoie aucun fragment du corpus CNIL, qui ne contient pas d'articles.

## Limites

- **20 questions ne classent pas le corpus.** L'intervalle sur le top 5 va de 34 % à 75 % : il interdit de dire si la recherche CNIL est « bonne » ou « mauvaise ».
- **Les six questions conceptuelles sont mal posées pour ce corpus.** Elles supposent une source canonique (« les critères du montant d'une amende ») alors que 249 décisions discutent ces critères. Leur échec mesure surtout ce défaut de conception, pas la recherche. Un prochain jeu doit viser un document ou accepter plusieurs sources.
- **Les seuils sont ceux du produit**, calibrés sur le RGPD. Aucune calibration CNIL n'a été faite : elle demanderait un split et un jeu plus grand.
- **Double découpage.** L'historique garde le `chunk_index` DINUM, publié ; d'éventuels incréments DILA recevraient un découpage local de 600 à 1 200 caractères, étiqueté `dila`. Aucun fragment `dila` n'est présent aujourd'hui.
- **URL non vérifiée.** `https://www.legifrance.gouv.fr/cnil/id/<id>` répond 403 aux robots ; elle est déclarée dans le manifeste avec `url_texte_verifiee: false`.
- **Une correction assumée.** Le premier passage mesurait les six questions conceptuelles sur un fragment précis (`CNILTEXT…#f35`). Ce critère était incohérent avec les douze autres questions et avec la citation retenue ; il a été ramené au document, puis la mesure a été rejouée. Le premier passage n'a pas été archivé : seul le second est reproductible. Il donnait 10/18 au top 5 et un `MRR` de 0,458, contre 0,472 après correction ; aucun résultat n'est inversé par le changement.

## Provenance

- Historique : `https://huggingface.co/datasets/AgentPublic/cnil`, deux fichiers parquet de 258 Mo et 76 Mo, empreintes `94d5f476…` et `ea03d97d…`, lus colonne par colonne sans la colonne d'embeddings `bge-m3` ; le texte est ré-embarqué avec `qwen3-embedding:0.6b`.
- Incréments : `https://echanges.dila.gouv.fr/OPENDATA/CNIL/`, 147 archives listées, 1 nouvelle depuis `etat.json` au moment de la vérification, 0 document retenu (nature non pertinente ou document non plus récent).
- Licence : `etalab-2.0` sur Hugging Face, `lov2` sur data.gouv ; l'écart est consigné dans `manifest.json`, pas résolu.
- Index : 6 907 unités, dont 6 342 CNIL ; un second passage embarque 0 unité en 0,2 s et laisse les vecteurs identiques.
