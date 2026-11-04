---
status: pending
---

# Instruction: Index incrémental

## Architecture projection

```txt
.
├── mcp/
│   └── index/
│       └── ✏ build.ts
├── tests/
│   └── ✏ index.test.ts
└── data/
    └── corpus/
        └── index/
            └── ✅ index.db
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire un index sur six unités avec un embedder compteur | Six passages embarqués | cli |
| Happy path   | Relancer sans changement | Zéro passage embarqué, mêmes vecteurs | cli |
| Happy path   | Ajouter une unité puis relancer | Un seul passage embarqué, les cinq autres inchangés | cli |
| Happy path   | Modifier le texte d'une unité puis relancer | Un seul passage embarqué | cli |
| Edge case    | Supprimer une unité puis relancer | Zéro passage embarqué, la ligne et son vecteur disparaissent | cli |
| Edge case    | Changer de modèle ou de dimension | Reconstruction complète, message explicite | cli |
| Teardown     | Supprimer la racine temporaire | Aucun fichier résiduel | cli |

## Tasks to do

### `1)` Empreindre chaque unité

> Une empreinte qui change dès que le vecteur changerait.

1. Ajouter `empreinte` à la table `unites` : `sha256` de `model`, `dim` et du passage contextualisé.
2. Ajouter un index unique sur `ref` (déjà présent) et une table `meta` inchangée.
3. Calculer l'empreinte d'une unité avant tout appel d'embedding.

### `2)` Comparer avant d'embarquer

> Le diff décide, pas la commande.

1. Si l'index existe et que `model` et `dim` correspondent, ouvrir la base et lire `ref → rowid, empreinte`.
2. Classer chaque unité en `ajoutee`, `modifiee`, `inchangee` ; classer les `ref` absentes en `supprimee`.
3. Ne demander un vecteur que pour `ajoutee` et `modifiee`.
4. Attribuer les nouveaux `rowid` à la suite du maximum existant, jamais par position.
5. Supprimer les lignes et vecteurs des `supprimee`, dans la même transaction.

### `3)` Rester atomique et compatible

> Un échec ne laisse pas d'index partiel.

1. Conserver le mode actuel quand l'index est absent, illisible ou incompatible : construction dans `index.db.tmp` puis renommage.
2. En mode incrémental, écrire dans une transaction et annuler en cas d'erreur.
3. Rendre `{ ajoutees, modifiees, supprimees, inchangees }` et journaliser sur `stderr`.
4. Mettre à jour `meta` (`construit_le`, `unites`) sans changer le modèle ni la dimension.

### `4)` Verrouiller par les tests

> Un embedder compteur prouve le delta.

1. Écrire un embedder qui compte les passages reçus et garde un vecteur déterministe.
2. Vérifier la première construction, le second passage à zéro, l'ajout, la modification et la suppression.
3. Relire les vecteurs inchangés avant et après et vérifier qu'ils sont identiques.
4. Vérifier la reconstruction complète sur changement de modèle.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Chaque unité porte une empreinte qui dépend du modèle, de la dimension et du passage. |
| 2 | Un second passage embarque zéro unité ; un ajout en embarque une ; une modification une ; une suppression zéro. |
| 3 | Un échec ne laisse pas d'index partiel ; les nouveaux `rowid` ne dépendent pas de la position ; le journal nomme les quatre comptes du delta. |
| 4 | Les vecteurs des unités inchangées sont identiques avant et après ; `npm test` et `npm run typecheck` passent. |
