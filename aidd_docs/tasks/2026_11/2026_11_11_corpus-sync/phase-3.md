---
status: pending
---

# Instruction: Outil MCP `etat_corpus`

## Architecture projection

```txt
.
├── ✏️ mcp/tools.ts
├── ✏️ mcp/server.ts
├── ✏️ tests/corpus-sync.test.ts
└── ✏️ tests/server-stdio.test.ts
```

## Test Scope

| Scénario | Action | Résultat observable | Acteur |
| -------- | ------ | ------------------- | ------ |
| Happy path | Un rapport et huit manifestes dans une racine temporaire | `etatCorpus` rend `a_jour_au`, huit corpus et les manquants | test |
| Edge case | Aucun `sync.json` | `a_jour_au` vaut `null`, l'inventaire reste rendu et un message nomme `corpus:sync` | test |
| Happy path | `tools/list` sur le vrai serveur | quatre outils, dont `etat_corpus`, sont exposés sans Ollama | test |

## Tasks to do

### `1)` Lire l'état

1. Ajouter `etatCorpus(rootDir)` à `mcp/tools.ts`, à partir de `lireRapport` et `inventaireCorpus`.
2. Rendre `{ a_jour_au, derniere_tentative, depuis, corpus, manquants, sources, index, message? }`.
3. `manquants` reprend les lignes `statut: "manquant"` du rapport ; `message` n'apparaît que si aucun rapport n'existe.

### `2)` Exposer l'outil

1. Enregistrer `etat_corpus` dans `mcp/server.ts` : titre, description qui dit « corpus à jour au », aucun paramètre, réponse JSON.
2. Ajouter la phrase à `CONSIGNE_SERVEUR` : `etat_corpus` dit la date de fraîcheur et les documents manquants.
3. Mettre à jour le message de démarrage (`quatre outils`).
4. Mettre à jour `tests/server-stdio.test.ts` : quatre noms d'outils, l'outil `etat_corpus` présent, les huit corpus toujours nommés.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | le test prouve le rapport complet, le repli sans rapport, l'inventaire et le message |
| 2 | `tests/server-stdio.test.ts` prouve les quatre outils et les huit corpus ; `npm run typecheck` passe |
