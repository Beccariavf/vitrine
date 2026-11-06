---
objective: "Un jeu CNIL de 50 questions qui visent un document précis, réparties 25 dev et 25 test, écrites contre le corpus et vérifiées avant mesure ; le test ne se mesure qu'une fois avec les seuils du produit, et le résultat vit dans un rapport CNIL séparé."
status: completed
---

# Plan: Jeu CNIL v2

Source: `aidd_docs/tasks/2026_11/2026_11_05_corpus-cnil/eval-cnil.md` (limite « 20 questions ne classent pas le corpus »).

## Phases

| #   | Phase                         | File                         | Depends on |
| --- | ----------------------------- | ---------------------------- | ---------- |
| 1   | Écrire et valider le jeu     | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Mesurer dev puis test une fois | [`phase-2.md`](./phase-2.md) | 1          |

## Contrat

- 50 questions, toutes de type `reference`, toutes vers un document entier (`CNILTEXT…` sans `#`), 25 `dev` et 25 `test`.
- Chaque question est répondue par son document cible et ne cite ni l'identifiant `CNILTEXT…`, ni le numéro `SAN-…`, ni un numéro d'article : ces trois formes donneraient un succès de recherche lexicale ou le court-circuit déterministe.
- Aucune question ne réutilise le texte des jeux v1, v2, v3, AI Act ou du jeu CNIL de 20 questions.
- Aucun seuil n'est calibré sur ce jeu : `dev` et `test` sont mesurés avec les seuils du produit (`0,69 / 0,74 / 0,01`). Le jeu mesure la recherche, pas la bande de confiance.
- `test` est mesuré une seule fois, avec `--mesurer-test`, et laisse un marqueur commité.

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| regression | Un jeu de plus ne touche ni l'index ni le serveur ; seuls `mcp/eval/` et `tests/eval.test.ts` changent. | 1 |
| statistics | 25 questions test donnent un intervalle de Wilson utile, là où 18 questions sémantiques donnaient 34–75 %. | 2 |
| documentation | Le rapport CNIL de 20 questions reste intact ; le nouveau résultat a son propre fichier. | 2 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Chaque question est vérifiée contre le texte du document cible. | Une question mal ciblée mesure le jeu, pas la recherche. |
| Le test ne se mesure qu'une fois, après vérification factuelle de chaque prémisse. | Un jeu de test retouché après mesure ne mesure plus rien ; une prémisse fausse mesure le jeu, pas la recherche. |
| Un split de test invalidé par une prémisse fausse est remplacé, pas remesuré ; l'ancien est archivé. | Remesurer les mêmes questions après avoir vu leur score serait un ajustement ; un split neuf sur des documents disjoints reste une mesure tenue à l'écart du produit, et le rapport dit qu'il n'est pas préenregistré. |
| Aucun seuil n'est réglé sur ce jeu. | Le but est le rappel documentaire, pas d'inventer une bande CNIL. |
| Aucun rapport existant n'est réécrit. | Les scores de corpus et de jeux différents ne se comparent pas. |
