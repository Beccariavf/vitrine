---
status: completed
---

# Instruction: Incréments DILA

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ corpus/
│       └── ✅ cnil/
│           ├── ✅ descripteur.json
│           ├── ✅ increments.ts
│           ├── ✅ parse.ts
│           ├── ✅ sync.ts
│           └── ✅ historique.ts
├── ✅ tests/
│   ├── ✅ cnil.test.ts
│   └── ✅ fixtures/
│       └── ✅ cnil/
│           ├── ✅ deliberation.xml
│           └── ✅ lignes.json
└── ✅ data/
    └── ✅ corpus/
        └── ✅ cnil/
            ├── ✅ etat.json
            ├── ✅ manifest.json
            └── ✅ unites.jsonl
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Parser une délibération XML de fixture | Métadonnées et paragraphes extraits | cli |
| Happy path   | Découper 265 paragraphes | Fragments de 600 à 1 200 caractères, aucun paragraphe perdu | cli |
| Happy path   | Rejouer la synchronisation sans nouvelle archive | Zéro téléchargement, zéro unité réécrite | cli |
| Edge case    | Une archive sans `BLOC_TEXTUEL` | Échec nommant l'identifiant, corpus intact | cli |
| Edge case    | Un document déjà présent (même `doc_id`) | Toutes ses unités sont remplacées, pas dupliquées | cli |
| Edge case    | Un `ETAT_JURIDIQUE` non `VIGUEUR` | Conservé avec son statut, jamais supprimé | cli |
| Teardown     | `--dry-run` | Aucune écriture, seuls les comptes | cli |

## Tasks to do

### `1)` Parser `TEXTE_CNIL`

> Même famille que LEGI, pas la même structure qu'EUR-Lex.

1. `mcp/corpus/cnil/parse.ts` : extraire `ID`, `TITRE`, `TITREFULL`, `NUMERO`, `NATURE_DELIB`, `DATE_TEXTE`, `DATE_PUBLI`, `ETAT_JURIDIQUE`.
2. Extraire les paragraphes `<p>` de `BLOC_TEXTUEL > CONTENU`, dans l'ordre, entités décodées.
3. Lever si l'identifiant, la date ou le contenu manquent, en nommant le fichier.
4. Filtrer sur `NATURE_DELIB` selon le descripteur.

### `2)` Découper localement

> Un fragment se cite, un paragraphe de un caractère ne se cite pas.

1. Regrouper les paragraphes consécutifs jusqu'à 600 caractères, sans dépasser 1 200 ; un paragraphe plus long reste seul.
2. Numéroter les fragments dans l'ordre du document, `ref` = `${id}#f${n}`, `origine` = `dila`.
3. Marquer le découpage local dans `chemin` ou dans le manifeste : la citation doit dire que la numérotation vient de nous.
4. Ne jamais perdre de texte : la concaténation des fragments doit égaler celle des paragraphes, à la normalisation près. Le vérifier par test.

### `3)` Reprendre les archives, sans doubler

> Une empreinte et une date, pas une liste de fichiers.

1. Lister `https://echanges.dila.gouv.fr/OPENDATA/CNIL/`, retenir les archives postérieures à `data/corpus/cnil/etat.json` (`derniere_archive`).
2. Pour chacune : télécharger, extraire les `TEXTE_CNIL`, parser, puis remplacer toutes les unités du `doc_id` concerné.
3. Écrire `etat.json` (dernière archive, date, empreinte) après succès seulement, et rejouer en cas d'échec sans conserver d'état partiel.
4. `--dry-run` affiche archives, documents lus, documents retenus, unités remplacées, sans écrire.

### `4)` Brancher la commande

> Une seule porte pour les deux origines.

1. `mcp/corpus/cnil/sync.ts` : `--historique`, `--increments`, `--tout`, `--dry-run`, `--nature <valeur>`.
2. `--tout` = historique puis incréments, dans cet ordre.
3. Script `npm run cnil:sync` dans `package.json`, journal sur `stderr`.
4. Écrire `manifest.json` avec les deux sources, les comptes et la date de synchronisation.

### `5)` Verrouiller par les tests

> Le réseau reste dehors.

1. Parser la fixture XML et vérifier métadonnées et paragraphes.
2. Vérifier la conservation du texte au découpage et les bornes 600–1 200.
3. Vérifier le remplacement par `doc_id` et l'absence de doublon.
4. Vérifier l'idempotence avec un état à jour et une archive injectée.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La fixture rend les métadonnées attendues ; un contenu absent lève en nommant l'identifiant. |
| 2 | Aucun texte perdu, fragments de 600 à 1 200 caractères, `ref` et `origine` conformes. |
| 3 | Une seconde exécution ne télécharge rien et ne réécrit aucune unité ; un `doc_id` connu est remplacé, pas dupliqué. |
| 4 | `npm run cnil:sync -- --tout --dry-run` n'écrit rien et affiche les comptes. |
| 5 | Les tests couvrent parsing, découpage, remplacement et idempotence ; `npm test` et `npm run typecheck` passent. |
