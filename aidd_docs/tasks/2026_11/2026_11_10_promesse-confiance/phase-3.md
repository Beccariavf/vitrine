---
status: completed
---

# Instruction: Coder la règle de confiance

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✏️ mcp/confidence.ts
├── ✏️ mcp/tools.ts
├── ✏️ mcp/eval/run.ts
├── ✏️ tests/mcp.test.ts
└── ✏️ tests/eval.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Résultats factices à similarités connues, corpus `cnil` | le niveau se calcule avec la table CNIL | cli |
| Happy path   | Premier passage au-dessus du seuil haut CNIL, marge suffisante | `confiant` | cli |
| Edge case    | Aucun résultat rendu, ou seuils fournis par l'appelant | le repli global s'applique sans lever ; des seuils fournis priment sur la table | cli |

## Tasks to do

### `1)` Porter la table dans `mcp/confidence.ts`

> Les valeurs de `promesse.md`, pas d'autres.

1. Remplacer les constantes uniques par une table `SEUILS_PAR_CORPUS` ne portant que la CNIL, ajustée en phase 2, chaque entrée avec `bas`, `haut` et `marge` — la forme actuelle, sans paramètre ajouté. Tout autre corpus suit le repli.
2. Garder `SEUIL_BAS`, `SEUIL_HAUT`, `MARGE` comme triplet de repli.
3. Écrire en tête du fichier ce que la promesse garantit, la borne qui la soutient, et ce qu'elle ne garantit pas.

### `2)` Choisir la table sur le corpus demandé

> La table suit ce que l'appel demande, jamais ce que les passages contiennent.

1. Ajouter `corpus?: string` aux options de `niveauConfiance`, avec cette précédence : seuils explicitement fournis par l'appelant (hors `--regle produit`), puis la table du corpus demandé, puis le repli global. Le corpus ne se lit jamais dans les passages : une recherche qui ne nomme qu'un document part avec une autre instruction de requête et un autre bassin.
2. Faire passer `corpus` depuis `search` quand `demande.corpus` est fourni ; sans lui, aucune table ne s'applique, même si les passages rendus appartiennent à un corpus connu.
3. Documenter la résolution en une phrase et laisser `exact: true` rendre `confiant` sans lire la table.

### `3)` Mesurer la règle qui part

> Le harnais applique souvent la sienne.

1. Ajouter `--regle produit` à `mcp/eval/run.ts` : `seuilsDeMesure` rend la table du corpus au lieu de calibrer ou de lire `--seuils`, les quatre sites de niveau reçoivent ces valeurs avec l'origine `table`, et le JSON les porte. C'est `seuilsDeMesure` qui décide d'où viennent les seuils, pas `niveauConfiance`.
2. Refuser `--regle produit` combiné à `--seuils`, en nommant le conflit.
3. Propager le corpus aux cinq endroits qui calculent un niveau (`refusee`, `calibrer`, `niveau`, `resume`, `entreeQuestionJson`), pour que le `niveau` par question du JSON soit celui du produit.
4. Laisser `calibrer` et `--seuils` inchangés : ils restent l'outil d'expérience.

### `4)` Verrouiller par des tests

> Chaque valeur de la table est vérifiée sur une frontière.

1. `tests/mcp.test.ts` : table appliquée quand le corpus est demandé, repli sans corpus, repli sur corpus inconnu, seuils fournis par l'appelant prioritaires, frontières `bas`/`haut`, marge, `exact` inchangé.
2. `tests/eval.test.ts` : `--regle produit` applique la table et porte l'origine, `--seuils` simultané est refusé en le nommant, et une mesure `dev` conserve les mêmes `refs` qu'avant.
3. Un test qui lit `promesse.md` et compare les constantes du code aux valeurs écrites.
4. `npm test` et `npm run typecheck` verts.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | la table porte la CNIL avec `bas`, `haut`, `marge`, et le repli couvre explicitement les autres corpus |
| 2 | une même similarité donne `confiant` avec `corpus: cnil` et `incertain` sans corpus quand les tables diffèrent ; l'appelant peut forcer une valeur |
| 3 | `--regle produit` produit un JSON dont les `seuils` portent l'origine `table`, et la mesure `dev` rend les mêmes `refs` qu'avant |
| 4 | un test échoue si `mcp/confidence.ts` et `promesse.md` divergent |
