# Phase 3 — Parseur et synchronisation CJUE

## Livrables

- `mcp/corpus/cjue/descripteur.json` : matière PDON, borne, langue `fra`, types retenus.
- `mcp/corpus/cjue/liste.ts` : requête SPARQL et lecture de la liste (CELEX, date).
- `mcp/corpus/cjue/parse.ts` : en-tête, points de motivation, dispositif.
- `mcp/corpus/cjue/sync.ts` : liste, cache XHTML par CELEX, reprise, comptes et manifeste.
- Commande `npm run cjue:sync` (`--dry-run`, `--date-min`, `--limite`).
- Fixtures et tests hors ligne : liste réduite, arrêt Google Spain, version française absente comptée, idempotence.

## Vérification

- Une capture sans point de motivation retombe sur des fragments de paragraphes, jamais sur zéro unité.
- Un CELEX absent (404) est écarté et compté, sans faire échouer les autres.

## État

Livré et couvert par `tests/cc-corpus.test.ts` et `tests/cjue-corpus.test.ts`.
