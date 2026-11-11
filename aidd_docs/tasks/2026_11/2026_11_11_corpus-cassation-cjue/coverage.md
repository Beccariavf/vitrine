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
| `cjue` | 152 | 14 756 | 2014-04-08 → 2026-11-05 | CELLAR / EUR-Lex — SPARQL `PDON` + notion `4.11.01` + 2 CELEX, XHTML français | Décision 2011/833/UE (CC BY 4.0) |

## Détail `cc`

- 22 phrases de recherche, `field=text`, `operator=and`, borne `2014-01-01`.
- 1 133 décisions lues : 352 retenues, 781 écartées `hors_sujet`, 0 `avant_borne` (l'API filtre la date ; le parseur compte quand même toute décision antérieure), 0 `date_invalide`, 0 `texte_vide`.
- 641 doublons de recherche ; 4 entrées Judilibre de `data/entries/` incluses et retenues (`veille.entrees: 4`, `veille.retenues: 4`) ; une décision de la veille échappe au filtre de pertinence par construction.
- Filtre : visa citant un instrument de protection des données, ou au moins 2 occurrences d'une expression centrale ; `CNIL` seul ne suffit plus (51 décisions retirées : 36 sans aucune autre expression, 15 avec une seule occurrence). 124 décisions n'ont pas de visa dans Judilibre. 1 333 fragments dépassent 1 200 caractères (un paragraphe long reste entier, maximum 28 852). Aucun identifiant introuvable.
- `periode.date_min` est la première date observée (2014-01-14) ; `couverture.borne` porte la borne demandée (2014-01-01).
- Le corpus n'est pas une collection exhaustive de la Cour de cassation : c'est un sous-ensemble déclaré, borné par 22 phrases et par le filtre de pertinence.

## Détail `cjue`

- SPARQL CELLAR, union de la matière `PDON` et de la notion fine `fd_578/4.11.01` (« Protection des données à caractère personnel »), CELEX `6…`, date ≥ `2014-01-01` ; deux CELEX explicites (`62018CJ0746`, `62019CJ0511`) que CELLAR ne classe pas dans les données personnelles.
- 252 CELEX listés et 2 complémentaires : 152 retenus, 73 conclusions d'avocat général (`CC`), 2 autres types, 27 versions françaises absentes (404 consignés).
- Types retenus par suffixe CELEX : `CJ`, `TJ`, `CO`, `TO` ; 27 n'ont pas de version française et 152 ont produit des unités.
- 44 décisions des types retenus, de la même sélection et antérieures à 2014, sont comptées à part (`couverture.avant_borne`).
- La borne 2014 inclut la fin de la directive 95/46 et la préparation du RGPD ; elle exclut la jurisprudence antérieure, comptée mais non collectée.
- `periode.date_min` est la première date observée (2014-04-08) ; `couverture.borne` porte la borne demandée (2014-01-01).
- La notion `4.11.01` récupère La Quadrature du Net (C-511/18) ; les deux Prokuratuur (C-746/18, C-511/19) sont ajoutées par la liste explicite. Le manifeste porte `couverture.notion`, `celex_complementaires` et `complementaires_ajoutes`.

## Évaluations `dev`

Mesures du 11 novembre 2026, hors split `test`, sur l'index à huit corpus (74 947 unités).

| Jeu | Résultat |
|---|---|
| Cour de cassation, 10 questions | 6/10 au top 5, MRR 0,470, top 1 40,0 % |
| CJUE, 10 questions | 8/10 au top 5, MRR 0,750, top 1 70,0 % |

Le détail des rangs et des similarités est dans [`eval.md`](./eval.md). Ces jeux ne calibrent aucun seuil : le produit applique le repli `0,69 / 0,74 / 0,01` à `cc` et `cjue`.
