# Testing

Comment le projet est testé : les couches, les outils et les conventions. Où vivent les tests et comment les lancer.

## Strategy

- Unitaire : parseur CNIL, canonisation d'URL, identifiant, écriture (idempotence, déplacement d'une entrée).
- Unitaire : lecteur d'entrées (`src/lib/entries.ts`), sur le `data/` committé et sur des racines temporaires : une entrée par fichier, tri décroissant avec les dates nulles en dernier, JSON ou champ invalide qui lève, `data/` absent qui lève.
- Intégration : `run` avec un `fetch` injecté, sur une racine temporaire.
- Aucun test ne touche le réseau : les fixtures sont des captures du flux réel. Le build (`npm run build`) ne fait aucun appel réseau non plus.

## Tools

- `node:test` et `node:assert/strict` : runner et assertions, sans dépendance.
- `tsc --noEmit` : vérification des types.

## Conventions

- Tests dans `tests/`, fixtures dans `tests/fixtures/<source>/`.
- Un test par comportement observable.
- Les valeurs figées (identifiants, hashes) sont calculées indépendamment du code testé, jamais comparées à leur propre sortie.

## Run

- `npm test`
- `npm run typecheck`
- `npm run build` : la preuve que la page contient réellement `data/` (échoue sans `data/`).
