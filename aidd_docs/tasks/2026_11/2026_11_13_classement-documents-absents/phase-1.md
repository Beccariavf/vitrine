---
status: completed
---

# Instruction: Déclarer le périmètre au catalogue et calculer le classement

## Architecture projection

```txt
.
├── mcp/corpus/
│   ├── citations.ts            ✏️ `perimetre` par instrument, `documentDeclare`, `documentsExclus`
│   └── hors-corpus.ts          ➕ `classerCitations` (pur), `classementHorsCorpus` (lit `data/`)
└── tests/
    └── hors-corpus.test.ts     ➕ tri, comptes, autorités, présents, exclus
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `classerCitations` sur deux corpus simulés citant `32002L0058` (4 citations CNIL, 1 CE) et `LEGITEXT000006070987` (2 CC) | deux documents, `ePrivacy` 5 citations, `CPCE` 2 | system |
| Happy path | `classerCitations(…, presents vides, exclusions vides)` | tri `ePrivacy` puis `CPCE`, `statut: "absent"` pour les deux | system |
| Edge case | `32016R0679` cité et présent dans `presents` | absent du classement | system |
| Edge case | `exclusions = new Set(["32002L0058"])` | `ePrivacy` porte `statut: "exclu"`, toujours classé | system |
| Edge case | deux documents à égalité de citations | ordre croissant des identifiants, stable | system |
| Edge case | catalogue sans exclusion | `documentsExclus()` rend l'ensemble vide | system |
| Teardown | `mkdtempSync` pour `classementHorsCorpus` | répertoire supprimé | system |

## Tasks to do

### `1)` Déclarer le périmètre d'un instrument

> Le catalogue dit ce qui est couvert et ce qui est exclu ; il n'exclut rien aujourd'hui.

1. Ajouter `perimetre?: "exclu"` à `Instrument` dans `mcp/corpus/citations.ts` ; l'absence du champ vaut `"couvert"`.
2. Exporter `documentDeclare(identifiant): { libelle, url } | null` : lecture par `PAR_IDENTIFIANT`, `null` quand l'identifiant est inconnu.
3. Exporter `documentsExclus(): ReadonlySet<string>` : identifiants normalisés des instruments déclarés `exclu`.
4. Ne marquer aucun des huit instruments `exclu` : tous sont déclarés au périmètre, quelle que soit la couverture des tickets (#41 en ajoute trois, #44 deux partiellement, la directive 95/46 aucun).

### `2)` Calculer le classement

> Une seule extraction par corpus, puis un calcul pur.

1. Créer `mcp/corpus/hors-corpus.ts` :
   - `export type AutoriteCitations = { autorite: string; citations: number }` ;
   - `export type DocumentHorsCorpus = { document: string; instrument: string; url: string | null; statut: "absent" | "exclu"; citations: number; autorites: AutoriteCitations[] }` ;
   - `export type ClassementHorsCorpus = { calcule_le: string; documents: DocumentHorsCorpus[] }` ;
   - `export type CitationsParCorpus = readonly { corpus: string; citations: ReadonlyMap<string, readonly Citation[]> }[]`.
2. `classerCitations(citationsParCorpus, presents, exclusions): DocumentHorsCorpus[]` : compter chaque citation rendue (décision × instrument) par document normalisé, écarter les documents présents, marquer `exclu` les identifiants de `exclusions`, libellé et URL par `documentDeclare`, autorités par un libellé humain (`cnil` → `CNIL`, `ce` → `Conseil d'État`, `cc` → `Cour de cassation`, `cjue` → `CJUE`, `cepd` → `CEPD`), trier par `citations` décroissant puis `document` croissant, `autorites` par compte décroissant puis libellé.
3. `classementHorsCorpus(rootDir, date): ClassementHorsCorpus` : lire `citationsDuCorpus` sur `CORPUS_DECISIONS`, `documentsPresents(rootDir)` et `documentsExclus()`, puis `classerCitations` ; `calcule_le` = `date` reçue. Un corpus sans fichier lisible est ignoré, jamais une exception.
4. Aucune écriture, aucun index, aucun réseau.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1... | `documentDeclare("32002l0058")` rend `libelle: "ePrivacy"` et son URL ; un identifiant inconnu rend `null` |
| 1... | `documentsExclus()` rend un ensemble vide sur le catalogue actuel |
| 2... | `classerCitations` compte les citations rendues, écarte les présents, marque les exclus et trie comme le contrat l'exige |
| 2... | `classementHorsCorpus` sur un `rootDir` temporaire (deux corpus de décisions, un manifeste) rend le classement et sa date |
| 2... | `npm run typecheck` passe |
