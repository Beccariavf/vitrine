---
status: pending
---

# Instruction: Documentation, mémoire et validation

## Architecture projection

```txt
.
├── ✏️ README.md
├── ✏️ aidd_docs/memory/architecture.md
├── ✏️ aidd_docs/memory/codebase-map.md
├── ✏️ aidd_docs/memory/deployment.md
├── ✏️ aidd_docs/memory/testing.md
├── ✏️ aidd_docs/memory/data.md
└── ✏️ aidd_docs/tasks/2026_11/2026_11_11_corpus-sync/review.md (après revue)
```

## Test Scope

| Scénario | Action | Résultat observable | Acteur |
| -------- | ------ | ------------------- | ------ |
| Happy path | `npm run corpus:sync -- --dry-run` sur le dépôt réel | la sortie nomme la fraîcheur, les documents manquants et les sources ; aucun fichier `sync.json` n'apparaît | cli |
| Happy path | `npm test`, `npm run typecheck`, `npm run build` | verts | cli |

## Tasks to do

1. README : ajouter les trois commandes (`corpus:sync`, `--dry-run`, `--planifier`) et une section courte qui dit la correspondance, la fenêtre, le rapport, l'outil MCP et l'agent de trois jours.
2. `architecture.md` : une puce sur `corpus:sync` (correspondance, sources déclenchées, état `data/corpus/sync.json`, réindexation, `etat_corpus`, launchd) et la limite des corpus statiques.
3. `codebase-map.md` : nommer `veille.ts`, `sync.ts`, `sync-rapport.ts`, `sync-planificateur.ts`, l'entrée `npm run corpus:sync` et le fichier de rapport.
4. `deployment.md` : remplacer « aucun workflow planifié » par l'agent launchd de trois jours, ses logs, son installation et le fait que GitHub Actions reste écarté.
5. `data.md` : décrire `data/corpus/sync.json` et la sémantique de `a_jour_au`.
6. `testing.md` : ajouter la ligne des tests de correspondance, d'orchestrateur, de panne, d'index et de planificateur.
7. Lancer la validation complète et consigner les résultats dans `review.md` via le vérificateur indépendant.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1–6 | la documentation nomme la commande, le rapport, l'outil et l'ordonnanceur, sans dupliquer les chiffres du corpus |
| 7 | `npm test` 0 échec, `npm run typecheck` propre, `npm run build` code 0, et `git status` propre après commit |
