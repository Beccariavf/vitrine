---
status: pending
---

# Instruction: Index d'expérience et reproduction du `dev`

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/
└── mesures/
    └── dev-harrier-ollama.json                     ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `mkdir -p` du dossier `mesures/` puis copie de `data/corpus/cnil/` sous `~/.cache/vitrine-harrier-ollama/root/data/corpus/cnil/` | Le corpus d'expérience porte 29 299 unités, `data/corpus/index/index.db` n'est pas touché | cli |
| Happy path   | `node mcp/index/build.ts --root ~/.cache/vitrine-harrier-ollama/root --modele leoipulsar/harrier-0.6b --dim 1024` | Journal : 29 299 unités, `leoipulsar/harrier-0.6b`, 1 024 dimensions, mode complet | cli |
| Happy path   | `npm run mcp:eval -- --questions questions-cnil-etendu.csv --split dev --root ~/.cache/vitrine-harrier-ollama/root --modele leoipulsar/harrier-0.6b --dim 1024 --json` | 44/54 au top 5 sémantique, 38/54 au rang 1, MRR 0,7404, proche de `harrier-dev-actuelle.json` | cli |
| Edge case    | Écart franc entre les deux mesures, ou modèle ou dimension refusés | Le lot s'arrête et l'écart est nommé ; aucun fichier produit n'est écrit | cli |
| Teardown     | Aucun fichier du produit modifié | `git status --short` ne montre que le dossier de tâche | cli |

## Tasks to do

### `1)` Construire l'index d'expérience

> 29 299 unités CNIL et Harrier Ollama dans une racine séparée.

1. Créer `aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/`.
2. Copier `data/corpus/cnil/` sous `~/.cache/vitrine-harrier-ollama/root/data/corpus/cnil/`.
3. Lancer `node mcp/index/build.ts --root ~/.cache/vitrine-harrier-ollama/root --modele leoipulsar/harrier-0.6b --dim 1024`.
4. Consigner le journal (mode complet, 29 299 unités).

### `2)` Mesurer le `dev` CNIL

> Les 60 questions du split `dev`, en vue brute.

1. Lancer `npm run mcp:eval -- --questions questions-cnil-etendu.csv --split dev --root ~/.cache/vitrine-harrier-ollama/root --modele leoipulsar/harrier-0.6b --dim 1024 --json > aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/dev-harrier-ollama.json`.
2. Comparer `agregats` à `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev-actuelle.json` : top 5, rang 1, MRR, pièges cités.
3. Écrire l'écart dans le fichier de mesure ou arrêter le lot s'il est franc.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | L'index d'expérience porte 29 299 unités `leoipulsar/harrier-0.6b` en 1 024 dimensions ; l'index produit n'est pas modifié. |
| 2 | Le `dev` rend la référence au top 5 pour 44 questions sémantiques sur 54, au rang 1 pour 38, MRR 0,7404 (à un ou deux points près) ; tout écart est expliqué. |
