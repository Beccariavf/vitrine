# Couverture des huit corpus

Comptes lus dans les `manifest.json` du 14 novembre 2026 (13 novembre pour les corpus inchangés), jamais recopiés depuis un autre rapport.

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 299 (119 articles de la consolidation `02024R1689-20260727` + 180 considérants de l'acte d'origine) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` et `lov2`, écart déclaré ; DILA : Licence Ouverte 2.0 |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart` | Licence Ouverte 2.0 (Etalab) |
| `textes_fr` | 3 | 183 articles en vigueur (décret 2019-536 : 166 ; Code pénal 226-16 à 226-24 : 16 ; CPCE L34-5 : 1) ; 2 abrogés écartés | consultés le 2026-11-14 | PISTE — Légifrance `/consult/legiPart`, `/consult/code`, `/consult/getArticleWithIdAndNum` | Licence Ouverte 2.0 (Etalab) |
| `ce` | 1 594 | 20 774 | 1982-03-12 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 328 | 20 287 | 2018-04-11 → 2026-11-10 | CEPD, sitemap des pages `_fr` et `_en` et PDF | Régime ouvert (notice de copyright du CEPD) |
| `cc` | 403 | 8 194 | 1986-07-21 → 2026-11-10 | PISTE — Judilibre `/search` et `/decision` | Licence Ouverte 2.0 (Etalab) et CGU Judilibre |
| `cjue` | 251 | 23 460 | 1999-10-14 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notions `4.11.01` et `2.04` + 4 CELEX, XHTML français puis anglais, repli HTML patrimonial | Décision 2011/833/UE (CC BY 4.0) |

## Détail `ce`

- Archive JADE globale du 8 novembre 2026, fonds `jade/global/publie` et `jade/global/inedit`, lus en flux.
- 573 525 entrées lues : 1 594 retenues, 399 198 autres juridictions, 167 044 sans mot-clé, 5 627 textes vides, 0 date invalide ; 62 doublons d'identifiant entre les deux fonds.
- 174 265 décisions du Conseil d'État valablement datées, toutes dates, avant mots-clés (`decisions_ce`, doublons de fonds compris) ; aucune borne de date n'est appliquée, ni au descripteur ni au filtrage.
- Fonds `publie` : 282 décisions / 4 430 fragments ; fonds `inedit` : 1 312 / 16 344.
- `periode.date_min` et `periode.date_max` sont les premières et dernières dates observées dans le corpus (1982-03-12 → 2026-10-27).
- Filtre inchangé : juridiction normalisée exactement « Conseil d'État » et au moins un mot-clé du descripteur (`données personnelles`, `données à caractère personnel`, `informatique et libertés`, `protection des données`, `RGPD`, `règlement général sur la protection des données`, `commission nationale de l'informatique et des libertés`, `CNIL`). Un seul mot-clé suffit : le corpus contient des faux positifs (par exemple `CETATEXT000028411879`, où la CNIL n'est que créancière de frais), et 132 166 des 167 044 exclusions sans mot-clé sont antérieures à 2014 — « toutes dates » ne veut pas dire « toute la jurisprudence ».
- 282 décisions sur les 138 074 décisions du Conseil d'État antérieures à 2014 sont retenues. Les 5 627 entrées sans texte intégral (`BLOC_TEXTUEL/CONTENU` vide) n'ont qu'un sommaire dans l'archive, que le parseur ne lit pas : une partie de la jurisprudence ancienne reste donc hors d'atteinte, même sans borne.

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
- Langues des textes retenus : 156 français, 172 anglais. Un PDF sans suffixe de langue suit la langue de sa page ; le manifeste porte `documents_langues` document par document.
- 13 écartés, tous motivés : 7 sans PDF, 3 versions obsolètes (doublons anglais d'un même numéro), 2 où la page ne sert que l'annexe, 1 PDF sans rapport avec le document (WP242, dont la pièce jointe est une décision danoise). 10 sont comptés `documents_sans_texte_ecartes`.
- Licence : régime ouvert de la notice de copyright du CEPD ; chaque fragment porte son URL de page et son chemin `CEPD > <type> > <titre>`, et le serveur ne produit aucun résumé.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 891 unités). Les corpus `cjue`, `ce` et `cc` ont été élargis les 13 et 14 novembre (sans borne de date) sans que ces rangs soient remesurés.

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Les rangs CJUE ont été rejoués le 14 novembre 2026 sur l'index de 83 994 unités (corpus `cjue` de 248 décisions et 23 188 fragments) : mêmes résultats, la calibration `dev` du harnais donne 1 `confiant` et 9 `incertain`. La recherche « Lindqvist diffusion de données personnelles sur une page Internet » (`corpus: "cjue"`, `k: 5`) rend C-101/01 aux rangs 1, 2 et 4 (`62001CJ0101#point14`, similarité 0,726), avec l'URL EUR-Lex française de l'arrêt. La recherche « données pseudonymisées identifiables par le destinataire » rend toujours C-413/23 P au premier rang (`62023CJ0413#point68`, similarité 0,729).

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.

<!-- controle-curia:debut -->
## Contrôle par la fiche thématique Curia

Contrôle du 2026-11-14 : fiche « Protection des données à caractère personnel » (Juillet 2024), 51 numéros d'affaires pour 43 arrêts — 43 présents, dont 4 entré(s) par la liste complémentaire, 0 absent(s) avec raison, 0 manquant(s) sans raison.

Fiche : <https://curia.europa.eu/site/upload/docs/application/pdf/2018-10/fiche_thematique_-_donnees_personnelles_-_fr.pdf> (page <https://curia.europa.eu/site/jcms/d2_5127/fr/fiches-thematiques>), consultée le 2026-11-14.
Absents avec raison : aucun.
Rapport : `data/corpus/cjue/controle-curia.json`.
<!-- controle-curia:fin -->
