# Couverture des huit corpus

Comptes lus dans les `manifest.json` du 14 novembre 2026 (13 novembre pour les corpus inchangés), jamais recopiés depuis un autre rapport.

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 293 (113 articles + 180 considérants) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` et `lov2`, écart déclaré ; DILA : Licence Ouverte 2.0 |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart` | Licence Ouverte 2.0 (Etalab) |
| `textes_fr` | 3 | 183 articles en vigueur (décret 2019-536 : 166 ; Code pénal 226-16 à 226-24 : 16 ; CPCE L34-5 : 1) ; 2 abrogés écartés | consultés le 2026-11-14 | PISTE — Légifrance `/consult/legiPart`, `/consult/code`, `/consult/getArticleWithIdAndNum` | Licence Ouverte 2.0 (Etalab) |
| `ce` | 1 594 | 20 774 | 1982-03-12 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 36 | 5 443 | 2018-04-11 → 2025-06-05 | CEPD, sitemap des pages `_fr` et PDF | À vérifier : aucune licence explicite déclarée |
| `cc` | 403 | 8 194 | 1986-07-21 → 2026-11-10 | PISTE — Judilibre `/search` et `/decision` | Licence Ouverte 2.0 (Etalab) et CGU Judilibre |
| `cjue` | 166 | 16 916 | 2014-04-08 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notions `4.11.01` et `2.04` + 1 CELEX, XHTML français puis anglais | Décision 2011/833/UE (CC BY 4.0) |

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

- SPARQL CELLAR, union de la matière `PDON` et de deux notions fines, `fd_578/4.11.01` (« Protection des données à caractère personnel ») et `fd_578/2.04` (« Protection des données à caractère personnel par les institutions de l'Union »), CELEX `6…`, date ≥ `2014-01-01` ; un CELEX explicite (`62018CJ0746`, Prokuratuur) que CELLAR ne classe pas dans les données personnelles.
- 295 CELEX listés et 1 complémentaire : 166 retenus, 73 conclusions d'avocat général (`CC`), 2 autres types, 55 XHTML absents dans toutes les langues (404 consignés en `xhtml_absent`) ; `documents_lus` vaut 296, soit exactement les documents retenus plus les exclusions (166 + 73 + 2 + 55).
- Types retenus par suffixe CELEX : `CJ`, `TJ`, `CO`, `TO` ; 55 décisions ne sont servies dans aucune langue et 166 ont produit des unités. La notion `2.04` apporte 15 décisions joignables, dont C-413/23 P (EDPS c. SRB, 4 septembre 2025) ; sur les 32 absences classées `2.04`, 4 étaient déjà écartées avant l'élargissement, donc 28 des 55 exclusions sont nouvelles.
- Langue : un seul XHTML par décision, la première servie — français d'abord, anglais après un 404 français. Le texte capturé est classé par son contenu (`langueCapture`) : `couverture.langues` = 166 `fra`, 0 `eng`, `couverture.documents_langues` vide. Aucune décision du corpus n'existe uniquement en anglais. Les 55 absences sont des 404 bilingues : 28 demandées en `fra` puis `eng` par la passe du 13 novembre, 27 héritées dont le 404 bilingue vient de la sonde du 2026-11-12 (hors dépôt) et que la passe ne redemande pas. Une panne (5xx, réseau) ne crée aucun marqueur durable : la décision est redemandée à la passe suivante plutôt que lue en anglais.
- 45 décisions des types retenus, de la même sélection et antérieures à 2014, sont comptées à part (`couverture.avant_borne`) ; l'élargissement à `2.04` en ajoute une aux 44 précédentes.
- La borne 2014 inclut la fin de la directive 95/46 et la préparation du RGPD ; elle exclut la jurisprudence antérieure, comptée mais non collectée.
- `periode.date_min` est la première date observée (2014-04-08) ; `couverture.borne` porte la borne demandée (2014-01-01).
- La notion `4.11.01` récupère La Quadrature du Net (C-511/18) ; Prokuratuur (C-746/18) est ajouté par la liste explicite. Le manifeste porte `couverture.notions` (deux entrées), `celex_complementaires` et `complementaires_ajoutes`.
- La notion `4.11.01` est large : six décisions ajoutées (douanes, droit d'auteur, agents FIFA, État de droit, réparation automobile, ne bis in idem) ne traitent les données personnelles que dans une partie de leur raisonnement. Elles restent dans le corpus, la source officielle et son libellé étant déclarés.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 891 unités ; **77 107** depuis l'élargissement CJUE du 13 novembre, 2 216 fragments de plus). Les corpus `ce` et `cc` ont été élargis le 14 novembre (sans borne de date) sans que ces rangs soient remesurés.

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Les rangs CJUE ont été rejoués le 13 novembre 2026 sur l'index élargi (77 107 unités) : mêmes résultats, 1 `confiant` et 9 `incertain` aux seuils produit (0,69 / 0,74 / 0,01) ; la calibration `dev` du harnais donne 2 et 8. La recherche « données pseudonymisées identifiables par le destinataire » (`corpus: "cjue"`, `k: 5`) rend C-413/23 P au premier rang (`62023CJ0413#point68`, similarité 0,729), avec l'URL EUR-Lex française de l'arrêt.

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.
