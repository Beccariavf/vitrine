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
| Empreinte du JSON    | `5446c344775b0693786daa6609f2226d33b31ae68e81d3711b503b0266e8ca0f` | `sha256 base-dev.json` |
| Rapport lisible      | `mesures/base-dev.txt`                        | —                               |

Les seuils sont calibrés sur ce même split (le split `dev` règle ses seuils) ;
le split `test` n'a pas été touché.

## Index mesuré

| Champ       | Valeur                                                             |
| ----------- | ------------------------------------------------------------------ |
| Unités      | 53 143 (`unites.jsonl` : aiact 293, ce 17 703, cepd 5 443, cnil 29 299, lil 133, rgpd 272) |
| `corpus:index` | mode `incremental`, 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées, 0 métadonnée rafraîchie |
| `sha256`    | `a1f93b75d24376356c8825bc0925eeb0ae1646276f52447647f560a6526d60f4`  |
| Ollama      | 0.40.14                                                            |

Zéro unité embarquée : l'index était déjà à jour, la mesure porte donc sur un
index aligné au corpus. Le `sha256` avant le passage valait
`2291d9f17c8cf0c6948261049b9886680348bdc70349bd734c8b84f9128289fd` ; il a
changé parce que le mode delta réécrit `meta.construit_le`, sans toucher un
vecteur (53 143 unités inchangées). C'est l'empreinte d'après passage,
`a1f93b75…`, qui décrit l'index utilisé par les deux mesures ; elle est restée
identique avant et après les mesures.

## Chiffres de tête

Dénominateur : les 54 questions conceptuelles ; les 6 pièges sont comptés à part.

| Métrique                  | Valeur              | Champ JSON                                        |
| ------------------------- | ------------------- | ------------------------------------------------- |
| recall@5, brut            | 38/54 = 70,4 %      | `agregats.top5_semantique_succes` / `semantiques` |
| recall@5, rendu           | 38/54 = 70,4 %      | `agregats.top5_rendu_succes`                      |
| recall@5, global          | 38/54 = 70,4 %      | `agregats.top5_global_succes`                     |
| MRR                       | 0,616 (33,25/54 → 0,61574) | `agregats.mrr_semantique`                  |
| MRR rendu                 | 0,616               | `agregats.mrr_rendu`                              |
| top-1 brut                | 29/54 = 53,7 %      | `agregats.top1_semantique_succes`                 |
| top-1 rendu               | 29/54 = 53,7 %      | `agregats.top1_rendu_succes`                      |

Brut et rendu coïncident parce qu'aucune réponse n'est refusée : 0
`aucun_resultat_fiable`. Le rendu n'ampute donc aucune question du rappel.

Distribution du rang de la première référence attendue (54 questions
conceptuelles) : rang 1 → 29, rang 2 → 8, rang 4 → 1, absent → 16. Total
des succès top 5 : 29 + 8 + 1 = 38.

## Niveaux de confiance (questions conceptuelles)

| Niveau                 | Nombre | Champ JSON                    |
| ---------------------- | ------ | ----------------------------- |
| `confiant`             | 31     | `agregats.confiant`           |
| `incertain`            | 23     | `agregats.incertain`          |
| `aucun_resultat_fiable`| 0      | `agregats.aucun_resultat_fiable` |

Croisement « niveau × justesse », déduit des entrées `niveau` et `rangs` du JSON :

| Niveau    | Questions | Juste au top 5 | Faux au top 5 | Juste au top 1 |
| --------- | --------- | -------------- | ------------- | -------------- |
| `confiant`| 31        | 25             | 6             | 20             |
| `incertain`| 23       | 13             | 10            | 9              |

Le niveau `confiant` porte donc 6 erreurs au top 5 et 11 au top 1 ; à l'inverse,
13 des 23 `incertain` sont justes au top 5. La calibration ne refuse aucune
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

## Lecture

- Le dense place le bon document dans les cinq premiers pour 70,4 % des
  questions documentaires, et premier pour 53,7 %.
- 16 questions sur 54 n'ont aucun passage attendu dans le top 5 : c'est la marge
  que l'ordre d'un reranker peut récupérer.
- Les 6 pièges de `dev` sont tous cités, dont 4 avec l'assurance « confiant » :
  la base ne refusait déjà rien, un réordonnancement ne peut donc pas améliorer
  ce point par les seuls seuils.
