# Base mesurée — `questions-cnil-etendu.csv`, split `dev`

Témoin apparié des phases suivantes. Tous les chiffres ci-dessous viennent de
`mesures/base-dev.json` (même dossier), produit par :

```sh
node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json
```

Aucune valeur n'est recopiée d'un autre rapport.

## Conditions de mesure

| Champ                | Valeur                                        | Source JSON                     |
| -------------------- | --------------------------------------------- | ------------------------------- |
| Date                 | 2026-11-10                                    | `date`                          |
| Modèle               | `qwen3-embedding:0.6b`, 1024 dimensions        | `modele`, `dimensions`          |
| Recherche            | `dense`                                       | `recherche`                     |
| Corpus               | `cnil`                                        | `corpus`                        |
| Split                | `dev`                                         | `split`                         |
| Seuils               | bas 0,62 · haut 0,67 · marge 0,01             | `seuils`                        |
| Questions            | 60 (54 conceptuelles, 6 pièges, 0 références) | `questions`                     |
| Ordre                | celui du CSV, vérifié question par question   | `questions[].question`          |
| Empreinte des questions | `85317ef84ba5de41e02073d7f52618b739abf17325335db03bfd017dc261618b` | `sha256 mcp/eval/questions-cnil-etendu.csv` |
| Empreinte du JSON    | `d94eeda56154ad79d1a702beaf0d0df131d95d66e2e811ea2c483553a8e3bb87` | `sha256 base-dev.json` |
| Rapport lisible      | `mesures/base-dev.txt`                        | —                               |

Les seuils sont calibrés sur ce même split (le split `dev` règle ses seuils) ;
le split `test` n'a pas été touché. Ce JSON a été refait après le rééquilibrage
du jeu : 20 avis + 7 recommandations + 27 sanctions + 6 pièges en `dev`, et toute
mesure `dev` antérieure à ce gel est caduque.

## Index mesuré

| Champ       | Valeur                                                             |
| ----------- | ------------------------------------------------------------------ |
| Unités      | 53 143 (`unites.jsonl` : aiact 293, ce 17 703, cepd 5 443, cnil 29 299, lil 133, rgpd 272) |
| `corpus:index` | mode `incremental`, 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées, 0 métadonnée rafraîchie |
| `sha256`    | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c`  |
| Ollama      | 0.40.14                                                            |

Zéro unité embarquée : l'index était déjà à jour, la mesure porte donc sur un
index aligné au corpus. L'empreinte `07583570…` est celle de l'indexation la
plus récente (`npm run corpus:index`), et elle est restée identique avant et
après les mesures des deux rerankers de ce dossier. Le mode delta réécrit
`meta.construit_le` à chaque passage, sans toucher un vecteur : c'est l'empreinte
d'après passage qui décrit l'index réellement interrogé, et seule une empreinte
relevée juste avant et juste après les mesures prouve que rien n'a bougé.

## Chiffres de tête

Dénominateur : les 54 questions conceptuelles ; les 6 pièges sont comptés à part.

| Métrique                  | Valeur              | Champ JSON                                        |
| ------------------------- | ------------------- | ------------------------------------------------- |
| recall@5, brut            | 39/54 = 72,2 %      | `agregats.top5_semantique_succes` / `semantiques` |
| recall@5, rendu           | 39/54 = 72,2 %      | `agregats.top5_rendu_succes`                      |
| recall@5, global          | 39/54 = 72,2 %      | `agregats.top5_global_succes`                     |
| MRR                       | 0,625               | `agregats.mrr_semantique`                         |
| MRR rendu                 | 0,625               | `agregats.mrr_rendu`                              |
| top-1 brut                | 29/54 = 53,7 %      | `agregats.top1_semantique_succes`                 |
| top-1 rendu               | 29/54 = 53,7 %      | `agregats.top1_rendu_succes`                      |

Brut et rendu coïncident parce qu'aucune réponse n'est refusée : 0
`aucun_resultat_fiable`. Le rendu n'ampute donc aucune question du rappel.

Distribution du rang de la première référence attendue (54 questions
conceptuelles) : rang 1 → 29, rang 2 → 9, rang 4 → 1, absent → 15. Total
des succès top 5 : 29 + 9 + 1 = 39.

## Niveaux de confiance (questions conceptuelles)

| Niveau                 | Nombre | Champ JSON                    |
| ---------------------- | ------ | ----------------------------- |
| `confiant`             | 30     | `agregats.confiant`           |
| `incertain`            | 24     | `agregats.incertain`          |
| `aucun_resultat_fiable`| 0      | `agregats.aucun_resultat_fiable` |

Croisement « niveau × justesse », déduit des entrées `niveau` et `rangs` du JSON :

| Niveau    | Questions | Juste au top 5 | Faux au top 5 | Juste au top 1 |
| --------- | --------- | -------------- | ------------- | -------------- |
| `confiant`| 30        | 24             | 6             | 19             |
| `incertain`| 24       | 15             | 9             | 10             |

Le niveau `confiant` porte donc 6 erreurs au top 5 et 11 au top 1 ; à l'inverse,
15 des 24 `incertain` sont justes au top 5. La calibration ne refuse aucune
question : elle classe, elle ne filtre pas.

## Pièges (6, tous mesurés par seuil)

| Champ             | Valeur | Champ JSON               |
| ----------------- | ------ | ------------------------ |
| Pièges mesurés    | 6      | `agregats.pieges_mesures`|
| Pièges cités      | 6/6    | `agregats.pieges_cites`  |
| Pièges confiants  | 4      | `agregats.pieges_confiants`|

Les six pièges cités, avec leur niveau :

- confiant — Quelle sanction la CNIL a-t-elle prononcée contre une compagnie aérienne pour la reconnaissance faciale des passagers à l'embarquement ?
- incertain — Quel avis la CNIL a-t-elle rendu sur l'installation de caméras dans les piscines municipales ?
- confiant — Que recommande la CNIL pour les données de santé des animaux de compagnie dans les cliniques vétérinaires ?
- incertain — Quel avis la CNIL a-t-elle rendu sur un projet de recherche utilisant des implants cérébraux chez des patients paralysés ?
- confiant — Quelle sanction la CNIL a-t-elle prononcée contre un loueur de vélos en libre-service pour la géolocalisation des trajets de ses utilisateurs ?
- confiant — Quel avis la CNIL a-t-elle rendu sur les puces électroniques implantées sous la peau des salariés pour contrôler l'accès aux locaux ?

Aucun piège n'est refusé : le taux de citations invalides vaut 6/6 sur les
pièges mesurés par seuil.

## Porte de la phase 2 : la doctrine reproduite

La phase 2 devait retrouver le témoin de la tranche doctrinale avant d'écrire le
jeu élargi ; ce contrôle manquait au premier rapport, il est consigné ici. Rejeu
sur `mcp/eval/questions-cnil-doctrine.csv` (10 questions de doctrine : 7 avis,
3 recommandations ou lignes directrices ; split `dev`), même modèle, même index,
même Ollama que ci-dessus :

```sh
node mcp/eval/run.ts --questions questions-cnil-doctrine.csv --split dev --json \
  > mesures/doctrine-qwen.json
