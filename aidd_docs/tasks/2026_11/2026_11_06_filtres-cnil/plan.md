---
objective: "Les décisions CNIL portent un type de sanction, un montant d'amende et la présence d'une injonction, extraits du dispositif et validés sur les 249 documents ; `search` expose des filtres de date, type, montant et numéro, poussés dans la requête `vec0`, et un pilote mesure leur apport."
status: completed
---

# Plan: Filtrage CNIL par métadonnées

Source: `aidd_docs/tasks/2026_11/2026_11_06_jeu-cnil-v2/eval-cnil-v2.md` (limite « le vecteur ne sépare pas les décisions aux faits proches »).

## Phases

| #   | Phase                         | File                         | Depends on |
| --- | ----------------------------- | ---------------------------- | ---------- |
| 1   | Extraire les métadonnées      | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Indexer et filtrer            | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | Mesurer le pilote             | [`phase-3.md`](./phase-3.md) | 2          |

## Contrat

- Chaque décision CNIL reçoit `type_sanction` (`amende`, `avertissement`, `rappel`, `injonction`, `liquidation`, `interruption`, `autre`), `montant` (total des amendes en euros, `null` si absent ou masqué) et `injonction`.
- L'extraction lit le dispositif après « PAR CES MOTIFS », jamais un résumé généré. Les astreintes quotidiennes ne sont pas des amendes ; un total suivi de sa décomposition n'est pas additionné à ses composantes.
- `search` expose `date_min`, `date_max`, `type_sanction`, `montant_min`, `montant_max` et `numero`. Les filtres descendent dans la requête `vec0` : filtrer après le KNN affamerait les décisions minoritaires.
- L'index migre sans ré-embarquer ; les chiffres CNIL v2 `dev` et RGPD v2 `dev` doivent se reproduire.
- Le pilote de filtres est un jeu de 12 cas, pas un test tenu à l'écart ; il ne remplace pas le jeu CNIL v2.

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| data | 249 décisions, 6 342 fragments ; 134 amendes (133 avec montant, 1 masquée), 95 avertissements, 12 liquidations, 6 rappels, 2 interruptions. | 1 |
| regression | Ajouter des colonnes à `unites` et `vec_unites` exige une migration ; les vecteurs sont recopiés, pas recalculés. | 2 |
| api | `search` gagne six filtres et rend le type, le montant et l'injonction dans chaque passage. | 2 |
| measure | Pilote : 7/12 au top 5 sans filtre, 11/12 avec. Un cas reste absent. | 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `data/` n'est jamais édité à la main. | `cnil:sync` réécrit `unites.jsonl` ; `corpus:index` en dérive l'index. |
| Aucun vecteur n'est ré-embarqué par la migration. | Seules les métadonnées changent ; l'empreinte du passage est identique. |
| Les filtres descendent dans `vec0`, pas après le KNN. | Même starvation que pour `corpus` et `document`. |
| Le test CNIL v2 consommé n'est pas rejoué. | La migration doit reproduire `dev` (14/25) sans toucher au marqueur. |
| Le pilote n'est pas un test aveugle. | Douze cas écrits pour vérifier l'apport, pas pour classer le système. |
