---
status: completed
---

# Instruction: Runtime du reranker prouvé

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/runtime-reranker.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Démarrer `llama-server --reranking --model <gguf>` | le serveur écoute et annonce le modèle | system |
| Happy path   | `POST /reranking` avec une question et trois passages | un score par passage, nombre égal au nombre de passages | api |
| Edge case    | Appeler le serveur sans `--reranking`, ou avec un modèle non reranker | l'appel échoue explicitement, il ne rend pas de score | api |

## Tasks to do

### `1)` Installer un runtime de reranking

> Un seul runtime local expose un endpoint de rerank : llama.cpp.

1. Vérifier d'abord les refus : `POST http://127.0.0.1:11434/api/rerank`, `POST http://127.0.0.1:11434/v1/rerank`, `POST http://127.0.0.1:8888/v1/rerank`.
2. Installer `llama.cpp` (`brew install llama.cpp`) pour disposer de `llama-server`.
3. Télécharger un GGUF de `Qwen/Qwen3-Reranker-0.6B` hors du dépôt et noter son empreinte `sha256`.

### `2)` Prouver l'endpoint

> `/reranking` rend des scores exploitables, et rien d'autre n'est supposé.

1. Lancer `llama-server --reranking --model <gguf> --port 8080`.
2. `POST http://127.0.0.1:8080/reranking` avec `{query, documents}` ; vérifier la forme `{results: [{index, relevance_score}]}`.
3. Vérifier que `top_n` absent rend tous les documents et que chaque score est un nombre fini.

### `3)` Contrôler le classement sur le cas français du ticket

> Un reranker qui ne sépare pas trois passages connus ne mérite pas une mesure.

1. Question « droit à l'effacement », passages : article 17 du RGPD, un passage cookies, un passage Linky.
2. Vérifier que le passage d'effacement sort premier.
3. Noter que les scores de rerank ne sont pas des cosinus : ils ne se comparent ni aux seuils ni entre modèles.

### `4)` Mesurer le coût d'un lot de 50 candidats

> La latence entre dans le verdict, pas dans une note de bas de page.

1. Relever dans `data/corpus/cnil/unites.jsonl` la médiane et le p90 de la taille des fragments, sans supposer une valeur.
2. Envoyer 50 passages à ces deux tailles, la charge réelle d'une recherche CNIL.
3. Mesurer trois passes et retenir la médiane, en millisecondes.
3. Consigner aussi le temps de démarrage du serveur et la mémoire résidente.

### `5)` Consigner le runtime

> La phase suivante code contre des faits, pas contre une espérance.

1. Écrire `runtime-reranker.md` : version de `llama-server`, empreinte du GGUF, commande de démarrage, forme de la réponse.
2. Y recopier les deux 404 d'Ollama et d'Unsloth Studio, avec la date de l'observation.
3. Y dire la latence mesurée et la limite : un seul serveur, un seul modèle à la fois.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `llama-server --reranking` démarre, et les refus d'Ollama et d'Unsloth sont consignés |
| 2 | `POST /reranking` rend un score par document, en nombre égal |
| 3 | le contrôle français classe le passage d'effacement devant cookies et Linky |
| 4 | la latence médiane de 50 passages est consignée en millisecondes |
| 5 | `runtime-reranker.md` nomme la version, l'empreinte du GGUF et les deux 404 datés |
