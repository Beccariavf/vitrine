---
status: completed
---

# Instruction: Corpus explicite dans le schéma

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✅ corpus/
│   │   └── ✏ parse.ts
│   ├── ✅ index/
│   │   ├── ✏ build.ts
│   │   └── ✏ search.ts
│   ├── ✏ tools.ts
│   └── ✅ eval/
│       └── ✏ run.ts
├── ✅ tests/
│   ├── ✏ corpus.test.ts
│   ├── ✏ index.test.ts
│   ├── ✏ mcp.test.ts
│   └── ✏ eval.test.ts
└── ✅ data/
    └── ✅ corpus/
        └── ✅ rgpd/
            └── ✏ unites.jsonl
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `unites.jsonl` d'un corpus existant | Chaque unité porte `corpus` | cli |
| Happy path   | Chercher avec `corpus: "rgpd"` | Seuls les fragments RGPD reviennent | cli |
| Happy path   | Chercher sans `corpus` | Tous les corpus répondent, comme avant | cli |
| Edge case    | Un index sans colonne `corpus` | Message explicite : reconstruire l'index | cli |
| Edge case    | `corpus` inconnu | Zéro résultat, jamais une erreur de SQL | cli |
| Teardown     | Rejouer `--split dev` du jeu v2 | Chiffres identiques à ceux publiés | cli |

## Tasks to do

### `1)` Nommer le corpus sur chaque unité

> Un acte, un document ; une collection, un corpus.

1. Ajouter `corpus: string` à `Unite` dans `mcp/corpus/parse.ts`, rempli depuis `descripteur.corpus`.
2. Regénérer `data/corpus/{rgpd,aiact}/unites.jsonl` : seuls les champs et les octets du texte comptent, l'ordre ne change pas.
3. Vérifier qu'aucun champ existant ne disparaît et que `ref` reste identique.

### `2)` Porter le corpus dans l'index et la recherche

> Le filtre change de niveau, pas de comportement.

1. Ajouter `corpus` à la table `unites` et au résultat de recherche.
2. Remplacer le filtre `document` de `searchIndex` et de `rechercheHybride` par un filtre `corpus`, en gardant `document` pour les usages exacts.
3. Refuser d'ouvrir un index dont la table `unites` n'a pas la colonne `corpus`, en nommant `npm run corpus:index`.
4. Exposer `corpus` dans `SearchDemande` et dans la branche exacte de `mcp/tools.ts`.

### `3)` Cadrer l'évaluation par corpus

> Les jeux existants ne doivent pas bouger.

1. Dériver le corpus d'une question du préfixe de ses références (`32016R0679` → `rgpd`, `32024R1689` → `aiact`, `CNILTEXT…` → `cnil`), ou d'une colonne `corpus` du CSV quand elle existe.
2. Refuser une question dont les références appartiennent à deux corpus.
3. Passer `corpus` au lieu de `document` dans la mesure.

### `4)` Vérifier la non-régression

> Une reconstruction qui change un chiffre est un défaut.

1. Reconstruire l'index (`npm run corpus:index`).
2. Rejouer `--questions questions-v2.csv --split dev` et `--questions questions-v3.csv --split dev` : les chiffres publiés doivent se reproduire exactement. Sinon, arrêter et rapporter.
3. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Chaque unité des deux corpus existants porte `corpus` ; `ref` et texte sont inchangés. |
| 2 | `search(corpus)` filtre par corpus ; sans corpus, le comportement est identique ; un index sans colonne rend un message actionnable. |
| 3 | Une question à références multi-corpus lève ; les jeux v1, v2 et v3 mesurent le même corpus qu'avant. |
| 4 | `dev` v2 et v3 reproduisent leurs chiffres publiés ; `npm test` et `npm run typecheck` passent. |
