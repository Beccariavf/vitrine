---
status: pending
---

# Instruction: Sortie JSON et marqueur par modèle

## Architecture projection

```txt
.
├── ✅ mcp/
│   └── ✅ eval/
│       └── ✏ run.ts
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
| Setup        | Lancer `--json` sans `--split test` | Un objet JSON parseable, une entrée par question | cli |
| Happy path   | Lire une entrée | `question`, `type`, `attendues`, `refs`, `rangs`, `niveaux` présents | cli |
| Happy path   | Lancer sans `--json` | La sortie texte est identique à aujourd'hui | cli |
| Edge case    | Mesurer `test` avec un modèle déjà présent dans le marqueur | Refusé, en nommant le modèle | cli |
| Edge case    | Mesurer `test` avec un second modèle pré-déclaré | Accepté, une seconde entrée est ajoutée | cli |
| Edge case    | Marqueur v2 à plat (sans `mesures`) | Refusé : le test v2 est consommé | cli |
| Teardown     | Relire le marqueur | Aucune mesure effacée | cli |

## Tasks to do

### `1)` Rendre chaque mesure lisible par une machine

> Le texte reste pour l'humain ; le JSON sert à comparer.

1. Ajouter `--json` à `mcp/eval/run.ts` : écrire sur `stdout` un objet `{date, modele, dimensions, split, document, recherche, seuils, questions:[...], agregats:{...}}`.
2. Chaque question porte : `question`, `type`, `piege`, `attendues`, `refs` (dans l'ordre rendu), `rangs` (rang de chaque référence attendue), `similarites`, `niveau`.
3. Garder la sortie texte par défaut, inchangée.
4. Refuser `--json` avec `--split all` : deux splits dans un seul objet rendraient la comparaison ambiguë.

### `2)` Compter une mesure par modèle

> Deux modèles pré-déclarés, pas deux passages du même.

1. Remplacer le marqueur à plat par `{questions_sha256, mesures:[{modele, dimensions, date, agregats}]}`.
2. Avant la mesure, refuser si une entrée porte déjà le même `modele` pour la même empreinte de questions, en nommant le modèle.
3. Après la mesure, ajouter l'entrée sans effacer les précédentes.
4. Refuser un marqueur à plat existant (format v2) : le test v2 est consommé, quel que soit le modèle.

### `3)` Verrouiller par les tests

> Les deux formats et les deux refus se testent hors ligne.

1. Tester l'ajout d'une mesure, le refus du même modèle, l'acceptation d'un second modèle.
2. Tester le refus d'un marqueur v2 à plat.
3. Tester la forme JSON : une entrée par question, rangs et niveaux alignés.
4. Vérifier que la sortie texte par défaut ne change pas.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `--json` rend un objet parseable avec une entrée par question et les agrégats ; la sortie texte par défaut est inchangée. |
| 2 | Le même modèle deux fois est refusé en le nommant ; un second modèle est accepté et ajouté ; un marqueur v2 est refusé. |
| 3 | Les tests couvrent les deux formats et les deux refus ; `npm test` et `npm run typecheck` passent. |
