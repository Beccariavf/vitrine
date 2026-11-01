---
objective: "Les décisions du Conseil d'État affichent les articles des textes qu'elles appliquent, lus dans leur texte intégral et sous le plafond PISTE inchangé."
status: pending
---

# Plan: Références des décisions du Conseil d'État

Source: aidd_docs/tasks/2026_11/2026_11_01_references-conseil-etat/spec.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Extraction des articles appliqués | [`phase-1.md`](./phase-1.md) | none |
| 2   | Lecture du texte et enrichissement | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Données et mémoire | [`phase-3.md`](./phase-3.md) | 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/juri | Le texte intégral d'une décision CETAT est rendu par `textId`, avec `texte` et un champ `visas` vide (sonde du 1er novembre 2026, HTTP 200 sur 10 décisions, dont une publiée au Recueil). |
| https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search | `typeChamp: "VISA"` filtre bien sur le visa mais ne rend que des identifiants : inutilisable pour les articles. |
| https://www.conseil-etat.fr/fr/arianeweb/CE/decision/2026-10-27/520279 | Le site rend le même texte, mais impose un scraping ; écarté. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | `/consult/juri` a répondu 200 sur les 10 décisions sondées ; la passe complète reste à observer en phase 3 (`data/usage`). Un appel par nouvelle décision, sous le plafond de 16. | 2, 3 |
| regression | Les références CETAT passent du titre et du résumé aux articles du texte ; risque moyen, la phase 1 verrouille l'extraction sur six textes réels couvrant les neuf résultats avant le branchement. | 1, 2 |
| architecture | Le crochet `ApiResult.enrich`, le report et le cache existent déjà pour Judilibre ; CETAT les réutilise sans changer `Entry.references`. | 2 |
| documentation | La mémoire décrit la lecture du texte CE, la règle des formules et la couverture réelle. | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Les sources API enrichissent après le rattachement. | L'extraction filtre les instruments avec les matières déjà attribuées. |
| Une entrée non lue est différée, jamais écrite avec une référence inventée. | Le rapport sous plafond doit pouvoir relire la décision. |
| `Entry.references` reste un tableau de chaînes. | Aucun changement de schéma ; l'URL se déduit du libellé. |
| Le site ne lit aucune API au runtime. | Les URL de référence restent statiques. |
| La passe reste sous le plafond de 16 appels PISTE. | La lecture du texte est bornée par le budget restant. |
| Les recherches Judilibre passent après CETAT. | Six appels leur sont réservés, sinon la lecture CETAT empêcherait Judilibre de chercher. |
| Une pastille n'apparaît que si un article est trouvé. | Le visa du Conseil d'État ne porte pas d'articles ; l'instrument seul n'apprend rien. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Lire le texte intégral par décision plutôt que scraper le site du Conseil d'État. | Même donnée, même session, même journal, même report ; pas de parseur HTML. |
| N'extraire que les articles des formules d'application et des phrases de considérant. | Les motifs mêlent les textes appliqués aux griefs des parties ; « les dispositions de l'article » attrape les deux. |
| Ne pas exiger que l'instrument figure dans le bloc `Vu :`. | Le visa contient des coquilles (511156 : « 2016/79 ») ; le filtrage par matières suffit et évite d'inventer. |
| Rejouer une passe ciblée pour rattraper les 9 décisions déjà écrites. | Le cache empêche de les relire ; la passe ciblée les réécrit sans toucher aux autres sources. |
| Réserver six appels à Judilibre pendant que CETAT lit ses textes. | La passe est bornée à 16 ; sans réserve, les lectures CETAT feraient échouer les recherches Judilibre qui suivent. |
