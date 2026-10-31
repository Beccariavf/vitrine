---
status: completed
---

# Instruction: Matières et contrat

## Architecture projection

```txt
.
├── package.json ✏
├── veille/
│   ├── main.ts ✏
│   ├── themes.ts ✅
│   ├── themes.json ✅
│   ├── types.ts ✏
│   ├── backfill.ts ✅
│   ├── write.ts ✏
│   ├── tags.ts ❌
│   ├── tags.json ❌
│   └── sources/
│       ├── cnil.ts ✏
│       └── cjeu.ts ✏
├── src/
│   ├── layouts/
│   │   └── Base.astro ✏
│   ├── lib/
│   │   ├── entries.ts ✏
│   │   └── sources.ts ✏
│   └── pages/
│       ├── index.astro ✏
│       └── veille/
│           └── index.astro ✏
├── tools/
│   ├── parametres.html ✏
│   └── README.md ✏
├── tests/
│   ├── themes.test.ts ✅
│   ├── tags.test.ts ❌
│   ├── cjeu.test.ts ✏
│   ├── entries.test.ts ✏
│   └── write.test.ts ✏
└── data/
    └── entries/ ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Lire `veille/themes.json` et les 11 entrées committées | Quatre matières, onze entrées sans `themes` | cli |
| Happy path   | Lancer `npm run backfill` | Chaque entrée porte au moins une matière ; aucune autre valeur ne change | cli |
| Happy path   | Lancer `npm run veille` sur les fixtures CNIL et CJUE | Une actualité IA CNIL porte données personnelles et IA ; Jautiva porte données personnelles | cli |
| Edge case    | Désactiver une matière puis `npm run build` | Les entrées de cette matière ne sont plus rendues, les fichiers restent | cli |
| Edge case    | Lire une entrée sans `themes` | Le lecteur lève une erreur nommée | cli |
| Teardown     | `npm run typecheck`, `npm test`, `npm run build` | Tout passe, les pages ne livrent aucun script | cli |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ · DROIT DU NUMÉRIQUE                 VEILLE     │
├──────────────────────────────────────────────────────────────┤
│ (2) VEILLE_ · SOURCES · N PUBLICATIONS                       │
│     MATIÈRES ACTIVES : DONNÉES PERSONNELLES · IA · ...       │
├──────────────────────────────────────────────────────────────┤
│ (3) MATIÈRES                                                 │
│     ┌────────────────┐ ┌────────────────┐                    │
│     │ DONNÉES PERSO. │ │ IA             │                    │
│     │ TEXTES · SOURCES│ │ TEXTES · SOURCES│                   │
│     └────────────────┘ └────────────────┘                    │
├──────────────────────────────────────────────────────────────┤
│ (4) PUBLICATION 29 OCT. · CNIL · [DONNÉES PERSONNELLES] [IA] │
│     TITRE / RÉSUMÉ / RÉFÉRENCES / LIRE                       │
├──────────────────────────────────────────────────────────────┤
│ (5) PIED : SOURCES · ATTRIBUTIONS                            │
└──────────────────────────────────────────────────────────────┘
```

1. En-tête commun, navigation.
2. Tête de veille : sources réelles, compte des publications visibles, matières actives.
3. Bloc matières : une carte par matière active, avec textes couverts et sources.
4. Publication : titre, résumé, références, matière(s) et source.
5. Pied : sources et attributions.

## Tasks to do

### `1)` Poser le contrat et le catalogue

> Une matière est une sélection ; elle porte ses textes et ses sources, et chaque entrée dit à quelle matière elle appartient.

