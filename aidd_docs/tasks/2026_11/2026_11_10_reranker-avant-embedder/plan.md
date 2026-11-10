---
objective: "Un reranker est mesuré en apparié sur un jeu CNIL élargi, et le produit ne change d'étage ou de modèle qu'après un verdict établi sur le split dev."
status: pending
---

# Plan: Évaluer un reranker avant tout changement d'embedder

Source: GitHub #17 (Beccariavf/vitrine)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | jeu-cnil-etendu | [`phase-1.md`](./phase-1.md) | none |
| 2   | base-mesuree | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | runtime-reranker | [`phase-3.md`](./phase-3.md) | none |
| 4   | etage-rerank | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | comparaison-appariee | [`phase-5.md`](./phase-5.md) | 2, 4 |
| 6   | decision-produit | [`phase-6.md`](./phase-6.md) | 5 |
| 7   | harrier-separe | [`phase-7.md`](./phase-7.md) | 6 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md | `POST /reranking` (aliases `/rerank`, `/v1/rerank`, `/v1/reranking`) serves a reranker when `--reranking` is passed, and returns a Jina-shaped `{results: [{index, relevance_score}]}`; it is explicitly not OAI-compatible. |
| https://huggingface.co/Qwen/Qwen3-Reranker-0.6B | the first candidate reranker exists as a 0,6B text-ranking model on Hugging Face. |
| https://huggingface.co/BAAI/bge-reranker-v2-m3 | the second candidate reranker exists on Hugging Face, and llama.cpp names it as the reranker it supports. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | unverified: no reranker runtime on this machine. Ollama 0.40.14 answers 404 to `POST /api/rerank` and `POST /v1/rerank`; Unsloth Studio on `127.0.0.1:8888` answers 404 to `/v1/rerank` and `/rerank`, and its `openapi.json` exposes `/v1/embeddings` and `/v1/chat/completions` only; `llama-server` is not installed and no reranker GGUF sits in `~/.cache/huggingface`. | 3 |
| regression | medium: `search()` is shared by the MCP server, the eval harness, the demo and every test of `tests/mcp.test.ts`; the reranker must be opt-in so the dense path stays identical. Covered areas: `tests/mcp.test.ts`, `tests/index.test.ts`, `tests/eval.test.ts`, `tests/compare.test.ts`. Safety-net phase: 2 locks the baseline before any code change. | 2, 4 |
| architecture | the pipeline gains one optional stage after the dense KNN: `searchIndex` yields 50 candidates, the reranker reorders them, `search` keeps the first k. Embeddings and index are untouched; `mcp/rerank/` sits behind an interface like `mcp/embed/`. | 4 |
| documentation | `aidd_docs/memory/data.md` (models and evaluations), `aidd_docs/memory/testing.md` (new commands and flags), `aidd_docs/memory/architecture.md` (second-stage gotcha). | 6, 7 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Aucun modèle plus lourd sans gain mesuré | the ticket's own constraint: the reranker and any second embedder are adopted only on a paired verdict, never on a hunch. |
| Le split `test` ne se mesure qu'une fois, après la fin des corrections | the new 60-question held-out split is a single shot, reserved for the configuration the dev split retains. |
| Le jeu de tests par défaut ne touche pas le réseau | the reranker adapter and any second embedder are exercised behind a fake `fetch`. |
| L'index du produit reste intact pendant l'expérience | both rerankers and Harrier are measured without rebuilding `data/corpus/index/index.db`. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le jeu élargi est CNIL seul, 120 questions | `corpusDuJeu` refuses a game mixing two corpora; the measured failure is CNIL doctrine (3/10); 60 dev questions keep McNemar's six-discordant-pair floor reachable. |
| Le rerank ne change que l'ordre, jamais l'échelle de confiance | `niveauConfiance` reads `1 - distance`; keeping the dense cosine makes the existing calibration procedure valid and leaves one score scale in the product. |
| La comparaison des rerankers se fait à seuils figés, celle des embedders non | même embedder, donc même échelle de similarité : seul l'ordre change, et les seuils du témoin restent valides. Harrier change l'échelle : chaque modèle calibre les siens et les vues brutes décident. |
| Harrier est mesuré, pas basculé | the ticket asks to test a same-size embedder, not to install it; switching the product embedder rebuilds the whole index and needs its own test-split measurement, which is a separate delivery. |
| Le reranker est servi par `llama-server --reranking` | Ollama and Unsloth Studio have no rerank endpoint (404 observed on both, 2026-11-10); llama.cpp is the only local runtime that exposes one. |
| Le reranker reste optionnel dans le produit | a missing reranker service must not break search: the dense path stays the fallback, and the server only uses it when the environment names it. |
