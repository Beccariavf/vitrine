---
status: completed
---

# Instruction: Exposer la mention dans les réponses et refuser un document absent

## Architecture projection

```txt
.
├── mcp/
│   ├── tools.ts                ✏️ citations marquées, refus partagé par les trois outils
│   └── server.ts               ✏️ descriptions des outils
└── tests/
    └── mcp.test.ts             ✏️ citations marquées, absences, identifiant inconnu
```

## Test Scope

| Scenario     | Action                                                              | Observable outcome                                                                 | Actor  |
| ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Setup        | `mkdtempSync` + corpus réduit et manifestes RGPD/LIL                | racine prête sans index ni réseau                                                  | system |
| Happy path   | `get_decision` sur une décision citant RGPD et ePrivacy             | citations avec `hors_corpus: false` puis `true`, identifiants et URL                | system |
| Happy path   | `search` sur un passage de la même décision                         | la citation hors corpus est recopiée sur le passage                                 | system |
| Edge case    | `get_article({ document: "32002L0058", numero: "5" })`             | `trouve: false`, message « absent de mon corpus (périmètre : …) », aucun `texte`    | system |
| Edge case    | `get_decision({ document: "32002L0058" })`                          | même refus, `decisions: []`                                                        | system |
| Edge case    | `search({ document: "32002L0058", … })`                             | `aucun_resultat_fiable`, `passages: []`, même refus, embedder jamais appelé        | system |
| Edge case    | `get_article({ document: "CNILTEXT000000000000" })`                 | réponse actuelle « introuvable », jamais « absent de mon corpus »                  | system |
| Teardown     | `rmSync(root, { recursive: true, force: true })`                    | répertoire temporaire supprimé                                                     | system |

## Tasks to do

### `1)` Marquer les citations rendues

> `search` et `get_decision` rendent des citations qui disent si leur document est au corpus.

1. Dans `avecCitations`, calculer `documentsPresents` une fois, puis marquer chaque citation.
2. Dans `getDecision`, marquer `citationsDesUnites(premiers)` avec le même `rootDir`.
3. Typer `Passage.citations` et `DecisionTrouvee.citations` en `CitationRendue[]`.

### `2)` Refuser un document connu absent

> Les trois outils disent la même phrase, et seulement pour un instrument connu.

1. `search` : quand `demande.document` est connu absent, rendre `aucun_resultat_fiable`, `passages: []`, le message d'absence, avant l'embedder et l'index.
2. `get_article` : quand l'article est introuvable et le document connu absent, remplacer « introuvable » par le message d'absence, sans ajouter de `texte`.
3. `get_decision` : même règle avant « Aucune décision pour … ».
4. Ne rien changer pour un identifiant inconnu ni pour un document présent dont l'article manque.

### `3)` Décrire le comportement aux clients

1. `CONSIGNE_CITATIONS` : citer `document` et `hors_corpus`, et le refus « absent de mon corpus ».
2. Relire les descriptions de `get_article`, `get_decision` et `search` ; n'ajuster que ce qui nomme les citations ou les absences.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1... | une citation RGPD rend `hors_corpus: false` ; une citation ePrivacy rend `hors_corpus: true`             |
| 1... | le marquage suit le document, sur chaque passage de `search` comme sur chaque décision de `get_decision` |
| 2... | les trois outils rendent la phrase d'absence, avec la liste des huit corpus, et aucun texte               |
| 2... | un identifiant inconnu et un article manquant d'un document présent gardent leur message actuel           |
| 3... | les descriptions assertées par `tests/server-stdio.test.ts` restent exactes                              |
