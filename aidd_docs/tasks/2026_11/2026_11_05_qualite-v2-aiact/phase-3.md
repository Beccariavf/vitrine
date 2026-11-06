---
status: completed
---

# Instruction: Corpus AI Act

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ corpus/
│       ├── ✅ aiact.json
│       ├── ✏ parse.ts
│       └── ✏ build.ts
├── ✅ tests/
│   ├── ✏ corpus.test.ts
│   └── ✅ fixtures/
│       └── ✅ eurlex/
│           └── ✅ aiact.xhtml
└── ✅ data/
    └── ✅ corpus/
        └── ✅ aiact/
            ├── ✅ manifest.json
            └── ✅ unites.jsonl
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Écrire la capture AI Act dans `tests/fixtures/eurlex/aiact.xhtml` | 113 ancres `art_N`, 180 `rct_N` | cli |
| Happy path   | Parser la capture avec son descripteur | 113 articles et 180 considérants, article 1 non vide | cli |
| Happy path   | Rejouer le parseur sur le RGPD | Toujours 99 articles et 173 considérants | cli |
| Edge case    | Un descripteur au compte faux | Le parseur lève en nommant le document | cli |
| Edge case    | `--document aiact` | Seul l'AI Act est construit | cli |
| Teardown     | Relancer la construction | Les deux corpus sont identiques aux octets près | cli |

## Tasks to do

### `1)` Décrire le corpus

> Un descripteur, aucun code spécial.

1. Créer `mcp/corpus/aiact.json` : `document` `32024R1689`, nom `AI Act`, titre officiel, `langue` `fra`, URL EUR-Lex, licence, `date_acte` `2024-06-13`, `date_publication` `2024-07-12`, `date_debut` `2024-08-01`, `articles_attendus` 113, `considerants_attendus` 180.
2. Ajouter les mêmes comptes au descripteur RGPD (`rgpd.json`).
3. Vérifier que le champ `nom` du descripteur remplace le libellé `RGPD` codé en dur dans le chemin.

### `2)` Généraliser le parseur

> Une seule structure ELI, deux documents.

1. Renommer `parseRgpd` en `parseCellar(xhtml, descripteur)` ; garder `parseRgpd` comme enveloppe si les tests existants l'importent.
2. Lire `nom`, `articles_attendus` et `considerants_attendus` dans le descripteur.
3. Construire le chemin avec `nom` et le chapitre.
4. Lever si les comptes ne correspondent pas, en nommant le document et le compte attendu.

### `3)` Construire tous les descripteurs

> La commande suit le dossier, pas une liste.

1. Faire lire `mcp/corpus/*.json` par `mcp/corpus/build.ts`.
2. Ajouter `--document <id>` pour n'en construire qu'un.
3. Écrire `data/corpus/<document>/manifest.json` et `unites.jsonl` pour chacun.
4. Garder les écritures idempotentes.

### `4)` Verrouiller par les tests

> Les deux corpus se testent ensemble.

1. Vérifier 113 articles et 180 considérants pour l'AI Act, article 1 non vide et chapitre I.
2. Vérifier 99/173 pour le RGPD après généralisation.
3. Vérifier qu'un descripteur au compte faux lève.
4. Lancer `npm test` et `npm run typecheck`.

### `5)` Construire et indexer pour de vrai

> Le corpus et l'index doivent exister.

1. Lancer `npm run corpus:build -- --document aiact`.
2. Lancer `npm run corpus:index` et vérifier que l'AI Act entre dans l'index avec le même modèle.
3. Vérifier `git status` : corpus commité, index ignoré.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Le descripteur AI Act porte les trois dates, les comptes 113/180 et un `nom` utilisé dans le chemin. |
| 2 | `parseCellar` rend 113/180 pour l'AI Act et 99/173 pour le RGPD ; un compte faux lève en nommant le document. |
| 3 | `npm run corpus:build` construit les deux corpus ; `--document aiact` n'en construit qu'un, de façon idempotente. |
| 4 | Les tests couvrent les deux corpus et le compte faux ; `npm test` et `npm run typecheck` passent. |
| 5 | `data/corpus/aiact/` et son entrée d'index existent ; l'index reste ignoré par git. |
