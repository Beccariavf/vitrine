---
status: in-progress
---

# Instruction: Application et veille

## Architecture projection

```txt
.
├── aidd_docs/
│   └── memory/
│       └── design.md ✏
└── src/
    ├── pages/
    │   ├── index.astro ✏
    │   └── veille/
    │       └── index.astro ✏
    └── styles/
        └── global.css ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | `npm run build` puis lancer la preview | Les pages répondent | cli |
| Happy path   | Ouvrir `/` | La variante retenue s'affiche, sans route concurrente | browser |
| Happy path   | Ouvrir `/veille` | Dix entrées, titres, dates, sources et résumés | browser |
| Edge case    | Chercher l'entrée FNAC | Résumé absent, titre, date et source présents | browser |
| Edge case    | Réduire à 375 px et tabuler | Aucun débordement, focus visible | browser |
| Edge case    | Inspecter le HTML livré | Aucune balise `<script>` client | browser |
| Teardown     | Demander `/variante-b` | Réponse 404 | cli |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ · DROIT DU NUMÉRIQUE                 VEILLE     │
├──────────────────────────────────────────────────────────────┤
│ (2) VEILLE_ · 10 ACTUALITÉS · DERNIÈRE PUBLICATION           │
├──────────────────────────────────────────────────────────────┤
│ (3) VUE / CORPUS — 10 CELLULES CLIQUABLES, 5 × 2             │
│     [13][14][15][16][16][16][19][20][22][29]                 │
├──────┬───────────────────────────────────────────────────────┤
│ (4)  │ (5) TITRE DE L'ACTUALITÉ                              │
│ 29   │ RÉSUMÉ SUR DEUX LIGNES                                │
│ OCT. │ CNIL                                                  │
├──────┼───────────────────────────────────────────────────────┤
│ (6)  │ ...                                                   │
├──────┴───────────────────────────────────────────────────────┤
│ (7) PIED                                                     │
└──────────────────────────────────────────────────────────────┘
```

1. En-tête commun, navigation rappelant la section courante.
2. Bandeau de tête : compte réel, dernière publication.
3. Grille du corpus : une cellule par entrée, dans l'ordre chronologique, couleur de façade, chaque cellule renvoie à sa ligne.
4. Colonne date en mono, deux lignes maximum.
5. Titre cliquable, résumé non redondant, source.
6. Rangées suivantes, séparées par un filet.
7. Pied commun.

## Tasks to do

### `1)` Appliquer la variante retenue

> Une seule page d'accueil reste.

1. Reporter le markup et les styles de la variante retenue dans `src/pages/index.astro`.
2. Supprimer `src/pages/variante-b.astro`.
3. Vérifier que les chiffres et le bloc pipeline restent calculés depuis les données.

### `2)` Refaire la page de veille

> Un registre lisible, pas un tableau administratif.

1. Porter l'en-tête en `VEILLE_`, avec le compte réel et la dernière publication.
2. Ajouter la grille `VUE / CORPUS` : une cellule par entrée, ordre chronologique, couleurs alternées, lien vers la ligne et `aria-label`.
3. Numéroter les rangées antéchronologiques et garder la date en colonne, en mono.
4. Garder le titre cliquable, le résumé sur deux lignes et le label de source.
5. Conserver `isRedundantSummary` : l'entrée FNAC perd son résumé, pas sa place.
6. Survol de rangée discret, sans changer la couleur du texte.

### `3)` Vérifier le responsive et le focus

> 375 px n'est pas une option.

1. Contrôler l'accueil et la veille à 375, 768 et 1280 px.
2. Supprimer tout débordement horizontal.
3. Vérifier le focus clavier sur la navigation, le CTA et chaque titre.
4. Vérifier les contrastes des aplats rouge, bleu et jaune.

### `4)` Mettre la mémoire à jour

> La décision visuelle doit survivre à la session.

1. Réécrire `aidd_docs/memory/design.md` avec la palette, la typographie, les formes et la règle 80/20.
2. Recalculer les contrastes AA de la nouvelle palette et les consigner.
3. Y consigner le motif retenu et ce qu'on a écarté de la référence.

### `5)` Passer la porte complète

> La même porte qu'en local et en CI.

1. Lancer `npm run typecheck`, `npm test`, `npm run build`.
2. Capturer l'accueil et la veille finales en 1280 px et 375 px.
3. Vérifier que le HTML livré ne contient aucun script client.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une seule page d'accueil est servie ; `/variante-b` renvoie 404. |
| 2 | La veille affiche les dix entrées avec leur lien source ; le résumé FNAC reste masqué. |
| 3 | Aucun débordement à 375 px et le focus reste visible sur chaque élément interactif. |
| 4 | `design.md` nomme la palette, les polices, les formes, la règle 80/20 et les contrastes recalculés. |
| 5 | Typecheck, tests et build passent ; aucune balise `<script>` dans le HTML livré. |
