---
objective: "`etat_corpus` rend le classement des documents cités absents du corpus, daté et recalculé à chaque synchronisation, avec les autorités qui les citent et la mention « exclu » pour un document déclaré hors périmètre."
status: planned
---

# Plan: Classer les documents absents les plus cités

Source: GitHub issue #32 (epic #25, feuille de route #65), contrat dans `spec.md`.

## Phases

| #   | Phase                  | File                         | Depends on |
| --- | ---------------------- | ---------------------------- | ---------- |
| 1   | classement-pur         | [`phase-1.md`](./phase-1.md) | none       |
| 2   | rapport-et-sync        | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | surfaces-et-preuve     | [`phase-3.md`](./phase-3.md) | 1, 2       |

## External sources

| URL | What it settled |
| --- | --------------- |
| aucune | Aucun réseau : les citations, les manifestes et le catalogue sont déjà locaux. |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Une passe d'extraction sur les cinq corpus de décisions coûte 1,6 s et lit 5 111 documents (mesuré le 2026-11-13 sur le corpus réel) à chaque `npm run corpus:sync`, déjà long par la réindexation. `etat_corpus` ne calcule rien : il lit le bloc du rapport, sans index, sans réseau, sans écriture. | 1, 2 |
| regression | `RapportSync` gagne un champ optionnel : les rapports déjà commités restent lisibles et `etat_corpus` rend `hors_corpus: null`. `formaterRapport` et le test de description d'outil de `tests/mcp.test.ts` sont relus. Aucun changement d'index. | 2, 3 |
| architecture | Un module neuf `mcp/corpus/hors-corpus.ts` porte le classement ; il lit `citationsDuCorpus`, `documentsPresents` et le catalogue de `citations.ts`, jamais une seconde extraction. Le catalogue reste la source unique des instruments et de leur périmètre. `data/corpus/sync.json` reste la seule mémoire de la passe. | 1, 2 |
| documentation | `README.md` (§ état du corpus), `architecture.md` (le classement et sa déclaration d'exclusion), `codebase-map.md` (`hors-corpus.ts`, `eval/citations.ts`), `testing.md` (les nouveaux tests), et `mesure.md` (relevé réel). | 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `data/` n'est jamais édité à la main | Le bloc `hors_corpus` n'est écrit que par `npm run corpus:sync` ; les tests écrivent sous un `rootDir` temporaire. |
| Ne mesurer que ce qui est déclaré | Un document exclu se déclare au catalogue ; le classement ne devine aucune exclusion. |
| Un document hors corpus ne porte aucun texte ni résumé | Le classement ne rend que identifiant, libellé, lien, statut et comptes. |
| La fraîcheur du corpus reste à #34 | Le bloc ne porte que sa date de calcul (`calcule_le`), pas la fraîcheur du corpus. |
| `npm run typecheck`, `npm test` et `npm run build` passent avant le push | Règle du dépôt (`coding-assertions.md`) ; la CI les rejoue. |

## Decisions

| Decision | Why |
| -------- | ----- |
| Un module pur `classerCitations` séparé de la lecture du corpus | Le tri, le statut et les comptes se testent sans `data/` ; la lecture reste une enveloppe de trois lignes. |
| L'unité comptée est la citation rendue (décision × instrument) | Même dénominateur que la mesure de #31 (4 459 citations, 410 hors corpus) ; deux dénominateurs rendraient les deux illisibles. |
| Un seul bloc `hors_corpus` dans `sync.json`, écrit à chaque passe | Le critère exige un classement daté et recalculé ; un cache à part créerait une seconde vérité. |
| Le libellé d'autorité est humain (`CNIL`, `Conseil d'État`, `Cour de cassation`, `CJUE`, `CEPD`) | `etat_corpus` s'adresse à un juriste ; les identifiants de corpus restent ceux du champ `corpus` de l'inventaire. |
| `perimetre` par défaut `couvert`, jamais déduit d'une date ou d'un manifeste | Le catalogue déclare ; une déduction implicite ferait apparaître des exclusions que personne n'a décidées. |
