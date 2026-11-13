---
status: approved
date: 2026-11-13
spec: ./spec.md
---

# Plan : décisions qui citent un article

Une seule phase.

## Étapes

1. `mcp/corpus/hors-corpus.ts` : exporter `autoriteDe`.
2. `mcp/corpus/citants.ts` :
   - `formeArticle` : normalise un numéro (`art.`, `1er`, `L.34-5`) ; `citeArticle(citation, numero)` : égalité de base, alinéa ignoré, plage numérique `a–b` contenant le numéro.
   - `decisionsCitant(rootDir, { document, numero, limite?, decalage? })` : identifiant inconnu → refus ; article au corpus lu dans le seul `unites.jsonl` du corpus qui déclare le document ; citants depuis `citationsDuCorpus` des `CORPUS_DECISIONS` ; métadonnées (numéro, date, URL) de la première unité de chaque décision citante ; tri, comptes par autorité, pagination, messages.
3. `mcp/server.ts` : outil `decisions_citant`, schéma zod (`limite` 1–500, `decalage` ≥ 0), description ; message de démarrage et compte d'outils.
4. Tests `tests/citants.test.ts` (racines temporaires) ; `tests/mcp.test.ts` : liste des outils et description.
5. `npm run typecheck`, `npm test`, `npm run build` ; smoke RGPD art. 9 sur le corpus réel.

## Validation

- Pas de parcours de bout en bout : aucune interface du site ; le serveur est couvert par le client MCP en mémoire.
