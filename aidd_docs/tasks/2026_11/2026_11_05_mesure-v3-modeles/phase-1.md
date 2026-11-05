---
status: pending
---

# Instruction: Jeu RGPD v3

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       └── ✅ questions-v3.csv
├── ✅ tests/
│   └── ✏ eval.test.ts
└── ✅ aidd_docs/
    └── ✅ tasks/
        └── ✅ 2026_11/
            └── ✅ 2026_11_05_mesure-v3-modeles/
                └── ✅ eval-v3.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `questions-v3.csv` | 80 lignes, 40 `dev`, 40 `test`, 6 pièges | cli |
| Happy path   | Compter les types | 68 sémantiques, 6 références, 6 pièges | cli |
| Happy path   | Vérifier chaque `sources_attendues` | Chaque `ref` existe dans `unites.jsonl` | cli |
| Edge case    | Une question sans référence ni piège | Le parseur la classe sémantique, sans lever | cli |
| Edge case    | Un piège portant une référence existante | Refusé : un piège ne cite pas une source attendue | cli |
| Teardown     | Comparer au jeu v2 | Aucune ligne de `questions-v2.csv` n'est réutilisée | cli |

## Tasks to do

### `1)` Écrire quatre-vingts questions

> Tirées des articles, pas des échecs connus.

1. Créer `mcp/eval/questions-v3.csv` avec `question,type,sources_attendues,piege,split`.
2. Écrire 68 questions sémantiques (34 `dev`, 34 `test`), 6 références exactes (3/3) et 6 pièges (3/3).
3. Couvrir les 99 articles du RGPD : chaque question est relue contre le texte de l'article attendu ; viser une répartition sur les chapitres, sans reprendre les questions v1 et v2.
4. Vérifier que chaque `sources_attendues` existe dans `data/corpus/rgpd/unites.jsonl`.
5. Ne consulter aucun résultat du système pendant la rédaction : les questions ne doivent pas être choisies parce qu'elles échouent ou réussissent.

### `2)` Verrouiller par les tests

> Le CSV se teste sans modèle.

1. Vérifier 80 lignes, 40 `dev`, 40 `test`, 68 sémantiques, 6 références, 6 pièges.
2. Vérifier que chaque référence attendue existe et qu'aucune question ne mélange deux documents.
3. Vérifier qu'un piège ne porte pas de `sources_attendues`.
4. Lancer `npm test` et `npm run typecheck`.

### `3)` Ouvrir le rapport v3

> Un rapport neuf, indépendant des deux précédents.

1. Créer `eval-v3.md` : date, modèle, corpus, composition du jeu, et la mention que le test n'est pas encore mesuré.
2. Y recopier la règle de décision du plan, avant toute mesure.
3. Ne pas modifier `eval-v2.md` ni le rapport v1.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `questions-v3.csv` porte 80 lignes, 40 `dev`, 40 `test`, 68 sémantiques, 6 références, 6 pièges, et chaque référence existe. |
| 2 | Les tests couvrent les comptes, les références et les pièges ; `npm test` et `npm run typecheck` passent. |
| 3 | `eval-v3.md` existe, porte la composition et la règle de décision, et dit que le test n'est pas mesuré. |
