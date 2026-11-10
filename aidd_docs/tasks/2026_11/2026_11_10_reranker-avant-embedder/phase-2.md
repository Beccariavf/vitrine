---
status: pending
---

# Instruction: Base mesurée et 3/10 reproduit

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `npm run corpus:index` | le journal ne réembarque aucune unité et l'index annonce ses unités | cli |
| Happy path   | `node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json` | 60 entrées datées, modèle, corpus et seuils compris | cli |
| Edge case    | `node mcp/eval/run.ts --questions questions-cnil-doctrine.csv --split dev --json` | 3/10 au top 5, et le croisement « confiant × correct » se lit dans les entrées JSON | cli |

## Tasks to do

### `1)` Prouver que l'index est celui du corpus

> Aucune mesure ne vaut sur un index périmé.

1. Lancer `npm run corpus:index` depuis la racine.
2. Vérifier le journal : mode delta, zéro unité embarquée, nombre d'unités cohérent avec les manifestes.
3. Noter que `data/corpus/index/index.db` est ignoré par git : seule son empreinte `sha256` le décrit.

### `2)` Reproduire le 3/10 de la doctrine

> Le point de départ du ticket doit se retrouver avant d'ajouter quoi que ce soit.

1. Lancer `node mcp/eval/run.ts --questions questions-cnil-doctrine.csv --split dev --json`.
2. Comparer au constat du ticket et de la mémoire : recall@5 3/10, MRR 0,225, top 1 20,0 %, 8 confiantes dont 3 correctes et 5 fausses, 2 incertaines fausses.
3. Le croisement « confiant × correct » se déduit des entrées JSON (niveau, attendues, refs) ; le rapport texte seul ne le porte pas.
4. Si un chiffre diffère, arrêter : l'écart est un fait à expliquer avant toute expérience de reranking.

### `3)` Mesurer la base sur le jeu élargi

> Le témoin apparié de toutes les comparaisons suivantes.

1. Lancer `node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json`, rediriger vers `aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json`.
2. Lancer la même mesure sans `--json` pour le rapport lisible.
3. Vérifier que le JSON porte `date`, `modele`, `dimensions`, `split` = `dev`, `corpus` = `cnil`, `recherche` = `dense`, `seuils`, et 60 questions dans l'ordre du CSV.

### `4)` Consigner la base

> Les chiffres qui décideront du sort du reranker.

1. Écrire `mesures/base-dev.md` : recall@5, MRR, top 1 brut et rendu, niveaux de confiance, pièges cités.
2. Y recopier les chiffres depuis le JSON, jamais depuis un autre rapport.
3. Y noter la version d'Ollama et l'empreinte de `data/corpus/index/index.db`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | le journal de `corpus:index` annonce zéro unité embarquée et le nombre d'unités du corpus |
| 2 | le rapport doctrine rend 3/10 au top 5, MRR 0,225, top 1 20,0 % et 8 réponses confiantes dont 5 fausses |
| 3 | `mesures/base-dev.json` porte 60 questions dans l'ordre du CSV, avec le corpus, le modèle et les seuils |
| 4 | `mesures/base-dev.md` donne recall@5, MRR, top 1 et les niveaux, chaque chiffre retrouvable dans le JSON |
