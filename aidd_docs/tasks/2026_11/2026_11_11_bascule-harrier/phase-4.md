---
status: pending
---

# Instruction: Reconstruction de l'index produit et seconde passe

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
data/
└── corpus/
    └── index/
        └── index.db                                (dérivé, non commité)
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | L'index produit porte encore `qwen3-embedding:0.6b` | Le prochain passage est complet, pas incrémental | cli |
| Happy path   | `npm run corpus:index -- --modele leoipulsar/harrier-0.6b --dim 1024` | Journal : 53 143 unités, `leoipulsar/harrier-0.6b`, 1 024 dimensions, mode complet | cli |
| Happy path   | Relancer la même commande | Journal : 53 143 unités, 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées | cli |
| Edge case    | Une coupure pendant la construction | `index.db.tmp` est supprimé, l'ancien `index.db` reste lisible | system |
| Teardown     | Lire `meta` de `index.db` | `model` = `leoipulsar/harrier-0.6b`, `dim` = 1024, `unites` = 53143 | cli |

## Tasks to do

### `1)` Reconstruire l'index complet

> Les six corpus, 53 143 unités, sans toucher au modèle par défaut du code.

1. Lancer `npm run corpus:index -- --modele leoipulsar/harrier-0.6b --dim 1024`.
2. Relever la durée et le journal : mode complet, 53 143 ajoutées.
3. Vérifier les clés `model`, `dim` et `unites` de la table `meta`.

### `2)` Prouver l'idempotence

> Le second passage n'embarque rien.

1. Relancer `npm run corpus:index -- --modele leoipulsar/harrier-0.6b --dim 1024`.
2. Vérifier 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | L'index produit porte 53 143 unités et le modèle `leoipulsar/harrier-0.6b` en 1 024 dimensions. |
| 2 | Le second passage n'ajoute, ne modifie et ne supprime aucune unité. |
