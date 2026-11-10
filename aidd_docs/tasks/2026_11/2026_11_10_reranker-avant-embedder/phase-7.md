---
status: completed
---

# Instruction: Harrier dans une racine séparée

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ mcp/embed/openai.ts
├── ✏️ mcp/index/build.ts
├── ✏️ mcp/eval/run.ts
├── ✏️ tests/index.test.ts
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev.json
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/harrier.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Racine d'expérience hors du dépôt, `data/corpus/` copié, aucun index | corpus prêt, index du produit intact | cli |
| Happy path   | `npm run corpus:index -- --root <racine> --fournisseur openai --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024` | index séparé de 1 024 dimensions, journal qui nomme le modèle | cli |
| Edge case    | Le service sert silencieusement `unsloth/bge-small-en-v1.5` en 384 dimensions | la réponse est refusée en nommant le modèle et la dimension reçus | api |

## Tasks to do

### `1)` Écrire la porte de la phase

> Harrier ne se teste que si le reranking n'a rien établi.

1. Lire `eval-rerank.md` : si un reranker obtient `adopter`, arrêter cette phase et le dire dans `harrier.md`.
2. Sinon, y écrire la raison d'ouvrir l'expérience : le rappel plafonne, pas le classement.
3. Ne rien changer au produit tant que cette phase n'a pas de verdict.

### `2)` Ajouter l'adaptateur d'embeddings OpenAI

> Harrier est servi par Unsloth Studio sur `/v1/embeddings`, pas par Ollama.

1. Créer `mcp/embed/openai.ts` : `POST {url}/v1/embeddings` avec `{model, input}`, lecture `data[].embedding`, et une table d'instructions de requête fournie par l'appelant.
2. Vérifier le champ `model` de la réponse et la dimension de chaque vecteur ; une réponse servie par un autre modèle lève en nommant les deux.
3. Normaliser les vecteurs comme l'adaptateur Ollama et exposer la même interface `Embedder`.

### `3)` Choisir le fournisseur dans la construction et la mesure

> La racine, le modèle et la dimension restent des paramètres.

1. Ajouter `--fournisseur ollama|openai` et `--embed-url <url>` à `mcp/index/build.ts` (défaut `ollama`, comportement inchangé).
2. Faire de même dans `mcp/eval/run.ts`, en conservant `--modele` et `--dim`.
3. Tester l'adaptateur avec un `fetch` factice dans `tests/index.test.ts` : modèle, dimension, normalisation, refus du repli silencieux.

### `4)` Construire l'index Harrier hors du produit

> Même dimension n'est pas même espace.

1. Créer une racine d'expérience hors du dépôt, y copier `data/corpus/{rgpd,aiact,cnil,lil,ce,cepd}/`.
2. Relever l'empreinte `sha256` de `data/corpus/index/index.db` à cet instant, après le dernier `corpus:index` connu : c'est la référence de cette phase.
3. Construire l'index avec `--root <racine> --fournisseur openai --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024`.
4. Après construction, vérifier que l'empreinte relevée à l'étape 2 n'a pas bougé : `meta.construit_le` du produit ne sert pas de preuve, il change à chaque passage.

### `5)` Choisir l'instruction de requête de Harrier

> L'instruction mesurée pour qwen3 ne se transporte pas.

1. Appliquer l'instruction CNIL retenue en phase 6, puis la mesurer sur dev avec l'index Harrier contre une variante de même forme rédigée pour Harrier : choisir par `--instruction <nom>` (introduit en phase 6) et transmettre le choix à `createOpenAIEmbedder`. L'instruction par défaut nomme le RGPD, elle ne convient pas comme concurrente.
2. Retenir celle qui gagne au top 5, et ne la retenir que si le gain dépasse une question.
3. Consigner le choix et l'écart dans `harrier.md`.

### `6)` Mesurer sur l'index Harrier

> Un index de même dimension ne se distingue pas tout seul.

1. Mesurer le dev CNIL en dense avec Harrier, `--json`, sans `--seuils`, avec `--root <racine> --fournisseur openai --embed-url <url> --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024`, et rediriger vers `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev.json` : l'index produit et Harrier font tous deux 1 024 dimensions, donc `searchIndex` ne détecterait pas un mauvais index et mesurerait l'espace qwen3. La vue brute de `compare.ts` a été introduite en phase 4.
2. Vérifier que `harrier-dev.json` porte `index.chemin` sous la racine d'expérience : le champ `modele` ne prouve rien, il vient de `--modele`.
3. Vérifier qu'aucun marqueur de test n'a été créé : cette phase ne consomme que `dev`.

### `7)` Mesurer et conclure

> Le bruit du jeu comme juge, et une décision explicite.

1. Lancer `node mcp/eval/compare.ts --vue brute aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev.json` : la base est la référence, Harrier le candidat, et `b`, `c` se lisent du point de vue de la base.
2. Vérifier que `harrier-dev.json` porte `index.chemin` sous la racine d'expérience : le champ `modele` ne prouve rien, il vient de `--modele`, et un index produit de même dimension passerait inaperçu.
3. Écrire `harrier.md` : recall@5, MRR, top 1, verdict, latence d'indexation, et la décision de garder `qwen3-embedding:0.6b` ou de proposer Harrier.
4. Si Harrier gagne, la bascule de l'index produit n'est pas faite ici : elle exige de reconstruire l'index et de mesurer le test, et se décide dans un lot suivant.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `harrier.md` dit soit l'arrêt motivé par un verdict `adopter`, soit la raison d'ouvrir l'expérience |
| 2 | un `fetch` factice prouve que la réponse d'un autre modèle ou d'une autre dimension est refusée en les nommant |
| 3 | `--fournisseur` absent garde le comportement Ollama, et `npm test` passe sans réseau |
| 4 | l'index Harrier vit hors du dépôt et l'empreinte de l'index produit est inchangée |
| 5 | l'instruction retenue est consignée avec son écart au top 5 |
| 6 | `harrier-dev.json` porte 60 questions, `index.chemin` sous la racine d'expérience, et aucun marqueur de test n'est créé |
| 7 | `harrier-dev.json` porte 60 questions et `harrier.md` donne son verdict, avec l'adoption renvoyée à un lot suivant |
