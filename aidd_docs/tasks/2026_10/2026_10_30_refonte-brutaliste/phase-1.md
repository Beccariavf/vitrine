---
status: completed
---

# Instruction: Socle visuel

## Architecture projection

```txt
.
└── src/
    ├── layouts/
    │   └── Base.astro ✏
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
| Setup        | Lire `src/styles/global.css` et `src/layouts/Base.astro` | Jetons et coquille prêts à remplacer | cli |
| Happy path   | `npm run build` | Deux pages générées | cli |
| Edge case    | Ouvrir `/` et `/veille` à 375 px | Aucun débordement horizontal, textes lisibles | browser |
| Edge case    | Tabuler sur les liens | Focus visible, contraste suffisant | browser |
| Teardown     | Vérifier `data/` | Aucun fichier modifié | cli |

## Tasks to do

### `1)` Remplacer les jetons

> Une seule source de vérité pour la palette, les formes et les polices.

1. Dans `src/styles/global.css`, remplacer les couleurs par béton `#E7E2D7`, papier `#F4F0E8`, encre `#121212`, rouge `#C62828`, bleu `#1E4E79`, jaune `#E0A82E` et un gris de retrait lisible sur béton.
2. Ajouter les ombres dures `--shadow-hard` et `--shadow-hard-lg`.
3. Ramener tous les rayons de la thème à `0`.
4. Définir `--font-display`, `--font-sans` et `--font-mono` avec des polices système uniquement.

### `2)` Poser la typographie et les formes

> Le texte se lit, les titres pèsent, les angles restent vifs.

1. Titres en sans display, graisse 700, interlettrage serré, interligne court.
2. Corps en sans système, 16 px, interligne 1,6.
3. Labels, dates et chiffres en mono, majuscules, interlettrage large.
4. Supprimer Georgia et le serif ; aucun arrondi, aucune ombre floue, aucun dégradé, aucune animation hors survol.
5. Focus visible et sélection en encre ou rouge, contraste AA.

### `3)` Reconstruire la coquille

> Un cadre commun, sans largeur rigide imposée aux pages.

1. Dans `src/layouts/Base.astro`, passer l'en-tête en bandeau bordé de 2 px avec le wordmark `VITRINE_` en mono.
2. Garder la navigation et `aria-current="page"`.
3. Porter le pied de page en mono, avec les liens sources et dépôt.
4. Laisser chaque page choisir sa largeur de lecture dans un conteneur interne.

### `4)` Migrer les pages sans changer leur structure

> La palette change, la mise en page existante tient encore debout.

1. Dans `src/pages/index.astro` et `src/pages/veille/index.astro`, remplacer les classes des anciens jetons par les nouveaux.
2. Remplacer le serif des titres et des dates par la police display ou mono selon le rôle.
3. Retirer les arrondis et les ombres douces.
4. Vérifier que les dix entrées et leurs résumés restent affichés.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les six couleurs, les deux ombres dures et les trois familles de polices sont définies ; aucun rayon non nul. |
| 2 | Aucun titre ni date n'utilise Georgia ; le focus clavier reste visible sur fond béton ; aucun dégradé ni animation hors survol. |
| 3 | L'en-tête affiche `VITRINE_`, la navigation marque la page courante et le pied reste lisible à 375 px. |
| 4 | Le build réussit et les deux pages affichent toujours les dix entrées avec leurs résumés. |
