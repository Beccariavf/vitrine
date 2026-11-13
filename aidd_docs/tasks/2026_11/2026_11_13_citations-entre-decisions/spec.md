---
status: approved
date: 2026-11-13
source: GitHub issue #30
---

# Contrat : Voir les décisions qu'une décision cite, et qui la cite

## Objectif observable

Une décision rendue par `search` ou `get_decision` liste les décisions qu'elle cite (`decisions_citees`), reconnues par leurs références usuelles et résolues vers le corpus quand c'est possible ; un nouvel outil `decisions_citant_decision` rend, pour une référence (par exemple `C-311/18`), les décisions du corpus qui la citent. Une famille de références n'est exposée que si sa précision, mesurée sur un échantillon relu, atteint le seuil fixé par l'utilisateur ; le chiffre est publié.

## Seuil (🛑 tranché par l'utilisateur le 2026-11-13)

- Mesure **par famille** de références, jamais en moyenne.
- Unité : une citation = (décision citante, référence citée, cibles résolues). Juste si la référence est bien citée comme décision par le texte et si les cibles rendues sont correctes ; pour une référence ambiguë, juste si la bonne décision figure parmi les candidats ; une référence hors corpus est juste si elle est rendue sans cible.
- Seuil : **borne basse de Wilson à 95 % ≥ 90 %** (40 justes sur 40, ou 60 avec au plus une erreur).
- Échantillon déterministe (identifiants triés, pas régulier), relu avec l'extrait affiché ; le relecteur est indépendant de l'implémentation.
- Une famille sous le seuil n'est pas exposée ; son chiffre est publié avec la raison. Le rappel n'a pas de seuil.

## Périmètre

- Familles : affaire de l'Union (`C-311/18`, `T-435/16`, suffixe `P`), ECLI, délibération CNIL (`SAN-2019-001`, `délibération n° 2019-001`), requête du Conseil d'État (`n° 353066` dans un contexte qui nomme le Conseil d'État), pourvoi de la Cour de cassation (`19-17.278`).
- Extraction déterministe à la lecture depuis `data/corpus/{cnil,ce,cc,cjue,cepd}/unites.jsonl`, au niveau du document ; cache par fichier comme #28.
- Résolution vers le corpus : CJUE par le numéro d'affaire de son chemin, CNIL par son `numero`, Conseil d'État par son `numero`, Cour de cassation par le numéro de pourvoi de son chemin. L'ECLI n'est porté par aucune unité : il est reconnu, jamais résolu.
- Hors périmètre : qualification du lien (applique, écarte, renverse), résolution des ECLI (demande une synchronisation qui les écrive), citations vers des décisions d'autres juridictions.

## Critères d'acceptation

1. Chaque décision rendue par `search` et `get_decision` porte `decisions_citees`, chacune `{ reference, famille, cibles }` ; `cibles` liste `{ document, corpus, intitule, date_acte, url }`, vide quand la décision citée n'est pas au corpus. Seules les familles exposées y figurent.
2. Une référence ambiguë (même clé pour deux documents) rend tous les candidats, jamais un choix silencieux.
3. Une décision ne se cite pas elle-même : son propre numéro, les numéros joints de son en-tête (« Pourvoi n° … », « Sous le n° … ») et son numéro d'affaire sont exclus.
4. `decisions_citant_decision({ reference })` rend les décisions du corpus qui citent la référence, triées par date décroissante, avec `{ document, corpus, autorite, intitule, date_acte, url }`, `total`, `par_autorite`, `cibles` de la référence, `limite`/`decalage`/`tronque` ; une référence d'une famille non exposée est refusée avec le chiffre mesuré ; une référence illisible est refusée.
5. La précision par famille est mesurée sur l'échantillon relu, publiée dans `mesure.md` et dans les descriptions d'outils ; seules les familles qui passent le seuil sont exposées.
6. Les descriptions disent seulement « cite » : aucune qualification n'est affichée ; une liste vide ne prouve pas qu'aucune décision n'est citée.
7. `npm run typecheck`, `npm test` et `npm run build` passent.

## Décisions

| #   | Décision | Raison |
| --- | -------- | ------ |
| 1   | Seuil par famille, borne basse de Wilson à 90 %. | Choix de l'utilisateur. Une requête du Conseil d'État n'est qu'un nombre à six chiffres : une moyenne cacherait la famille faible. |
| 2   | Requête du Conseil d'État reconnue seulement près d'une mention du Conseil d'État. | Un « n° 123456 » seul est aussi un numéro de déclaration, de dossier ou de délibération d'un autre organe. |
| 3   | Champ `decisions_citees` distinct de `citations`. | `citations` vise des instruments (#28) ; mêler décisions et textes brouillerait `hors_corpus`. |
| 4   | Outil inverse dédié plutôt qu'un mode de `decisions_citant` (#29). | #29 n'est pas fusionné ; la clé d'entrée est une référence de décision, pas un couple document + article. |
| 5   | ECLI reconnu, non résolu. | Aucune unité du corpus ne porte d'ECLI ; l'écrire demande une synchronisation réseau (`data/` ne s'édite pas à la main). Mesuré à 34/55 : non exposé. |
| 6   | Une date donnée par le texte filtre les cibles. | Révisée après la première mesure : un numéro de requête ou de pourvoi porte souvent plusieurs décisions (fond, référé, renvoi) ; la date qui suit la référence prime sur celle qui la précède. |
| 7   | Numéros joints indexés : « Sous le n° » (CE), pourvois de l'en-tête (Cour de cassation), « Dans les affaires jointes » (CJUE). | Révisée après mesure : sans eux, une décision du corpus citée par un numéro joint était dite hors corpus. |

## Limites assumées

- L'extraction est non exhaustive : une référence sous une forme non reconnue manque.
- Une décision citée seulement par son nom de partie (« arrêt Google Spain ») n'est pas reconnue.
- Une date erronée dans le texte citant écarte la bonne décision (une faute mesurée sur 60 en `requete_ce`).

## Preuve de réussite

- Tests unitaires : formes de chaque famille, tirets typographiques (`C‑131/12`), auto-citations exclues, ambiguïté, résolution, famille non exposée refusée.
- Mesure `mesure.md` : précision par famille sur l'échantillon relu, Wilson, familles exposées.
- `npm run typecheck`, `npm test` et `npm run build` verts.
