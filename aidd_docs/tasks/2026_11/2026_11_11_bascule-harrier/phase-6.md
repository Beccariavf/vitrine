---
status: pending
---

# Instruction: Bascule du produit, de la table et de la documentation

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
mcp/
├── confidence.ts                                   ✏️
├── corpus/cnil/historique.ts                       ✏️
├── embed/embedder.ts                               ✏️
└── server.ts                                       ✏️
tests/
├── eval.test.ts                                    ✏️
├── index.test.ts                                   ✏️
└── mcp.test.ts                                     ✏️
README.md                                           ✏️
aidd_docs/
├── tasks/2026_11/2026_11_10_promesse-confiance/promesse.md  ✏️
└── memory/
    ├── architecture.md                             ✏️
    ├── data.md                                     ✏️
    └── testing.md                                  ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `mesures/calibration.md`, `test-harrier-promesse.md` et `autres-corpus.md` | Triplet, promesse et chiffres hors CNIL connus | cli |
| Happy path   | `npm test` | Toute la suite passe, y compris le test qui compare `SEUILS_PAR_CORPUS` aux lignes de `promesse.md` | cli |
| Happy path   | `npm run typecheck` et `npm run build` | Les deux sortent en 0 | cli |
| Edge case    | Un test fige encore `qwen3-embedding:0.6b` ou `0,67 / 0,67 / 0,02` | Il est mis à jour vers le modèle et le triplet retenus, jamais neutralisé | cli |
| Teardown     | `npm run corpus:index` sans option | Journal : mode incrémental, 0 ajoutée, 0 modifiée | cli |

## Tasks to do

### `1)` Basculer le modèle et la table

> Le produit interroge Harrier Ollama et applique la table calibrée en phase 2.

1. `mcp/embed/embedder.ts` : `MODELE_DEFAUT = "leoipulsar/harrier-0.6b"`, commentaire à jour.
2. `mcp/confidence.ts` : `SEUILS_PAR_CORPUS.cnil` reçoit le triplet figé ; le commentaire de tête porte la nouvelle borne, la couverture et la source.
3. `mcp/server.ts` : `CONSIGNE_PROMESSE` porte le nouveau triplet, la nouvelle borne, la couverture et le plancher.
4. `mcp/corpus/cnil/historique.ts` : le commentaire nomme `leoipulsar/harrier-0.6b` comme espace vectoriel du produit.

### `2)` Réécrire la promesse

> `promesse.md` reste le contrat que le code applique et que le test lit.

1. Remplacer les valeurs qwen3 par celles de Harrier (triplet, couverture, risque, borne, plancher, doctrine, sept jeux).
2. Conserver la règle de choix, la population, les exclusions et la section « ce qui invaliderait ».
3. Nommer le modèle, l'index et les fichiers de mesure du lot ; dire que les chiffres qwen3 restent dans `mesures/` et `confirmation.md`.
4. Écrire la limite du garde par nom de modèle : `leoipulsar/harrier-0.6b` n'a pas consommé de tir et ne doit pas en consommer.

### `3)` Mettre la documentation et les tests d'accord

> README et mémoire disent le modèle retenu, la table et la borne.

1. `README.md` : commande de tirage du modèle, promesse, tableau des seuils, lignes `:34`, `:51-52`, `:190` et `:207-238`.
2. `aidd_docs/memory/architecture.md`, `data.md`, `testing.md` : modèle, table, borne, commandes.
3. `tests/mcp.test.ts` : triplet, frontières, marge et lecture de `promesse.md`.
4. `tests/index.test.ts` et `tests/eval.test.ts` : modèle par défaut et table du produit.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `creerEmbedder("ollama", {})` rend `leoipulsar/harrier-0.6b` en 1 024 dimensions ; `SEUILS_PAR_CORPUS.cnil` vaut le triplet de `calibration.md`. |
| 2 | Les lignes « Seuils retenus » et « Repli des autres corpus » de `promesse.md` portent des triplets identiques au code, et la borne CNIL publiée est celle de `test-harrier-promesse.md`. |
| 3 | `npm test`, `npm run typecheck` et `npm run build` passent ; README et mémoire ne nomment plus `qwen3-embedding:0.6b` comme modèle du produit. |
