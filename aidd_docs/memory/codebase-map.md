# Codebase Map

La disposition macro : les zones de premier niveau et ce qu'elles portent. Une carte pour naviguer, pas l'arbre complet.

```mermaid
flowchart TD
    CLI["veille/ — pipeline CNIL"] --> DATA["data/ — sortie versionnée"]
    TESTS["tests/ — suite hors ligne"] --> CLI
    SRC["src/ — site Astro statique"] --> DATA
    DOCS["aidd_docs/ — spec, plan, mémoire"]
```

## Areas

- `veille/` : le pipeline. Adaptateurs de sources, normalisation des URL, écriture des entrées. Seule zone qui parle aux sources.
- `src/` : le site Astro, rendu statique. `lib/entries.ts` lit `data/entries/` au build ; les pages ne parlent à aucune API. Jetable : les données lui survivent.
- `tests/` : la suite `node:test` et les fixtures de sources, hors ligne.
- `data/` : la sortie du pipeline, versionnée par git. Snapshots bruts adressés par leur contenu, entrées JSON par `id`.
- `aidd_docs/` : le contrat (`spec.md`), les plans et la mémoire projet.

## Entry points

- `veille/main.ts` : une passe complète, lancée par `npm run veille`.
- `src/pages/veille/index.astro` : la liste des entrées, générée par `npm run build`.
- `npm test` : la suite de tests ; `npm run typecheck` vérifie les types.
