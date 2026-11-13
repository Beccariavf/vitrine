---
status: planned
---

# Instruction: Écrire le classement dans le rapport de synchronisation

## Architecture projection

```txt
.
├── mcp/corpus/
│   ├── sync-rapport.ts         ✏️ `hors_corpus?` dans `RapportSync`, tolérance de `lireRapport`
│   └── sync.ts                 ✏️ calcule le classement à chaque passe et l'écrit
└── tests/
    └── corpus-sync.test.ts     ✏️ bloc écrit et daté, dry-run sans écriture, rapport sans bloc toléré
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `rootDir` temporaire avec `cnil` (deux décisions citant `32002L0058`) et manifeste RGPD | corpus lisible | system |
| Happy path | `syncCorpus({ rootDir, date: "2026-11-13", agents simulés })` | `rapport.hors_corpus.calcule_le === "2026-11-13"`, `ePrivacy` classé, fichier `data/corpus/sync.json` écrit | system |
| Happy path | deuxième passe au `2026-11-14` | `calcule_le` avance, le classement est recalculé | system |
| Edge case | `dryRun: true` | rapport rendu avec le bloc, fichier du disque inchangé | system |
| Edge case | `sync.json` sans `hors_corpus` (rapport #31) | `lireRapport` le lit, `hors_corpus` absent ; `hors_corpus` mal formé rend `null` | system |
| Edge case | corpus illisible présent dans `data/corpus/` | aucun classement, la passe ne lève pas | system |
| Teardown | `rmSync(root, { recursive: true, force: true })` | répertoire temporaire supprimé | system |

## Tasks to do

### `1)` Étendre le rapport

> `sync.json` reste la seule mémoire de la passe ; le nouveau bloc est additif.

1. Ajouter `hors_corpus?: ClassementHorsCorpus` à `RapportSync` dans `mcp/corpus/sync-rapport.ts`, avec l'import de type depuis `./hors-corpus.ts` ; garder `version: 1`.
2. `lireRapport` : accepter l'absence du champ ; quand il est présent, exiger `calcule_le` chaîne et `documents` tableau, sinon rendre `null` (forme inconnue).
3. Ne rien changer d'autre à la lecture ; `ecrireRapport` reste inchangé.

### `2)` Calculer à chaque passe

1. Dans `syncCorpus` (`mcp/corpus/sync.ts`), après la relecture du corpus et avant la construction de l'objet `rapport`, calculer `horsCorpus = classementHorsCorpus(rootDir, date)`.
2. Le poser dans `rapport.hors_corpus`, y compris en `dryRun` : la passe le rend, `ecrireRapport` n'est pas appelé en dry-run.
3. Ne pas avancer `a_jour_au` pour ce calcul : une extraction de citations en échec est ignorée par corpus, la passe ne doit pas échouer.
4. Rendre le classement visible en `--json` sans autre changement de la sortie texte (le texte est en phase 3).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1... | un rapport sans `hors_corpus` reste lu ; un bloc mal formé rend `null` |
| 2... | après une passe, `data/corpus/sync.json` porte `hors_corpus` daté du jour de la passe |
| 2... | `--dry-run` rend le bloc et laisse le fichier intact |
| 2... | une passe sur un corpus sans décision ne lève pas et rend un classement vide |
| 2... | `npm run typecheck` et `npm test` passent |
