---
status: planned
---

# Instruction: Porter le statut d'application dans les trois sorties

## Architecture projection

```txt
.
├── mcp/
│   ├── tools.ts        ✏️ `statut_application` sur `Passage`, `ArticleTrouve`, `DecisionTrouvee`
│   └── server.ts       ✏️ descriptions des trois outils
├── tests/
│   ├── mcp.test.ts     ✏️ champ présent et exact, descriptions, article abrogé
│   └── statut.test.ts  ✏️ (phase 1)
└── aidd_docs/memory/   ✏️ architecture, codebase-map, testing + README.md
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Happy path | `get_article` sur l'article 3 du RGPD | `statut_application: "en_vigueur"`, `statut: "en_vigueur"` | system |
| Happy path | `get_article` sur un article LIL | `statut_application: "en_vigueur"`, `statut: "VIGUEUR"` | system |
| Happy path | `get_decision` sur une sanction CNIL | `statut_application: "rendue"`, `statut` source intact | system |
| Happy path | `search` sur la CJUE et sur le CEPD | `rendue` et `adoptee` sur chaque passage | system |
| Edge case | `get_article` sur une unité `ABROGE` d'un corpus temporaire | `statut_application: "abroge"`, `date_fin` rendue, `statut` source `ABROGE` | system |
| Edge case | `get_article` introuvable | aucun `statut_application` inventé sur la réponse d'absence | system |
| Teardown | racine temporaire supprimée | aucun fichier résiduel | system |

## Tasks to do

### `1)` Ajouter le champ aux trois réponses

1. `mcp/tools.ts` : `Passage = ResultatRecherche & { similarite: number; statut_application: StatutApplication; citations?: CitationRendue[] }` ; `ArticleTrouve = Unite & { trouve: true; statut_application: StatutApplication }` ; `DecisionTrouvee.statut_application: StatutApplication`.
2. Une seule fonction de composition, par exemple `avecStatutApplication(unite)`, appliquée là où `Unite` devient réponse : `passageExact`, les passages de `search`, `getArticle`, chaque décision de `getDecision`.
3. La réponse d'absence (`trouve: false`) ne porte pas le champ.
4. Ne pas toucher `Unite`, ni `ResultatRecherche`, ni l'index.

### `2)` Décrire et tester

1. `mcp/server.ts` : les descriptions de `search`, `get_article` et `get_decision` nomment `statut_application`, ses valeurs, et disent qu'un texte abrogé ou proposé n'est jamais applicable et que `statut` reste la valeur de la source.
2. `tests/mcp.test.ts` : asserter le champ sur un article RGPD, un article LIL, une décision CNIL, un passage CJUE et un passage CEPD ; asserter que `statut` source n'est pas réécrit ; asserter les descriptions.
3. Test de l'article abrogé sur une racine temporaire, avec `ABROGE` et une `date_fin`.
4. Mettre à jour `README.md` (réponses des outils), `aidd_docs/memory/architecture.md`, `codebase-map.md` et `testing.md`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1... | les trois sorties portent `statut_application` avec les valeurs du contrat ; une sortie d'absence n'en porte pas |
| 1... | `statut` garde sa valeur source sur les trois sorties |
| 2... | l'article abrogé rend `abroge` et ses dates, sans réécriture |
| 2... | les descriptions nomment le champ et l'interdit d'applicabilité ; `tests/mcp.test.ts` les asserte |
| 2... | `npm run typecheck`, `npm test` et `npm run build` passent |
