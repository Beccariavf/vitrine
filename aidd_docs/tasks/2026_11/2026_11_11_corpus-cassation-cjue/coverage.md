# Couverture des corpus

Comptes lus dans les `manifest.json` du 14 novembre 2026 (13 novembre pour les corpus inchangés, 15 novembre pour `metadonnees`), jamais recopiés depuis un autre rapport.

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 299 (119 articles de la consolidation `02024R1689-20260727` + 180 considérants de l'acte d'origine) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` et `lov2`, écart déclaré ; DILA : Licence Ouverte 2.0 |
| `cnil_doctrine` | 56 (30 guides, 26 référentiels) | 4 459 | documents datés de 2019-11-21 à 2026-11-14 ; 2 listes AIPD laissées au corpus `cnil` | cnil.fr — pages de référence (guides, référentiels, listes AIPD) | CC BY-ND 4.0, marquage par fragment ; listes AIPD en Licence Ouverte via `cnil` |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart` | Licence Ouverte 2.0 (Etalab) |
| `textes_fr` | 12 (36 blocs) | 626 articles en vigueur (décret 2019-536 : 166 ; Code pénal : 31 — 226-16 à 226-24, 226-1, 226-8-1, 226-13, chapitre 323 ; CPCE L32-3, L34-1, L34-5 : 3 ; Code du travail : 5 ; Code de la santé publique : 394 — L1110, L1111, L1121 à L1126, L1130 à L1133, L1141, SNDS L1460/L1461, L1470, L6316, articles isolés et parties réglementaires R1110, R1111, R1461, R1470, R6316 ; Code de la sécurité sociale : 3 ; Code des assurances : 2 ; CGCT : 1 ; Code de la sécurité intérieure titre V du livre II : 18 ; Code monétaire et financier : 1 ; CRPA : 1 ; Code civil art. 9 : 1) ; 37 abrogés écartés | consultés le 2026-11-25 | PISTE — Légifrance `/consult/legiPart`, `/consult/code`, `/consult/getArticleWithIdAndNum` | Licence Ouverte 2.0 (Etalab) |
| `preparation` | 8 propositions + 120 affaires pendantes | 128 (8 propositions, 120 affaires ; 35 affaires présumées) | propositions 2022-03-22 → 2026-06-23 ; affaires 2019-01-07 → 2026-09-25 | CELLAR / EUR-Lex, SPARQL et communications du Journal officiel en XHTML | Décision 2011/833/UE (CC BY 4.0) |
| `ce` | 1 594 | 20 774 | 1982-03-12 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `constit` | 108 | 5 775 | 1982-12-14 → 2026-08-14 | DILA — CONSTIT, XML Légifrance | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 328 | 20 287 | 2018-04-11 → 2026-11-10 | CEPD, sitemap des pages `_fr` et `_en` et PDF | Régime ouvert (notice de copyright du CEPD) |
| `cc` | 403 | 8 194 | 1986-07-21 → 2026-11-10 | PISTE — Judilibre `/search` et `/decision` | Licence Ouverte 2.0 (Etalab) et CGU Judilibre |
| `cjue` | 251 | 23 460 | 1999-10-14 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notions `4.11.01` et `2.04` + 4 CELEX, XHTML français puis anglais, repli HTML patrimonial | Décision 2011/833/UE (CC BY 4.0) |
| `metadonnees` | 1 595 identifiants (1 597 notices) | 1 597 notices, aucun texte | 2018-09-12 → 2026-08-10 | CEPD — registre des décisions définitives du guichet unique (art. 60 RGPD) ; source CEDH (HUDOC) arrêtée, motif au manifeste | Notice de copyright du CEPD |

## Détail `ce`

