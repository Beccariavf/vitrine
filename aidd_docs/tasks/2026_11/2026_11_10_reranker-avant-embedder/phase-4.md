---
status: completed
---

# Instruction: Étage de rerank mesurable

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ mcp/rerank/reranker.ts
├── ✏️ mcp/tools.ts
├── ✏️ mcp/eval/run.ts
├── ✏️ mcp/eval/compare.ts
├── ✅ tests/rerank.test.ts
├── ✏️ tests/mcp.test.ts
├── ✏️ tests/compare.test.ts
└── ✏️ tests/eval.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Index construit dans une racine temporaire avec un embedder factice | index prêt, aucun réseau | cli |
| Happy path   | `search()` avec un reranker factice qui inverse l'ordre | les passages sortent dans l'ordre du reranker, distance dense conservée | cli |
| Edge case    | Le serveur de rerank rend un HTTP 500, un score manquant ou non numérique | l'erreur nomme l'URL et le nombre de scores attendu, et `search` échoue au lieu de servir le dense | cli |

## Tasks to do

### `1)` Poser l'interface et l'adaptateur

> Un second étage derrière une interface, comme l'embedder.

1. Créer `mcp/rerank/reranker.ts` : type `Reranker` avec `model` et `score(question, passages): Promise<number[]>`, et `CANDIDATS_RERANK = 50`.
2. Écrire `createLlamaReranker({ url, model, fetchImpl })` qui `POST {url}/reranking` avec `{ model, query, documents }` et lit `results[].relevance_score`, replacé dans l'ordre d'entrée par `results[].index`.
3. Valider que chaque `index` est présent une fois et dans les bornes ; un index manquant, dupliqué ou hors bornes lève, et une erreur nomme l'URL, le statut et le compte attendu. Ne jamais supposer que la réponse suit l'ordre d'envoi : llama.cpp la trie et la tronque par `top_n`.

### `2)` Brancher l'étage dans `search`

> Le rerank reordonne la fenêtre dense, il ne remplace pas l'index.

1. Ajouter `rerank?: Reranker` à `SearchDeps`.
2. Quand il est présent, demander `Math.max(k, CANDIDATS_RERANK)` passages à `searchIndex`, les reranker, garder les `k` premiers.
3. Conserver la `distance` dense de chaque passage : `niveauConfiance` continue de lire `1 - distance` sur le premier passage rendu.
4. Ajouter à `ResultatRechercheOutil` un champ optionnel `rerank: { modele, duree_ms }`, rempli quand l'étage a tourné : c'est la seule latence que le harnais peut imputer au rerank.
5. Laisser la voie sans reranker strictement identique, et propager une erreur de rerank : aucun repli dense ici, la mesure doit échouer franchement.

### `3)` Exposer la mesure dans le harnais

> Sans drapeau, rien ne change ; avec, la latence est mesurée.

1. Ajouter `--rerank <modele>` et `--rerank-url <url>` à `mcp/eval/run.ts`.
2. Agréger le `duree_ms` rendu par chaque `search` en une moyenne sur le split.
3. Ajouter à `ObjetMesureJson` les champs `index: { chemin, unites }`, lus dans l'index ouvert : le JSON doit dire quel index a été mesuré, pas seulement quel modèle.
4. Ajouter au JSON un bloc `rerank` : modèle, URL, latence moyenne ; sans le drapeau, le bloc est absent.
5. Adapter les constructions de test de `tests/eval.test.ts` et `tests/compare.test.ts` à l'`index` désormais obligatoire, sans changer les assertions existantes sur les champs de question.

### `4)` Nommer la configuration comparée et choisir la vue

> Deux JSON portent le même embedder, et le rendu ne dit pas tout.

1. Lire le bloc `rerank` facultatif dans `mcp/eval/compare.ts` et composer le libellé du candidat : `embedder` seul, ou `embedder` + modèle de rerank.
2. Ajouter `--vue brute` : le McNemar porte alors sur `Top1Brut` et le garde-fou sur `Top5Brut`, au lieu des vues rendues. Sans le drapeau, le comportement actuel est inchangé.
3. Garder l'alignement des questions inchangé.
4. Tester dans `tests/compare.test.ts` le libellé du candidat, un JSON sans bloc `rerank`, et les deux vues, dont un cas où le rendu et le brut divergent.

### `5)` Tester hors réseau

> Le reranker est un service : le test n'en dépend pas.

1. `tests/rerank.test.ts` : `fetch` factice dont la réponse est triée et tronquée, corps envoyé, scores replacés par `index`, top 5 rendu, index manquant ou dupliqué qui lève.
2. `tests/mcp.test.ts` : `search` avec reranker factice rend l'ordre reranké, la distance dense d'origine et `rerank.duree_ms` ; sans reranker, l'ordre dense est identique à avant et `rerank` est absent.
3. `npm test` et `npm run typecheck` passent sans réseau.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | un `fetch` factice montre le corps `{model, query, documents}` et des scores replacés par `index` alors que la réponse est triée et tronquée ; un index manquant lève en nommant l'URL |
| 2 | avec un reranker factice inversant l'ordre, `search` rend les passages inversés, garde la distance dense d'origine et remplit `rerank.duree_ms` |
| 3 | `--rerank` ajoute le bloc `rerank` au JSON et le retire quand le drapeau est absent ; le JSON porte `index.chemin` et `index.unites` |
| 4 | le rapport de `compare.ts` nomme le reranker du candidat, `--vue brute` décide sur les vues brutes, et sans le drapeau le comportement rendu est inchangé |
| 5 | `npm test` et `npm run typecheck` passent avec le réseau coupé, `tests/eval.test.ts` et `tests/compare.test.ts` compris |
