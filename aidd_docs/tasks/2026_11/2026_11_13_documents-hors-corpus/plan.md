---
objective: "Chaque citation d'instrument rendue par search et get_decision porte l'identifiant du document visé et son appartenance au corpus ; un instrument connu absent répond « absent de mon corpus (périmètre : …) » sans rendre de texte."
status: completed
---

# Plan: Signaler les documents cités absents du corpus

Source: GitHub issue #31 (epic #25, feuille de route #65), contrat dans `spec.md`.

## Phases

| #   | Phase                  | File                         | Depends on |
| --- | ---------------------- | ---------------------------- | ---------- |
| 1   | identifiant-et-presence | [`phase-1.md`](./phase-1.md) | none       |
| 2   | exposition-outils      | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | preuve-et-documentation | [`phase-3.md`](./phase-3.md) | 1, 2       |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058` | URL officielle déjà portée par l'instrument ePrivacy ; le CELEX `32002L0058` sert d'identifiant, comme les six autres instruments UE. |
| `https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987` | URL du CPCE ; `LEGITEXT000006070987` sert d'identifiant, comme `LEGITEXT000006068624` pour la LIL. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Lecture de huit `manifest.json` (29 035 octets au total, mesuré le 2026-11-13) à chaque réponse qui rend des citations ou refuse un document : aucun réseau, aucune écriture. Le marquage ne relit pas `unites.jsonl` ; le cache par fichier de `citationsDuCorpus` reste celui des citations brutes. | 1, 2 |
| regression | `Citation` gagne `document` ; `Passage.citations` et `DecisionTrouvee.citations` passent au type enrichi, lus par `mcp/eval/citations.ts`, `tests/citations.test.ts` et `tests/mcp.test.ts`. Les descriptions d'outils sont assertées par `tests/server-stdio.test.ts` : elles sont relues et ajustées. Aucun changement d'index ni de `data/`. | 1, 2 |
| architecture | Aucun module nouveau : `mcp/corpus/citations.ts` reste la source unique des instruments et de leurs identifiants ; la présence se lit dans les manifestes, jamais dans une constante (décision 2 du contrat). Le refus passe par les trois outils existants, sans champ nouveau. | 1, 2 |
| documentation | `README.md` §réponses des outils, `architecture.md` (citations et présence), `codebase-map.md` (`citations.ts`, `tools.ts`), `testing.md` (tests et échantillonneur), et `mesure.md` (relevé par corpus). | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `data/` n'est jamais édité à la main | Les tests de présence écrivent leurs manifestes sous un `rootDir` temporaire ; le corpus réel n'est que lu. |
| Ne jamais déclarer absent ce que le serveur ne connaît pas | Le refus ne s'applique qu'aux huit identifiants d'instruments ; tout autre identifiant garde sa réponse actuelle. |
| Un document hors corpus ne porte aucun texte ni résumé | La citation garde instrument, identifiant, articles, lien et marque ; jamais de contenu. |
| Le périmètre cité ne porte aucune date de fraîcheur | `#34` porte la fraîcheur ; `#31` ne publie qu'un refus exact. |
| `npm run typecheck`, `npm test` et `npm run build` passent avant le push | Règle du dépôt (`coding-assertions.md`) ; la CI les rejoue. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Deux types : `Citation` extraite, `CitationRendue` marquée | L'extraction reste pure et testable sans corpus ; le marquage est le seul endroit qui lit la présence, sans valeur par défaut qui mentirait. |
| Présence lue dans les manifestes à chaque appel, sans cache | 29 Ko de JSON suffisent pour l'ordre de grandeur d'une réponse ; un cache devrait suivre l'arrivée d'un manifeste, le critère 6 exige que la mention disparaisse seule. |
| Un seul message d'absence, partagé par `get_article`, `get_decision` et `search` | Le contrat impose la même phrase ; une seconde formulation ouvrirait deux vérités. |
| Le refus de `search` s'applique avant l'embedder et l'index | Un document absent du corpus n'a aucun passage à chercher ; la réponse ne doit pas dépendre d'Ollama ni de l'index. |
