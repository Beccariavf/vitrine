---
status: completed
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
Vue grille (par défaut)
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ · DROIT DU NUMÉRIQUE                 VEILLE     │
├──────────────────────────────────────────────────────────────┤
│ (2) VEILLE_ · 10 ACTUALITÉS · DERNIÈRE PUBLICATION           │
├──────────────────────────────────────────────────────────────┤
│ (3) AFFICHAGE                               [GRILLE] [LISTE] │
├──────────────────┬──────────────────┬────────────────────────┤
│ (4) 29 OCT.      │ (5) 22 OCT.      │ (6) 20 OCT.            │
│ TITRE            │ TITRE            │ TITRE                  │
│ RÉSUMÉ           │ RÉSUMÉ           │ RÉSUMÉ                 │
│ LIRE             │ LIRE             │ LIRE                   │
├──────────────────┴──────────────────┴────────────────────────┤
│ (7) rangées suivantes, en-têtes rouge/bleu/jaune/béton        │
├──────────────────────────────────────────────────────────────┤
│ (8) PIED                                                     │
└──────────────────────────────────────────────────────────────┘

Vue liste
┌──────────────────────────────────────────────────────────────┐
│ (3) AFFICHAGE                               [GRILLE] [LISTE] │
├──────┬───────────────────────────────────────────────────────┤
│ (9)  │ (10) TITRE · RÉSUMÉ · SOURCE                          │
├──────┼───────────────────────────────────────────────────────┤
│ (11) │ ...                                                   │
└──────┴───────────────────────────────────────────────────────┘
```

1. En-tête commun, navigation rappelant la section courante.
2. Bandeau de tête : compte réel, dernière publication.
3. Bascule grille / liste en CSS pur, grille par défaut.
4. Carte : en-tête coloré avec le jour, le mois et la source ; corps papier avec titre, résumé et « Lire ».
5. Carte suivante, teinte différente.
6. Carte suivante, teinte différente.
7. Rangées suivantes, cycle rouge / bleu / jaune / béton.
8. Pied commun.
9. Colonne date en mono, deux lignes maximum.
10. Titre cliquable, résumé non redondant, source.
11. Rangées suivantes ; la liste reste centrée à 56rem.

## Tasks to do

### `1)` Appliquer la variante retenue

> Une seule page d'accueil reste.

1. Reporter le markup et les styles de la variante retenue dans `src/pages/index.astro`.
2. Supprimer `src/pages/variante-b.astro`.
3. Vérifier que les chiffres et le bloc pipeline restent calculés depuis les données.

### `2)` Refaire la page de veille

> Un registre lisible, pas un tableau administratif.

1. Porter l'en-tête en `VEILLE_`, avec le compte réel et la dernière publication.
2. Ajouter la bascule grille / liste sans JavaScript (radios et CSS), grille par défaut.
3. Dessiner la grille : trois colonnes, une carte par entrée, en-tête coloré sur un cycle rouge / bleu / jaune / béton, corps papier avec titre, résumé et lien.
4. Centrer la liste à 56rem, numérotée antéchronologique, avec date en colonne, titre, résumé et source.
5. Conserver `isRedundantSummary` : l'entrée FNAC perd son résumé, pas sa place.
6. Survol de carte et de rangée discret, sans changer la couleur du texte courant.

### `3)` Vérifier le responsive et le focus

> 375 px n'est pas une option.

1. Contrôler l'accueil et la veille à 375, 768 et 1280 px.
2. Supprimer tout débordement horizontal.
3. Vérifier le focus clavier sur la navigation, le CTA et chaque titre.
4. Vérifier les contrastes des en-têtes rouge, bleu, jaune et béton, et du corps papier.

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
| 2 | La bascule grille / liste fonctionne sans JavaScript ; la grille affiche dix cartes et la liste centrée les dix entrées ; le résumé FNAC reste masqué. |
| 3 | Aucun débordement à 375 px et le focus reste visible sur chaque élément interactif. |
| 4 | `design.md` nomme la palette, les polices, les formes, la règle 80/20 et les contrastes recalculés. |
| 5 | Typecheck, tests et build passent ; aucune balise `<script>` dans le HTML livré. |
