---
objective: "Le MCP sert les décisions de la Cour de cassation et de la CJUE sur les données personnelles depuis 2014, avec couverture déclarée et éval dev."
status: done
---

# Plan: Corpus Cour de cassation et CJUE

Source: aidd_docs/tasks/2026_11/2026_11_11_corpus-cassation-cjue/spec.md

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1 | Budget PISTE et parseur Cour de cassation | [`phase-1.md`](./phase-1.md) | none |
| 2 | Synchronisation Cour de cassation | [`phase-2.md`](./phase-2.md) | 1 |
| 3 | Parseur et synchronisation CJUE | [`phase-3.md`](./phase-3.md) | none |
| 4 | Collecte, index, éval dev | [`phase-4.md`](./phase-4.md) | 2, 3 |
| 5 | Serveur, documentation et mémoire | [`phase-5.md`](./phase-5.md) | 4 |
| 6 | Élargir la CJUE à la notion fine | [`phase-6.md`](./phase-6.md) | 3, 5 |

## Impact

| Catégorie | Verdict et preuve | Phase |
| --- | --- | --- |
| runtime | Judilibre exige un budget d'appels dédié ; CELLAR répond en 303 puis 200 ; le SPARQL peut être lent. | 1, 2, 3 |
| régression | `PisteSession` gagne un budget optionnel ; les listes de corpus des tests et du serveur passent de six à huit. | 1, 5 |
| architecture | Deux dossiers autonomes sous `mcp/corpus/`, aucun changement de schéma d'index. | 2, 3 |
| documentation | README, `server.ts`, mémoire (`architecture`, `data`, `codebase-map`, `testing`) et couverture. | 5 |

## Rules

- `data/` n'est jamais édité à la main.
- Aucun secret versionné ; `.env` reste local.
- Chaque source a sa fixture et son test ; hors ligne par défaut.
- `npm run typecheck`, `npm test`, `npm run build` avant tout push.
