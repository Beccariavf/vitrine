# #143 — Mesure avant ingestion des filtres élargis `ce`, `cc`, `cjue`

Date : 2026-11-25. Index de départ : **156 706 unités** (`data/corpus/index/index.db`).
Périmètre : filtre élargi en **union** avec le filtre historique ; aucune décision déjà présente n'est retirée.

## Méthode

1. Filtre élargi déclaré aux descripteurs (`mcp/corpus/ce/descripteur.json`,
   `mcp/corpus/cc/descripteur.json`, `mcp/corpus/cjue/descripteur.json`) et appliqué par
   `mcp/corpus/pertinence.ts` : textes visés d'abord (numéro d'article à moins de 160 caractères
   du nom du texte, dans la forme normalisée), expressions bornées ensuite. Aucune expression
   générique seule.
2. Mesure sans écriture du corpus : lecture de l'archive JADE en flux pour `ce` (script de mesure
   réutilisant `parseDecisionJade` et `criteresTrouves`), recherche Judilibre pour `cc`, SPARQL
   CELLAR pour `cjue`. Les captures Judilibre et CELLAR lues pour l'échantillon ont été mises au
   cache brut (`data/raw/cc`, `data/raw/cjue`), jamais au corpus.
3. Échantillon : 20 décisions ajoutées par corpus, triées par `sha256("echantillon-143:<id>")`
   (graine fixe 143), lues sur leurs motifs et classées pertinente / hors-sujet.
