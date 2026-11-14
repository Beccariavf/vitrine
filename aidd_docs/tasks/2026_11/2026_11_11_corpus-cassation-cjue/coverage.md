# Couverture des huit corpus

Comptes lus dans les `manifest.json` du 14 novembre 2026 pour la CJUE, du 13 novembre pour les autres corpus (11 novembre pour les corpus inchangés), jamais recopiés depuis un autre rapport.

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 293 (113 articles + 180 considérants) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` et `lov2`, écart déclaré ; DILA : Licence Ouverte 2.0 |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart` | Licence Ouverte 2.0 (Etalab) |
| `textes_fr` | 3 | 183 articles en vigueur (décret 2019-536 : 166 ; Code pénal 226-16 à 226-24 : 16 ; CPCE L34-5 : 1) ; 2 abrogés écartés | consultés le 2026-11-14 | PISTE — Légifrance `/consult/legiPart`, `/consult/code`, `/consult/getArticleWithIdAndNum` | Licence Ouverte 2.0 (Etalab) |
| `ce` | 1 312 | 17 703 | 2014-01-01 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 36 | 5 443 | 2018-04-11 → 2025-06-05 | CEPD, sitemap des pages `_fr` et PDF | À vérifier : aucune licence explicite déclarée |
| `cc` | 352 | 7 048 | 2014-01-14 → 2026-11-10 | PISTE — Judilibre `/search` et `/decision` | Licence Ouverte 2.0 (Etalab) et CGU Judilibre |
| `cjue` | 248 | 23 174 | 1999-10-14 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notions `4.11.01` et `2.04` + 1 CELEX, XHTML français puis anglais, repli HTML patrimonial | Décision 2011/833/UE (CC BY 4.0) |

## Détail `cc`

- 22 phrases de recherche, `field=text`, `operator=and`, borne `2014-01-01`.
- 1 133 décisions lues : 352 retenues, 781 écartées `hors_sujet`, 0 `avant_borne` (l'API filtre la date ; le parseur compte quand même toute décision antérieure), 0 `date_invalide`, 0 `texte_vide`.
- 641 doublons de recherche ; 4 entrées Judilibre de `data/entries/` incluses et retenues (`veille.entrees: 4`, `veille.retenues: 4`) ; une décision de la veille échappe au filtre de pertinence par construction.
- Filtre : visa citant un instrument de protection des données, ou au moins 2 occurrences d'une expression centrale ; `CNIL` seul ne suffit plus (51 décisions retirées : 36 sans aucune autre expression, 15 avec une seule occurrence). 124 décisions n'ont pas de visa dans Judilibre. 1 333 fragments dépassent 1 200 caractères (un paragraphe long reste entier, maximum 28 852). Aucun identifiant introuvable.
- `periode.date_min` est la première date observée (2014-01-14) ; `couverture.borne` porte la borne demandée (2014-01-01).
- Le corpus n'est pas une collection exhaustive de la Cour de cassation : c'est un sous-ensemble déclaré, borné par 22 phrases et par le filtre de pertinence.

## Détail `cjue`

- SPARQL CELLAR, union de la matière `PDON` et de deux notions fines, `fd_578/4.11.01` (« Protection des données à caractère personnel ») et `fd_578/2.04` (« Protection des données à caractère personnel par les institutions de l'Union »), CELEX `6…`, **sans borne de date** ; un CELEX explicite (`62018CJ0746`, Prokuratuur) que CELLAR ne classe pas dans les données personnelles. Types retenus : `CJ`, `TJ`, `CO`, `TO` ; conclusions d'avocat général (`CC`) et autres types écartés et comptés.
- 361 CELEX listés et 1 complémentaire : 248 retenus, 95 conclusions d'avocat général (`CC`), 5 autres types, 14 sans aucune représentation téléchargeable (404 en XHTML et en HTML, toutes langues) ; `documents_lus` vaut 362, soit exactement les documents retenus plus les exclusions (248 + 95 + 5 + 14).
- Types des 248 décisions retenues : 167 arrêts de la Cour, 52 arrêts du Tribunal, 14 ordonnances de la Cour, 15 ordonnances du Tribunal.
- Antériorité : 40 décisions sont datées d'avant 2014 (1999-10-14 → 2013-12-12). Les 45 décisions des types retenus que l'ancienne borne comptait à part (`couverture.avant_borne`, supprimé) sont donc au corpus, sauf 5 (`62002TJ0179`, `62007TJ0392`, `62009TJ0241`, `62010TJ0308`, `62011TJ0214`) : CELLAR ne sert pour elles qu'une notice RDF, sans texte. Lindqvist (C-101/01, `62001CJ0101`, 6 novembre 2003) est au corpus avec ses points `#point1` à `#point100`.
- Deux rendus : le XHTML moderne, puis le HTML patrimonial servi aux arrêts anciens (`data/raw/cjue/<CELEX>.html`, marqueurs `<dt>N</dt>`, ancres `pointN` ou numéro en tête de paragraphe) ; 70 des 86 décisions sans XHTML ont ainsi été récupérées. Le HTML patrimonial porte la date des conclusions avant celle de l'arrêt : la date CELLAR fait foi pour lui, l'en-tête du XHTML pour le rendu moderne.
- Langue : un seul rendu par décision, la première servie — français d'abord, anglais après un 404 français. `couverture.langues` = 247 `fra`, 1 `eng` (`62002TJ0320`, arrêt du Tribunal servi seulement en anglais) ; aucune décision du corpus n'existe uniquement en XHTML anglais.
- `periode.date_min` est la première date observée (1999-10-14) ; le manifeste ne porte plus ni `date_min` ni `couverture.borne`.
- La notion `4.11.01` récupère La Quadrature du Net (C-511/18) ; Prokuratuur (C-746/18) est ajouté par la liste explicite. Le manifeste porte `couverture.notions` (deux entrées), `celex_complementaires` et `complementaires_ajoutes`.
- La notion `4.11.01` est large : six décisions ajoutées (douanes, droit d'auteur, agents FIFA, État de droit, réparation automobile, ne bis in idem) ne traitent les données personnelles que dans une partie de leur raisonnement. Elles restent dans le corpus, la source officielle et son libellé étant déclarés.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 891 unités ; **83 980** depuis l'ouverture de la CJUE aux arrêts antérieurs à 2014, le 14 novembre).

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Les rangs CJUE ont été rejoués le 14 novembre 2026 sur l'index de 83 980 unités (corpus `cjue` de 248 décisions et 23 174 fragments) : mêmes résultats, la calibration `dev` du harnais donne 1 `confiant` et 9 `incertain`. La recherche « Lindqvist diffusion de données personnelles sur une page Internet » (`corpus: "cjue"`, `k: 5`) rend C-101/01 aux rangs 1, 2 et 4 (`62001CJ0101#point14`, similarité 0,726), avec l'URL EUR-Lex française de l'arrêt. La recherche « données pseudonymisées identifiables par le destinataire » rend toujours C-413/23 P au premier rang (`62023CJ0413#point68`, similarité 0,729).

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.
