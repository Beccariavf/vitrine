---
status: approved
date: 2026-11-11
source: GitHub issue #19
---

# Contrat : Cour de cassation et CJUE dans le corpus

## Objectif observable

Le MCP répond sur les décisions de la Cour de cassation et de la CJUE relatives aux données personnelles depuis le 1er janvier 2014, avec deux corpus filtrables (`cc`, `cjue`), un manifeste de couverture par corpus, des exclusions comptées et un jeu d'éval `dev` par corpus.

## Périmètre

- Deux corpus versionnés : `data/corpus/cc/` et `data/corpus/cjue/`, produits par `npm run cc:sync` et `npm run cjue:sync`.
- Cour de cassation : Judilibre (PISTE), texte intégral et visa.
- CJUE : CELLAR, version française des arrêts et ordonnances.
- Index SQLite+FTS5 reconstruit par delta, `search` filtrant sur `corpus`.
- Aucun site, aucune distribution nouvelle.

## Décisions

| # | Décision | Raison |
| --- | --- | --- |
| 1 | Borne `2014-01-01` appliquée à la date de décision, côté source et côté parseur. | Demande du ticket ; la borne éditoriale inclut la fin de la directive 95/46 et la préparation du RGPD. |
| 2 | Cour de cassation : recherche Judilibre par phrases du descripteur (`field=text`, `operator=and`), puis lecture de chaque décision par `/decision`. | La recherche portée par les phrases garde un rappel utile sans dépendre d'une taxonomie de thème incomplète avant 2018. |
| 3 | Filtre de pertinence local compté : visa citant un instrument de protection des données, ou au moins deux occurrences d'une expression centrale dans le texte. | La recherche plein texte ramène des décisions qui ne font que citer les mots ; le filtre et ses écarts sont déclarés. |
| 4 | Budget d'appels dédié et reprise : `--max-appels`, cache brut par décision, état `etat.json`; le corpus n'est écrit qu'avec les décisions déjà lues, jamais une décision inventée. | Le plafond de 16 appels de la veille ne vaut pas pour une collecte ; une interruption doit reprendre sans redemander. |
| 5 | CJUE : SPARQL CELLAR sur la matière `PDON` (protection des données personnelles), CELEX `6…`, puis XHTML `fra` par CELEX. | La matière est le filtre officiel de CELLAR ; la langue est demandée explicitement. |
| 6 | CJUE : arrêts et ordonnances de la Cour et du Tribunal (`CJ`, `TJ`, `CO`, `TO`) ; conclusions d'avocat général (`CC`) et autres types écartés et comptés. | Les conclusions ne sont pas des décisions de justice. |
| 7 | Les décisions présentes dans `data/entries/` pour les sources `judilibre` et `cjue` sont incluses d'office dans la sélection. | La couverture doit contenir ce que la veille a publié sur ces deux sources. |
| 8 | Unités : fragments numérotés par nous (`<document>#f<n>`) pour la Cour de cassation ; points de motivation (`#pointN`), en-tête et dispositif pour la CJUE. | Citations stables et passages assez courts pour l'embedding. |
| 9 | Licence : Licence Ouverte 2.0 (Etalab) pour Judilibre ; réutilisation EUR-Lex autorisée par la décision 2011/833/UE pour CELLAR. | Le dépôt est public ; la licence est écrite au manifeste. |
| 10 | Éval `dev` : 10 questions par corpus, colonne `corpus`, attente au document (le rang est rapporté). | Le ticket demande le jeu et ses rangs ; le split `test` reste hors de ce lot. |
| 11 | CJUE : la sélection réunit la matière `PDON` **et** la notion `fd_578/4.11.01` (« Protection des données à caractère personnel »), plus deux CELEX explicites (`62018CJ0746`, `62019CJ0511`) que CELLAR ne classe pas dans la protection des données. | `PDON` seul manquait La Quadrature du Net et les deux Prokuratuur ; la notion fine en récupère une partie, la liste déclarée couvre le reste. La limite est écrite au manifeste. |

## Critères d'acceptation

1. Les comptes des manifestes `cc` et `cjue` correspondent aux `unites.jsonl` commités (test).
2. Une décision antérieure au 1er janvier 2014 est écartée et comptée (`exclusions.avant_borne`).
3. Une décision de la veille sur Judilibre ou la CJUE présente dans `data/entries/` se retrouve dans le corpus correspondant.
4. `search({ corpus: "cc" | "cjue" })` ne rend que les unités de ce corpus ; l'index porte les deux corpus.
5. `npm run cc:sync` et `npm run cjue:sync` sont idempotents : une seconde passe ne réécrit rien et ne relit pas les décisions en cache.
6. Une interruption de budget laisse le corpus précédent intact et la reprise ne redemande que les décisions absentes.
7. `npm run mcp:eval -- --questions mcp/eval/questions-cc.csv` et `...-cjue.csv` rendent leurs rangs `dev`.
8. `npm run typecheck`, `npm test` et `npm run build` passent.

## Hors périmètre

- Split `test` et recalibration des seuils de confiance pour `cc` et `cjue`.
- `get_decision` étendu à ces corpus.
- Rafraîchissement automatique (ticket #18).
- Diffusion du corpus hors du dépôt.