- Archive JADE globale du 8 novembre 2026, fonds `jade/global/publie` et `jade/global/inedit`, lus en flux.
- 573 525 entrées lues : 1 594 retenues, 399 198 autres juridictions, 167 044 sans mot-clé, 5 627 textes vides, 0 date invalide ; 62 doublons d'identifiant entre les deux fonds.
- 174 265 décisions du Conseil d'État valablement datées, toutes dates, avant mots-clés (`decisions_ce`, doublons de fonds compris) ; aucune borne de date n'est appliquée, ni au descripteur ni au filtrage.
- Fonds `publie` : 282 décisions / 4 430 fragments ; fonds `inedit` : 1 312 / 16 344.
- `periode.date_min` et `periode.date_max` sont les premières et dernières dates observées dans le corpus (1982-03-12 → 2026-10-27).
- Filtre inchangé : juridiction normalisée exactement « Conseil d'État » et au moins un mot-clé du descripteur (`données personnelles`, `données à caractère personnel`, `informatique et libertés`, `protection des données`, `RGPD`, `règlement général sur la protection des données`, `commission nationale de l'informatique et des libertés`, `CNIL`). Un seul mot-clé suffit : le corpus contient des faux positifs (par exemple `CETATEXT000028411879`, où la CNIL n'est que créancière de frais), et 132 166 des 167 044 exclusions sans mot-clé sont antérieures à 2014 — « toutes dates » ne veut pas dire « toute la jurisprudence ».
- 282 décisions sur les 138 074 décisions du Conseil d'État antérieures à 2014 sont retenues. Les 5 627 entrées sans texte intégral (`BLOC_TEXTUEL/CONTENU` vide) n'ont qu'un sommaire dans l'archive, que le parseur ne lit pas : une partie de la jurisprudence ancienne reste donc hors d'atteinte, même sans borne.

## Détail `constit`

- Archive CONSTIT du 8 novembre 2026 (`Freemium_constit_global_20261108-140000.tar.gz`, 13 Mo), lue en flux : 7 423 entrées, 2 045 décisions DC/QPC toutes dates, 108 retenues (77 DC, 31 QPC), 5 775 fragments, 4 doublons de numéro + nature résolus au profit de l'identifiant le plus récent.
- Exclusions : 5 378 documents de natures hors périmètre (contentieux électoral `AN` 4 171, `SEN` 306, lois `L` 338, `ORGA` 169, etc.), 1 933 DC/QPC sans mot-clé, 0 texte vide, 0 date invalide.
- Filtre : mots-clés du descripteur CE, ou « vie privée » associée à `données de connexion`, `traitement(s) automatisé(s)`, `traitement(s) de données` ou `fichier automatisé`. Il lit le texte publié entier (décision, saisines, observations) ; les unités sont découpées dans le `BLOC_TEXTUEL` seul, les saisines et observations ne sont jamais indexées. Le compte rejoint la cible du spike #37 (108 décisions au stock du 2026-11-08).
- 108 = 112 retenues avant doublons, dont 6 admises par la saisine seule (82-148, 91-302, 93-325, 94-352, 96-377 et 96-378 DC) : le filtre lit le texte publié entier, les unités restent la décision seule. Les 4 doublons sont des publications identiques.
- La décision la plus récente de l'archive est datée du 2026-10-16, soit 29 jours avant l'extraction du 2026-11-14 ; aucun incrément CONSTIT n'est publié à cette date. Le manifeste porte `couverture.retard_archive`.
- Natures et lien officiel : `nature` vaut `DC` ou `QPC`, `numero` les associe (`2018-765 DC`), l'URL vient de `URL_CC` (https).

## Détail `cc`

- 22 phrases de recherche, `field=text`, `operator=and`, aucune borne de date (ni `date_start` ni `date_end`).
- 1 348 décisions lues : 403 retenues, 945 écartées `hors_sujet`, 0 `date_invalide`, 0 `texte_vide`.
- 705 doublons de recherche ; 4 entrées Judilibre de `data/entries/` incluses et retenues (`veille.entrees: 4`, `veille.retenues: 4`) ; une décision de la veille échappe au filtre de pertinence par construction.
- Filtre : visa citant un instrument de protection des données, ou au moins 2 occurrences d'une expression centrale. Au 11 novembre 2026, `CNIL` seul ne suffisait plus (51 décisions retirées par le durcissement du filtre : 36 sans aucune autre expression, 15 avec une seule occurrence). 147 décisions n'ont pas de visa dans Judilibre. 1 535 fragments dépassent 1 200 caractères (un paragraphe long reste entier, maximum 28 852). Aucun identifiant introuvable.
- 51 décisions retenues sont antérieures à 2014, la plus ancienne au 1986-07-21 : la borne n'existe plus, ni au descripteur ni dans `exclusions`.
- Le filtre de pertinence est resté celui du ticket précédent, comme le plan l'imposait ; l'élargissement laisse donc entrer des faux positifs que le corpus de 2014 ne rencontrait guère. Relevé sur les 51 nouvelles décisions : « protection des données confidentielles » (secret des affaires, `613727efcd5801467742e936`), nom de disque « D:/données personnelles » (`61372838cd580146774300a0`), contentieux électoral où la loi 78-17 n'apparaît qu'au troisième moyen (`6079b1019ba5988459c50e9a`). Côté Conseil d'État, un seul mot-clé suffit : la Cour des comptes y rend deux agents débiteurs de la CNIL (`CETATEXT000028411879`), et la jurisprudence fondatrice voisine avec des moyens incidents. Durcir ce filtre est hors de ce ticket.
- `periode.date_min` et `periode.date_max` sont les premières et dernières dates observées dans le corpus ; le manifeste ne porte plus de `couverture.borne`.
- Le corpus n'est pas une collection exhaustive de la Cour de cassation : c'est un sous-ensemble déclaré, borné par 22 phrases et par le filtre de pertinence ; Judilibre ne sert pas le texte de toutes les décisions.

## Détail `cjue`

- SPARQL CELLAR, union de la matière `PDON` et de deux notions fines, `fd_578/4.11.01` (« Protection des données à caractère personnel ») et `fd_578/2.04` (« Protection des données à caractère personnel par les institutions de l'Union »), CELEX `6…`, **sans borne de date** ; un CELEX explicite (`62018CJ0746`, Prokuratuur) que CELLAR ne classe pas dans les données personnelles. Types retenus : `CJ`, `TJ`, `CO`, `TO` ; conclusions d'avocat général (`CC`) et autres types écartés et comptés.
- 361 CELEX listés et 4 complémentaires : 251 retenus, 95 conclusions d'avocat général (`CC`), 5 autres types, 14 sans aucune représentation téléchargeable (404 en XHTML et en HTML, toutes langues) ; `documents_lus` vaut 365, soit exactement les documents retenus plus les exclusions (251 + 95 + 5 + 14).
- Types des 251 décisions retenues : 170 arrêts de la Cour, 52 arrêts du Tribunal, 14 ordonnances de la Cour, 15 ordonnances du Tribunal.
- Antériorité : 40 décisions sont datées d'avant 2014 (1999-10-14 → 2013-12-12). Les 45 décisions des types retenus que l'ancienne borne comptait à part (`couverture.avant_borne`, supprimé) sont donc au corpus, sauf 5 (`62002TJ0179`, `62007TJ0392`, `62009TJ0241`, `62010TJ0308`, `62011TJ0214`) : CELLAR ne sert pour elles qu'une notice RDF, sans texte. Lindqvist (C-101/01, `62001CJ0101`, 6 novembre 2003) est au corpus avec ses points `#point1` à `#point100`.
- Deux rendus : le XHTML moderne, puis le HTML patrimonial servi aux arrêts anciens (`data/raw/cjue/<CELEX>.html`, marqueurs `<dt>N</dt>`, ancres `pointN` ou numéro en tête de paragraphe) ; 72 des 86 décisions sans XHTML ont ainsi été récupérées. Le HTML patrimonial porte la date des conclusions avant celle de l'arrêt : la date CELLAR fait foi pour lui, l'en-tête du XHTML pour le rendu moderne.
- Six décisions (`62004CJ0475`, `62002TJ0320`, `62003TJ0259`, `62004TJ0161`, `62009TJ0082`, `62010TJ0190`) ne sont servies par CELLAR que sous forme de résumé, sans motifs ; elles entrent au corpus pour ce que la source en donne.
- Langue : un seul rendu par décision, la première servie — français d'abord, anglais après un 404 français. `couverture.langues` = 250 `fra`, 1 `eng` (`62002TJ0320`, arrêt du Tribunal servi seulement en anglais) ; aucune décision du corpus n'existe uniquement en XHTML anglais.
- `periode.date_min` est la première date observée (1999-10-14) ; le manifeste ne porte plus ni `date_min` ni `couverture.borne`.
- La notion `4.11.01` récupère La Quadrature du Net (C-511/18) ; Prokuratuur (C-746/18) est ajouté par la liste explicite. Le manifeste porte `couverture.notions` (deux entrées), `celex_complementaires` et `complementaires_ajoutes`.
- La notion `4.11.01` est large : six décisions ajoutées (douanes, droit d'auteur, agents FIFA, État de droit, réparation automobile, ne bis in idem) ne traitent les données personnelles que dans une partie de leur raisonnement. Elles restent dans le corpus, la source officielle et son libellé étant déclarés.
- Le contrôle du 14 novembre 2026 par la fiche thématique Curia « Protection des données à caractère personnel » a fait entrer trois arrêts que le classement CELLAR ne donnait pas : C-461/10 (Bonnier Audio, `62010CJ0461`), C-37/20 et C-601/20 (`62020CJ0037`), C-339/20 et C-397/20 (`62020CJ0339`). Prokuratuur (`62018CJ0746`) était déjà complémentaire.
- La synchronisation de ce contrôle s'est faite sans cache `data/raw/cjue/` (non commité) : elle a relu les 251 arrêts, et EUR-Lex a actualisé la graphie « État » dans 287 fragments de 19 décisions. Aucun texte n'a été édité à la main.

## Détail `cepd`

- Sitemap du 14 novembre 2026 (`https://www.edpb.europa.eu/sitemap.xml`, pages 1 à 5), rubriques réelles `guideline`, `opinion-of-the-board-art-64`, `edpb-binding-decisions` et `recommendation`. La page française est retenue quand elle existe, l'anglaise sert de repli ; le PDF français est préféré, puis l'anglais.
- 341 documents listés, 328 retenus : 263 avis art. 64 (7 770 fragments), 43 lignes directrices (6 914), 12 décisions contraignantes art. 65 (4 571), 9 recommandations (841) et 1 document G29 repris (191, WP260 Transparence). Les documents du G29 sont reconnus à leur titre, à leur slug ou à la phrase d'endossement de la page.
- Langues des textes retenus : 154 français, 174 anglais. Seul le marqueur terminal du nom de PDF compte, et un PDF sans suffixe de langue suit la langue de sa page ; le manifeste porte `documents_langues` et `documents_types` document par document.
- 7 documents sont des versions de consultation (`statut: projet`, 1 268 fragments) : la page porte « Public consultation ongoing/closed » sans « Final version » ni « Version 2.0 ».
- 22 entrées écartées, toutes motivées (dont deux pages courtes, doublons de WP242 et WP260) : 7 sans PDF, 3 versions obsolètes (doublons anglais d'un même numéro), 2 où la page ne sert que l'annexe, 1 PDF sans rapport avec le document (WP242, dont la pièce jointe est une décision danoise) et 9 documents de la liste d'endossement du G29 (8 hébergés hors du site du CEPD, WP263 porté par un document EDPB hors des rubriques). 10 sont comptés `documents_sans_texte_ecartes`.
- La page d'endossement du G29 (16 documents) est rapprochée du corpus : 6 retenus, dont WP260 et cinq WP (259, 250, 244, 264, 256) représentés par leur successeur EDPB (`successeurs: 5`) ; 10 écartés, dont 8 hébergés sur `ec.europa.eu`, hors de la notice de copyright du CEPD.
- Licence : régime ouvert de la notice de copyright du CEPD ; chaque fragment porte son URL de page et son chemin `CEPD > <type> > <titre>`, et le serveur ne produit aucun résumé.

## Détail `cnil_doctrine`

- Synchronisation du 2026-11-14 : quatre pages de référence — guides (`fr/mediatheque?field_scald_collection_tid=29`, 26 PDF), guides AIPD (`fr/guides-aipd`, 4 PDF), référentiels (`fr/autres-referentiels`, 26 PDF), listes AIPD (`fr/listes-des-traitements-pour-lesquels-une-aipd-est-requise-ou-non`, 2 pages → 2 PDF).
- 56 documents ingérés (30 guides, 26 référentiels), 4 459 fragments. Les deux listes AIPD ne sont pas dupliquées : la liste requise est la délibération 2018-327 (`CNILTEXT000037560659`), la liste non requise la 2019-118 (`CNILTEXT000039249797`), toutes deux déjà au corpus `cnil` (Licence Ouverte) ; le manifeste les porte dans `couverts_par_cnil`.
- Aucun document écarté : l'heuristique de « mention contraire » (`tous droits réservés`, `reproduction interdite`, `all rights reserved`, `sous réserve de droits d'auteur`) n'a rien trouvé sur les 58 PDF.
- Les guides et référentiels sont sous CC BY-ND 4.0 : chaque fragment rendu porte « extrait non modifié · CC BY-ND 4.0 · lien », le titre, « Source : CNIL – https://www.cnil.fr » et la date d'extraction. Le serveur ne produit ni résumé ni reformulation.
- Les PDF bruts et leur cache vivent sous `data/raw/cnil-doctrine/` (non commité), adressés par leur `sha256` ; le cache des PDF vaut sept jours et `--refresh` le force. Les pages de référence sont relues à chaque passe, pour qu'un guide ajouté ou retiré soit vu. 47 documents sur 56 ne déclarent pas de date dans leur en-tête : leur `date_acte` est la date d'extraction, et le manifeste porte `date_source: "extraction"`.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 891 unités). Les corpus `cjue`, `ce` et `cc` ont été élargis les 13 et 14 novembre (sans borne de date) sans que ces rangs soient remesurés.

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Les rangs CJUE ont été rejoués le 14 novembre 2026 sur l'index de 83 994 unités (corpus `cjue` de 248 décisions et 23 188 fragments) : mêmes résultats, la calibration `dev` du harnais donne 1 `confiant` et 9 `incertain`. La recherche « Lindqvist diffusion de données personnelles sur une page Internet » (`corpus: "cjue"`, `k: 5`) rend C-101/01 aux rangs 1, 2 et 4 (`62001CJ0101#point14`, similarité 0,726), avec l'URL EUR-Lex française de l'arrêt. La recherche « données pseudonymisées identifiables par le destinataire » rend toujours C-413/23 P au premier rang (`62023CJ0413#point68`, similarité 0,729).

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.

## Détail `preparation`

- Synchronisation du 2026-11-14, source unique CELLAR SPARQL (`https://publications.europa.eu/webapi/rdf/sparql`) et communications du Journal officiel lues en XHTML français. Licence : décision 2011/833/UE (CC BY 4.0), mention portée au manifeste.
- Propositions : 41 dossiers candidats, 40 documents (matière `PDON` ou proposition de modification d'un acte du corpus ; `52018PC0636` est porté par deux dossiers), 8 retenus `PROP_PENDING` ; écartés 1 retiré, 13 documents adoptés (dont le Digital Omnibus IA `52025PC0836`, dossier `2025/0359/COD`), 18 sans statut de dossier. Une proposition par dossier, le corrigendum `R(01)` cédant au CELEX de base ; un même document porté par deux dossiers (`52018PC0636`) n'est compté qu'une fois.
- Titres : ceux que CELLAR sert, souvent en anglais ; CELLAR peut étiqueter `fr` un titre qui n'a pas été traduit. Le titre est repris tel quel, la langue n'est pas affirmée.
- Dernière étape : événement de date maximale ≤ 2026-11-14 ; les événements planifiés postérieurs (par exemple un vote du Conseil au 2026-11-19 pour `2025/0360/COD`) ne sont pas retenus.
- Affaires : 351 communications `CN`/`TN` Eurovoc 5181 ou 5595 depuis 2019, 231 écartées parce qu'une décision `CJ`/`CO` (Cour) ou `TJ`/`TO` (Tribunal) de même année et même numéro CELEX existe, 120 pendantes. La lettre de juridiction fait partie de la clé : `C-1/19` et `T-1/19` sont deux affaires distinctes. Une affaire jointe est fermée par le CELEX de son arrêt : `case-law_joins_case_court` ajoute les numéros joints (C-601/20 avec C-37/20, T-84/23 avec T-70/23, et une jonction inter-années pour T-607/25).
- 35 affaires durent depuis plus de trois ans sans décision : elles restent au corpus avec `pendant_presume: true`, et le manifeste les nomme. Aucune capture n'a manqué ; aucun texte vide.
- Preuve réelle : `search` borné à `preparation` sur « Digital Omnibus simplification du cadre législatif numérique » rend `2025/0360/COD` au rang 1, `statut_application: propose`, avec « Dernière étape : OPI_R1_byEP_CMT le 10/11/2026 » ; « affaire pendante pourvoi Latombe C-703/25 P » rend `C-703/25 P` au rang 1, `statut_application: pendant`. `get_article` et `get_decision` ne rendent aucun texte proposé applicable.

<!-- controle-curia:debut -->
## Contrôle par la fiche thématique Curia

Contrôle du 2026-11-14 : fiche « Protection des données à caractère personnel » (Juillet 2024), 51 numéros d'affaires pour 43 arrêts — 43 présents, dont 4 entré(s) par la liste complémentaire, 0 absent(s) avec raison, 0 manquant(s) sans raison.

Fiche : <https://curia.europa.eu/site/upload/docs/application/pdf/2018-10/fiche_thematique_-_donnees_personnelles_-_fr.pdf> (page <https://curia.europa.eu/site/jcms/d2_5127/fr/fiches-thematiques>), consultée le 2026-11-14.
Absents avec raison : aucun.
Rapport : `data/corpus/cjue/controle-curia.json`.
<!-- controle-curia:fin -->

## Détail `metadonnees`

- 1 597 notices, une par décision définitive du guichet unique, lues au registre du CEPD le 2026-11-15 : 146 pages, 1 603 lignes, 1 595 identifiants, 6 doublons. Aucune ne porte de texte : chaque unité est une ligne de métadonnées (identifiant `EDPBI:…`, autorité chef de file, date, sujets publiés par le registre, PDF officiel ou page du registre filtrée) et `metadonnees_seulement: true`.
- Le registre sert parfois la même décision sous deux noms de fichier ou depuis deux dossiers (`…_redacted.pdf` et `…_redacted_0.pdf`, `…_en_1.pdf`) : c'est le numéro de décision lu dans le PDF qui tranche, à défaut le nom normalisé. 6 lignes sont des doublons. Deux identifiants portent deux décisions distinctes (`decision-no-3850.pdf` / `decision-no-3851_1.pdf`, `decision-no-972-1.pdf` / `decision-no-973.pdf`) : les deux sont gardées, la seconde avec une référence suffixée `#2`. Deux notices n'ont pas de PDF : leur `url` ouvre le registre filtré sur leur identifiant. Ces limites sont déclarées (`couverture.limites`).
- **Source CEDH arrêtée.** L'interface de recherche de HUDOC (celle du site, `/app/query/results`) refuse le client du projet : 403 en alternance depuis Node quand curl reçoit 200 sur la même URL au même moment, et quatre tentatives espacées de 0, 60, 180 et 480 s pendant la passe. Le critère arbitré (article 8 de la Convention **et** mots-clés de données personnelles, collections `JUDGMENTS` et `DECISIONS`, communications exclues, versions FR et EN fusionnées) est conservé au descripteur et testé hors ligne ; le motif, la preuve et la reprise sont au manifeste (`couverture.perimetre.cedh_abandonnee`). Aucun contournement n'est tenté : ni changement de client, ni empreinte de navigateur imitée.
- Au rendu, chaque passage du corpus porte `metadonnees_seulement` et `avertissement_contenu` : « métadonnées seulement — contenu non connu du serveur, consulter la source ». Le statut d'application est `adoptee` pour une décision d'autorité, `rendue` pour une décision juridictionnelle.

<!-- delais:start -->
## Délais publication → corpus

Mesure du 2026-11-15 par `npm run veille:delais` (rapport daté : `data/corpus/delais.json`). Délai = date d'entrée au corpus moins `date_acte` ; la détection par la veille est rendue à part quand la source date sa lecture. Aucun chiffre n'est déduit : un corpus sans cas mesurable le dit. Un cas dont la publication précède la mise en route de la veille mesure ce démarrage, pas sa réactivité à l'état stable.

Cas détectés par la veille — publication, détection, entrée au corpus. La détection n'est datée que par les sources qui datent leur passe ; sinon l'étape publication → veille n'est pas chiffrée.

| Corpus | Cas mesurés | Médiane (jours) | Maximum (jours) | Exemple le plus long |
|---|---:|---:|---:|---|
| `aiact` | 1 | 110 | 110 | 32024R1689 : 110 jours (publication → veille 110 j, veille → corpus 0 j) |
| `cc` | 4 | 22 | 35 | 6ac6079ec27382d099f5a06e : 35 jours (détection par la veille non datée) |
| `ce` | 9 | 20 | 73 | CETATEXT000054762056 : 73 jours (détection par la veille non datée) |
| `cjue` | 1 | 6 | 6 | 62025CJ0205 : 6 jours (détection par la veille non datée) |
| `cnil` | 2 | 222 | 430 | CNILTEXT000052182222 : 430 jours (détection par la veille non datée) |

Collecte initiale — documents récents qu'aucune entrée de veille ne désigne, publication → entrée au corpus. Ce n'est pas le délai d'une nouveauté : le corpus les a lus en une passe.

| Corpus | Documents | Médiane (jours) | Maximum (jours) | Document le plus long |
|---|---:|---:|---:|---|
| `adequation` | 3 | 330 | 330 | 32025D2571 : 330 jours |
| `cc` | 2 | 3.5 | 6 | 6aed6b376c2e1778124430e0 : 6 jours |
| `ccs` | 1 | 1989 | 1989 | 32021D0914 : 1989 jours |
| `ce` | 2 | 20 | 20 | CETATEXT000055005463 : 20 jours |
| `cepd` | 3 | 4 | 32 | opinion-242026-on-the-draft-decision-of-the-french : 32 jours |
| `cjue` | 2 | 53.5 | 69 | 62024CJ0798 : 69 jours |
| `cnil` | 2 | 35.5 | 53 | CNILTEXT000054908904 : 53 jours |
| `cnil_doctrine` | 3 | 1227 | 1384 | guide-referentiel-recrutement : 1384 jours |
| `constit` | 3 | 100 | 114 | CONSTEXT000054617305 : 114 jours |
| `eprivacy` | 1 | 8891 | 8891 | 32002L0058 : 8891 jours |
| `eudpr` | 1 | 2944 | 2944 | 32018R1725 : 2944 jours |
| `lil` | 1 | 2718 | 2718 | LEGITEXT000006068624 : 2718 jours |
| `metadonnees` | 3 | 107 | 121 | EDPBI:NO:OSS:D:2026:4219 : 121 jours |
| `police` | 1 | 3853 | 3853 | 32016L0680 : 3853 jours |
| `preparation` | 3 | 69 | 86 | 62026TN0556 : 86 jours |
| `rgpd` | 1 | 3843 | 3843 | 32016R0679 : 3843 jours |
| `rgpdproc` | 1 | 353 | 353 | 32025R2518 : 353 jours |
| `textes_fr` | 3 | 1001 | 2302 | LEGITEXT000006070987 : 2302 jours |

Retards d'archive déclarés par les manifestes :

- `constit` : dernière décision du 2026-10-16, archive du 2026-11-08, soit 23 jours jusqu'à l'archive et 29 jours jusqu'à l'extraction (6 jours de plus entre l'archive et l'extraction du 2026-11-14).
<!-- delais:end -->
