---
status: completed
---

# Instruction: Exposer le contrat au lecteur et au client

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✏️ mcp/server.ts
├── ✏️ README.md
├── ✏️ aidd_docs/memory/data.md
└── ✏️ aidd_docs/memory/testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `promesse.md` et `mesures/dev-apres.md` | les chiffres à publier sont connus | cli |
| Happy path   | Lire les instructions de `createServer` | la promesse y est dite avec son plafond | cli |
| Edge case    | Un corpus non mesuré | la promesse ne le couvre pas, et le texte le dit | cli |

## Tasks to do

### `1)` Dire la promesse au client MCP

> Le modèle qui lit ces instructions doit citer l'étiquette correctement.

1. Ajouter aux instructions de `mcp/server.ts` ce que `confiant` garantit, son plafond d'erreur là où il est démontré, et ce qu'il ne garantit pas.
2. Nommer les corpus couverts, le repli pour les autres, et le sous-ensemble doctrinal qui, bien que CNIL, n'est pas couvert par le plafond.
3. Garder le texte court : deux phrases, pas un rapport.

### `2)` Documenter côté dépôt

> Le README porte la même promesse, sans la déformer.

1. Mettre à jour la section du README qui décrit les niveaux de confiance.
2. Y citer le plafond et la couverture des corpus où ils sont mesurés, dire que les autres n'ont pas de promesse chiffrée, et renvoyer au rapport.
3. Corriger toute phrase devenue fausse sur les seuils uniques.

### `3)` Mettre la mémoire à jour

> Le prochain agent part de la règle réelle.

1. `aidd_docs/memory/data.md` : seuils par corpus, plafond, couverture, et la distinction entre promesse statistique et justesse par réponse.
2. `aidd_docs/memory/testing.md` : la commande `mcp/eval/risque.ts` et l'emplacement des mesures.
3. Signaler que la table est liée au couple (modèle, corpus) et qu'un changement d'embedder la recalibre.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | les instructions du serveur nomment le plafond et les corpus couverts, sans promesse non mesurée |
| 2 | le README dit la même chose que `promesse.md`, chiffres compris, et ne promet rien pour un corpus non mesuré |
| 3 | les deux mémoires portent la règle, la commande et la dépendance au couple (modèle, corpus) |
