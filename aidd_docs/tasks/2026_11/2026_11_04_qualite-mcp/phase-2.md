---
status: completed
---

# Instruction: Articles prioritaires

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✅ index/
│   │   └── ✏ search.ts
│   └── ✏ tools.ts
├── ✅ tests/
│   └── ✏ mcp.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_04_qualite-mcp/
                └── ✅ eval.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire un index factice avec un article et un considérant proches | Les deux passages sont présents | cli |
| Happy path   | Considérant à 0,80 et article à 0,79 | L'article passe devant | cli |
| Happy path   | Considérant à 0,90 et article à 0,70 | Le considérant reste devant | cli |
| Edge case    | Deux articles proches | L'ordre de similarité est conservé | cli |
| Edge case    | Un considérant sans article comparable | Il reste rendu, étiqueté `considerant` | cli |
| Teardown     | Relancer la recherche | Le résultat est identique, sans état | cli |

## Tasks to do

### `1)` Nommer la préférence

> Une bande, pas une exclusion.

1. Ajouter `BANDE_ARTICLE = 0.02` dans `mcp/index/search.ts`, exprimée en similarité.
2. Calculer un score de classement : similarité brute, plus `BANDE_ARTICLE` pour un `niveau` `article`.
3. Trier sur ce score, rendre la similarité brute inchangée.
4. Documenter que la bande est mesurée sur les questions de développement, et que 0,02 est retenue pour rester minimale.

### `2)` Étiqueter dans l'outil

> Le lecteur voit ce qu'il cite.

1. Vérifier que chaque passage rend `niveau`, `numero` et `chemin`.
2. Ajouter dans la description de `search` que l'article pose la règle et le considérant l'éclaire.
3. Ne jamais retirer un considérant du résultat : il reste disponible après les articles.

### `3)` Mesurer sur le développement

> La préférence doit améliorer le top 1 sans dégrader le top 5.

1. Rejouer `npm run mcp:eval -- --split dev` et comparer top 1, top 5 et MRR.
2. Conserver la bande si le top 1 progresse sans perte de top 5 ; sinon la réduire ou la retirer.
3. Noter les chiffres avant et après dans `eval.md`.

### `4)` Verrouiller par les tests

> Des résultats synthétiques suffisent.

1. Écrire les cas 0,80/0,79 et 0,90/0,70 dans `tests/mcp.test.ts`.
2. Vérifier que la similarité rendue reste la valeur brute.
3. Vérifier l'ordre stable entre deux articles.
4. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Un article à 0,79 passe devant un considérant à 0,80 ; un considérant à 0,90 reste devant un article à 0,70. |
| 2 | Chaque passage porte `niveau` et `numero` ; aucun considérant n'est supprimé. |
| 3 | Le rapport `dev` donne le top 1, le top 5 et le MRR avant et après, et la bande retenue. |
| 4 | Les tests couvrent les deux cas de bande et l'ordre stable ; `npm test` et `npm run typecheck` passent. |