```

| Métrique | Valeur | Champ JSON |
| --- | --- | --- |
| recall@5 | 3/10 = 30,0 % | `agregats.top5_semantique_succes` |
| MRR | 0,225 | `agregats.mrr_semantique` |
| top-1 | 2/10 = 20,0 % | `agregats.top1_semantique_succes` |
| Seuils calibrés | 0,71 / 0,76 / 0,01 | `seuils` |
| Niveaux | 8 / 2 / 0 | `agregats.confiant`, `incertain`, `aucun_resultat_fiable` |

Croisement « niveau × justesse » au top 5 :

| Niveau | Questions | Juste au top 5 | Faux au top 5 |
| --- | --- | --- | --- |
| `confiant` | 8 | 3 | 5 |
| `incertain` | 2 | 0 | 2 |

Les trois succès viennent de deux questions au rang 1 et d'une au rang 4 ; les
sept autres questions n'ont aucun passage attendu dans les cinq premiers. Le
niveau `confiant` se trompe 5 fois sur 8 : sur cette tranche, la confiance ne
trie presque rien, elle étiquette. C'est le point de départ de l'expérience de
rerank, pas une conclusion sur le produit.

## Lecture

- Le dense place le bon document dans les cinq premiers pour 72,2 % des
  questions documentaires, et premier pour 53,7 %.
- 15 questions sur 54 n'ont aucun passage attendu dans le top 5 : c'est la marge
  que l'ordre d'un reranker peut récupérer.
- Les 6 pièges de `dev` sont tous cités, dont 4 avec l'assurance « confiant » :
  la base ne refusait déjà rien, un réordonnancement ne peut donc pas améliorer
  ce point par les seuls seuils.


## Avec les seuils du produit (0,69 / 0,74 / 0,01)

Mesure complémentaire, `mesures/base-dev-seuils-produit.json` : le même jeu
`dev`, le même index, mais les seuils constants de `mcp/confidence.ts` au lieu
de la calibration `dev` (0,62 / 0,67 / 0,01). C'est la seule vue qui dise ce que
le lecteur reçoit aujourd'hui.

| Niveau | Questions | Dont document attendu au top 5 |
| --- | --- | --- |
| `confiant` | 24 | 19 justes, **5 fausses** |
| `incertain` | 26 | 20 justes, 6 fausses |
| `aucun_resultat_fiable` | 4 | 0 |

Top 5 39/54, MRR 0,6250, top 1 29/54 (le classement ne change pas : seules les
étiquettes changent). Les cinq fausses confiantes se répartissent en 4 sanctions
et 1 recommandation, sur 9 et 3 réponses confiantes : c'est là que le produit
trompe le lecteur, et non dans la doctrine majoritaire (12 confiantes, 0 fausse).