4. Itération 1 : le premier passage (contexte accepté n'importe où dans la décision) donnait
   `ce` 1 165 décisions / 13 114 fragments, avec des faux positifs (article d'un autre code +
   mention du CRPA ailleurs : éducation, EHPAD, mines, code de la route). Le contexte a été
   ramené à une fenêtre de 160 caractères autour de l'article ; `ce` tombe à 1 033 / 10 616.
   Aucune autre itération n'a été nécessaire.

## Volume ajouté

| Corpus | Décisions ajoutées | Fragments | Part de l'index | Critères principaux |
| --- | ---: | ---: | ---: | --- |
| `ce` | 1 033 | 10 616 | 6,8 % | accès aux documents administratifs 634 / 5 200 ; CRPA livre III 214 / 2 748 ; secret des affaires 120 / 2 090 ; communication des documents administratifs 75 / 582 ; code pénal 226-13 69 / 954 ; CSP données de santé 42 / 543 ; loi 51-711 34 / 283 ; code du patrimoine 18 / 241 ; base de données + producteur 17 / 359 ; autres ≤ 14 |
| `cc` | 330 | 7 445 | 4,8 % | secret des affaires 265 ; base de données + producteur 17 ; code de commerce L. 151-1 16 ; CSP données de santé 12 ; CPI L. 341-1 12 ; CRPA livre III 11 ; code pénal 226-13 10 ; patrimoine 8 ; droit sui generis 8 ; accès aux documents administratifs 7 ; intelligence artificielle 7 ; directive bases de données 5 ; communication des documents 4 ; loi 68-678 3 ; directive secret des affaires 1 |
| `cjue` | 55 | 5 026 | 3,2 % | DSA, directive Open Data, directive bases de données, droit d'auteur, secret des affaires, AI Act : 62 décisions retenues par citation d'acte (57 hors filtre historique, 5 déjà présentes) |
| **Total** | **1 418** | **23 087** | **14,7 %** | seuil d'arrêt : 47 000 fragments (30 %) — **non atteint** |

Ces comptes sont les deltas réels des corpus (base **pré-#143**, `git show 8bf5419~1:data/corpus/<c>/unites.jsonl`,
face aux fichiers ingérés ; `8bf5419~1` est `c4154a1`, pas le commit de données #143).
La mesure `cc` par les seules 11 requêtes nouvelles donnait 315 décisions / 7 170 fragments ; la
synchronisation réelle, qui rejoue aussi les 22 requêtes historiques sur le cache, porte le corpus
à 330 décisions / 7 445 fragments. Sur ces 330 : 329 sont entrées par un critère élargi (7 427
fragments) et 1, nouvelle, est retenue par le filtre historique depuis une requête nouvelle
(18 fragments, aucun critère élargi). Les compteurs par critère du résultat de synchronisation
(`ajouteesElargi`, `fragmentsAjoutes`) portent ces 329 / 7 427 et excluent en outre la décision
déjà présente par la veille, qui passe en `deja_presents_par_critere` (critère « intelligence
artificielle », 7 → 6). Pour `cjue`, 62 décisions sont retenues par citation d'acte : 57 ajoutées
et 5 déjà présentes (matière, notion, veille ou complémentaire) ; le manifeste ne stocke que les
comptes par critère (`ajouts_par_critere`, `deja_presents_par_critere`, `decisions_par_origine`),
pas le total de synchronisation. La liste CELLAR a retiré `62025CO0502` entre deux passes : il
n'était pas au corpus avant #143, donc aucune décision antérieure n'est perdue ; l'index a supprimé
ses 46 unités.

## Échantillon (60 décisions, graine 143)

### Conseil d'État (20)

| # | Décision | Date | Critère | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | CETATEXT000047881637 | 2023-07-24 | CRPA | pertinente | refus de communiquer méthodologie et données statistiques |
| 2 | CETATEXT000007806190 | 1991-11-20 | accès | pertinente | avis CADA, communication d'un document administratif |
| 3 | CETATEXT000007831970 | 1992-03-16 | accès | pertinente | communication de documents administratifs (placement) |
| 4 | CETATEXT000027164324 | 2013-03-11 | secret des affaires | pertinente | communication d'éléments de l'offre, limite du secret |
| 5 | CETATEXT000008061474 | 2000-02-02 | accès | pertinente | avis CADA, accès aux documents |
| 6 | CETATEXT000032509771 | 2016-05-02 | CRPA, accès | pertinente | refus de communication de documents de marché |
| 7 | CETATEXT000054758939 | 2026-08-27 | CRPA, secret | pertinente | dossier médical, occultation du secret des affaires |
| 8 | CETATEXT000007801639 | 1990-03-14 | accès | pertinente | avis CADA, dossier pénitentiaire |
| 9 | CETATEXT000007933424 | 1996-06-12 | accès | pertinente | communication de documents de l'IGAS |
| 10 | CETATEXT000008228002 | 2005-04-12 | accès | pertinente | accès aux archives et au dossier administratif |
| 11 | CETATEXT000007834113 | 1992-11-18 | loi 51-711 | pertinente | recensement, loi statistique appliquée |
| 12 | CETATEXT000047824765 | 2023-07-12 | secret, L. 151-1 | pertinente | secret des affaires des opérateurs, L. 151-1 |
| 13 | CETATEXT000020868503 | 2009-04-10 | accès | pertinente | dossier médical, document administratif |
| 14 | CETATEXT000020374598 | 2007-05-21 | accès | pertinente | communication de pièces d'enquête administrative |
| 15 | CETATEXT000053667866 | 2026-03-11 | secret des affaires | pertinente | communication ARCEP, secret des affaires |
| 16 | CETATEXT000032950541 | 2016-07-22 | CRPA | pertinente | applique L. 311-1 (bordereau de situation) |
| 17 | CETATEXT000044211415 | 2021-10-14 | CRPA, secret | pertinente | L. 311-6, documents de mise en concurrence |
| 18 | CETATEXT000007757638 | 1989-06-30 | accès | pertinente | accès à des documents d'un OPHLM |
| 19 | CETATEXT000019703675 | 2008-10-22 | accès | pertinente | communication de documents de concours |
| 20 | CETATEXT000034076458 | 2017-02-22 | CRPA | pertinente | applique L. 311-1 (bordereau de situation) |

Hors-sujet : **0 / 20**.

### Cour de cassation (20)

| # | Décision | Date | Critère | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | 5fd8f7e1e8fed38c696fc223 | 2017-09-27 | secret des affaires | pertinente | comptes réglementaires, limite du secret |
| 2 | 6079b4699ba5988459c56d30 | 2008-06-18 | secret des affaires | pertinente | refus de communiquer des données de rémunération |
| 3 | 623c219e2df83f0576e9d85f | 2022-03-24 | secret des affaires | pertinente | saisie de documents, secret des affaires |
| 4 | 683fe301669ab9459096099a | 2025-06-04 | secret des affaires | pertinente | communication de coûts, secret des affaires |
| 5 | 5fd8f5775def058982fd5e67 | 2017-10-19 | secret des affaires | pertinente | comptes d'exploitation, secret des affaires |
| 6 | 60e5435fd7f3d51b50f07860 | 2021-07-07 | secret des affaires | pertinente | saisie informatique, sélection des données |
| 7 | 5fca4be130816962ab3c3c53 | 2020-07-02 | secret des affaires | pertinente | mesure d'instruction, secret des affaires |
| 8 | 6079bd329ba5988459c57101 | 2012-12-19 | secret des affaires | pertinente | documents RH, vie privée et secret |
| 9 | 6140257b1879b4afa45906b5 | 2012-03-06 | CSP, 226-13 | pertinente | bilan sanguin, donnée médicale et secret professionnel |
| 10 | 6257bca47ee821954281c720 | 2022-04-14 | secret des affaires | pertinente | séquestre, tri des pièces saisies |
| 11 | 68242dbbeaabb276d1616de3 | 2025-05-14 | secret, L. 151-1 | pertinente | séquestre, R. 153-1 code de commerce |
| 12 | 6257bc947ee821954281c710 | 2022-04-14 | secret des affaires | pertinente | information confidentielle, secret des affaires |
| 13 | 63bfb6f05e2fbe7c90043b5d | 2023-01-12 | secret des affaires | pertinente | saisie d'une data room, secret des affaires |
| 14 | 5fd8fd1cc74ea992f28e94bb | 2017-07-05 | secret des affaires | pertinente | saisie, secret des affaires |
| 15 | 6af55f1b6c2e1778128884a8 | 2026-11-12 | intelligence artificielle | **hors-sujet** | « Intelligence artificielle applications » est le nom d'une société |
| 16 | 5fd90113a8a26697c6092936 | 2017-06-01 | secret des affaires | pertinente | pièces saisies, secret des affaires |
| 17 | 6079e66f9ba5988459c5c369 | 2015-11-10 | secret des affaires | pertinente | pièces internes confidentielles |
| 18 | 60c1aaa31ce32f2fbf7feebe | 2021-06-10 | secret des affaires | pertinente | mots-clés de saisie, secret des affaires |
| 19 | 67a3097deaef5a22b443b3ab | 2025-02-05 | secret, L. 151-1 | pertinente | violation du secret des affaires |
| 20 | 61372843cd580146774303b9 | 2012-09-26 | CSP | pertinente | hébergement de données de santé, L. 1111-8 |

Hors-sujet : **1 / 20** (5 %).

### CJUE (20)

| # | Décision | Date | Acte cité | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | 62024CO0511 | 2024-09-06 | DSA | pertinente | désignation de très grande plateforme, sursis |
| 2 | 62019CJ0401 | 2022-04-26 | 2019/790 | pertinente | article 17, filtrage des contenus |
| 3 | 62024CO0806 | 2026-06-03 | AI Act | pertinente | affaire AI Act (non-lieu à statuer) |
| 4 | 62019CJ0927 | 2021-09-07 | 2016/943 | pertinente | confidentialité des offres, secret des affaires |
| 5 | 62023TJ0348 | 2025-09-03 | DSA | pertinente | désignation de très grande plateforme |
| 6 | 62024TO0486 | 2025-02-13 | DSA | pertinente | registre de publicité, sursis |
| 7 | 62024CO0620 | 2025-02-25 | DSA | pertinente | désignation de très grande plateforme, sursis |
| 8 | 62023CJ0336 | 2024-11-21 | 2019/1024 | pertinente | réutilisation de documents du secteur public |
| 9 | 62017CJ0299 | 2019-09-12 | 2019/790 | pertinente | droits voisins de la presse |
| 10 | 62023CJ0186 | 2025-05-08 | 2019/790 | pertinente | transposition du droit d'auteur |
| 11 | 62021CJ0054 | 2022-11-17 | 2016/943 | pertinente | accès aux informations non confidentielles |
| 12 | 62023CJ0238 | 2025-05-22 | 2019/1024 | pertinente | transposition des données ouvertes |
| 13 | 62023CO0693 | 2024-03-22 | Data Act | **hors-sujet** | résolution bancaire, citation d'acte sans rapport avec les motifs |
| 14 | 62024TO0138 | 2024-07-02 | DSA | pertinente | désignation de très grande plateforme, sursis |
| 15 | 62002CJ0203 | 2004-11-09 | 96/9 | pertinente | droit sui generis des bases de données |
| 16 | 62007CJ0545 | 2009-03-05 | 96/9 | pertinente | extraction substantielle d'une base de données |
| 17 | 62012CJ0355 | 2014-01-23 | droit d'auteur | pertinente | mesures techniques de protection |
| 18 | 61999CJ0370 | 2001-01-11 | 96/9 | pertinente | non-transposition de la directive bases de données |
| 19 | 62023CJ0211 | 2025-05-08 | 2019/790 | pertinente | transposition du droit d'auteur |
| 20 | 62010CJ0604 | 2012-03-01 | 96/9 | pertinente | droit d'auteur sur une base de données |

Hors-sujet : **1 / 20** (5 %).

## Taux de hors-sujet

**2 / 60 = 3,3 %** (CE 0, CC 1, CJUE 1), sous le seuil de 10 %.
Causes : un nom de société (« Intelligence artificielle applications ») pour `cc` ; une citation
d'acte sans rapport avec les motifs (résolution bancaire) pour `cjue`. Les deux critères
fautifs sont bornés (expression exacte, citation CELLAR) et ne produisent qu'un cas chacun ;
aucun resserrement supplémentaire n'est appliqué, le taux restant très en deçà du seuil.

## Décision

Volume ajouté 23 087 fragments (**14,7 %** de l'index, seuil 47 000 non atteint) et hors-sujet
3,3 % : **ingestion**. Les corpus ont été reconstruits par `ce:sync`, `cc:sync` et `cjue:sync`,
puis l'index mis à jour en incrémental par `npm run corpus:index`.

## Vérification après ingestion

- Corpus : `ce` 2 627 décisions / 31 390 fragments ; `cc` 735 / 15 670 ; `cjue` 312 / 29 318.
  Aucune décision ni référence antérieure à #143 ne manque dans les trois corpus.
- Index : première passe **23 133 ajoutées, 0 modifiée, 0 supprimée, 156 706 inchangées** ;
  après la correction de liste CELLAR (retrait de `62025CO0502`), seconde passe **0 ajoutée,
  0 modifiée, 46 supprimées, 179 793 inchangées** — 179 793 unités au total.
- `decisions_citant` : CRPA L. 321-1 → 2 décisions du Conseil d'État (toutes deux ajoutées par
  #143) ; C. com. L. 151-1 → 16 (10 Cour de cassation, 6 Conseil d'État) ; CPI L. 342-1 → 9
  (6 Cour de cassation, 3 Conseil d'État).
- Recherche « secret des affaires communication document administratif » : quatre décisions du
  Conseil d'État au top 5, toutes ajoutées par #143 (`CETATEXT000052031228`,
  `CETATEXT000049631269`, `CETATEXT000054534126`, `CETATEXT000047357723`), derrière l'article du
  CRPA livre III.
- `npm run typecheck`, `npm test` (1 414 réussis, 0 échec, 1 ignoré) et `npm run build` verts.

## Itération 2 — resserrement demandé

Date : 2026-11-26. Les cinq resserrements portent sur les critères élargis seulement ; le filtre
historique est inchangé, et aucune décision présente sur `main` avant #143 n'est retirée.

1. **C. pén. 226-13** : le nom du code et un contexte de santé (médecin, médical, patient, soins,
   établissement ou données de santé, secret médical) doivent tous deux tenir dans la fenêtre de
   160 caractères autour de l'article.
2. **Code du patrimoine** : seuls les articles du livre II (L. 211-1 à L. 222-3, R. 211 et R. 212)
   comptent ; le motif `l (?:21[1-7]|22[12])` remplace `l 21[1-7]`, et `r 21[12]` est ajouté.
3. **CRPA livre III** : l'article L. 300-1 à L. 327-1 doit être accompagné, dans la fenêtre, du nom
   du code et d'un contexte de communication, réutilisation, document administratif, CADA,
   publication en ligne ou informations publiques. `pertinence.ts` accepte désormais plusieurs
   motifs de contexte, tous exigés.
4. **Secret des affaires** (`ce`, `cc`) : l'expression doit apparaître au moins deux fois
   (`occurrences_min: 2`) ; une citation de C. com. L. 151-1 à L. 154-1 ou de la directive
   2016/943 continue de suffire par son propre critère.
5. **CJUE par citation d'acte** : `mcp/corpus/cjue/pertinence.ts` ne retient une décision listée
   par le seul critère `acte_cite` que si l'acte figure dans le titre ou les mots-clés, ou s'il est
   cité au moins deux fois dans les motifs qui suivent l'« Appréciation de la Cour » (le rappel du
   cadre juridique et les arguments des parties ne comptent pas). Les mentions qu'un motif déclare
   sans lien avec le litige (« aucun lien avec le présent recours », « non pas la directive X, mais
   la directive Y ») sont écartées. Le filtre ne touche ni la matière, ni les notions, ni la veille,
   ni les CELEX complémentaires.

### Volume après resserrement

| Corpus | Décisions avant | Décisions après | Fragments avant | Fragments après | Part de l'index après |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ce` | 1 033 | 898 | 10 616 | 8 557 | 4,9 % |
| `cc` | 330 | 240 | 7 445 | 5 826 | 3,3 % |
| `cjue` | 55 | 47 | 5 026 | 4 109 | 2,3 % |
| **Total** | **1 418** | **1 185** | **23 087** | **18 492** | **10,6 %** |

Index après passe incrémentale : **175 198 unités** (contre 179 793) ; seuil d'arrêt 47 000
fragments (30 %) toujours non atteint.

### Comptes par critère (décisions ajoutées)

| Corpus | Critère | Avant | Après |
| --- | --- | ---: | ---: |
| `ce` | accès aux documents administratifs | 634 | 634 |
| `ce` | CRPA livre III | 214 | 166 |
| `ce` | secret des affaires | 120 | 47 |
| `ce` | code pénal 226-13 | 69 | 9 |
| `ce` | code du patrimoine | 18 | 22 |
| `ce` | autres critères | ≤ 75 | ≤ 75 |
| `cc` | secret des affaires | 265 | 168 |
| `cc` | code du patrimoine | 8 | 15 |
| `cc` | CRPA livre III | 11 | 7 |
| `cc` | code pénal 226-13 | 10 | 1 |
| `cc` | autres critères | ≤ 17 | ≤ 17 |
| `cjue` | citation d'acte (ajouts / déjà présents) | 57 / 5 | 47 / 5 |

Le patrimoine gagne 4 décisions pour `ce` et 7 pour `cc` : les articles L. 221, L. 222 et R. 211,
R. 212 du livre II entrent dans le motif. Les 139 décisions `ce` et 97 décisions `cc` retirées le
sont par les critères 226-13 (60 + 9), secret des affaires (73 + 97), CRPA (48 + 4) ; 9 décisions
`cjue` sont écartées par le texte (`acte_sans_rapport`), dont 62023CJ0198 et 62023CJ0212.

### Échantillon (60 décisions, graine 1431)

Sélection : 20 décisions ajoutées par corpus, triées par `sha256("echantillon-1431:<id>")`.

#### Conseil d'État (20)

| # | Décision | Date | Critère | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | CETATEXT000020868529 | 2009-04-10 | accès | pertinente | refus de communiquer des documents judiciaires, avis CADA |
| 2 | CETATEXT000007689309 | 1983-10-07 | accès | pertinente | accès au dossier personnel, loi du 17 juillet 1978 |
| 3 | CETATEXT000051646885 | 2025-05-20 | CRPA, accès | pertinente | communication de la décision de permis, L. 311-1 |
| 4 | CETATEXT000031495037 | 2015-11-18 | accès | pertinente | communication de documents pénitentiaires au juge des référés |
| 5 | CETATEXT000048573325 | 2023-12-15 | CRPA | pertinente | communication des comptes rendus de contrôle, L. 311-6 |
| 6 | CETATEXT000036233190 | 2017-12-15 | CRPA, accès | pertinente | avis CADA, noms des agents du CACIR |
| 7 | CETATEXT000028411919 | 2013-12-26 | communication, accès | pertinente | données sources des études sur le Mediator |
| 8 | CETATEXT000007836567 | 1994-06-20 | accès | pertinente | communication de procès-verbaux d'enquête, CADA |
| 9 | CETATEXT000053163173 | 2025-12-23 | CRPA, accès | pertinente | communication des rendus de numérisation 3D du musée Rodin |
| 10 | CETATEXT000029177093 | 2014-06-25 | base + producteur | **hors-sujet** | copie privée : « producteur » de phonogrammes, pas une base de données |
| 11 | CETATEXT000007834119 | 1992-11-18 | loi 51-711 | pertinente | recensement, chiffre de la population légale |
| 12 | CETATEXT000007918030 | 1996-09-30 | 226-13 | pertinente | contrôle médical et secret professionnel, contexte de santé |
| 13 | CETATEXT000019247011 | 2008-07-25 | accès | pertinente | communication des comptes annuels du CEA |
| 14 | CETATEXT000050935923 | 2024-12-31 | patrimoine | **hors-sujet** | police de l'eau : L. 214-17 du code de l'environnement cité près du « code du patrimoine » (monuments) |
| 15 | CETATEXT000041753781 | 2020-03-20 | secret, L. 151-1 | pertinente | publication de la décision de l'Autorité de la concurrence, secret des affaires |
| 16 | CETATEXT000007834535 | 1994-01-19 | accès | pertinente | délivrance de copies, frais |
| 17 | CETATEXT000007784141 | 1991-10-23 | accès | pertinente | communication des actes de vente, CADA |
| 18 | CETATEXT000033308550 | 2016-10-21 | CRPA, communication | pertinente | communication du rapport de l'inspection du travail |
| 19 | CETATEXT000007727575 | 1988-03-25 | accès | pertinente | délai de l'avis CADA, accès aux actes notariés |
| 20 | CETATEXT000038351111 | 2019-04-05 | CRPA, accès | pertinente | communication de documents d'une association foncière urbaine |

Hors-sujet : **2 / 20**.

#### Cour de cassation (20)

| # | Décision | Date | Critère | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | 5fca5830e68210229ff28857 | 2020-03-25 | secret des affaires | pertinente | expertise in futurum et proportionnalité au secret |
| 2 | 5fd91ab5eb0eedb6c7f7b75e | 2016-11-03 | secret des affaires | pertinente | secret des affaires et secret professionnel face à l'article 145 |
| 3 | 639192726d1e4f05d4f680c4 | 2022-12-08 | secret des affaires | pertinente | séquestre provisoire des pièces |
| 4 | 683fe302669ab9459096099c | 2025-06-04 | secret des affaires | pertinente | comptes réglementaires couverts par le secret |
| 5 | 61372840cd580146774302c0 | 2012-09-11 | base de données | pertinente | extraction illicite d'une base de données |
| 6 | 5fd8f5775def058982fd5e67 | 2017-10-19 | secret des affaires | pertinente | compte d'exploitation, secret des affaires |
| 7 | 5fca5cca2eee9739cc966f36 | 2020-01-29 | secret des affaires | pertinente | protection de pièces devant l'Autorité de la concurrence |
| 8 | 61372923cd58014677434aaa | 2015-02-10 | secret des affaires | pertinente | secret des affaires et article 145 |
| 9 | 6979b374cdc6046d47f27461 | 2026-01-28 | secret des affaires | pertinente | séquestre provisoire et délai d'appel |
| 10 | 60794ccb9ba5988459c470a8 | 1998-06-24 | secret des affaires | pertinente | expertise et secret des affaires |
| 11 | 6af55f1b6c2e1778128884a8 | 2026-11-12 | intelligence artificielle | **hors-sujet** | « Intelligence artificielle applications » est le nom d'une société |
| 12 | 6079e1509ba5988459c5c12a | 2015-02-10 | secret des affaires | pertinente | rétractation d'une ordonnance sur requête |
| 13 | 66d805188c253fd3db1c2d3f | 2024-09-04 | secret, L. 151-1 | pertinente | déclassement de pièces, L. 151-1 du code de commerce |
| 14 | 666a8c01c0b8d3000801907c | 2024-06-13 | CSP | pertinente | audiogramme et données de santé, L. 1110-4 |
| 15 | 613727e2cd5801467742e4d7 | 2011-09-06 | secret des affaires | **hors-sujet** | correspondance privée écartée des débats, pas un secret d'affaires |
| 16 | 60797df49ba5988459c4a23d | 2014-06-26 | secret des affaires | pertinente | atteinte au secret non établie, mesure d'instruction |
| 17 | 5fca6df2daa7d15907eedb82 | 2019-06-05 | secret des affaires | pertinente | comptes réglementaires, confidentialité |
| 18 | 63bfb6f05e2fbe7c90043b5d | 2023-01-12 | secret, L. 153-1 | pertinente | saisie et tri des pièces |
| 19 | 5fca8d5d7a23107fe4b166a7 | 2018-06-12 | patrimoine | pertinente | L. 211-4, caractère public des archives |
| 20 | 6137294acd580146774355f7 | 2015-07-01 | secret des affaires | **hors-sujet** | prix de logiciels : secret opposé par le vendeur dans un litige de consommation |

Hors-sujet : **3 / 20**.

#### CJUE (20)

| # | Décision | Date | Acte cité | Verdict | Raison |
| ---: | --- | --- | --- | --- | --- |
| 1 | 62010CJ0604 | 2012-03-01 | 96/9 | pertinente | droit d'auteur sur les calendriers, base de données |
| 2 | 62011CJ0138 | 2012-07-12 | 96/9 | pertinente | données du registre du commerce, droit sui generis |
| 3 | 62023TJ0367 | 2025-11-19 | DSA | pertinente | désignation de très grande plateforme |
| 4 | 62023TJ0348 | 2025-09-03 | DSA | pertinente | désignation de Zalando |
| 5 | 62023CJ0336 | 2024-11-21 | Open Data | pertinente | réutilisation de documents du secteur public |
| 6 | 62023CJ0201 | 2025-09-04 | 2019/790 | pertinente | manquement de transposition |
| 7 | 62019CJ0927 | 2021-09-07 | 2016/943 | pertinente | confidentialité des offres |
| 8 | 62012CJ0355 | 2014-01-23 | 96/9 | **hors-sujet** | mesures techniques de la directive 2001/29, 96/9 citée dans une définition |
| 9 | 62002CJ0046 | 2004-11-09 | 96/9 | pertinente | droit sui generis, notion d'investissement |
| 10 | 62002CJ0203 | 2004-11-09 | 96/9 | pertinente | partie substantielle de la base de données |
| 11 | 62007CJ0545 | 2009-03-05 | 96/9 | pertinente | extraction de données juridiques officielles |
| 12 | 62023CO0647 | 2024-01-11 | DSA | pertinente | intervention dans un litige DSA |
| 13 | 62023CJ0215 | 2025-05-22 | Open Data | pertinente | transposition incomplète |
| 14 | 62025CO0502 | 2025-12-18 | AI Act | pertinente | renvoi préjudiciel sur l'AI Act, irrecevable |
| 15 | 62024CO0806 | 2026-06-03 | AI Act | pertinente | non-lieu à statuer, litige AI Act |
| 16 | 62023CJ0238 | 2025-05-22 | Open Data | pertinente | transposition incomplète |
| 17 | 62002CJ0444 | 2004-11-09 | 96/9 | pertinente | notion de base de données |
| 18 | 62024CO0620 | 2025-02-25 | DSA | pertinente | désignation de très grande plateforme |
| 19 | 62024CO0511 | 2024-09-06 | DSA | pertinente | désignation de très grande plateforme |
| 20 | 62012CJ0202 | 2013-12-19 | 96/9 | pertinente | droit sui generis, métamoteur de recherche |

Hors-sujet : **1 / 20**.

### Taux de hors-sujet

**6 / 60 = 10,0 %** (CE 2, CC 3, CJUE 1). Les cas limites sont comptés hors-sujet : copie privée
où « producteur » désigne le phonogramme, article du code de l'environnement cité près du « code du
patrimoine », correspondance privée et prix de logiciels où le secret n'est qu'un argument, 96/9
rappelée dans une définition. Les trois premiers relèvent de l'ambiguïté connue des critères
(expression ou numéro d'article partagé) et non des cinq resserrements demandés ; ils sont signalés
sans nouveau changement de règle, le taux restant à la limite acceptée.

### Vérification après resserrement

- Aucune décision présente sur `main` avant #143 n'est sortie : `ce` 0, `cc` 0, `cjue` 0
  (`git show origin/main:data/corpus/<c>/unites.jsonl`).
- Synchronisations sur le cache : `ce` 2 492 décisions / 29 331 fragments, `cc` 645 / 14 051,
  `cjue` 304 / 28 401. Aucun téléchargement de décision pour `cjue` ; `cc` 0 décision lue ;
  `ce` a relu l'archive locale, sans retéléchargement.
- Index incrémental : **252 ajoutées, 0 modifiée, 4 847 supprimées, 174 946 inchangées**
  (4 décisions `ce`, 7 `cc`, 1 `cjue` nouvelles entrées par les motifs de patrimoine élargis et le
  retour de `62025CO0502`) ; 175 198 unités au total, aucune unité conservée recalculée.
- `npm run typecheck`, `npm test` (1 422 tests, 1 421 réussis, 0 échec, 1 ignoré) et
  `npm run build` verts. Tests ajoutés : un reçu et un écarté par resserrement, dont
  `62025CJ0999` (acte dans le titre) et `62025CJ0998` / `62025CJ0997` (citation passagère).
