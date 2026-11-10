---
status: completed
---

# Instruction: Décision produit et recalibrage des seuils

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✏️ mcp/server.ts
├── ✏️ mcp/confidence.ts
├── ✏️ mcp/embed/embedder.ts
├── ✏️ mcp/eval/run.ts
├── ✏️ tests/mcp.test.ts
├── ✏️ tests/eval.test.ts
├── ✅ mcp/eval/questions-cnil-etendu.test-consomme.json
├── ✏️ aidd_docs/memory/data.md
├── ✏️ aidd_docs/memory/testing.md
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/decision.md
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/final-dev.json
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/final-test.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `eval-rerank.md` de la phase 5 | le verdict de chaque candidat est établi | cli |
| Happy path   | Verdict `adopter` : `RERANK_URL` défini, `npm run mcp` | `search` reranke, puis rend `k` passages | cli |
| Edge case    | Verdict `adopter` : `RERANK_URL` pointe un service éteint | le serveur journalise sur `stderr` et sert les passages denses, sans échouer | cli |

## Tasks to do

### `1)` Écrire la décision

> Un verdict par reranker, avec ses chiffres, et rien de plus.

1. Reprendre les verdicts de `compare.ts` et les reporter dans `decision.md`.
2. Nommer le candidat retenu, ou dire qu'aucun ne l'est, et citer `b`, `c`, `p` et le top 5 rendu.
3. Écrire ce que la mesure ne prouve pas : elle porte sur 60 questions CNIL de dev.

### `2)` Brancher le reranker par défaut, si et seulement si `adopter`

> Le produit gagne l'étage sans perdre la recherche quand il manque.

1. Lire `RERANK_URL` et `RERANK_MODELE` au démarrage de `mcp/server.ts` ; sans elles, ne créer aucun reranker.
2. Envelopper le reranker d'un décorateur de repli : sur erreur, journaliser sur `stderr` et rendre des scores strictement décroissants (`1 - rang / nombre`), donc l'ordre dense préservé sans dépendre d'un tri stable. Le repli vit dans `mcp/server.ts`, jamais dans `search`.
3. Laisser `search` strict : le harnais d'évaluation doit échouer franchement, pas mesurer du dense étiqueté rerank.
4. Tester le décorateur dans `tests/mcp.test.ts` : un reranker qui lève laisse les passages dans l'ordre dense, et le `stderr` porte l'erreur.

### `3)` Recalibrer instructions et seuils

> `niveauConfiance` lit toujours la distance dense, mais le premier passage a changé.

1. Ajouter `--instruction <actuelle|neutre>` à `mcp/eval/run.ts` et l'option `instructions` à `createOllamaEmbedder`, quelle que soit la branche : c'est une capacité du harnais, pas un changement produit.
2. Mesurer sur dev, avec la configuration retenue (dense si refus, rerankée si adoption), l'instruction CNIL actuelle contre une variante de même forme qui ne parle que du corpus CNIL sans nommer la sanction : la première ne couvre que la moitié doctrinale du jeu, et l'instruction par défaut nomme le RGPD, donc elle ne convient pas comme concurrente. Consigner les deux mesures.
3. Si `adopter` et si l'instruction concurrente gagne au moins une question au top 5 : retenir cette instruction et l'écrire dans `INSTRUCTION_CNIL`, en même temps que les seuils. Dans la branche du refus, le produit garde son instruction : un changement d'instruction déplace la similarité, donc les seuils, et sans adoption il n'y a pas de mesure de `test` pour le justifier.
4. Si `adopter` : relancer la mesure dev avec le reranker mais sans `--seuils`, pour que `calibrer` rende les seuils de l'ordre reranké, consigner ce JSON dans `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/final-dev.json`, puis écrire ces valeurs dans `mcp/confidence.ts` avec la référence au rapport. Le JSON de phase 5 portait les seuils du témoin : il ne peut pas les fournir.
5. Si `adopter` : mesurer la vue rendue qui part en production, `compare.ts` sans `--vue brute`, entre `base-dev.json` et `final-dev.json` : le top 5 rendu et les pièges cités ne doivent pas reculer. Un premier passage reranké sous `bas` refuse la question, et la grille de `calibrer` ne descend qu'à 0,2 : sans cette vérification, l'effet ignoré par la vue brute atteindrait le produit sans mesure.
6. Si `adopter` : mettre à jour les littéraux de seuils de `tests/eval.test.ts` (aujourd'hui `0.69`, `0.74`, `0.01`) vers les valeurs calibrées, sinon `npm test` reste rouge.
7. Si `adopter` : mesurer le split `test` une seule fois, avec `--mesurer-test`, la configuration, les seuils et l'instruction retenus, et le consigner dans `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/final-test.json`.

### `4)` Consigner le refus, sinon

> Une expérience négative est un résultat, pas un échec.

1. Si `conserver` ou `non_etabli` : ne rien changer dans `mcp/server.ts`, `mcp/confidence.ts` ni `INSTRUCTION_CNIL`.
2. Ne pas mesurer le split `test` : aucun marqueur ne doit être créé pour `questions-cnil-etendu.csv`.
3. Consigner le refus et sa raison dans `decision.md`.

### `5)` Mettre à jour la mémoire

> Le prochain agent ne doit pas refaire l'expérience.

1. `aidd_docs/memory/data.md` : étage de rerank retenu ou refusé, chiffres, latence, seuils, instruction de requête.
2. `aidd_docs/memory/testing.md` : commande `--rerank`, `--rerank-url`, et l'emplacement des mesures.
3. `aidd_docs/memory/architecture.md` : l'étage optionnel et son repli dense, si adopté.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `decision.md` nomme le verdict de chaque candidat et cite les chiffres de `compare.ts` |
| 2 | si adopté, `RERANK_URL` défini active l'étage ; sans elle, ou service éteint, la recherche rend les passages denses et journalise l'absence |
| 3 | dans les deux branches, l'instruction concurrente est mesurée sur dev, sans changement produit hors adoption ; si adopté, `mcp/confidence.ts` porte les seuils de `mesures/final-dev.json`, la vue rendue ne recule pas devant `base-dev.json`, les littéraux de `tests/eval.test.ts` suivent, et le marqueur du test porte une seule mesure |
| 4 | si refusé, aucun marqueur n'est créé et `git status` ne montre que `decision.md`, la mémoire et la capacité `--instruction` du harnais |
| 5 | la mémoire dit le modèle retenu, l'étage de rerank, les chiffres, les seuils et les commandes |
