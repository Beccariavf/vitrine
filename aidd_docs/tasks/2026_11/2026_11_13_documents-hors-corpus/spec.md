---
status: approved
date: 2026-11-13
source: GitHub issue #31
---

# Contrat : Signaler les documents cités absents du corpus

## Objectif observable

Toute citation d'instrument rendue par `search` et `get_decision` nomme le document officiel qu'elle vise et dit s'il appartient au corpus ; une interrogation portant sur un instrument connu mais absent répond « absent de mon corpus (périmètre : …) », jamais « introuvable » ni une chaîne vide.

## Périmètre

- Les huit instruments que l'extracteur de #28 reconnaît : RGPD, directive 95/46/CE, ePrivacy, 2016/680, 2018/1725, loi 78-17, CPCE, code pénal.
- Présence lue à la lecture dans `data/corpus/*/manifest.json` (champ `document` ou `text_id`).
- Surfaces : les `citations` de `search` et `get_decision`, et les messages de `get_article`, `get_decision` et `search` quand `document` nomme un instrument connu absent.
- Hors périmètre : citations entre décisions (#30), classement des absents (#32), statut des textes (#33), périmètre et fraîcheur dans chaque réponse (#34), veille.

## Critères d'acceptation

1. Chaque citation porte l'identifiant du document visé (`32002L0058`, `LEGITEXT000006068624`…) et `hors_corpus: true | false`.
2. Les citations du RGPD et de la loi 78-17 sont marquées présentes ; celles des six autres instruments sont marquées absentes.
3. Une citation hors corpus garde son lien officiel et ne porte aucun texte ni résumé.
4. `get_article`, `get_decision` et `search` interrogés sur l'identifiant d'un instrument connu absent répondent « absent de mon corpus (périmètre : …) », avec la liste des huit corpus, et ne rendent aucun texte.
5. Un identifiant inconnu garde la réponse actuelle : le serveur n'affirme pas l'absence de ce qu'il ne connaît pas.
6. Le marquage est calculé à la lecture : ajouter le manifeste d'un instrument dans `data/corpus/` fait disparaître la mention sans changement de code, prouvé sur un corpus temporaire.
7. `npm run typecheck` et `npm test` passent.

## Décisions

| #   | Décision                                                                            | Raison                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Le périmètre se limite aux instruments de #28 ; les décisions citées relèvent de #30. | La feuille de route #65 ordonne #31 avant #29 et #30, et réserve les citations entre décisions à #30, qui doit fixer un seuil de précision avant de les exposer.     |
| 2   | La présence se lit dans les manifestes, jamais dans une constante.                   | Critère 6 : un document qui entre au corpus ne doit demander aucune édition manuelle.                                                                              |
| 3   | Un instrument inconnu n'est jamais déclaré absent.                                   | Le serveur ne connaît que huit instruments ; déclarer « absent » un identifiant inconnu serait une affirmation non prouvée.                                        |
| 4   | Le périmètre cité est la liste des huit corpus, sans date de fraîcheur.              | #34 porte la fraîcheur ; #31 ne publie qu'un refus exact.                                                                                                          |
| 5   | Le refus garde la forme actuelle d'une absence (`trouve: false` + message).          | Aucun champ nouveau à négocier côté client ; les outils existants disent déjà une absence.                                                                          |

## Preuve de réussite

- Tests unitaires des citations (présent, absent, identifiant inconnu) et des trois outils.
- Test sur un `rootDir` temporaire : manifeste ajouté, mention disparue.
- Relevé sur le corpus réel : chaque instrument cité hors corpus apparaît marqué, avec son compte, dans `mesure.md`.
- `npm run typecheck` et `npm test` verts.
