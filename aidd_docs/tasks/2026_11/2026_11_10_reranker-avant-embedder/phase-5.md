---
status: pending
---

# Instruction: Comparaison appariée des deux rerankers

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/candidat-qwen3.json
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/candidat-bge.json
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/eval-rerank.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `mesures/base-dev.json` produit en phase 2, serveur de rerank démarré | les trois configurations visent les mêmes 60 questions sous les mêmes seuils | cli |
| Happy path   | `node mcp/eval/compare.ts mesures/base-dev.json mesures/candidat-qwen3.json` | un verdict, `b`, `c`, `p`, et les deux top 5 | cli |
| Edge case    | Le JSON candidat porte une question de plus, de moins, ou dans un autre ordre | `aligner` lève en nommant la question décalée | cli |

## Tasks to do

### `1)` Fixer le protocole

> Sans seuils figés, deux configurations changent à la fois l'ordre et le rendu.

1. Extraire `seuils.bas`, `seuils.haut` et `seuils.marge` de `mesures/base-dev.json`.
2. Décider que les trois mesures `dev` tournent avec ces seuils, passés par `--seuils`, pour que la vue rendue soit comparable d'une configuration à l'autre.
3. Décider que le verdict se prend sur les vues brutes (`--vue brute`) : sous les seuils du témoin, un premier passage reranké dont la similarité dense tombe sous `bas` viderait `refs` et effacerait un gain réel. La recalibration du rendu appartient à la phase 6.

### `2)` Mesurer le premier reranker

> Mêmes questions, même corpus, même découpage, mêmes seuils.

1. Démarrer `llama-server --reranking` avec le GGUF de `Qwen/Qwen3-Reranker-0.6B` téléchargé en phase 3.
2. Lancer `node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json --seuils <bas,haut,marge> --rerank <modele> --rerank-url http://127.0.0.1:8080`, rediriger vers `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/candidat-qwen3.json`.
3. Vérifier le bloc `rerank`, les seuils identiques au témoin, et les 60 questions dans l'ordre du CSV.

### `3)` Mesurer le second reranker

> Deux candidats, un seul protocole.

1. Télécharger un GGUF de `BAAI/bge-reranker-v2-m3`, noter son empreinte `sha256`, puis redémarrer `llama-server --reranking` avec ce fichier.
2. Produire `mesures/candidat-bge.json` avec la même commande et les mêmes seuils.
3. Vérifier que le JSON nomme le modèle de rerank, les mêmes seuils et la même liste de questions.

### `4)` Comparer en apparié

> La règle figée tranche sur les vues brutes, pas la lecture des moyennes.

1. Lancer `node mcp/eval/compare.ts --vue brute aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/candidat-qwen3.json`.
2. Lancer la même commande avec `candidat-bge.json` en candidat.
3. Consigner pour chaque paire : `b`, `c`, `p`, verdict et raisons, top 1 brut et top 5 brut ; la vue rendue reste rapportée pour la lecture.

### `5)` Rapporter avant, après et le coût

> recall@5, MRR et top 1 sur le même jeu, plus la latence.

1. Extraire des trois JSON recall@5, MRR, top 1 brut et rendu, pièges cités et niveaux de confiance.
2. Reporter la latence moyenne du rerank et le surcoût par question.
3. Écrire `eval-rerank.md` : configurations, chiffres, verdicts, et ce que chaque verdict ne prouve pas (60 questions CNIL de dev).

### `6)` Prouver que rien du produit n'a bougé

> L'expérience ne touche ni le corpus ni l'index.

1. Relever l'empreinte `sha256` de `data/corpus/index/index.db` juste avant les deux mesures puis juste après.
2. Lancer `npm run corpus:index` : zéro unité embarquée (son `meta.construit_le` change à chaque passage, il ne prouve rien).
3. Vérifier que `git status` ne montre aucun fichier de `data/corpus/` : l'index est ignoré par git, seule son empreinte le décrit.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | les seuils du témoin sont consignés et les trois mesures les partagent |
| 2 | `candidat-qwen3.json` porte 60 questions dans l'ordre de `base-dev.json`, les mêmes seuils et un bloc `rerank` |
| 3 | `candidat-bge.json` porte le même jeu, les mêmes seuils, et nomme son modèle de rerank |
| 4 | chaque `compare.ts --vue brute` imprime un verdict sur les vues brutes avec `b`, `c` et `p`, sans erreur d'alignement ; un code de sortie 2 signale `non_etabli` et n'est pas un échec du protocole |
| 5 | `eval-rerank.md` donne recall@5, MRR, top 1 brut et rendu des trois configurations, plus la latence moyenne |
| 6 | `corpus:index` réembarque zéro unité et `git status` ne montre aucun fichier de corpus |
