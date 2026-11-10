---
status: completed
---

# Instruction: Jeu CNIL élargi à 120 questions

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ mcp/eval/questions-cnil-etendu.csv
├── ✏️ tests/eval.test.ts
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/jeu-cnil-etendu.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `data/corpus/cnil/unites.jsonl` (3 245 documents) | le corpus est présent, rien n'est écrit | cli |
| Happy path   | `node --test tests/eval.test.ts` | le bloc `questions-cnil-etendu.csv` passe et nomme 120 questions, 60 `dev` / 60 `test` | cli |
| Edge case    | Ajouter une ligne qui cite son identifiant `CNILTEXT…`, reprend une question de `questions-cnil-v2.csv`, ou porte une référence absente du corpus | le test échoue en nommant la ligne fautive | cli |

## Tasks to do

### `1)` Écrire les 120 questions

> Un jeu mono-corpus, tenu à l'écart, qui couvre la doctrine et les sanctions.

1. En-tête `question,type,sources_attendues,piege,split,corpus`, une ligne par question, `corpus` = `cnil`.
2. Répartition : 60 `dev` et 60 `test` ; par split 27 conceptuelles doctrine (avis ou recommandation), 27 conceptuelles sanction et 6 pièges.
3. `sources_attendues` porte l'identifiant `CNILTEXT…` du document entier, sans `#`.
4. Aucune question ne cite l'identifiant de son document, son numéro `SAN-…`, ni un article numéroté ; aucun piège ne porte de source.

### `2)` Vérifier le jeu contre le corpus

> Aucune référence inventée, aucun document compté deux fois.

1. Contrôler dans `unites.jsonl` que chaque document attendu existe ; compter les `nature` des documents distincts et vérifier au moins 27 avis ou recommandations et 27 sanctions.
2. Refuser deux questions visant le même document, dans un split comme entre splits.
3. Refuser une question dont le texte reprend celui d'un autre jeu (`questions-cnil.csv`, `questions-cnil-v2.csv`, `questions-cnil-doctrine.csv`, `questions-v2.csv`, `questions-v3.csv`).

### `3)` Verrouiller le jeu par des tests

> Le jeu figé ne se dégrade plus en silence.

1. Ajouter un `describe("questions-cnil-etendu.csv")` dans `tests/eval.test.ts` : 120 questions, 60 `dev` / 60 `test`, en-tête à six colonnes, `corpus` sur chaque ligne.
2. Y vérifier les références présentes, les pièges sans source, les documents distincts et l'absence de reprise d'un autre jeu.
3. Laisser les blocs existants (`questions-cnil-v2.csv`, `questions-v3.csv`, marqueur, seuils) inchangés et verts.

### `4)` Figer et documenter

> Le jeu devient une référence citable, pas un brouillon.

1. Écrire `jeu-cnil-etendu.md` : composition par type, nature et split, nombre de documents distincts.
2. Y consigner l'empreinte `sha256` du CSV et la date de gel.
3. Y dire ce que le jeu ne mesure pas : le filtre `nature` et les seuils de confiance restent hors de son périmètre.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | le CSV porte 120 questions utiles, 60 `dev` et 60 `test`, et `corpus` vaut `cnil` sur chaque ligne |
| 2 | chaque `sources_attendues` existe dans `unites.jsonl`, les documents distincts comptent au moins 27 avis ou recommandations et 27 sanctions, et aucun document n'est visé deux fois |
| 3 | `node --test tests/eval.test.ts` passe, et une ligne fautive introduite fait échouer le test en la nommant |
| 4 | l'empreinte du CSV est consignée, avec les comptes par type, nature et split |
