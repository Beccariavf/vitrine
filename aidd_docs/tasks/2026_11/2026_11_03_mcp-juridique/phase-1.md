---
status: pending
---

# Instruction: Corpus RGPD

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ corpus/
│       ├── ✅ rgpd.json
│       ├── ✅ fetch.ts
│       ├── ✅ parse.ts
│       ├── ✅ write.ts
│       └── ✅ build.ts
├── ✅ data/
│   └── ✅ corpus/
│       └── ✅ rgpd/
│           ├── ✅ manifest.json
│           └── ✅ unites.jsonl
├── ✅ tests/
│   ├── ✅ corpus.test.ts
│   └── ✅ fixtures/
│       └── ✅ eurlex/
│           └── ✅ rgpd.xhtml
├── ✏ package.json
└── ✏ tsconfig.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Écrire la capture XHTML réelle du RGPD dans `tests/fixtures/eurlex/rgpd.xhtml` | Le fichier porte 99 ancres `art_N` et 173 ancres `rct_N` | cli |
| Happy path   | Lancer `parseRgpd` sur la capture | 99 articles et 173 considérants, article 17 non vide, chemin `RGPD > Chapitre III > …` | cli |
| Happy path   | Lancer `npm run corpus:build -- --fixture tests/fixtures/eurlex/rgpd.xhtml` | `data/corpus/rgpd/manifest.json` et `unites.jsonl` écrits, 272 lignes | cli |
| Edge case    | Rejouer la commande sur la même capture | Les octets sont identiques, aucun doublon | cli |
| Edge case    | Parser une capture sans l'ancre `art_17` | Le parseur lève une erreur nommant l'ancre manquante, aucun fichier écrit | cli |
| Teardown     | Supprimer la racine temporaire du test | Aucun fichier résiduel | cli |

## Tasks to do

### `1)` Décrire le corpus et récupérer le document

> Une seule source, une seule langue, un descripteur vérifié.

1. Créer `mcp/corpus/rgpd.json` : `document` `32016R0679`, titre officiel, `langue` `fra`, URL EUR-Lex, licence de réutilisation, `date_acte` `2016-04-27`, `date_publication` `2016-05-04`, `date_debut` `2018-05-25`.
2. Écrire `fetchCellar(document, langue)` dans `mcp/corpus/fetch.ts` : `Accept: application/xhtml+xml`, `Accept-Language: <langue>`, suit la redirection 303, rend le corps texte et lève sur un statut non 2xx.
3. Réutiliser `writeRaw(rootDir, contenu, "xhtml")` de `veille/write.ts` pour conserver la capture dans `data/raw/` ; cette lecture n'altère pas `veille/`.

### `2)` Parser le XHTML en unités

> Les ancres ELI sont stables : `art_N`, `rct_N`, `cpt_<romain>`.

1. Écrire `parseRgpd(xhtml, descripteur)` dans `mcp/corpus/parse.ts`.
2. Découper sur les ancres `id="art_(\d+)"` et `id="rct_(\d+)"` ; chaque unité va jusqu'à l'ancre suivante.
3. Suivre le dernier `id="cpt_([IVXLC]+)"` rencontré et lire son titre dans `id="cpt_\1.tit_1"` pour construire le chemin.
4. Retirer les balises, décoder les entités, normaliser les espaces ; le texte est copié, jamais reformulé.
5. Lever si le document ne rend pas 99 articles et 173 considérants, en nommant l'ancre manquante.

### `3)` Écrire le manifeste et les unités

> Deux fichiers : métadonnées du document, puis une ligne JSON par unité.

1. Écrire `writeCorpus(rootDir, descripteur, unites, snapshotPath)` dans `mcp/corpus/write.ts`.
2. `data/corpus/<document>/manifest.json` : `document`, `titre`, `langue`, `url`, `licence`, les trois dates, `snapshot` et `unites`.
3. `snapshot` porte le nom de fichier rendu par `writeRaw` (son `sha256`), pas un hash recalculé sur un autre contenu.
4. `data/corpus/<document>/unites.jsonl` : une ligne par unité avec `ref`, `document`, `niveau`, `numero`, `chemin`, `texte`, `date_acte`, `date_debut`, `date_fin`, `statut`, `url`.
5. Écrire seulement si le contenu change, pour que deux passes produisent les mêmes octets.

### `4)` Câbler la commande

> Une entrée CLI, un script, un include de typage.

1. Écrire `mcp/corpus/build.ts` : lit le descripteur passé ou `mcp/corpus/rgpd.json`, accepte `--fixture <chemin>` pour éviter le réseau, sinon appelle `fetchCellar`.
2. Écrire le snapshot brut, parser, écrire le corpus, journaliser le nombre d'unités sur `stderr`.
3. Ajouter `"corpus:build": "node mcp/corpus/build.ts"` dans `package.json`.
4. Ajouter `"mcp/**/*.ts"` dans `include` de `tsconfig.json`.

### `5)` Verrouiller par les tests

> La capture réelle est la fixture ; aucune requête réseau, aucune seconde copie brute.

1. Écrire `tests/corpus.test.ts` sur `tests/fixtures/eurlex/rgpd.xhtml` ; le test lit la fixture, il n'écrit pas dans `data/raw/`.
2. Vérifier 99 articles, 173 considérants, l'article 17 non vide et son chemin.
3. Vérifier le manifeste, le nom du snapshot et l'idempotence des deux écritures.
4. Vérifier qu'une capture amputée de `art_17` lève et n'écrit rien.
5. Documenter dans `testing.md` que cette fixture est la capture intégrale, exception à la règle des captures réduites (phase 5).
6. Lancer `npm test`, `npm run typecheck` et `npm run build`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `fetchCellar` envoie les deux en-têtes, suit la redirection et lève sur un statut non 2xx ; le snapshot est adressé par son `sha256`. |
| 2 | La capture rend 99 articles et 173 considérants ; l'article 17 contient « effacement » et son chemin nomme le chapitre III. |
| 3 | Le manifeste porte les trois dates, l'URL et le nom du snapshot ; `unites.jsonl` porte 272 lignes et deux passes rendent les mêmes octets. |
| 4 | `npm run corpus:build -- --fixture …` écrit les deux fichiers sans réseau et journalise 272 unités sur `stderr`. |
| 5 | `npm test`, `npm run typecheck` et `npm run build` passent ; aucun test ne touche le réseau ni `data/raw/`. |
