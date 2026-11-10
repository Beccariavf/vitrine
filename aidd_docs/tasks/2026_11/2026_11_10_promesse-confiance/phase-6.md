---
status: completed
---

# Instruction: Confirmer la promesse sur le split tenu à l'écart

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✅ mcp/eval/questions-cnil-etendu.test-consomme.json
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/confirmation.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Décision de modèle tranchée, règle livrée, table figée | la configuration qui part est écrite | cli |
| Happy path   | `node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split test --mesurer-test --regle produit --json` | une mesure unique, un marqueur, la promesse constatée sur la CNIL | cli |
| Edge case    | Le marqueur existe déjà pour ce modèle | la mesure est refusée en nommant le modèle et la date | cli |

## Tasks to do

### `1)` Attendre la décision de modèle

> Un seul tir, pour la configuration qui part.

1. Vérifier que la question Harrier est tranchée : la promesse est liée au couple (modèle, corpus), et changer d'embedder après coup invaliderait la confirmation.
2. Si le modèle change, recalibrer la table d'abord et rejouer la phase 4 ; la phase 6 attend.
3. Écrire la configuration exacte : modèle, dimension, table, plancher.

### `2)` Tirer une fois

> `--mesurer-test` n'a qu'un coup, et il ne porte que sur la CNIL.

1. Lancer la mesure du split `test` de `questions-cnil-etendu.csv`, seule collection dont le `test` n'est pas consommé, avec `--regle produit` : le JSON doit porter le triplet appliqué et son origine. Le harnais accepte une mesure par modèle pré-déclaré (`mesure-v3` a mesuré `0.6b` et `4b`) : deux modèles peuvent donc être mesurés, dans l'ordre déclaré, et le rapport le dit.
2. Ne pas relancer : le marqueur refuse le même modèle, et c'est voulu.
3. Conserver le JSON sous `mesures/`.

### `3)` Constater et conclure

> La promesse tenue en `dev` tient-elle hors échantillon ?

1. Appliquer la règle écrite d'avance : la borne haute de Wilson du risque, calculée sur les confiantes du `test`, doit rester sous le plafond publié en phase 2, avec la couverture atteinte. Un point d'estime sous le plafond avec une borne au-dessus vaut `non tenu`.
2. Écrire `mesures/confirmation.md` : risque constaté, intervalle, couverture, verdict tenu ou non, et le rappel que la CNIL est la seule collection confirmée.
3. Si la promesse n'est pas tenue, le dire sans la corriger sur le test : la correction se refait en `dev`, et le tir est dépensé.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | la configuration confirmée est écrite avant la mesure, modèle et table compris |
| 2 | un seul marqueur est créé, une entrée par modèle pré-déclaré, et une seconde tentative pour le même modèle est refusée en le nommant ; le JSON porte le triplet appliqué |
| 3 | `confirmation.md` donne risque, intervalle et couverture du `test`, applique la règle de borne haute écrite d'avance, et dit que seule la CNIL est confirmée |
