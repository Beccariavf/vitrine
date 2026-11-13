# Couverture des huit corpus

Comptes lus dans les `manifest.json` du 11 novembre 2026, jamais recopiés depuis un autre rapport.

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 293 (113 articles + 180 considérants) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` et `lov2`, écart déclaré ; DILA : Licence Ouverte 2.0 |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart` | Licence Ouverte 2.0 (Etalab) |
| `ce` | 1 312 | 17 703 | 2014-01-01 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 36 | 5 443 | 2018-04-11 → 2025-06-05 | CEPD, sitemap des pages `_fr` et PDF | À vérifier : aucune licence explicite déclarée |
| `cc` | 352 | 7 048 | 2014-01-14 → 2026-11-10 | PISTE — Judilibre `/search` et `/decision` | Licence Ouverte 2.0 (Etalab) et CGU Judilibre |
| `cjue` | 166 | 16 916 | 2014-04-08 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notions `4.11.01` et `2.04` + 1 CELEX, XHTML français puis anglais | Décision 2011/833/UE (CC BY 4.0) |

## Détail `cc`

- 22 phrases de recherche, `field=text`, `operator=and`, borne `2014-01-01`.
- 1 133 décisions lues : 352 retenues, 781 écartées `hors_sujet`, 0 `avant_borne` (l'API filtre la date ; le parseur compte quand même toute décision antérieure), 0 `date_invalide`, 0 `texte_vide`.
- 641 doublons de recherche ; 4 entrées Judilibre de `data/entries/` incluses et retenues (`veille.entrees: 4`, `veille.retenues: 4`) ; une décision de la veille échappe au filtre de pertinence par construction.
- Filtre : visa citant un instrument de protection des données, ou au moins 2 occurrences d'une expression centrale ; `CNIL` seul ne suffit plus (51 décisions retirées : 36 sans aucune autre expression, 15 avec une seule occurrence). 124 décisions n'ont pas de visa dans Judilibre. 1 333 fragments dépassent 1 200 caractères (un paragraphe long reste entier, maximum 28 852). Aucun identifiant introuvable.
- `periode.date_min` est la première date observée (2014-01-14) ; `couverture.borne` porte la borne demandée (2014-01-01).
- Le corpus n'est pas une collection exhaustive de la Cour de cassation : c'est un sous-ensemble déclaré, borné par 22 phrases et par le filtre de pertinence.

## Détail `cjue`

- SPARQL CELLAR, union de la matière `PDON` et de deux notions fines, `fd_578/4.11.01` (« Protection des données à caractère personnel ») et `fd_578/2.04` (« Protection des données à caractère personnel par les institutions de l'Union »), CELEX `6…`, date ≥ `2014-01-01` ; un CELEX explicite (`62018CJ0746`, Prokuratuur) que CELLAR ne classe pas dans les données personnelles.
- 295 CELEX listés et 1 complémentaire : 166 retenus, 73 conclusions d'avocat général (`CC`), 2 autres types, 55 XHTML absents dans toutes les langues (404 consignés en `xhtml_absent`) ; `documents_lus` vaut 296, soit exactement les documents retenus plus les exclusions (166 + 73 + 2 + 55).
- Types retenus par suffixe CELEX : `CJ`, `TJ`, `CO`, `TO` ; 55 décisions ne sont servies dans aucune langue et 166 ont produit des unités. La notion `2.04` apporte 15 décisions joignables, dont C-413/23 P (CEPD c. SRB, 4 septembre 2025), et 28 des 55 exclusions ; 32 des 55 absences relèvent de la seule notion `2.04`.
- Langue : un seul XHTML par décision, la première servie — français d'abord, anglais après un 404 français. Le texte capturé est classé par son contenu (`langueCapture`) : `couverture.langues` = 166 `fra`, 0 `eng`, `couverture.documents_langues` vide. Aucune décision du corpus n'existe uniquement en anglais ; les 55 absentes répondent 404 dans les deux langues. Une panne (5xx, réseau) ne crée aucun marqueur durable : la décision est redemandée à la passe suivante plutôt que lue en anglais.
- 45 décisions des types retenus, de la même sélection et antérieures à 2014, sont comptées à part (`couverture.avant_borne`) ; l'élargissement à `2.04` en ajoute une aux 44 précédentes.
- La borne 2014 inclut la fin de la directive 95/46 et la préparation du RGPD ; elle exclut la jurisprudence antérieure, comptée mais non collectée.
- `periode.date_min` est la première date observée (2014-04-08) ; `couverture.borne` porte la borne demandée (2014-01-01).
- La notion `4.11.01` récupère La Quadrature du Net (C-511/18) ; Prokuratuur (C-746/18) est ajouté par la liste explicite. Le manifeste porte `couverture.notions` (deux entrées), `celex_complementaires` et `complementaires_ajoutes`.
- La notion `4.11.01` est large : six décisions ajoutées (douanes, droit d'auteur, agents FIFA, État de droit, réparation automobile, ne bis in idem) ne traitent les données personnelles que dans une partie de leur raisonnement. Elles restent dans le corpus, la source officielle et son libellé étant déclarés.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 891 unités ; **77 107** depuis l'élargissement CJUE du 13 novembre, 2 216 fragments de plus).

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Les rangs CJUE ont été rejoués le 13 novembre 2026 sur l'index élargi (77 107 unités) : mêmes résultats, 2 `confiant` et 8 `incertain` aux seuils recalibrés sur `dev`. La recherche « données pseudonymisées identifiables par le destinataire » (`corpus: "cjue"`, `k: 5`) rend C-413/23 P au premier rang (`62023CJ0413#point68`, similarité 0,729), avec l'URL EUR-Lex française de l'arrêt.

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.
