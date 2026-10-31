---
status: done
---

# Instruction: Brancher les pages CNIL dans la passe

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── veille/
│   ├── main.ts ✏
│   └── write.ts ✏
└── tests/
    └── write.test.ts ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Créer une racine temporaire et un `fetch` simulé qui distingue le flux, la page FNAC et les pages sans référence. | Aucun réseau, états des deux sources maîtrisés. | cli |
| Happy path   | Lancer `run` avec le flux CNIL, la page FNAC et des pages vides pour les autres entrées. | L'entrée FNAC porte `Loi Informatique et Libertés · art. 82`, un snapshot `.html` existe, `warnings` est vide. | cli |
| Edge case    | La page FNAC lève ou répond 500. | L'entrée FNAC est écrite avec `references: []`, `warnings` nomme l'URL, la passe se termine sans rejeter ; les autres entrées gardent leurs références. | cli |
| Edge case    | Une page réussit mais n'a pas de section cible. | Aucun snapshot `.html` n'est écrit pour elle ; l'entrée porte `[]`. | cli |
| Edge case    | Lancer les deux sources avec CJUE. | Les références CNIL et CJUE coexistent ; les pages CNIL sans référence n'ajoutent aucun snapshot. | cli |
| Teardown     | Supprimer la racine temporaire. | Aucun fichier de test ne reste. | cli |

## Tasks to do

### `1)` Décrire la page à lire par source

> `run` ne doit pas connaître un cas CNIL particulier.

1. Ajouter à `Source` un champ optionnel `references` : `pageUrl(entry)` et `parsePage(html)`.
2. Renseigner ce champ pour CNIL avec `entry.url` et `parseCnilPageReferences`.
3. Laisser CJUE sans ce champ : ses références restent extraites du titre dans `parseFeed`.

### `2)` Enrichir les entrées page par page

> Une page en échec ne doit jamais retirer l'entrée ni faire échouer la passe.

1. Ajouter un `fetchPage` qui réutilise `fetchImpl` et nomme la source dans l'erreur.
2. Après `parse`, parcourir les entrées CNIL dans l'ordre, lire la page, appeler `parsePage` et remplacer `references`.
3. En cas d'échec de fetch ou de parse, ajouter un avertissement avec l'URL et écrire l'entrée avec `references: []`.
4. Si des références sont retenues, écrire la page en snapshot `.html` ; une erreur d'écriture du snapshot reste une erreur de source.

### `3)` Exposer les pages et les avertissements

> La passe doit pouvoir signaler une page sans bloquer.

1. Généraliser `writeRaw(rootDir, content, extension = "xml")` ; le flux reste `.xml`, les pages CNIL sont `.html`.
2. Ajouter `pagePaths` à `SourceRun` et `warnings` à `RunResult`.
3. Dans le CLI, afficher les avertissements et le nombre de pages par source.

### `4)` Couvrir la passe avec des pages simulées

> Les tests existants prouvent le flux ; il faut prouver la page.

1. Mettre à jour les mocks de `tests/write.test.ts` pour que les URLs de pages CNIL aient une réponse sans référence, et garder les comptes de snapshots existants.
2. Ajouter un test FNAC : références écrites, snapshot `.html`, `pagePaths` et `warnings`.
3. Ajouter un test d'échec de page (réseau et HTTP 500) : `[]`, avertissement, passe résolue, autres entrées intactes.
4. Ajouter un test sans section : aucun snapshot ; et un test `writeRaw` avec extension `html`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `Source` porte `references` en option ; CNIL le renseigne, CJUE ne le renseigne pas. |
| 2 | Une page FNAC valide remplit l'entrée et crée un snapshot ; une page en échec laisse `[]` et un avertissement sans rejeter la passe. |
| 3 | `writeRaw` écrit `.xml` et `.html` ; le CLI voit `warnings` et `pagePaths`. |
| 4 | Les tests FNAC, échec de page, page sans section et CJUE passent ; les tests de flux existants restent verts. |
