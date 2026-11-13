---
status: pending
---

# Instruction: Porter l'identifiant du document et sa présence dans les citations

## Architecture projection

```txt
.
├── mcp/corpus/
│   └── citations.ts            ✏️ identifiant par instrument, `document`, `CitationRendue`, présence et message d'absence
└── tests/
    └── citations.test.ts       ✏️ identifiants, présence par manifeste, absence inconnue
```

## Test Scope

| Scenario     | Action                                                        | Observable outcome                                                            | Actor  |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Setup        | `mkdtempSync`, puis `data/corpus/rgpd/manifest.json` et `data/corpus/lil/manifest.json` | `documentsPresents` voit `32016R0679` et `LEGITEXT000006068624`               | system |
| Happy path   | `extraireCitations("l'article 6 du RGPD et l'article 5 de l'ePrivacy")` | deux citations portent `document` (`32016R0679`, `32002L0058`) et leur URL    | system |
| Happy path   | `avecPresence` sur ces citations                              | RGPD `hors_corpus: false`, ePrivacy `hors_corpus: true`                        | system |
| Edge case    | Texte sans citation, identifiant inconnu, absence de manifeste | `[]`, `null`, tout marqué hors corpus sans exception                          | system |
| Edge case    | `data/corpus/eprivacy/manifest.json` ajouté, puis `avecPresence` | ePrivacy passe à `hors_corpus: false` sans changement de code                  | system |
| Teardown     | `rmSync(root, { recursive: true, force: true })`              | répertoire temporaire supprimé                                                | system |

## Tasks to do

### `1)` Nommer le document de chaque instrument

> Chaque citation sait quel texte officiel elle vise.

1. Ajouter `identifiant` à chaque entrée de `INSTRUMENTS` : `32016R0679`, `31995L0046`, `32002L0058`, `32016L0680`, `32018R1725`, `LEGITEXT000006068624`, `LEGITEXT000006070987`, `LEGITEXT000006070719`.
2. Ajouter `document: string` à `Citation` et le renseigner dans `composer`.
3. Exporter `instrumentParIdentifiant` (ou équivalent) pour comparer un identifiant reçu, casse et espaces neutralisés.

### `2)` Lire la présence et marquer les citations

> La présence vient des manifestes, jamais d'une constante.

1. `documentsPresents(rootDir): ReadonlySet<string>` : lire `data/corpus/*/manifest.json`, retenir `document` et `text_id` non vides, normaliser en majuscules.
2. `CitationRendue = Citation & { hors_corpus: boolean }` et `avecPresence(rootDir, citations): CitationRendue[]`.
3. `absenceDuDocument(rootDir, document): string | null` : message `« <libellé> (<identifiant>) est absent de mon corpus (périmètre : RGPD, AI Act, LIL, CNIL, Conseil d'État, CEPD, Cour de cassation, CJUE). »` quand l'identifiant est connu et absent ; `null` sinon.
4. Laisser `extraireCitations`, `citationsDesUnites` et `citationsDuCorpus` rendre des `Citation` non marquées : aucune valeur par défaut.

### `3)` Prouver le marquage

1. Couvrir les huit identifiants et la forme affichable de chaque citation.
2. Couvrir présent, absent, identifiant inconnu, manifeste absent, manifeste ajouté après coup.
3. Vérifier qu'une citation hors corpus ne porte ni `texte` ni `resume`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------- |
| 1... | chaque citation rendue porte l'identifiant de son instrument et son URL officielle                      |
| 2... | RGPD et LIL sont présents sur le corpus réel ; ePrivacy, 95/46, 2016/680, 2018/1725, CPCE et code pénal absents |
| 2... | ajouter le manifeste d'un instrument dans un `rootDir` temporaire suffit à faire disparaître `hors_corpus` |
| 2... | un identifiant inconnu rend `absenceDuDocument` nul, jamais une absence affirmée                         |
| 3... | `npm run typecheck` et `npm test` passent                                                               |
