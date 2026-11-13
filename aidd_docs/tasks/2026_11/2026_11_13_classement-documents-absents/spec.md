---
status: approved
date: 2026-11-13
source: GitHub issue #32
---

# Contrat : Classer les documents absents les plus cités

## Objectif observable

`etat_corpus` rend le classement des documents cités par les décisions du corpus et absents du corpus, par nombre de citations décroissant, avec les autorités qui les citent ; le classement est recalculé et daté à chaque synchronisation, et un document déclaré hors du périmètre apparaît marqué « exclu » au lieu d'un trou.

## Périmètre

- Les citations que `mcp/corpus/citations.ts` extrait déjà (#28) sur les cinq corpus de décisions (`cnil`, `ce`, `cc`, `cjue`, `cepd`).
- Présence lue dans `data/corpus/*/manifest.json` ; déclaration d'exclusion lue dans le catalogue `INSTRUMENTS` de `mcp/corpus/citations.ts`.
- Calcul au moment de `npm run corpus:sync`, écriture dans le rapport `data/corpus/sync.json`, lecture par `etat_corpus`.
- Hors périmètre : citations entre décisions (#30), statut des textes (#33), périmètre et fraîcheur dans chaque réponse (#34), ajout des documents au corpus (#24), veille des sources.

## Critères d'acceptation

1. `etat_corpus` rend un bloc `hors_corpus` portant `calcule_le` et la liste `documents`, chaque entrée portant `document` (identifiant), `instrument` (libellé), `url` (lien officiel), `statut` (`absent` ou `exclu`), `citations` (nombre) et `autorites` (autorité citante et son compte).
2. Le classement est trié par `citations` décroissant, puis par `document` croissant ; un document présent au corpus n'y figure pas.
3. Le bloc est écrit par `npm run corpus:sync` avec `calcule_le` égal à la date de la passe, et recalculé à chaque passe ; `--dry-run` n'écrit rien.
4. Un rapport sans bloc (rapport antérieur, ou avant la première passe) reste lisible : `etat_corpus` rend `hors_corpus: null` et n'invente aucun classement.
5. Un document déclaré `perimetre: "exclu"` au catalogue apparaît avec `statut: "exclu"` et n'est jamais présenté comme un trou ; le catalogue actuel n'exclut aucun des huit instruments.
6. Un document hors corpus ne porte aucun texte ni résumé : le classement ne rend que identifiant, libellé, lien, statut et comptes.
7. `formaterRapport` imprime le classement en texte court ; la description de `etat_corpus` le nomme.
8. `npm run typecheck`, `npm test` et `npm run build` passent.

## Décisions

| #   | Décision                                                                                         | Raison                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Le classement se calcule à la synchronisation et vit dans `data/corpus/sync.json`.                | Le récit impose « recalculé à chaque synchronisation et daté » ; `etat_corpus` doit rester sans index ni réseau, et le calcul plein coûte 1,6 s sur 5 111 documents.        |
| 2   | L'exclusion se déclare dans le catalogue `INSTRUMENTS` (`perimetre: "couvert" \| "exclu"`).        | Choix de l'utilisateur : le catalogue est le seul endroit qui connaît les documents cités, aucune donnée supplémentaire à versionner, et #34 pourra y renvoyer.            |
| 3   | Le catalogue n'exclut rien aujourd'hui ; le critère 5 se prouve sur la fonction pure.              | Les huit instruments cités sont tous au périmètre (#41, #42) ; exclure l'un d'eux pour peupler le cas serait une fausse déclaration.                                     |
| 4   | Le classement ne porte que les documents absents ou exclus.                                        | Un document présent n'est pas un trou ; le rang est un ordre d'ajout au corpus (#24).                                                                                     |
| 5   | Le bloc est optionnel dans `RapportSync`, la version du rapport reste 1.                           | Un rapport antérieur, déjà écrit sur une autre machine, doit rester lisible ; `lireRapport` refuse une forme inconnue, pas un champ manquant. Conséquence assumée : un bloc présent et mal formé fait rendre `null` par `lireRapport`, donc `etat_corpus` perd aussi la fraîcheur — aucune forme inventée.   |
| 6   | L'unité comptée est la citation rendue (décision × instrument), comme la mesure de #31.            | La mesure existante (`mesure.md` de #31) compte déjà 4 459 citations ; deux dénominateurs concurrents rendraient les deux illisibles.                                     |

## Preuve de réussite

- Tests unitaires de la fonction pure : tri, présents écartés, statut `exclu`, autorités et comptes.
- Test de synchronisation sur un `rootDir` temporaire : bloc écrit et daté, `--dry-run` sans écriture, rapport sans bloc toléré.
- Test d'outil : `etat_corpus` rend `hors_corpus: null` sans rapport, puis le classement écrit.
- Relevé sur le corpus réel par `node mcp/eval/citations.ts --classement`, consigné dans `mesure.md`.
- `npm run typecheck`, `npm test` et `npm run build` verts.
