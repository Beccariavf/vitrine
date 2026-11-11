# Harrier hors CNIL : mesures `dev` des cinq autres corpus et de la doctrine

Date : 2026-11-11. Modèle : `leoipulsar/harrier-0.6b` (Ollama, 1 024 dimensions), index produit
`data/corpus/index/index.db`, 53 143 unités, recherche dense. Aucun split `test` n'existe hors CNIL :
ces chiffres sont **des constats `dev`, pas des promesses**. Les commandes passent les seuils de la
règle livrée (`0,69 / 0,74 / 0,01` hors CNIL ; `0,73 / 0,73 / 0,01` pour la doctrine, qui déclare
`cnil`), pour que la vue rendue soit celle du produit.

## Résultats

| Jeu | Corpus | Questions sém. | Top 5 | Rang 1 | MRR | Confiantes | Fausses | Refusées (dont justes) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `questions-v2.csv` `dev` | `rgpd` | 19 | **19/19** | 15/19 | 0,886 | 5 (26,3 %) | 0 | 1 (1) |
| `questions-aiact.csv` | `aiact` | 3 | 3/3 | 2/3 | 0,733 | 0 | — | 0 |
| `questions-lil.csv` `dev` | `lil` | 10 | 9/10 | 6/10 | 0,725 | 2 (20,0 %) | 0 | 0 |
| `questions-ce.csv` `dev` | `ce` | 12 | 6/12 | 3/12 | 0,347 | 2 (16,7 %) | 0 | 0 |
| `questions-cepd.csv` `dev` | `cepd` | 10 | 10/10 | 10/10 | 1,000 | 3 (30,0 %) | 0 | 0 |
| `questions-cnil-doctrine.csv` `dev` | `cnil` | 10 | 2/10 | 1/10 | 0,120 | 3 (30,0 %) | **3** | 0 |

Fichiers : `mesures/dev-<jeu>.json`. La doctrine est le seul jeu dont les confiantes se trompent ;
elle reste **hors promesse** et c'est un sous-ensemble adverse connu.

## Comparaison aux mesures qwen3 du 2026-11-09

Elles portaient sur le même index de 53 143 unités mais l'ancien modèle, et sans split `test` pour ces
corpus. Écarts observés, sans verdict : aucun jeu n'a la puissance statistique de trancher (3 à 19
questions sémantiques).

| Jeu | qwen3 `0.6b` | Harrier | Écart |
| --- | --- | --- | --- |
| RGPD v2 | 18/19 (MRR 0,860) | 19/19 (0,886) | +1 question, +0,026 MRR |
| AI Act | 2/3 (0,278) | 3/3 (0,733) | +1 question, +0,455 MRR |
| LIL | 10/10 (0,750) | 9/10 (0,725) | −1 question, −0,025 MRR |
| Conseil d'État | 8/12 (0,486) | 6/12 (0,347) | **−2 questions, −0,139 MRR** |
| CEPD | 10/10 (1,000) | 10/10 (1,000) | nul |
| CNIL doctrine | 3/10 (0,225) | 2/10 (0,120) | −1 question, −0,105 MRR |

## Ce qui change dans la vue rendue

- **RGPD** : une bonne réponse est désormais refusée par le plancher du repli (similarité de tête sous
  0,69) alors que son document est au top 5 brut. Le classement brut monte à 19/19, la vue rendue en
  perd une. Le repli n'a pas été recalibré pour Harrier : c'est le coût assumé de garder un triplet
  calibré sur une autre échelle.
- **Conseil d'État** : le recul est le plus net, en top 5 comme en MRR. Aucune promesse n'y était
  attachée ; le lot ne change pas sa ligne de table.
- **Doctrine CNIL** : sous la table Harrier, 3 confiantes sur 3 sont fausses, contre 4 sur 6 avant.
  La couverture baisse (30 % contre 60 %) et le risque monte ; le sous-ensemble reste hors plafond,
  et ce constat ne modifie pas la promesse du jeu étendu.
- **AI Act, LIL, CEPD** : mouvements d'une question au plus, sans verdict.

## Limites

- Mesures `dev` seulement ; aucun de ces corpus n'a de split `test`, donc rien n'est confirmé hors
  échantillon.
- Le repli `0,69 / 0,74 / 0,01` reste calibré sur le jeu v1 RGPD de `qwen3-embedding:0.6b` ; il est
  appliqué tel quel à l'échelle de Harrier. Le ticket #20 ne demande pas de le recalibrer et aucun jeu
  hors CNIL n'a la puissance de le faire.
