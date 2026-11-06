---
status: completed
---

# Instruction: Index vectoriel

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✅ embed/
│   │   ├── ✅ embedder.ts
│   │   └── ✅ smoke.ts
│   └── ✅ index/
│       ├── ✅ build.ts
│       └── ✅ search.ts
├── ✅ data/
│   └── ✅ corpus/
│       └── ✅ index/
│           └── ✅ index.db
├── ✅ tests/
│   └── ✅ index.test.ts
├── ✏ package.json
└── ✏ .gitignore
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Écrire six unités et un embedder factice déterministe (8 dimensions) dans une racine temporaire | Les unités et l'embedder sont prêts | cli |
| Happy path   | Construire l'index puis chercher la requête d'une unité | La première ligne est la référence attendue, `k` est respecté | cli |
| Happy path   | Lancer `npm run corpus:index -- --root <tmp>` | `data/corpus/index/index.db` contient 272 lignes et `meta` porte le modèle et la dimension | cli |
| Edge case    | Chercher sans index | L'erreur nomme `npm run corpus:index` et sort en code 1 | cli |
| Edge case    | Changer la dimension du modèle | La reconstruction échoue avec un message explicite au lieu de réutiliser l'ancien index | cli |
| Edge case    | Ajouter un second descripteur dans la racine temporaire | Il s'indexe et se filtre par `document` sans changer le code | cli |
| Edge case    | Insérer une unité avec un `rowid` explicite | L'insert réussit avec un entier, sans l'erreur « Only integers are allows » | cli |
| Teardown     | Supprimer la racine temporaire | Aucun fichier résiduel | cli |

## Tasks to do

### `1)` Isoler l'embedder derrière Ollama

> Une interface, un adaptateur HTTP, un seul contrat.

1. Écrire `Embedder` dans `mcp/embed/embedder.ts` : `dim`, `embedPassages(textes)`, `embedQuery(texte)`.
2. Implémenter `createOllamaEmbedder({ host = "http://127.0.0.1:11434", model = "qwen3-embedding:0.6b" })` : `POST /api/embed` avec `{ model, input }`, réponse `{ embeddings }`.
3. Normaliser chaque vecteur dans le code (norme 2 = 1) : Ollama la garantit aujourd'hui, le code ne s'y fie pas.
4. Lever avec un message actionnable si `host` ne répond pas ou si le modèle n'est pas tiré, en nommant `ollama pull qwen3-embedding:0.6b`.
5. Déclarer `dim = 1024` pour `qwen3-embedding:0.6b` ; la requête ne porte aucune instruction au départ, l'ajout éventuel se mesure en phase 4.

### `2)` Construire l'index

> Un fichier SQLite reconstructible, jamais committé.

1. Écrire `buildIndex(rootDir, embedder)` dans `mcp/index/build.ts` ; lire tous les `data/corpus/*/unites.jsonl`.
2. Créer `meta`, `unites` (`rowid` entier, `ref` unique, `document`, `niveau`, `numero`, `chemin`, `texte`, `date_acte`, `date_debut`, `date_fin`, `statut`, `url`) et la table virtuelle `vec_unites(embedding float[<dim>] distance_metric=cosine)`.
3. Contextualiser chaque passage : `chemin` puis `texte`, sans réécrire le texte.
4. Insérer le `rowid` en `BigInt` pour rester entier dans `node:sqlite`.
5. Écrire dans `data/corpus/index/index.db.tmp`, puis renommer ; refuser de réutiliser un index dont la dimension ou le modèle diffère.

### `3)` Rechercher dans l'index

> Une fonction pure, testable, sans MCP.

1. Écrire `openIndex(chemin)` et `searchIndex(index, vecteur, { k, document })` dans `mcp/index/search.ts`.
2. Joindre `vec_unites` et `unites` sur `rowid`, trier par distance croissante, rendre `ref`, `document`, `texte`, `chemin`, `url`, `date_acte`, `date_debut`, `date_fin`, `statut`, `distance`.
3. Filtrer sur `document` quand il est fourni ; lever avec un message actionnable quand le fichier manque.

### `4)` Câbler les commandes, l'ignore et le contrôle réel

> Le modèle vit dans Ollama ; le fichier produit reste hors git.

1. Ajouter `"corpus:index": "node mcp/index/build.ts"` et `"mcp:smoke": "node mcp/embed/smoke.ts"` dans `package.json`.
2. Épingler `sqlite-vec@0.1.9` ; ne pas ajouter `@huggingface/transformers` ni `onnxruntime-node`.
3. Ajouter `data/corpus/index/` dans `.gitignore`.
4. Écrire `mcp/embed/smoke.ts` : appelle le vrai Ollama, vérifie la dimension 1 024 et la norme 1, et échoue en nommant `ollama pull qwen3-embedding:0.6b`. Il n'est pas lancé en CI.

### `5)` Verrouiller par les tests

> Un embedder factice, aucune dépendance au modèle.

1. Écrire `tests/index.test.ts` avec un embedder déterministe de 8 dimensions.
2. Vérifier la construction, le nombre de lignes, le contenu de `meta`, l'ordre cosinus et `k`.
3. Vérifier l'erreur d'index absent, l'erreur de dimension, l'insert d'un `rowid` explicite et le second descripteur.
4. Vérifier que le test du vrai modèle est sauté proprement sauf quand `MCP_TEST_OLLAMA=1`.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | L'adaptateur appelle `/api/embed`, normalise les vecteurs, et nomme `ollama pull qwen3-embedding:0.6b` quand le modèle manque. |
| 2 | L'index contient 272 lignes, `meta` porte le modèle et la dimension, et le fichier final n'existe qu'après renommage ; un second descripteur s'indexe et se filtre par `document` sans modification du code. |
| 3 | La recherche rend les `k` meilleurs passages triés par distance cosinus croissante, avec `ref`, `document`, les dates et l'URL. |
| 4 | `npm run corpus:index` construit le fichier ; `data/corpus/index/` n'apparaît pas dans `git status` ; `npm run mcp:smoke` vérifie 1 024 dimensions et la norme 1. |
| 5 | Les tests passent hors ligne avec l'embedder factice ; le test réel est sauté sauf si `MCP_TEST_OLLAMA=1`. |
