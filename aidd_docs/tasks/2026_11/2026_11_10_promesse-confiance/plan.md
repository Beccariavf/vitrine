---
objective: "L'étiquette « confiant » porte un taux d'erreur plafonné et mesuré par corpus sur les jeux dev, avec son intervalle, sans retirer de bonne réponse au rendu."
status: implemented
---

# Plan: Donner à « confiant » une promesse mesurée

Source: décision du 2026-11-10 après la mesure `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/` (5 réponses confiantes fausses sur 24, 4 questions sans réponse dont 2 justes).

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | risque-couverture | [`phase-1.md`](./phase-1.md) | none |
| 2   | promesse-choisie | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | regle-implementee | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | mesure-dev | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | contrat-expose | [`phase-5.md`](./phase-5.md) | 4 |
| 6   | confirmation-test | [`phase-6.md`](./phase-6.md) | 5 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://en.wikipedia.org/wiki/Receiver_operating_characteristic#Area_under_the_curve | the risk-coverage framing is the selective-prediction view of the same curve: coverage is the share of answers labelled, risk the error rate among them. |
| https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval | the interval published with each risk is Wilson's, already implemented by `intervalleWilson` in `mcp/eval/run.ts`. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | none: no model, no service, no index change. The rule lives in `mcp/confidence.ts` and is read on every search. | none |
| regression | medium: the level decides whether any passage is returned (`mcp/tools.ts` empties `passages` under `aucun_resultat_fiable`), and `mcp/eval/run.ts` computes the level in four places (`refusee`, `calibrer`, `niveau`, `resume`) without a corpus. Covered by `tests/mcp.test.ts` and `tests/eval.test.ts`; safety net is phase 1, which measures the current rule before it moves. | 1, 3 |
| architecture | the level becomes corpus-aware: `niveauConfiance` reads a threshold table chosen on the requested corpus, with the global fallback for anything else. The three parameters keep their roles — `bas` refuses, `haut` and `marge` certify — so no signature grows. | 3 |
| documentation | `README.md`, `mcp/server.ts` instructions, `aidd_docs/memory/data.md` and `testing.md`. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le split `test` ne se mesure qu'une fois, après la fin des corrections | the promise is confirmed once, on the configuration that ships, never during tuning. |
| Le jeu de tests par défaut ne touche pas le réseau | the risk script reads `--json` files; its tests use fixtures. |
| L'index et le corpus restent intacts | the work is a rule change, not a retrieval change; any reindex would confound it. |
| Aucun modèle plus lourd sans gain mesuré | unchanged: this plan does not swap the embedder, it fixes what the labels claim. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| La promesse est statistique, jamais par réponse | no per-question signal proves the passage is the right one; a measured rate is what can be held, and the docs must say so. |
| `bas` reste le plancher de refus, séparé de la promesse | `confiant` ne dépend que de `haut` et de la marge ; baisser `bas` ne déplace donc pas la promesse, et un quatrième paramètre serait redondant. |
| La table se choisit sur le corpus demandé, jamais sur un document nommé | une recherche qui ne nomme qu'un document part avec l'instruction de requête de repli et un bassin d'un seul document : lui appliquer la table CNIL marierait des similarités produites autrement. Ce mode, et la recherche sans corpus, suivent le repli global et sortent de la promesse. |
| Le plafond est constaté, jamais supposé | le risque se calcule sur les réponses étiquetées `confiant`, pas sur la taille du jeu : 5 erreurs sur 24 confiantes donnent 20,8 %, borne haute 40,5 %. La phase 2 publie la borne que la règle atteint, avec sa couverture, et non un plafond visé d'avance. |
| Les deux jeux CNIL sont mesurés ensemble, et la doctrine est rapportée à part | `questions-cnil-etendu` et `questions-cnil-doctrine` visent le même corpus ; la doctrine est un sous-ensemble adverse (une seule délibération attendue parmi des voisines) où toute étiquette confiante se trompe au moins cinq fois sur huit. Elle informe, elle ne fixe pas la promesse. |
| La promesse vaut pour une recherche dont le corpus est connu | sans `corpus` ni document nommé, l'instruction de requête et le bassin de candidats changent, donc les similarités et les niveaux ; ce mode n'est pas mesuré et ne porte aucune promesse. |
| La promesse est liée au couple (modèle, corpus) | un changement d'embedder déplace l'échelle : la table se recalibre, la mécanique reste. C'est ce qui permettra de garder Harrier sans refaire l'architecture. |