1. Ajouter `themes: string[]` au type `Entry` et aux champs obligatoires du lecteur `src/lib/entries.ts` ; refuser un tableau vide, un champ absent ou un élément vide.
2. Créer `veille/themes.json` avec les quatre matières, leurs instruments canoniques, leurs termes de repli, leurs sources affichables et un booléen `active`.
3. Créer `veille/themes.ts` : lecture et validation du catalogue, matières actives, correspondance par instrument puis par termes, défauts par source, `themesForEntry`, `assignThemes`, `visibleEntries`.
4. Supprimer `veille/tags.ts`, `veille/tags.json` et `tests/tags.test.ts` ; remplacer leurs tests par `tests/themes.test.ts`.
5. Couvrir : CNIL IA → données personnelles + IA, Jautiva → données personnelles, arrêt hors matière rejeté, faux positif « droit d'accès à un avocat » rejeté, catalogue invalide refusé.

### `2)` Brancher le pipeline sur les matières

> CNIL et CJUE produisent des entrées ; le pipeline les rattache et n'écrit que celles qui ont une matière.

1. Dans `veille/main.ts`, remplacer l'option `tags` par `themes`, lire `themes.json` par défaut et passer les matières au rattachement ; dans `veille/sources/cnil.ts`, écrire `themes: []`, le rattachement restant central.
2. Retirer le filtre par tags de `veille/sources/cjeu.ts` : parser tous les arrêts, dédupliquer `_SUM`/`_RES`, puis laisser le rattachement décider.
3. Dans `run`, enrichir les références CNIL avant le rattachement, appeler `assignThemes` par source, écrire seulement les entrées qui portent au moins une matière, et conserver le snapshot brut même sans entrée retenue.
4. Supprimer la purge `pruneSourceEntries` et son usage : le site filtre au build, les fichiers restent.
5. Adapter les tests de `tests/write.test.ts` et `tests/cjeu.test.ts` : matières au lieu de tags, entrée sans matière non écrite, matière désactivée masquée sans suppression.

### `3)` Migrer les données existantes

> Les onze entrées committées doivent porter leurs matières avant que le site ne les lise.

1. Créer `veille/backfill.ts` : lire toutes les entrées de `data/entries`, calculer leurs matières avec le même rattachement, réécrire via `writeEntries`.
2. Ajouter `"backfill": "node veille/backfill.ts"` à `package.json`.
3. Lancer le backfill et vérifier que chaque entrée porte au moins une matière et que les autres champs sont inchangés.
4. Mettre à jour `tests/entries.test.ts` : neuf champs, `themes` non vide, `getVisibleEntries` masque les matières inactives.

### `4)` Afficher et sélectionner les matières

> Le propriétaire choisit ; le visiteur lit la sélection et voit à quelle matière chaque publication appartient.

1. Dans `src/pages/veille/index.astro`, lire les matières actives, filtrer les entrées visibles, afficher le bloc matières (textes et sources) et un badge de matière sur chaque carte et chaque ligne.
2. Dans `src/pages/index.astro`, compter les publications et les sources visibles et remplacer la copie « CNIL et CJUE » par les sources réelles.
3. Dans `src/layouts/Base.astro` et `src/lib/sources.ts`, ajouter les libellés et les attributions des nouvelles sources.
4. Réécrire `tools/parametres.html` et `tools/README.md` pour `themes.json` : quatre matières, seules les cases changent, validation des champs.
5. Vérifier le rendu en 1280 px et 375 px, l'absence de `<script>` public et l'absence de débordement.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `Entry` porte `themes` ; le catalogue contient quatre matières ; une actualité CNIL sur l'IA relève des deux matières ; un arrêt hors matière et le faux positif avocat sont rejetés ; un catalogue invalide lève. |
| 2 | Une entrée sans matière n'est pas écrite ; Jautiva est écrit avec données personnelles ; une matière désactivée ne supprime aucun fichier ; une panne d'une source laisse les autres écritures. |
| 3 | Les onze entrées portent au moins une matière ; le backfill est idempotent ; le lecteur refuse une entrée sans `themes` ; les matières inactives sont masquées. |
| 4 | Le sélecteur de matières masque les publications décochées ; la phrase explique le geste ; chaque publication affiche ses matières et sa source ; l'outil local ne change que les cases ; les pages restent sans JavaScript. |
