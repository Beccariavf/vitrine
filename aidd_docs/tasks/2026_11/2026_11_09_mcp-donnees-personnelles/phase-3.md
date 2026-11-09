---
status: pending
---

# Instruction: Construire le corpus du Conseil d'État depuis JADE

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp
│   └── corpus
│       └── ce
│           ├── descripteur.json
│           ├── archive.ts
│           ├── parse.ts
│           └── sync.ts
├── tests
│   ├── ce-corpus.test.ts
│   └── fixtures
│       └── ce
│           └── jade.tar.gz
├── data
│   ├── raw
│   │   └── ce
│   │       └── Freemium_jade_global_20261108-140000.tar.gz
│   └── corpus
│       └── ce
│           ├── etat.json
│           ├── manifest.json
│           └── unites.jsonl
├── package.json
├── .gitignore
└── README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Servir une archive tar.gz réduite de trois décisions | L'archive est lue sans réseau | cli |
| Happy path   | Synchroniser JADE | Seules les décisions du Conseil d'État depuis 2014 sur les données personnelles sont écrites | cli |
| Edge case    | Une décision de cour administrative d'appel ou antérieure à 2014 | Elle est comptée comme écartée, jamais écrite | cli |
| Teardown     | Rejouer avec la même archive et la même empreinte | Aucun fichier n'est réécrit | cli |

## Tasks to do

### `1)` Décrire et localiser l'archive

> Le descripteur nomme JADE, la borne de date, les mots-clés et la licence.

1. Créer `mcp/corpus/ce/descripteur.json` : `corpus: "ce"`, `nom: "Conseil d'État"`, URL de la liste DILA, motif `Freemium_jade_global_*.tar.gz`, `date_min: "2014-01-01"`, mots-clés, licence ouverte 2.0.
2. Lister la page `https://echanges.dila.gouv.fr/OPENDATA/JADE/` et retenir le nom d'archive le plus récent.
3. Télécharger sous `data/raw/ce/` par fichier temporaire puis renommage, et refuser une archive absente ou vide.

### `2)` Lire l'archive en flux

> Le fichier de 1,32 Go n'entre jamais entier en mémoire.

1. Créer `mcp/corpus/ce/archive.ts` : `fetch` → `Readable.fromWeb` → `createGunzip` → lecteur tar incrémental (en-têtes de 512 octets, données ignorées ou lues selon le nom).
2. Ne rendre que les entrées `jade/global/publie/**/*.xml` et `jade/global/inedit/**/*.xml` ; ignorer les répertoires et les autres fonds. L'archive réelle porte 73 332 fichiers `publie` et 536 197 fichiers `inedit` : les seconds contiennent les décisions inédites au recueil, dont celles de la veille.
3. Refuser une entrée dont la taille dépasse un plafond (par exemple 5 Mo) et une archive dont le gzip est corrompu, en nommant l'entrée.

### `3)` Filtrer et parser les décisions

> Chaque décision retenue devient une unité adressable.

1. Parser le XML avec `fast-xml-parser` : `META_COMMUN/ID`, `META_JURI/TITRE`, `DATE_DEC`, `NUMERO`, `JURIDICTION`, `PUBLI_RECUEIL`, `SOLUTION`, puis `TEXTE/BLOC_TEXTUEL/CONTENU`.
2. Retenir une `JURIDICTION` normalisée (casse, accents, espaces) égale à « Conseil d'État » et écarter celles qui contiennent « cour administrative d'appel », « CAA » ou « tribunal administratif », car JADE mêle les trois juridictions ; retenir aussi `DATE_DEC >= date_min` et un texte normalisé contenant au moins un mot-clé du descripteur.
3. Convertir `CONTENU` en texte (balises `<br/>` et entités), découper avec `decouperParagraphes` (600 à 1 200 caractères) et produire `ref: "<ID>#f<n>"`, `niveau: "fragment"`, `numero` et URL Légifrance `https://www.legifrance.gouv.fr/ceta/id/<ID>`.
4. Compter les décisions écartées par motif : autre juridiction, avant la borne, sans mot-clé, texte vide.

### `4)` Synchroniser et déclarer la couverture

> Le corpus n'est écrit qu'après validation, et le manifeste dit ce qui est dedans.

1. Créer `mcp/corpus/ce/sync.ts` avec `npm run ce:sync`, `--archive <chemin>`, `--dry-run` et `--date-min`.
2. Écrire `data/corpus/ce/etat.json` (nom d'archive, sha256, lu_le) et ne rien relire si l'archive et l'empreinte sont identiques.
3. Écrire `data/corpus/ce/unites.jsonl` et `manifest.json` : archive, sha256, date d'extraction, `date_min`, mots-clés, documents, fragments, écartés par motif, licence, bloc `couverture` (source, archive, période, juridiction, fonds `publie` et `inedit`, mots-clés, exclusions).
4. Ajouter `data/raw/ce/` à `.gitignore` : l'archive de 1,32 Go n'est jamais commitée.
5. Refuser une référence dupliquée, une date non ISO ou un texte vide sans toucher aux fichiers existants.

### `5)` Tester hors ligne

> L'archive de test est petite et ne sort pas du disque.

1. Créer `tests/fixtures/ce/jade.tar.gz` : six décisions XML, dont une dans `publie` et une dans `inedit`, plus une cour administrative d'appel, une décision antérieure à 2014, une sans mot-clé et un texte vide.
2. Créer `tests/ce-corpus.test.ts` : lecture en flux, filtre de juridiction, borne 2014, mot-clé, découpage, comptes d'écartés, manifeste, rejeu sans réécriture.
3. Vérifier qu'aucun test n'ouvre l'archive réelle ni le réseau.

### `6)` Mesurer sur le corpus réel

> Le corpus est construit, indexé et interrogé.

1. Lancer `npm run ce:sync` sur l'archive réelle et rapporter les comptes par motif d'exclusion.
2. Lancer `npm run corpus:index` puis une seconde fois : le second passage embarque zéro unité.
3. Écrire `mcp/eval/questions-ce.csv` (12 questions `dev`, corpus `ce`) et mesurer avec `npm run mcp:eval`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le descripteur nomme JADE, la borne 2014 et les mots-clés ; l'archive la plus récente est choisie et téléchargée par fichier temporaire. |
| 2 | L'archive est lue en flux ; seules les entrées XML de `jade/global/publie` et `jade/global/inedit` sont rendues ; une entrée trop grosse est refusée en la nommant. |
| 3 | Seules les décisions du Conseil d'État, depuis 2014 et portant un mot-clé, produisent des unités ; une décision de CAA ou de tribunal administratif est écartée et comptée. |
| 4 | `npm run ce:sync` écrit l'état, le corpus et le manifeste ; l'état identique empêche toute relecture ; `--dry-run` n'écrit rien. |
| 5 | Les tests passent hors ligne avec la petite archive. |
| 6 | Le manifeste publie les comptes réels et les exclusions ; l'éval CE est rapportée. |
