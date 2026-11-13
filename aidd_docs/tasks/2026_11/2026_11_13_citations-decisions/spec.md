---
status: approved
date: 2026-11-13
source: GitHub issue #28
---

# Contrat : Voir les textes qu'une décision cite

## Objectif observable

Une décision rendue par `search` ou `get_decision` liste les instruments et articles du périmètre « données personnelles » qu'elle cite, extraits du texte du corpus, chacun avec son lien officiel quand il est connu ; une décision sans citation reconnue rend une liste vide.

## Périmètre

- Extraction déterministe depuis `data/corpus/{cnil,ce,cc,cjue,cepd}/unites.jsonl`, au niveau du document.
- Exposition dans `search` (chaque passage) et `get_decision` (chaque décision).
- Instruments admis : RGPD, 95/46, ePrivacy, 2016/680, 2018/1725, loi 78-17, CPCE, Code pénal 226-16 et suivants.
- Aucun stockage, aucun changement d'index, aucune écriture dans `data/`.
- Hors périmètre : citations entre décisions (#30), documents cités absents du corpus (#31), classement des absents (#32), statut des textes (#33).

## Critères d'acceptation

1. Une décision rendue par `search` ou `get_decision` (CNIL, Conseil d'État, Cour de cassation, CJUE, CEPD) liste les instruments et articles qu'elle cite, au format `RGPD · art. 6`, `loi 78-17 · art. 82`.
2. Les citations viennent du texte du corpus, pas des seules entrées de veille.
3. Chaque instrument cité porte son lien officiel quand il est connu ; un instrument inconnu reste un libellé (`url: null`).
4. Une décision sans citation reconnue rend une liste vide, jamais une citation inventée.
5. La liste ne contient que des instruments du périmètre déclaré.

## Décisions

| # | Décision | Raison |
| --- | --- | --- |
| 1 | Extraction à la lecture, cache par corpus des seules citations. | Aucune reconstruction d'index, aucun schéma à migrer ; #29 pourra persister une table quand la requête par article arrivera. |
| 2 | Citations au niveau du document, recopiées sur chaque passage rendu. | Une décision garde sa base juridique complète, même si le passage remonté ne la nomme pas. |
| 3 | Un article n'est retenu que si son instrument suit immédiatement le connecteur, ou précède la liste dans la même proposition. | La précision prime : une liste vide est préférée à une attribution inventée. |
| 4 | Instrument sans article non rendu. | Même règle que `Entry.references` ; « Vu le règlement (UE) 2016/679 » n'établit pas une base article par article. |
| 5 | Anaphore (`du même règlement`) résolue seulement si un seul instrument de même nature est nommé. | Sans la garde, la résolution inventerait l'antécédent. |
| 6 | Alias anglais (`GDPR`, `Directive 95/46/EC`, `Article 6 GDPR`). | La CJUE bascule en anglais quand le français manque ; une décision anglaise doit citer comme les autres. |
| 7 | Aucun seuil de précision publié. | #30 fixe le seuil pour les citations entre décisions ; #28 publie seulement la précision mesurée sur échantillon. |

## Preuve de réussite

- `npm run typecheck`, `npm test` et `npm run build` passent.
- `mesure.md` donne la précision sur 25 documents relus (5 par corpus) avec son dénominateur.
- Sur un document CNIL connu (`CNILTEXT000055022778`), `get_decision` rend ses citations avec leurs URL.
