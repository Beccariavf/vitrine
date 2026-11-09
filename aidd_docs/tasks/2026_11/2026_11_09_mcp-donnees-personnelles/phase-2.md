---
status: pending
---

# Instruction: Ajouter la loi Informatique et Libertés au corpus

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp
│   ├── corpus
│   │   └── lil
│   │       ├── descripteur.json
│   │       ├── parse.ts
│   │       └── sync.ts
│   └── tools.ts
├── veille
│   └── piste.ts
├── tests
│   ├── lil.test.ts
│   └── fixtures
│       └── lil
│           └── legi-part.json
├── data
│   └── corpus
│       └── lil
│           ├── manifest.json
│           └── unites.jsonl
├── package.json
├── .gitignore
└── README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Servir une capture `legiPart` réduite | Les sections et articles sont lisibles | cli |
| Happy path   | Synchroniser la LIL | `unites.jsonl` porte un article par entrée avec son numéro et son URL | cli |
| Edge case    | Une réponse sans `sections` ou avec un article sans `content` | La synchronisation échoue et n'écrit rien | cli |
| Teardown     | Rejouer la synchronisation sur la même date | Aucun fichier n'est réécrit | cli |

## Tasks to do

### `1)` Lire la version consolidée

> PISTE rend la LIL à une date, par `textId`.

1. Ajouter `consultLegiPart(fetchImpl, textId, date)` à `PisteSession` dans `veille/piste.ts`, sur `/consult/legiPart` avec `{ textId, date }`.
2. Journaliser l'appel comme `legifrance/legiPart` et respecter le budget existant.
3. Vérifier qu'un `{ textId }` sans date n'est jamais envoyé.

### `2)` Décrire la LIL

> Le descripteur fige l'identité du texte, sa date et sa licence.

1. Créer `mcp/corpus/lil/descripteur.json` avec `textId: "LEGITEXT000006068624"`, `corpus: "lil"`, `nom: "LIL"`, titre, date de consultation, licence ouverte 2.0 et URL Légifrance.
2. Déclarer `articles_attendus` et `sections_attendues` après la première capture, pour refuser une réponse amputée.
3. Ne retenir que les articles dont l'état est `VIGUEUR`, en comptant les autres dans le manifeste.

### `3)` Parser les sections et les articles

> Chaque article devient une unité adressable, sans reformulation.

1. Créer `mcp/corpus/lil/parse.ts` : parcourir `sections` récursivement, lire `num`, `id`, `content`, `pathTitle` et `etat`.
2. Convertir `content` en texte avec les helpers existants (`texteVisible`) et construire le chemin depuis `pathTitle`.
3. Produire `ref: "LEGIARTI…"`, `niveau: "article"`, `numero: num`, `url` Légifrance et `document: "LEGITEXT000006068624"`.

### `4)` Synchroniser et valider

> Le corpus n'est écrit qu'après validation complète.

1. Créer `mcp/corpus/lil/sync.ts` avec `npm run lil:sync`, `--dry-run` et `--date`.
2. Écrire le snapshot JSON sous `data/raw/lil/`, puis `data/corpus/lil/unites.jsonl` et `manifest.json` (textId, date, comptes, licence, bloc `couverture` : source, date, articles en vigueur, articles abrogés écartés).
3. Ajouter `data/raw/lil/` à `.gitignore` : le snapshot brut n'est pas commité.
4. Refuser une référence dupliquée, un texte vide ou un article attendu absent, sans toucher aux fichiers existants.

### `5)` Nommer la LIL dans les outils

> Une question qui dit « la LIL » ou « loi 78-17 » restreint la recherche.

1. Ajouter les alias LIL à `documentsNommes` dans `mcp/tools.ts` : « LIL », « loi informatique et libertés », « loi 78-17 », « loi n° 78-17 ».
2. Ajouter `LEGITEXT000006068624` à `NOMS_DOCUMENTS`, que `libelleDocument` consulte.
3. Ajouter le corpus aux exemples et refus qui énumèrent les collections.

### `6)` Tester et mesurer

> La LIL est couverte par des tests hors ligne et une éval dédiée.

1. Créer `tests/fixtures/lil/legi-part.json`, capture réduite réelle (deux sections, trois articles, un abrogé).
2. Créer `tests/lil.test.ts` : parcours récursif, article abrogé écarté, comptes attendus, date, URL, échec sans écriture.
3. Écrire `mcp/eval/questions-lil.csv` (10 questions `dev`, corpus `lil`) et mesurer avec `npm run mcp:eval`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Un POST `legiPart` porte `{ textId, date }` ; le journal nomme `legiPart` ; le budget reste appliqué. |
| 2 | Le descripteur porte le `textId`, la date et la licence ; une réponse amputée est refusée en nommant le compte attendu. |
| 3 | Chaque article en vigueur rend une unité avec `numero`, `ref` et URL Légifrance ; aucun texte n'est reformulé. |
| 4 | `npm run lil:sync` écrit le snapshot, le corpus et le manifeste ; `--dry-run` ne crée aucun fichier. |
| 5 | « la LIL » et « loi 78-17 » restreignent la recherche à `lil` ; deux documents nommés n'infèrent rien. |
| 6 | Les tests passent hors ligne ; l'éval LIL est rapportée avec ses rangs. |
