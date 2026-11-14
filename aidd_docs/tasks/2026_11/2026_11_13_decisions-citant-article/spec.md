---
status: approved
date: 2026-11-13
source: GitHub issue #29
---

# Contrat : Trouver toutes les décisions qui citent un article

## Objectif observable

Un nouvel outil MCP `decisions_citant` rend, pour un article donné (`document` + `numero`), les décisions du corpus qui le citent, avec leur autorité, leur date et leur lien, le total et le compte par autorité ; une liste vide est dite explicitement, et un article absent du corpus est signalé comme absent, jamais comme « jamais cité ».

## Périmètre

- Nouveau module `mcp/corpus/citants.ts` et outil `decisions_citant` dans `mcp/server.ts`.
- Source : les citations extraites par #28 (`citationsDuCorpus`) sur les cinq corpus de décisions (`cnil`, `ce`, `cc`, `cjue`, `cepd`), lues à la lecture, sans index ni stockage.
- Hors périmètre : citations entre décisions (#30), meilleure extraction des citations, bloc `perimetre` de #34 (PR #76 non fusionnée), correction de la lecture des numéros composés par `get_article`.

## Critères d'acceptation

1. `decisions_citant({ document, numero })` rend `decisions`, chacune `{ document, corpus, autorite, intitule, date_acte, url, reference }`, triées par date décroissante puis identifiant. `intitule` vient du chemin de la décision (`Conseil d'État > Décision 353066`, `CJUE > Arrêt de la Cour C-131/12`) : le `numero` d'unité de la Cour de cassation et de la CJUE est un nom de section.
2. Le résultat porte `total` (décisions citantes distinctes) et `par_autorite` (`[{ autorite, decisions }]`, compte décroissant), calculés sur toutes les décisions, même quand la liste est paginée.
3. Un numéro est reconnu sous ses formes courantes : `9`, `art. 9`, `article 9`, `1er`, `L. 34-5`, `L.34-5`, `26-1`. Une citation de l'article 9 avec alinéa (`9(2)`, `9.2`) ou une plage qui le contient (`8–10`, `226-16–226-24` pour `226-18`) compte ; un article atteint seulement par une plage porte `via_plage: true`. `26-1` ne compte pas pour `26`, et `9 bis` est refusé, jamais lu comme `9`.
4. Un article présent au corpus qu'aucune décision ne cite rend `decisions: []`, `total: 0` et un message qui le dit, en rappelant que la liste des citations est non exhaustive.
5. Un article absent du corpus porte `article_au_corpus: false` et un message qui le dit absent, jamais « jamais cité » ; les décisions qui le citent restent rendues. Un instrument connu absent du corpus garde la phrase « absent de mon corpus (périmètre : …) ». Un identifiant inconnu le dit.
6. Loi 78-17 : une décision datée avant le 2019-06-01 vise la numérotation antérieure à l'ordonnance 2018-1125 ; elle est écartée de `decisions`, `total` et `par_autorite`, comptée dans `ecartees_numerotation_anterieure` et nommée par le message. Une date inconnue n'est pas écartée.
7. `limite` (défaut 50, max 500) et `decalage` paginent `decisions` ; `tronque` dit qu'il en reste.
8. La description de l'outil nomme ces règles ; `npm run typecheck`, `npm test` et `npm run build` passent.

## Décisions

| #   | Décision | Raison |
| --- | -------- | ------ |
| 1   | Un outil dédié plutôt qu'un mode de `search`. | La question est structurée (article → décisions), sans recherche par le sens ni niveau de confiance. |
| 2   | Calcul à la lecture depuis le cache de #28. | Aucun réindex ; un corpus resynchronisé se voit à l'appel suivant. Mesuré : 1,7 s à froid pour les 5 111 décisions, puis cache. |
| 3   | Un article absent du corpus garde ses décisions citantes. | Un article abrogé de la LIL ou un article du CPCE reste cité par des décisions présentes : les taire cacherait la jurisprudence ; le drapeau évite de laisser croire que le texte est au corpus. |
| 4   | Pagination avec total et comptes complets. | L'article 15 de la LIL est cité par plus de 700 décisions : tout rendre dépasserait la charge d'un client MCP. |
| 5   | Alinéa et plage comptent pour l'article, la plage signalée ; tiret ordinaire non. | `9(2)` cite l'article 9 ; `8–10` le couvre sans le nommer, d'où `via_plage` ; `26-1` est un autre article de la LIL. |
| 6   | Citations de la LIL antérieures au 2019-06-01 écartées des comptes. | Révisée après revue : l'ordonnance 2018-1125 a renuméroté la loi ; l'article 15 était cité par 744 décisions, dont 736 visaient l'ancienne numérotation. Les mêler rendrait la liste fausse pour le texte actuel. |

## Limites assumées

- La liste hérite de la précision de #28 : non exhaustive, une décision qui cite l'article sous une forme non reconnue manque.
- Une décision postérieure au 2019-06-01 qui cite la loi « dans sa rédaction antérieure » reste comptée : la date seule ne le révèle pas. Les rédactions antérieures à 2004 ne sont pas distinguées davantage : toutes précèdent 2019 et sont écartées.
- Le CEPD figure parmi les autorités : ses lignes directrices ne sont pas des décisions, mais elles sont dans les corpus citants de #28.

## Preuve de réussite

- Tests sur racine temporaire : formes de numéro, alinéa, plage, `26-1` ≠ `26`, tri, comptes par autorité, pagination, liste vide, article absent avec citants, instrument absent, identifiant inconnu.
- Description assertée par `tests/mcp.test.ts`.
- Smoke sur le corpus réel : RGPD art. 9.
- `npm run typecheck`, `npm test` et `npm run build` verts.
