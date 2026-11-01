---
status: completed
---

# Instruction: Données et mémoire

## Architecture projection

```txt
.
├── ✏️ data/entries/2026/08/CETATEXT000054762056.json
├── ✏️ data/entries/2026/10/CETATEXT000054964917.json
├── ✏️ data/entries/2026/10/CETATEXT000054993122.json
├── ✏️ data/entries/2026/10/CETATEXT000055005472.json
├── ✏️ data/entries/2026/10/CETATEXT000055005481.json
├── ✏️ data/entries/2026/10/CETATEXT000055005484.json
├── ✏️ data/entries/2026/10/CETATEXT000055005485.json
├── ✏️ data/entries/2026/10/CETATEXT000055005491.json
├── ✏️ data/entries/2026/10/CETATEXT000055022926.json
├── ✏️ aidd_docs/memory/architecture.md
├── ✏️ aidd_docs/memory/data.md
└── ✏️ aidd_docs/memory/testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lancer une passe ciblée CETAT avec les secrets locaux | Les 9 entrées existantes sont réécrites | cli |
| Happy path   | Lire les entrées et construire le site | 501268, 509210, 509589, 511155 et 513996 portent leurs articles ; 520279 n'en porte plus | cli |
| Edge case    | Lancer sans secrets PISTE | La passe ignore CETAT, les entrées restent inchangées | cli |
| Teardown     | Comparer `git status` avant et après | Aucune entrée hors CETAT n'est réécrite | cli |

## Tasks to do

### `1)` Rattraper les décisions déjà écrites

> Le cache empêche de les relire en passe normale : une passe ciblée les réécrit.

1. Exécuter un script temporaire hors du dépôt qui lit chaque entrée `source: "cetat"`, appelle `consultJuri`, applique l'extraction et le filtrage par matières, puis réécrit l'entrée et le snapshot brut.
2. Vérifier 501268 (`CPCE · art. L. 34-5`, `LIL · art. 8, 82, 20`, `RGPD · art. 83`), 509210 (`RGPD · art. 15, 16`), 509589 (`LIL · art. 8, 20`), 511155 (`RGPD · art. 15`), 513996 (`LIL · art. 31, 118`).
3. Vérifier que 520279 perd `Règlement (UE) 2016/679 · art. 5` et que 510485, 511156 et 519056 restent sans référence.
4. Reconstruire le site et vérifier les pastilles et leurs liens.
5. Vérifier que seules les entrées `source: "cetat"` ont changé dans `git status`.

### `2)` Mettre à jour la mémoire

> Les documents décrivent la nouvelle source et la règle.

1. `architecture.md` : le Conseil d'État lit son texte après le rattachement, comme la Cour de cassation.
2. `data.md` : le visa structuré est vide ; les articles viennent des formules d'application, jamais des griefs ; couverture 5 sur 9.
3. `testing.md` : tests de l'extraction CETAT, du `consultJuri` et de l'enrichissement.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les 9 entrées CETAT sont réécrites ; les cinq gains sont visibles ; 520279 n'a plus de référence ; aucune entrée hors CETAT ne change. |
| 2 | Les trois documents de mémoire décrivent la règle et la couverture réelles. |
