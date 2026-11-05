---
status: pending
---

# Instruction: Recherche hybride

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✏ index/
│   │   ├── ✏ build.ts
│   │   └── ✏ search.ts
│   └── ✏ tools.ts
├── ✅ tests/
│   ├── ✏ index.test.ts
│   └── ✏ mcp.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_qualite-v2-aiact/
                └── ✅ eval-v2.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire un index de six unités avec un embedder factice | `unites`, `vec_unites` et `fts_unites` sont remplies | cli |
| Happy path   | Chercher un terme rare présent dans une seule unité | La voie lexicale la remonte | cli |
| Happy path   | Un passage classé par les deux voies | Il passe devant un passage classé par une seule | cli |
| Edge case    | Une requête sans terme lexical connu | La voie dense seule décide | cli |
| Edge case    | Ajouter, modifier ou supprimer une unité | La table FTS suit le même delta que les vecteurs | cli |
| Teardown     | Relancer la même recherche | Le résultat est identique | cli |

## Tasks to do

### `1)` Ajouter la voie lexicale

> FTS5 dans le même fichier, même `rowid`.

1. Ajouter `fts_unites` avec `fts5(chemin, texte, tokenize="unicode61 remove_diacritics 2")` au schéma de `mcp/index/build.ts`.
2. Insérer chaque unité avec le même `rowid` que `unites`.
3. Vérifier que `node:sqlite` expose bien FTS5 avant de construire.

### `2)` Étendre le delta

> Un seul diff pour les deux tables.

1. Supprimer les lignes FTS des unités supprimées ou modifiées.
2. Insérer les lignes FTS des unités ajoutées ou modifiées.
3. Garder la transaction unique et l'écriture atomique.

### `3)` Fusionner les deux classements

> RRF, sans comparer des scores incomparables.

1. Écrire `rechercheHybride(index, vecteur, texte, k)` dans `mcp/index/search.ts`.
2. Prendre 50 candidats denses et 50 candidats lexicaux, puis fusionner par `somme de 1 / (60 + rang)`.
3. Rendre les `k` premiers avec leur distance dense et leur rang lexical, sans changer la similarité affichée.
4. Passer le texte de la question depuis `mcp/tools.ts`.

### `4)` Décider par la mesure

> Améliorer sans casser le refus.

1. Mesurer `dev` v2 avec la voie dense seule, puis avec l'hybride.
2. Conserver l'hybride seulement si le top 5 ou le top 1 progresse et que les pièges cités restent à zéro.
3. Noter les chiffres avant et après dans `eval-v2.md`.
4. Revenir à la voie dense seule si l'hybride dégrade.

### `5)` Verrouiller par les tests

> Le lexical et la fusion se testent sans modèle.

1. Tester un terme rare retrouvé par FTS et absent du classement dense.
2. Tester l'ordre RRF sur deux passages classés par une ou deux voies.
3. Tester le delta FTS sur ajout, modification et suppression.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `fts_unites` existe, partage le `rowid` de `unites` et retrouve « autorite chef de file ». |
| 2 | Une suppression retire la ligne FTS ; un ajout l'ajoute ; une modification la remplace. |
| 3 | Un passage classé par les deux voies devance un passage classé par une seule ; la similarité rendue reste la distance dense. |
| 4 | `eval-v2.md` donne le top 5, le top 1 et les pièges avant et après, et la décision de garder ou retirer l'hybride. |
| 5 | Les tests couvrent le lexical, la fusion et le delta ; `npm test` et `npm run typecheck` passent. |
