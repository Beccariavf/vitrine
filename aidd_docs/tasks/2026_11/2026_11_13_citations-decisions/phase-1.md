---
status: pending
---

# Instruction: Extraire les citations d'une décision

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp/
│   └── corpus/
│       └── citations.ts ✅
└── tests/
    └── citations.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Créer un texte synthétique portant les formes réelles (`article 6 du règlement (UE) 2016/679`, `articles 8 et 20 de la loi n° 78-17`, `Article 82 de la loi du 6 janvier 1978`). | Le texte est prêt, sans fixture externe. | cli |
| Happy path   | Appeler `extraireCitations` sur un texte qui attribue un article à un instrument. | La citation porte le libellé court, les articles dans l'ordre du texte, `reference` et l'URL officielle. | cli |
| Edge case    | Soumettre `l'article 94 du décret du 20 octobre 2005 pris pour l'application de la loi du 6 janvier 1978`, `l'article 6 de la convention européenne`, `Article 101 du traité sur le fonctionnement de l'Union européenne`. | Aucune citation : l'instrument ne suit pas immédiatement, ou n'est pas dans le périmètre. | cli |
| Edge case    | Soumettre `articles 378 et 226-21 du code pénal`. | Seul `226-21` reste. | cli |
| Teardown     | Aucun état écrit. | La racine reste inchangée. | cli |

## Tasks to do

### `1)` Poser le catalogue des instruments du périmètre

> Huit instruments, leurs formes réelles, leur libellé court et leur lien officiel.

1. Créer `mcp/corpus/citations.ts` : type `Citation` (`instrument`, `articles`, `reference`, `url: string | null`).
2. Déclarer RGPD, 95/46, ePrivacy, 2016/680, 2018/1725, loi 78-17, CPCE et Code pénal, chacun avec ses formes françaises et anglaises (`GDPR`, `Regulation (EU) 2016/679`, `Directive 95/46/EC`, `Directive 2002/58/EC`, `Directive (EU) 2016/680`, `Regulation (EU) 2018/1725`, `Article 6 GDPR`).
3. Calculer `reference` sur le modèle de `veille/references.ts` (`RGPD · art. 6, 12`) et exposer `urlOfficielle(libelle): string | null`, avec les URL des sources externes du plan ; un libellé inconnu rend `null` et la référence reste affichable sans lien.

### `2)` Extraire l'article qui précède son instrument

> La forme dominante du français juridique : « l'article 82 de la loi n° 78-17 ».

1. Reconnaître `article`/`articles`/`art.`, les listes (`,`, `et`, `à`, plages), `1er`, `L. 34-5`, `226-16`, `6.1`.
2. N'accepter que le connecteur (`du`, `de la`, `de l'`, `des`, `of`) suivi immédiatement de l'instrument, dans la même proposition (ponctuation forte exclue).
3. Refuser l'instrument trouvé plus loin dans la proposition (`du décret … de la loi …`, `du traité …`).

### `3)` Extraire l'instrument qui précède ses articles

> La forme des en-têtes CJUE et des visas : « Directive 95/46/CE — Articles 2, 4, 12 et 14 ».

1. Reconnaître l'instrument suivi de séparateurs (`—`, `–`, `,`, `:`) puis d'une liste d'articles.
2. Accepter `notamment ses articles …` dans la même proposition.
3. Résoudre `du même règlement` / `de la même directive` / `de la même loi` seulement si un seul instrument de cette nature est nommé dans le document.

### `4)` Filtrer, ordonner et dédoublonner

1. Écarter tout instrument hors périmètre et tout article du Code pénal antérieur à 226-16.
2. Rendre les instruments dans l'ordre du périmètre, les articles dans l'ordre de rencontre, sans doublon.
3. Rendre `[]` pour un texte sans citation reconnue ; un instrument reconnu sans URL garde son libellé et `url: null`.

### `5)` Écrire les tests unitaires

1. Créer `tests/citations.test.ts` avec les cas du Test Scope.
2. Couvrir une liste (`articles 5 et 6`), une plage (`articles 5 à 7`), une anaphore résolue, une anaphore ambiguë non résolue, une forme anglaise (`Article 6 GDPR`, `Article 6 of Regulation (EU) 2016/679`).
3. Vérifier les URL officielles, `urlOfficielle` qui rend `null` pour un libellé inconnu, et l'absence de citation pour un texte vide.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `RGPD`, `loi 78-17`, `CPCE`, `directive 95/46/CE`, `ePrivacy`, `2016/680`, `2018/1725` et `code pénal` sortent avec leur libellé court et leur URL ; `urlOfficielle("inconnu")` rend `null` ; un instrument hors périmètre ne sort jamais. |
| 2 | `l'article 82 de la loi n° 78-17` rend `loi 78-17 · art. 82` ; `l'article 94 du décret … de la loi du 6 janvier 1978` rend `[]` ; `articles 8 et 20 de la loi n° 78-17` rend `art. 8, 20` ; `Article 6 GDPR` rend `RGPD · art. 6`. |
| 3 | `Directive 95/46/CE — Articles 2, 4, 12 et 14` rend `directive 95/46/CE · art. 2, 4, 12, 14` ; `l'article 15 du même règlement` après un seul RGPD nommé rend `RGPD · art. 15` ; deux règlements nommés rendent `[]`. |
| 4 | `articles 378 et 226-21 du code pénal` rend `code pénal · art. 226-21` ; `article 6 du règlement (UE) 2024/1689` rend `[]` ; l'ordre est stable entre deux textes équivalents. |
| 5 | `npm test` passe et `npm run typecheck` passe. |
