---
status: pending
---

# Instruction: Extraction des articles appliqués

## Architecture projection

```txt
.
├── ✏️ veille/references.ts
├── ✏️ tests/references.test.ts
└── ✅ tests/fixtures/cetat/textes.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Charger les extraits réels des décisions 501268, 509210, 509589, 511155, 513996 et 520279 | Les textes sont prêts | cli |
| Happy path   | Extraire le texte de 501268 | `CPCE · art. L. 34-5`, `LIL · art. 8, 82, 20` et `RGPD · art. 83` | cli |
| Happy path   | Extraire 511155 et 513996 | `RGPD · art. 15` et `LIL · art. 31, 118` | cli |
| Edge case    | Extraire un grief (« violation de l'article 15 du RGPD », « les dispositions de l'article 58 ») ou un moyen placé avant les motifs | Aucune référence | cli |
| Edge case    | Extraire « L'article 15 du RGPD garantit » puis « L'article 16 du même règlement permet » | `RGPD · art. 15, 16` | cli |

## Tasks to do

### `1)` Reconnaître les instruments du texte

> Réutiliser `visaInstruments`, qui connaît déjà les instruments nommés et les actes européens.

1. Garder `visaInstruments` interne à `veille/references.ts`.
2. Vérifier qu'il rend `Règlement (UE) 2016/679`, `Loi Informatique et Libertés`, `Code des postes et des communications électroniques`, `Directive 2002/58/CE` et un acte générique.

### `2)` Extraire les articles appliqués

> Trois formes seulement : la formule d'application, la phrase de considérant, l'anaphore ; et seulement dans les motifs.

1. Ajouter `extractCetatReferences(text: string): string[]`, qui ne lit qu'après « Considérant ce qui suit » : avant, ce sont les visas et les moyens des parties.
2. Formules : « aux termes (de/des/du) (dispositions (combinées)) », « il résulte (de/des/du) (dispositions (combinées)) », « en vertu de », « en application de », « sur le fondement de ». L'instrument est celui qui suit la formule dans la même phrase.
3. Phrase de considérant : `L'article X du <instrument> garantit|permet|prévoit|dispose|oblige|impose|interdit|exige|confère|ouvre|accorde|définit|fixe|soumet|autorise|protège|énonce`.
4. Anaphore : `L'article X du même|de la même règlement|loi|code|directive`, seulement si elle ouvre une phrase et qu'un verbe d'application la suit ; l'instrument est le dernier nommé avant, de même nature.
5. Ne pas prendre « les dispositions de l'article X » comme déclencheur : cette tournure est aussi celle des griefs. Seules les formules listées et la phrase de considérant déclenchent l'extraction. Une formule directement introduite par « soutient que », « est soutenu » ou « moyen tiré de ce que » est ignorée ; « il résulte de l'instruction » ne déclenche rien.
6. Fusionner par instrument et dédoublonner les articles.

### `3)` Verrouiller les cas

> Des extraits réels, pas des textes inventés.

1. Ajouter `tests/fixtures/cetat/textes.json` avec les extraits de 501268, 509210, 509589, 511155, 513996 et 520279.
2. Tester les six décisions, les moyens écartés, les griefs exclus, « il résulte de l'instruction », l'anaphore, les listes et plages d'articles, un texte vide.
3. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les cinq instruments suivis et un acte européen générique sont reconnus avec leur libellé canonique. |
| 2 | 501268 rend `LIL · art. 8, 82, 20`, `CPCE · art. L. 34-5` et `RGPD · art. 83` (le texte réel cite aussi le barème et l'article 8) ; 509210 rend `RGPD · art. 15, 16` ; 509589 rend `LIL · art. 8, 20` ; 511155 rend `RGPD · art. 15` ; 513996 rend `LIL · art. 31, 118` ; 520279 rend `[]`. |
| 3 | Les tests de `tests/references.test.ts` passent hors ligne, y compris l'exclusion des moyens et des griefs, de « il résulte de l'instruction » et de « les dispositions de l'article ». |
