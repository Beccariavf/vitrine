---
status: pending
---

# Instruction: Ajouter les lignes directrices du CEPD au corpus

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp
│   └── corpus
│       └── cepd
│           ├── descripteur.json
│           ├── liste.ts
│           ├── pdf.ts
│           ├── parse.ts
│           └── sync.ts
├── tests
│   ├── cepd-corpus.test.ts
│   └── fixtures
│       └── cepd
│           └── guideline.txt
├── data
│   └── corpus
│       └── cepd
│           ├── manifest.json
│           └── unites.jsonl
├── package.json
├── .gitignore
└── README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Servir une liste réduite et un texte extrait | La liste et le texte sont lisibles sans réseau | cli |
| Happy path   | Synchroniser les lignes directrices | Chaque ligne directrice rend des fragments avec son numéro et sa date | cli |
| Edge case    | Une page en 503 ou un PDF illisible | La synchronisation échoue et nomme l'URL, sans écrire un corpus partiel | cli |
| Teardown     | Rejouer sur la même liste | Aucun fichier n'est réécrit | cli |

## Tasks to do

### `1)` Lister les lignes directrices

> La liste officielle est paginée et le site peut répondre 503.

1. Créer `mcp/corpus/cepd/descripteur.json` : corpus `cepd`, nom `CEPD`, URL de la liste française, motif de document, licence à vérifier, page maximale.
2. Créer `mcp/corpus/cepd/liste.ts` : parcourir les pages `?page=N`, extraire les liens `documents/guideline/*` et `documents/recommendation/*` avec titre et date.
3. Réessayer trois fois avec un délai court sur 429 et 503 ; si le site reste indisponible, lever en nommant l'URL et le statut.
4. Ne jamais lire une page de consultation publique ni un document d'un autre type.

### `2)` Extraire le texte des PDF

> Le texte officiel n'est publié qu'en PDF.

1. Ajouter `unpdf` en dépendance épinglée dans `package.json`.
2. Créer `mcp/corpus/cepd/pdf.ts` : télécharger le PDF, extraire le texte page par page, normaliser les espaces et refuser un PDF sans texte (scanné) en nommant l'URL.
3. Refuser aussi un texte de moins de 2 000 caractères ou dont la part de lettres est inférieure à 50 % : une extraction vide ou un PDF d'images ne doit pas produire de fragments.
4. Refuser un fichier qui n'est pas un PDF et un document hors du domaine `edpb.europa.eu`.

### `3)` Découper et adresser

> Chaque ligne directrice devient des fragments citables.

1. Créer `mcp/corpus/cepd/parse.ts` : déduire le numéro (`Guidelines 05/2022`), la date et la version depuis le titre, découper avec `decouperParagraphes` (600 à 1 200 caractères).
2. Produire `ref: "<slug>#f<n>"`, `document: "<slug>"`, `niveau: "fragment"`, `numero`, `chemin: "CEPD > Lignes directrices > <titre>"`, URL du document et `statut` (version finale ou projet).
3. Écarter les versions obsolètes quand une version finale porte le même numéro.

### `4)` Synchroniser et déclarer la couverture

> Le corpus n'est écrit qu'après validation complète.

1. Créer `mcp/corpus/cepd/sync.ts` avec `npm run cepd:sync`, `--dry-run`, `--limite <n>` et `--depuis <date>`.
2. Écrire les PDF sous `data/raw/cepd/`, puis `data/corpus/cepd/unites.jsonl` et `manifest.json` (source, date de liste, documents, fragments, versions écartées, licence, bloc `couverture` : types retenus, période, documents sans texte écartés).
3. Ajouter `data/raw/cepd/` à `.gitignore` : les PDF téléchargés ne sont pas commités.
4. Refuser une référence dupliquée, un texte vide ou un document attendu absent, sans toucher aux fichiers existants.

### `5)` Tester hors ligne

> La liste et le PDF sont remplacés par des fixtures.

1. Créer `tests/fixtures/cepd/guideline.txt` (texte extrait réel d'une ligne directrice, tronqué) et une liste HTML réduite.
2. Créer `tests/cepd-corpus.test.ts` : pagination, filtre de type, extraction texte, numéro et date, version obsolète écartée, 503 qui lève, rejeu sans réécriture.
3. Vérifier qu'aucun test n'appelle `edpb.europa.eu`.

### `6)` Mesurer ou constater le blocage

> Le corpus est interrogé, ou le blocage est dit avec sa cause.

1. Lancer `npm run cepd:sync` sur le site réel ; si le site répond encore 503, consigner l'URL, les tentatives et le statut dans le rapport de phase.
2. Si le corpus existe, lancer `npm run corpus:index` puis une seconde fois : zéro unité au second passage.
3. Écrire `mcp/eval/questions-cepd.csv` (10 questions `dev`, corpus `cepd`) et mesurer avec `npm run mcp:eval` ; sans corpus, ne pas fabriquer de mesure.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Seuls les liens de type ligne directrice ou recommandation sont retenus ; un 503 répété lève en nommant l'URL. |
| 2 | Un PDF réel rend un texte non vide ; un PDF sans texte, trop court ou majoritairement non alphabétique est refusé en nommant l'URL ; `unpdf` est épinglé. |
| 3 | Chaque ligne directrice porte un numéro, une date et un slug stable ; la version obsolète est écartée. |
| 4 | `npm run cepd:sync` écrit les PDF, le corpus et le manifeste ; `--dry-run` n'écrit rien. |
| 5 | Les tests passent hors ligne, sans `edpb.europa.eu`. |
| 6 | Soit le corpus est mesuré et le rapport porte ses rangs, soit le blocage est consigné avec l'URL et le statut, sans mesure inventée. |
