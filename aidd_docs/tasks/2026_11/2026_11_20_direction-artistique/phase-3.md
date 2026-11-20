---
status: pending
---

# Instruction: Accueil

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    ├── components/
    │   ├── ✏️ Demo.astro
    │   └── ✏️ Facade.astro
    └── pages/
        └── ✏️ index.astro
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `npm run dev`, sans `src/demo/demo.json` (état actuel) | l'accueil se charge | browser |
| Happy path   | Ouvrir `/` à 1 440 px | hero centré en grand serif, deux boutons en pilule, manifeste, deux rangées alternées, dernières publications | browser |
| Happy path   | Ouvrir `/` à 375 px | rangées empilées visuel puis texte, aucun défilement horizontal | browser |
| Happy path   | Chargement de la page | le hero monte en fondu une fois, en CSS seul | browser |
| Edge case    | `prefers-reduced-motion: reduce` | aucune animation | browser |
| Edge case    | `demo.json` absent | aucune zone de démo vide | browser |
| Edge case    | Aucune publication avec référence | la rangée « Chaque affirmation se vérifie » est omise | system |
| Edge case    | Aucune collection | la rangée façade est omise | system |
| Edge case    | Système en sombre | toutes les sections lisibles, façade et pastilles visibles | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────┐
│ (1)        • Connecteur en préparation                │
│        Une IA juridique qui cite ses sources.         │
│              chapeau en encre douce                   │
│        ( Découvrir le connecteur → ) ( Veille )       │
│ (2)   ┌──────────── démo compacte ─────────────┐     │
│       └────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────┤
│ (3)   Manifeste en grand serif, pastilles en ligne   │
├──────────────────────────────────────────────────────┤
│ (4) ┌──────────┐   Titre court                       │
│     │ façade   │   deux lignes                       │
│     └──────────┘   Dates par collection →            │
│ (5)   Titre court                    ┌──────────┐    │
│       deux lignes                    │ références│    │
│       Comment ça marche →            └──────────┘    │
├──────────────────────────────────────────────────────┤
│ (6) Dernières publications            Toute la veille →│
│     date · • source · titre                           │
└──────────────────────────────────────────────────────┘
```

1. Hero : surtitre à pastille, `h1` serif, chapeau, action pleine vers `/connecteur`, action voile vers `/veille`.
2. Démo compacte, seulement si `demo.json` existe.
3. Manifeste : une phrase en serif, CNIL, RGPD, CJUE en pastilles de famille (noms, jamais de logos).
4. Rangée façade : la façade du corpus dans une surface arrondie, lien vers `/connecteur#couverture`.
5. Rangée vérification : références réelles des dernières publications en pastilles sur un visuel accent, lien vers `/connecteur`.
6. Dernières publications : trois `PublicationRangee` compactes.

## Tasks to do

### `1)` Hero et démo

> La promesse, centrée, en grand serif.

1. `index.astro` : hero du wireframe ; texte du chapeau actuel conservé ; animation `@keyframes` de montée en fondu sur les enfants du hero, coupée par `prefers-reduced-motion`.
2. `Demo.astro` : surface arrondie, question en pilule blanche à ombre douce, sources en pastilles à filet, libellés Inter ; plus de filet rouge ni mono ; variante complète en deux colonnes conservée.

### `2)` Manifeste

> L'idée forte, une fois.

1. Phrase de `planche.html` en `--font-serif` clamp(2rem, 5.2vw, 4rem), pastilles en ligne avec la couleur de leur famille.

### `3)` Rangées alternées

> Visuel arrondi, titre court, deux lignes, un lien.

1. Rangée façade : `Facade` dans `surface` arrondie ; omise sans collection.
2. `Facade.astro` : colonnes arrondies en haut, aplats de famille, étages en loggia sur `surface` sans cadre encre ; `etagesFacade`, `aria-label`, libellés et volumes inchangés, en Inter `tabular-nums`.
3. Rangée vérification : jusqu'à trois `referenceLabel` uniques tirés des publications affichées ; omise s'il n'y en a aucune.
4. Grille deux colonnes au-dessus de 760 px, visuel une fois à gauche, une fois à droite ; empilées dessous.

### `4)` Dernières publications

> Lecture rapide.

1. Titre de section en Inter 40/500, lien « Toute la veille », liste à filets fins.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Hero conforme au wireframe à 375 et 1 440 px ; fondu visible au chargement, absent en mouvement réduit ; sans démo, aucun emplacement vide |
| 2 | Manifeste lisible en clair et en sombre, pastilles suivies de leur nom |
| 3 | Rangées alternées à 1 440 px, empilées à 375 px ; façade : mêmes hauteurs relatives et même `aria-label` qu'avant |
| 4 | Trois publications, chacune avec date, pastille, source et titre lié en nouvel onglet |
