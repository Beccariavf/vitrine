---
status: completed
---

# Instruction: Rendre le classement dans etat_corpus et prouver le relevé

## Architecture projection

```txt
.
├── mcp/
│   ├── tools.ts                ✏️ `hors_corpus` dans `EtatCorpus`
│   ├── server.ts               ✏️ description de `etat_corpus`
│   ├── corpus/sync-rapport.ts  ✏️ `formaterRapport` imprime le classement
│   └── eval/citations.ts       ✏️ `--classement` imprime le relevé réel, sans écrire
├── tests/
│   ├── mcp.test.ts             ✏️ `etat_corpus` sans rapport : `hors_corpus: null`
│   └── corpus-sync.test.ts     ✏️ classement rendu par l'outil et par le texte
└── aidd_docs/
    ├── tasks/2026_11/2026_11_13_classement-documents-absents/mesure.md   ➕ relevé réel
    └── memory/                 ✏️ architecture, codebase-map, testing
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | client MCP sur une racine sans `sync.json` | `etat_corpus` répond | system |
| Happy path | `etat_corpus` sur une racine avec un rapport portant `hors_corpus` | `payload.hors_corpus.calcule_le` et `documents[0].autorites` présents | system |
| Edge case | rapport sans bloc | `payload.hors_corpus === null`, aucun classement inventé | system |
| Edge case | `formaterRapport` sur un rapport avec un document `exclu` | ligne marquée `exclu`, jamais `manquant` | system |
| Edge case | `node mcp/eval/citations.ts --classement` | classement réel trié, `data/` inchangé (`git status --short data/` vide) | manual |
| Teardown | nettoyage des racines temporaires | aucun fichier résiduel | system |

## Tasks to do

### `1)` Exposer le classement

1. `mcp/tools.ts` : ajouter `hors_corpus: ClassementHorsCorpus | null` à `EtatCorpus`, renseigné par `rapport?.hors_corpus ?? null` ; documenter que le classement vient du rapport, jamais d'un calcul à la lecture.
2. `mcp/server.ts` : la description de `etat_corpus` nomme le classement des documents hors corpus, son nombre de décisions citantes et les autorités citantes, et rappelle qu'un document déclaré exclu est marqué comme tel.
3. `mcp/corpus/sync-rapport.ts` : `formaterRapport` ajoute une section `Hors corpus :` — une ligne par document, `libellé (identifiant) : N décision(s) citante(s) — CNIL 82, CE 25` puis ` [exclu]` pour un document exclu ; rien quand le classement est vide ou absent.

### `2)` Prouver sur le corpus réel

1. Ajouter `--classement` à `mcp/eval/citations.ts` : sans corpus positionnel, imprimer le classement rendu par `classementHorsCorpus(rootDir, dateDuJour())` — en-tête daté, une ligne par document avec statut, citations et autorités ; aucune écriture, aucun index, aucun réseau. Sans `--classement`, la sortie actuelle ne change pas.
2. Lancer la commande sur le corpus réel et écrire `mesure.md` (date, commande, tableau document × autorités, total, ce que le relevé prouve et ne prouve pas : il ne mesure pas la précision de l'extracteur de #28).
3. Vérifier que `git status --short data/` reste vide après le relevé.

### `3)` Documenter

1. `README.md` : la section qui décrit `etat_corpus` nomme le classement et son bloc dans `sync.json`.
2. `aidd_docs/memory/architecture.md` : une décision de plus — le classement, sa déclaration d'exclusion au catalogue, son écriture par la synchronisation.
3. `aidd_docs/memory/codebase-map.md` : `hors-corpus.ts` dans `mcp/`, `--classement` dans `mcp/eval/citations.ts`.
4. `aidd_docs/memory/testing.md` : les nouveaux tests et le relevé.
5. La case de #32 sera cochée à la fermeture, par la PR (règle 8 de #65) ; ne rien éditer sur GitHub ici.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1... | `etat_corpus` rend `hors_corpus: null` sans rapport, et le bloc écrit sinon |
| 1... | la description de l'outil nomme classement, citations et autorités ; `tests/mcp.test.ts` l'asserte |
| 1... | `formaterRapport` imprime le classement et marque `exclu` |
| 2... | `--classement` imprime le relevé réel et n'écrit rien ; `git status --short data/` vide |
| 2... | `mesure.md` porte les comptes réels et ses limites |
| 3... | `npm run typecheck`, `npm test` et `npm run build` passent |
