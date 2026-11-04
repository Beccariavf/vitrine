---
objective: "Un MCP local expose le RGPD par article exact et par recherche sémantique, avec provenance, et se mesure sur un jeu de 22 questions."
status: implemented
---

# Plan: MCP juridique RGPD

Source: aidd_docs/tasks/2026_11/2026_11_03_mcp-juridique/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Corpus RGPD | [`phase-1.md`](./phase-1.md) | none |
| 2   | Index vectoriel | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Serveur MCP | [`phase-3.md`](./phase-3.md) | 1, 2 |
| 4   | Jeu d'évaluation | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | Mémoire et documentation | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://publications.europa.eu/resource/celex/32016R0679 | Redirige 303 vers `cellar/…/DOC_1`, puis 200 en `application/xhtml+xml` avec `Accept-Language: fra` (400 sans cet en-tête) : 876 858 octets, 99 ancres `art_N`, 173 ancres `rct_N`, titres `cpt_<romain>.tit_1`. |
| https://github.com/asg017/sqlite-vec | `sqlite-vec` 0.1.9 s'expose par `getLoadablePath()` et `load(db)` ; `vec0(… distance_metric=cosine)` est accepté ; l'insert d'un `rowid` explicite exige un entier (BigInt) dans `node:sqlite`. |
| https://nodejs.org/api/sqlite.html | `DatabaseSync` accepte `allowExtension: true` et expose `loadExtension(path)`. Vérifié : `vec_version()` rend `v0.1.9`. |
| https://www.npmjs.com/package/@modelcontextprotocol/sdk | Version 1.32.2, sans entrée racine : importer `@modelcontextprotocol/sdk/server/mcp.js`, `@modelcontextprotocol/sdk/server/stdio.js` et `@modelcontextprotocol/sdk/inMemory.js`. |
| https://docs.ollama.com/api/embed | `POST /api/embed` avec `{ model, input }` rend `{ embeddings }` ; vérifié sur 0.34.1 local, route présente. |
| https://ollama.com/library/qwen3-embedding | `qwen3-embedding:0.6b` : 595,78 M paramètres, contexte 32 768, **1 024 dimensions**, quantisation **Q8_0**, 639 Mo. Vérifié localement : `/api/embed` rend 1 024 valeurs, norme 1,0. |
| https://unsloth.ai/docs/integrations/connect-curl-and-http-to-unsloth | Unsloth Studio expose des points de terminaison de **chat** (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`) ; aucun `/v1/embeddings` documenté. |
| https://huggingface.co/datasets/AgentPublic/cnil | Deuxième corpus : 64 466 chunks de délibérations CNIL depuis 1979, déjà découpés et vectorisés en **bge-m3**, Parquet 350 Mo, licence Etalab 2.0. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Observé : Ollama 0.40.14 écoute sur `127.0.0.1:11434`, `qwen3-embedding:0.6b` est tiré (Q8_0, 1 024 dimensions, norme 1,0) et `/api/embed` répond ; CELLAR répond 303 puis 200 en `application/xhtml+xml` ; `sqlite-vec` 0.1.9 se charge dans `node:sqlite` et accepte `distance_metric=cosine`. Mesuré : 26 unités/s en embedding. Estimation pour la CNIL (64 466 chunks) : ~41 min d'embedding, ~264 Mo de vecteurs, ~25 ms par requête ; force brute plafonne vers 250k chunks. | 1, 2 |
| regression | Aucun comportement existant changé : `veille/` et `src/` ne sont pas modifiés, seuls `package.json`, `tsconfig.json` et `.gitignore` le sont. Aucune dépendance native lourde : `npm ci` ne gagne que `sqlite-vec`, le SDK MCP et `zod`. La suite actuelle (238 tests) est rejouée en phase 1. Risque : faible. | 1 |
| architecture | Nouvelle zone `mcp/` et `data/corpus/`. Le descripteur, la colonne `document` et l'interface `Embedder` rendent l'ajout d'un corpus et le changement de fournisseur mécaniques. | 2, 3 |
| documentation | `architecture.md`, `data.md`, `codebase-map.md`, `testing.md`, `coding-assertions.md`, `INSTALL.md` et `README.md` ne connaissent ni `mcp/` ni `data/corpus/` ; `INSTALL.md` affirme même « Pas de SQLite », désormais faux. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le jeu de tests par défaut ne touche pas le réseau. | Le corpus et l'embedder sont injectés ; les fixtures sont des captures réelles. Le contrôle `MCP_TEST_OLLAMA=1` interroge Ollama local, à la demande. |
| `data/` n'est jamais édité à la main. | `corpus:build` et `corpus:index` produisent `data/corpus/`. |
| Versions épinglées. | Les dépendances ajoutées sont en version exacte, comme le reste du projet. |
| Typecheck strict sur tout le code. | `mcp/**/*.ts` entre dans `tsconfig.json` et passe `npm run typecheck`. |
| Un commit = une préoccupation. | Chaque phase livre un incrément committable. |
| Le site ne lit aucune API au runtime. | L'ingestion est une commande manuelle ; le MCP lit des fichiers locaux. |
| Aucune écriture sur `stdout` dans le serveur MCP. | `stdout` porte le protocole JSON-RPC ; les journaux vont sur `stderr`. |
| L'embedding reste local. | Ollama sur `127.0.0.1`, jamais un service cloud : reproductible et sans secret. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Ollama en HTTP, pas d'ONNX embarqué. | Ollama 0.40.14 tourne et expose `/api/embed` ; `npm ci` reste léger, sans `onnxruntime-node` ni `@huggingface/transformers`. |
| `qwen3-embedding:0.6b` en Q8_0, 1 024 dimensions. | Meilleur score multilingue récent sous 1 Go, contexte 32K, disponible dans la bibliothèque Ollama ; vérifié : 1 024 dimensions, norme 1,0. |
| Normaliser les vecteurs dans le code. | La normalisation n'est pas garantie par l'API ; le cosinus et les seuils en dépendent. |
| `sqlite-vec`, pas Postgres. | Un seul fichier, aucun service ; Postgres reste la cible de la version hébergée. |
| Un index unique avec une colonne `document`. | Ajouter un corpus ne change pas le code ; le filtre `document` isole les résultats. |
| CELLAR en XHTML direct, pas la CLI `eurlex`. | Vérifié sans clé ni outil supplémentaire, et le parseur reste en TypeScript. |
| Index vectoriel non commité. | Dépôt petit ; `npm run corpus:index` le reconstruit. |
| Corpus, index et outils passent par `mcp/`, pas `veille/`. | Le MCP est un produit distinct ; `veille/` reste le pipeline des actualités. Seuls `writeRaw` et le type `FetchLike` sont réutilisés, sans modifier `veille/`. |
| Métrique cosinus nommée, seuils exprimés en similarité. | `vec0(… distance_metric=cosine)` ; `similarité = 1 - distance`. |
| Tout est public au premier slice, jeu d'évaluation compris. | Portfolio ouvert ; la séparation public/propriétaire ne concerne que la phase hébergée. |
| Le premier slice reste le RGPD ; la CNIL arrive après. | 64 466 chunks tiennent dans sqlite-vec, mais imposent un index incrémental et un découpage avec document parent avant d'être ingérés. |
| Bascule Postgres quand > 250k chunks, > 100 ms, ou plusieurs utilisateurs. | Mesuré : force brute ~25 ms à 64k ; le repère public place le plafond vers 250k. |
| Les embeddings bge-m3 publiés par la CNIL restent une option, pas un choix. | Ils économiseraient ~41 min, mais imposeraient bge-m3 partout ; le jeu d'évaluation tranchera. |
