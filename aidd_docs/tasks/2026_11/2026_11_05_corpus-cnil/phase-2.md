---
status: completed
---

# Instruction: Historique DINUM

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ corpus/
│       └── ✅ cnil/
│           ├── ✅ descripteur.json
│           ├── ✅ historique.ts
│           └── ✅ sync.ts
├── ✅ tests/
│   ├── ✅ cnil.test.ts
│   └── ✅ fixtures/
│       └── ✅ cnil/
│           └── ✅ lignes.json
├── ✅ data/
│   └── ✅ corpus/
│       └── ✅ cnil/
│           ├── ✅ manifest.json
│           └── ✅ unites.jsonl
└── ✏ package.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire 3 lignes parquet injectées (2 sanctions, 1 avis) | 2 unités retenues | cli |
| Happy path   | Mapper une ligne sanction | `ref`, `corpus`, `numero`, `date`, `origine` corrects | cli |
| Happy path   | Synthétiser le manifeste | 249 documents, 6 342 fragments, sources déclarées | cli |
| Edge case    | Une ligne sans `text` | Rejetée, comptée dans les erreurs, corpus non écrit | cli |
| Edge case    | Deux lignes de même `doc_id` et `chunk_index` | Refus, la référence serait ambiguë | cli |
| Teardown     | Rejouer la synchronisation | Aucun fichier réécrit, comptes identiques | cli |

## Tasks to do

### `1)` Décrire la source

> Le descripteur dit où, quoi, et sous quelle licence.

1. Créer `mcp/corpus/cnil/descripteur.json` : `corpus` `cnil`, `nom` `CNIL`, nature filtrée `Sanction`, URL des deux parquet, page data.gouv, licence constatée (`etalab-2.0` sur HF, `lov2` sur data.gouv), date du snapshot, `url_texte` `https://www.legifrance.gouv.fr/cnil/id/{id}` marquée non vérifiée.
2. Déclarer les comptes attendus : 249 documents, 6 342 fragments.
3. Ajouter les dépendances `hyparquet` et `hyparquet-compressors`, versions épinglées.

### `2)` Lire le parquet sans embarquer

> On ne lit que le texte et les métadonnées.

1. `mcp/corpus/cnil/historique.ts` : télécharger les deux fichiers dans `data/raw/cnil/` s'ils sont absents, sinon les réutiliser ; calculer l'empreinte `sha256`.
2. Lire avec `parquetReadObjects` les seules colonnes `doc_id`, `chunk_index`, `text`, `number`, `date`, `title`, `status`, `nature_delib` ; ne jamais lire la colonne d'embeddings.
3. Filtrer `nature_delib === "Sanction"`.

### `3)` Mapper une ligne en unité

> La citation doit rester vérifiable.

1. `ref` = `${doc_id}#f${chunk_index}` ; `document` = `doc_id` ; `corpus` = `cnil` ; `niveau` = `fragment`.
2. `numero` = `number` (ou `doc_id` à défaut) ; `chemin` = `CNIL > Sanctions > Délibération ${numero}`.
3. `texte` = `text` ; `date_acte` et `date_debut` = `date` ; `statut` = `status` ; `origine` = `dinum`.
4. `url` = la route Légifrance du descripteur.

### `4)` Écrire le corpus après validation

> Un corpus partiel ne remplace jamais un corpus valide.

1. Valider : références uniques, textes non vides, dates ISO, comptes attendus.
2. Écrire `unites.jsonl` et `manifest.json` par fichier temporaire puis renommage.
3. Manifeste : `document` n'a pas de sens ici, le remplacer par `corpus`, comptes, `sources` (DINUM avec URL, date, empreinte ; DILA avec URL), `nature`, `decoupage` `dinum`, `url_texte_verifiee` `false`.
4. Ne pas commiter `data/raw/cnil/` : ajouter au `.gitignore`.

### `5)` Verrouiller par les tests

> Les fixtures remplacent le réseau.

1. Tester le filtre et le mapping sur des lignes injectées, y compris une ligne vide et un doublon.
2. Tester les comptes du manifeste sur un jeu réduit.
3. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le descripteur porte l'URL des deux parquet, la nature filtrée, la licence double et les comptes attendus. |
| 2 | Le parquet est lu colonne par colonne, sans la colonne d'embeddings ; les deux fichiers sont réutilisés s'ils existent. |
| 3 | Une ligne sanction donne `ref = <id>#f<n>`, `corpus = cnil`, `origine = dinum`, `date` et `numero` corrects. |
| 4 | Le corpus n'est écrit qu'après validation ; un texte vide ou une référence dupliquée bloque l'écriture. |
| 5 | Les tests couvrent filtre, mapping, doublon et manifeste ; `npm test` et `npm run typecheck` passent. |
