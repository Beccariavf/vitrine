# Phase 2 — Synchronisation Cour de cassation

## Livrables

- `mcp/corpus/cc/sync.ts` : recherche paginée, union des identifiants, inclusion des entrées de veille, cache brut par décision, reprise, manifeste et `etat.json`.
- Commande `npm run cc:sync` (`--dry-run`, `--max-appels`, `--date-min`, `--archive` implicite).
- Fixtures et tests hors ligne : recherche paginée, reprise sans redemander, budget épuisé sans écrire, corpus commité conforme au manifeste.

## Vérification

- Une seconde passe sur le même cache ne fait aucun appel de décision et n'écrit rien.
- Le corpus n'est écrit qu'après validation des unités.

## État

Livré et couvert par `tests/cc-corpus.test.ts` et `tests/cjue-corpus.test.ts`.
