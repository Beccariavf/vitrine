# Codebase Map

La disposition macro : les zones de premier niveau et ce qu'elles portent. Une carte pour naviguer, pas l'arbre complet.

```mermaid
flowchart TD
    CLI["veille/ — pipeline des sources"] --> DATA["data/ — sortie versionnée"]
    TESTS["tests/ — suite hors ligne"] --> CLI
    TESTS --> MCP
    SRC["src/ — site Astro statique"] --> DATA
    MCP["mcp/ — corpus et serveur MCP"] --> DATA
    TOOLS["tools/ — paramètres locaux"] --> CLI
    CI[".github/ — CI"] -.-> CLI
    CI -.-> SRC
    HOOKS[".githooks/ — garde-fou secrets"] -.-> CLI
    DOCS["aidd_docs/ — spec, plan, mémoire"]
```

## Areas

- `veille/` : le pipeline. Dix adaptateurs : CNIL, CJUE, ANSSI, CEPD, ARCEP, Commission, Commission DMA, ARCOM, CETAT et Judilibre ; catalogue `themes.json` ; rattachement par instruments puis termes ; normalisation, résumés, références, écriture. La page CNIL est lue pour sa section « Textes de référence » (`parseCnilPageReferences`), les instruments sont canonicalisés par `extractCnilReferences` et les pages retenues sont snapshotées en HTML. La page ARCOM filtre le DSA et fournit le résumé ; la page Commission `/fr/` fournit le titre, le résumé et le lien français. Seule zone qui parle aux sources.
- `src/` : le site Astro, rendu statique. `layouts/Base.astro` porte la coquille, `pages/` les deux routes, `styles/global.css` les jetons Tailwind, `lib/entries.ts` lit `data/entries/` au build, valide `themes` et filtre les matières actives, `lib/references.ts` résout l'URL officielle d'un instrument (Légifrance ou CELEX) sans réseau et abrège son libellé d'affichage (`RGPD`, `LIL`, `CPCE`, `ePrivacy`, `C. conso`, `AI Act`, `DSA`, `DMA`, `DORA`, `NIS2`, `CRA`, `Data Act`), le libellé complet restant dans `title`, `lib/sources.ts` porte les libellés des dix adaptateurs. Les pages ne parlent à aucune API. Jetable : les données lui survivent.
- `mcp/` : les corpus RGPD et AI Act et le serveur MCP, séparés du pipeline et du site. `corpus/` lit les descripteurs `mcp/corpus/*.json`, récupère le XHTML CELLAR, le parse avec `parseCellar` (RGPD 272 unités, AI Act 293) et écrit `data/corpus/<corpus>/` ; `--document` n'en construit qu'un. `index/` construit et interroge `data/corpus/index/index.db` (SQLite + `sqlite-vec` + FTS5) : `build.ts` porte l'empreinte, le calcul du delta (`calculerDelta`) et son application transactionnelle aux trois tables (`unites`, `vec_unites`, `fts_unites`), `search.ts` la bande article (`rangerPassages`) et `rechercheHybride` (jusqu'à 50 candidats par voie, RRF `1/(60+rang)`, non retenue par défaut ; sous filtre document, la voie dense peut en rendre moins) ; `embed/` isole Ollama derrière l'interface `Embedder` ; `tools.ts` porte `get_article` et `search`, `confidence.ts` les trois niveaux et la marge, `server.ts` le transport stdio ; `eval/` porte les jeux v1/v2/v3 (80 questions v3), la sortie `--json`, les seuils figés `--seuils`, le marqueur v3 par modèle, la comparaison appariée `compare.ts` et le filtrage par document. Seuls `writeRaw` de `veille/write.ts` et le type `FetchLike` de `veille/fetch.ts` sont réutilisés.
- `tests/` : la suite `node:test` et les fixtures des dix adaptateurs et des deux corpus CELLAR, hors ligne.
- `data/` : la sortie du pipeline et les corpus, versionnés par git. Snapshots bruts adressés par leur contenu, entrées JSON par `id`, journal d'appels PISTE, `corpus/rgpd/` et `corpus/aiact/` (manifestes et unités) ; `corpus/index/` est dérivé et ignoré.
- `tools/` : l'outil local de paramètres (`parametres.html`), non déployé ; il écrit `veille/themes.json`.
- `.github/` : la CI — contrôle des secrets PISTE, typecheck, tests et build ; aucun déploiement.
- `.githooks/` : le hook `pre-commit` qui refuse `.env` et les valeurs PISTE non vides.
- `aidd_docs/` : le contrat (`spec.md`), les plans et la mémoire projet.

## Entry points

- `veille/main.ts` : une passe complète sur les dix adaptateurs, lancée par `npm run veille`.
- `veille/themes.json` : le catalogue des cinq matières et de leur état, écrit par l’outil local.
- `veille/backfill.ts` : recalcule `themes` sur les entrées existantes, lancé par `npm run backfill`.
- `src/pages/index.astro` et `src/pages/veille/index.astro` : les deux pages, générées par `npm run build`.
- `mcp/corpus/build.ts` : `npm run corpus:build` (tous les descripteurs) et `--document <corpus>` (un seul), la capture CELLAR vers `data/corpus/<corpus>/`.
- `mcp/index/build.ts` : `npm run corpus:index`, l'index `sqlite-vec` + FTS5 incrémental depuis Ollama.
- `mcp/server.ts` : `npm run mcp`, le serveur MCP stdio (`get_article`, `search`).
- `mcp/eval/run.ts` : `npm run mcp:eval -- --questions <csv> [--split dev|test|all] [--mesurer-test] [--recherche dense|hybride] [--json] [--seuils bas,haut,marge] [--root <racine>] [--modele <nom>] [--dim <n>]`, les métriques datées, hors CI.
- `mcp/eval/compare.ts` : `node mcp/eval/compare.ts <base.json> <candidat.json>`, l'alignement par question, le McNemar exact et le verdict figé.
- `tools/parametres.html` : l'outil local de sélection des matières.
- `npm test` : la suite de tests ; `npm run typecheck` vérifie les types.
