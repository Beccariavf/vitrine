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

Ces comptes sont les deltas réels des corpus (`git show HEAD~1:data/corpus/<c>/unites.jsonl` face aux fichiers ingérés).
La mesure `cc` par les seules 11 requêtes nouvelles donnait 315 décisions / 7 170 fragments ; la
synchronisation réelle, qui rejoue aussi les 22 requêtes historiques sur le cache, porte le corpus
à 330 décisions / 7 445 fragments. Les comptes par critère du manifeste (`ajouts_par_critere`)
excluent les décisions déjà présentes par la veille : ils donnent 329 décisions / 7 427 fragments
pour `cc` et 57 pour `cjue`, la différence avec le delta étant des décisions déjà au corpus avant
la passe. La liste CELLAR a retiré `62025CO0502` entre deux passes : il n'était pas au corpus avant
#143, donc aucune décision antérieure n'est perdue ; l'index a supprimé ses 46 unités.

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
