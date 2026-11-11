---
status: completed
---

# Instruction: Correspondance veille → corpus

## Architecture projection

```txt
.
├── ✅ mcp/corpus/veille.ts
└── ✅ tests/corpus-sync.test.ts
```

## Test Scope

| Scénario | Action | Résultat observable | Acteur |
| -------- | ------ | ------------------- | ------ |
| Setup | Une racine avec `data/entries/` et `data/raw/<2 hex>/<hash>.html` | les entrées et snapshots sont lus hors ligne | test |
| Happy path | Une entrée CNIL, un snapshot canonique et deux liens `CNILTEXT…` | rend les deux identifiants, sans doublon | test |
| Happy path | Une entrée CETAT, une entrée Judilibre, une entrée CJUE | rendent `CETATEXT…`, l'identifiant Judilibre et le CELEX | test |
| Edge case | Une entrée CNIL sans snapshot, une source hors corpus, une date antérieure à `depuis`, un identifiant Judilibre ou un CELEX invalide | `non_mappee`, aucun corpus, entrée écartée de la fenêtre, identifiant refusé | test |

## Tasks to do

### `1)` Lire les entrées récentes

1. Créer `mcp/corpus/veille.ts`.
2. `lireEntrees(rootDir, depuis: string): Entry[]` parcourt récursivement `data/entries/`, lit chaque JSON, ignore un fichier illisible, garde une entrée dont `publishedAt` est une date ISO `>= depuis`, trie par date croissante puis par `id`.
3. Une entrée sans `publishedAt` exploitable n'entre pas dans la fenêtre.

### `2)` Indexer les snapshots CNIL

1. `indexerSnapshots(rootDir): Map<string, string[]>` parcourt `data/raw/<2 hex>/*.html`.
2. Pour chaque page, lire l'URL canonique (`<link rel="canonical" href="…">`, quel que soit l'ordre des attributs ; à défaut `<meta property="og:url" content="…">`).
3. Extraire les identifiants `https://www.legifrance.gouv.fr/cnil/id/(CNILTEXT\d+)`, dédoublonnés et triés.
4. La clé est l'URL canonique sans barre finale ; une page sans URL canonique ou sans identifiant n'entre pas dans la carte.

### `3)` Mapper une entrée

1. `corpusDeLEntree(entry): "cnil" | "ce" | "cc" | "cjue" | null` : `cnil` → `cnil`, `cetat` → `ce`, `judilibre` → `cc`, `cjeu` → `cjue`, toute autre source → `null`.
2. `documentsDeLEntree(entry, snapshots): string[]` : CNIL par la carte des snapshots ; `cetat` par `entry.id` si `CETATEXT…` ; `judilibre` par `entry.id` si 24 hexadécimaux minuscules ; `cjeu` par le CELEX de `entry.url` (`CELEX:…`, forme `6…`).
3. `indexerDocumentsCorpus(rootDir): Map<string, Set<string>>` lit chaque `data/corpus/<corpus>/unites.jsonl` et rend les `document` distincts par corpus.
4. `documentsEcartes(rootDir, corpus): Map<string, string>` lit `manifest.json` : pour `cjue`, `couverture.documents_ecartes` (`celex` → `motif`), en ne retenant que les motifs durables (`avis_avocat_general`, `autre_type`, `version_francaise_absente`) ; un échec de téléchargement reste manquant.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `tests/corpus-sync.test.ts` prouve le filtre `depuis`, le tri, la date nulle exclue et un JSON illisible ignoré |
| 2 | le test prouve l'URL canonique, l'ordre d'attributs inversé, `og:url`, le dédoublonnage et l'absence de lien |
| 3 | le test prouve les quatre correspondances, la source hors corpus, un identifiant invalide et la lecture des exclusions CJUE |
