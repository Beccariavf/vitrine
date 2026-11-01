---
status: completed
---

# Instruction: Donnée et mémoire

## Architecture projection

```txt
.
├── ✏️ data/entries/2026/10/6ac6079ec27382d099f5a06e.json
├── ✏️ aidd_docs/memory/architecture.md
├── ✏️ aidd_docs/memory/codebase-map.md
├── ✏️ aidd_docs/memory/data.md
├── ✏️ aidd_docs/memory/design.md
└── ✏️ aidd_docs/memory/testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lancer une passe Judilibre ciblée avec les secrets locaux | L'entrée 25-10.664 est réécrite | cli |
| Happy path   | Lire l'entrée et construire le site | La carte porte le visa et la pastille cliquable | cli |
| Edge case    | Lancer sans secrets PISTE | La passe ignore Judilibre, l'entrée reste inchangée | cli |

## Tasks to do

### `1)` Mettre à jour l'entrée

> Le visa réel remplace l'extraction vide.

1. Lancer une passe ciblée sur Judilibre.
2. Vérifier que `references` vaut `["Règlement (UE) 2016/679 · art. 4, 5, 6"]`.
3. Reconstruire et vérifier la carte.

### `2)` Mettre à jour la mémoire

> Les documents décrivent la nouvelle source et le lien.

1. `architecture.md` : le visa Judilibre remplace le résumé.
2. `data.md` : source des références Judilibre.
3. `testing.md` : tests du visa et des URL.
4. `design.md` : pastilles cliquables, nouvel onglet.
5. `codebase-map.md` : `src/lib/references.ts`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | L'entrée 25-10.664 porte les articles 4, 5, 6 du RGPD et aucun article du code du travail. |
| 2 | Les cinq documents de mémoire décrivent le visa et les liens. |
