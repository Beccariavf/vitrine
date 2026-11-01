---
objective: "Les décisions de la Cour de cassation affichent le visa officiel et toutes les références ouvrent leur texte officiel dans un nouvel onglet."
status: completed
---

# Plan: Visa de la Cour de cassation et références cliquables

Source: aidd_docs/tasks/2026_11/2026_11_01_visa-decisions-sanctions/spec.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Extraction du visa | [`phase-1.md`](./phase-1.md) | none |
| 2   | Lecture du visa Judilibre | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Références cliquables | [`phase-3.md`](./phase-3.md) | none |
| 4   | Donnée et mémoire | [`phase-4.md`](./phase-4.md) | 2, 3 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.data.gouv.fr/datasets/api-judilibre | Le champ `visa` porte les textes appliqués. |
| https://github.com/Cour-de-cassation/judilibre-search/blob/master/src/modules/elastic/decision.js | La décision rend `visa` sous forme de titres ; l'export supprime le visa quand il est abrégé. |
| https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search | Les identifiants Légifrance : LIL `LEGITEXT000006068624`, CPCE `LEGITEXT000006070987`, Code de la consommation `LEGITEXT000006069565`. |
| https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679 | Les URL CELEX des instruments européens répondent. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | `/decision?id=6ac6079ec27382d099f5a06e` a répondu 200 le 1er novembre 2026 avec un tableau `visa` ; le tableau est vide quand la décision ne cite aucun texte, cas testé. | 2 |
| regression | Les références Judilibre passent du résumé au visa ; le risque est moyen, la phase 1 verrouille l'extraction avant le branchement. | 1, 2 |
| architecture | Les sources API gagnent un enrichissement optionnel après le rattachement ; `Entry.references` ne change pas. | 2 |
| documentation | La mémoire décrit la source du visa, les liens et les tests. | 4 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le rattachement reste central ; Judilibre conserve seulement la matière de sa requête comme indice. | Une décision trouvée par une matière ne doit pas être écartée avant la lecture du visa. |
| Le site ne lit aucune API au runtime. | Les URL de référence sont statiques, dérivées au build. |
| Une panne de source n'emporte pas les autres. | Une erreur d'enrichissement devient un avertissement, pas un échec de passe. |
| `Entry.references` reste un tableau de chaînes. | Aucun changement de schéma ; l'URL se déduit du libellé. |
| Les références d'une décision sont limitées aux instruments de ses matières. | Le visa peut citer un texte suivi qui n'a pas rattaché l'entrée ; il ne doit pas apparaître. |
| La passe reste sous le plafond de 16 appels PISTE. | La lecture du visa est bornée par le budget restant. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Enrichir les sources API après le rattachement, via un crochet porté par le résultat de la source. | Garde le rattachement central et évite de lire le visa des décisions écartées. |
| Conserver la matière de la requête Judilibre sur chaque résultat. | Une décision peut ne correspondre que par son visa ; sans cet indice, elle serait écartée avant d'être lue. |
| Dériver l'URL de référence du libellé canonique au build. | Préserve le contrat de données et couvre toutes les sources avec une seule table. |
| Lire le visa de la Cour de cassation par décision, sous le plafond, plutôt qu'en export global. | L'export non abrégé porte le texte intégral ; la lecture par décision reste bornée. |
