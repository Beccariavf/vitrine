---
status: pending
---

# Instruction: Étendre le corpus CNIL aux sanctions, avis et recommandations

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp
│   ├── corpus
│   │   ├── parse.ts
│   │   └── cnil
│   │       ├── descripteur.json
│   │       ├── historique.ts
│   │       ├── increments.ts
│   │       ├── parse.ts
│   │       └── sync.ts
│   ├── index
│   │   ├── build.ts
│   │   └── search.ts
│   ├── tools.ts
│   ├── server.ts
│   └── eval
│       └── questions-cnil-doctrine.csv
├── tests
│   ├── cnil.test.ts
│   ├── index.test.ts
│   └── mcp.test.ts
└── README.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire les lignes parquet injectées des trois natures | Les comptes par nature sont connus | cli |
| Happy path   | Synchroniser puis chercher une question d'avis avec `nature: "Avis"` | Seuls des fragments d'avis sont rendus | cli |
| Edge case    | Chercher une sanction avec `nature: "Avis"` | Aucun fragment de sanction n'est rendu | cli |
| Teardown     | Rejouer la synchronisation sur un corpus inchangé | Aucun fichier n'est réécrit | cli |

## Tasks to do

### `1)` Décrire les trois natures

> Le descripteur et le type d'unité portent la nature de chaque délibération.

1. Remplacer `nature: "Sanction"` par `natures: ["Sanction", "Avis", "Recommandation/Lignes directrices"]` dans `mcp/corpus/cnil/descripteur.json`.
2. Ajouter `nature?: string` à `Unite` dans `mcp/corpus/parse.ts`.
3. Faire lire `natures` par `lireDescripteur` et `sync.ts`, sans casser un descripteur à `nature` unique.

### `2)` Filtrer plusieurs natures

> `historique.ts` et `increments.ts` retiennent chaque nature demandée.

1. Remplacer `estDeNature(ligne, nature)` par un test d'appartenance à un ensemble, insensible à la casse de `AVIS`.
2. Dans `unitesDinum`, poser `nature` sur chaque unité et n'appeler `extraireMetaSanction` que pour `Sanction`.
3. Remplacer le chemin figé `CNIL > Sanctions` par le libellé de la nature, dans `historique.ts` comme dans `unitesDila` de `parse.ts` ; n'appliquer les métadonnées de sanction qu'aux sanctions.
4. Faire accepter à `lireArchiveDepuis` et `fusionnerDecisions` la liste des natures.

### `3)` Propager la nature dans l'index

> La nature est stockée et filtrée dans `vec0`, comme les autres métadonnées.

1. Ajouter `nature TEXT NOT NULL DEFAULT ''` à `unites` et à `vec_unites` dans `mcp/index/build.ts`.
2. Étendre la migration existante : recopier les vecteurs et remplir `nature` depuis l'unité, sans ré-embarquer.
3. Ajouter `nature?: string` à `SearchOptions` et pousser le filtre dans `filtresVectoriels`, dans `candidatsLexicaux` et dans `retenu`, pour que la voie hybride ne laisse pas passer une autre nature.
4. Insérer et mettre à jour `nature` dans les trois écritures (insertion, delta, migration).

### `4)` Rendre les outils conscients de la nature

> `search` filtre par nature ; `get_decision` reste réservé aux sanctions, comme le brief le fixe.

1. Ajouter `nature?: string` à `SearchDemande` dans `mcp/tools.ts` et le transmettre à `searchIndex`.
2. Dans `getDecision`, ne retenir que les unités de nature `Sanction` ; si le document ou le numéro n'existe que comme avis ou recommandation, rendre `trouve: false` avec un message qui renvoie à `search` et son filtre `nature`.
3. Ajouter `nature` au schéma de l'outil `search` dans `mcp/server.ts` et remplacer la description du paramètre `corpus` qui n'énumère que `rgpd`, `aiact` et `cnil`.
4. Mettre à jour les messages de refus qui nomment `cnil` pour ne plus parler de sanction seule.

### `5)` Tester les trois natures

> Chaque comportement observable nouveau a son test hors ligne.

1. Étendre `tests/cnil.test.ts` : lignes injectées des trois natures, `AVIS` majuscule retenue, avis sans métadonnées de sanction, manifeste avec les comptes par nature.
2. Étendre `tests/index.test.ts` : filtre `nature` dans `vec0`, migration d'un index sans colonne qui copie les vecteurs.
3. Étendre `tests/mcp.test.ts` : recherche filtrée par nature, décision d'avis rendue sans montant, `get_decision` qui rend la nature.

### `6)` Régénérer, indexer et mesurer

> Le corpus committé et l'index local portent les 3 245 délibérations.

1. Lancer `npm run cnil:sync -- --tout` et vérifier le manifeste : 3 245 documents et le compte de fragments mesuré.
2. Lancer `npm run corpus:index` puis une seconde fois : le second passage embarque zéro unité.
3. Écrire `mcp/eval/questions-cnil-doctrine.csv` (10 questions d'avis et recommandations, corpus `cnil`, split `dev`) et mesurer avec `npm run mcp:eval`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le descripteur nomme les trois natures ; `Unite` porte `nature` ; un descripteur à `nature` unique reste lu. |
| 2 | Une ligne `Avis` et une ligne `AVIS` sont retenues ; un avis ne porte ni `type_sanction` ni `montant` ; son chemin nomme « Avis ». |
| 3 | `search` avec `nature` ne rend que cette nature, y compris quand elle est minoritaire ; un index sans colonne est migré sans ré-embedding. |
| 4 | Une recherche CNIL rend la nature ; `get_decision` sur un avis rend `trouve: false` et renvoie à `search` avec `nature`. |
| 5 | Les tests ajoutés passent hors ligne, sans Ollama ni réseau. |
| 6 | Le manifeste déclare 3 245 documents avec les comptes par nature ; le second index n'embarque rien ; l'éval doctrinale est rapportée. |
