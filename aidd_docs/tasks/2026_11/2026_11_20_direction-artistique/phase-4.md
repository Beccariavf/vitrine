---
status: pending
---

# Instruction: Connecteur et veille

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/
    └── pages/
        ├── ✏️ connecteur.astro
        └── veille/
            └── ✏️ index.astro
```

Hors arbre `src/pages/` : ✏️ `src/lib/familles.ts`, ✏️ `tests/familles.test.ts`.

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `npm run dev` | `/connecteur` et `/veille` se chargent | browser |
| Happy path   | `/connecteur` à 375 et 1 440 px | titre serif, étapes en cartes surface, façade et tableau arrondis, `pipeline.log` en bloc sombre arrondi | browser |
| Happy path   | `/veille` à 1 440 px, vue grille | cartes surface sur trois colonnes, pastille et source en tête, titre serif, références et matières en pilules | browser |
| Happy path   | Basculer en vue liste | liste à filets fins centrée, rangées complètes | browser |
| Happy path   | Décocher une matière | ses publications disparaissent, sans JavaScript | browser |
| Edge case    | 375 px, sélecteur de matières | les cinq pilules tiennent sur deux lignes au plus | browser |
| Edge case    | Clavier sur matières et bascule de vue | focus visible sur la pilule et le bouton de vue | browser |
| Edge case    | Système en sombre | cartes, tableau, filtres et bloc code lisibles | browser |

## Wireframe

```txt
┌──────────────── /connecteur ─────────────────────────┐
│ (1) • En préparation                                  │
│     Titre serif · chapeau                             │
│ (2) démo complète (si présente)                       │
│ (3) ┌─ 1 ──────┐ ┌─ 2 ──────┐ ┌─ 3 ──────┐           │
│     │ étape    │ │ étape    │ │ étape    │           │
│     └──────────┘ └──────────┘ └──────────┘           │
│ (4) façade · tableau de couverture · hors périmètre  │
│ (5) ┌──── pipeline.log (bloc sombre) ────┐           │
│ (6) Transparence · En attendant ( Consulter la veille )│
└──────────────────────────────────────────────────────┘
┌──────────────── /veille ─────────────────────────────┐
│ (7) Veille (serif) · compte · dernière date · légende │
│ (8) ( Données perso ) ( IA ) ( Cyber ) ( … )   ⓘ     │
│ (9) Affichage                       ( ▦ | ☰ )         │
│ (10) ┌ carte ┐ ┌ carte ┐ ┌ carte ┐                    │
│      │• CNIL  17 nov.│                               │
│      │ titre serif   │                               │
│      │ résumé · réfs │                               │
│      └───────┘ └───────┘ └───────┘                    │
└──────────────────────────────────────────────────────┘
```

1. En-tête du connecteur : statut à pastille, `h1` serif, chapeau.
2. Démo complète, seulement si `demo.json` existe.
3. Trois étapes en cartes `surface` arrondies, numéro en grand serif décoratif (`aria-hidden`), ordre porté par `<ol>`.
4. Couverture : façade, tableau en surface arrondie à filets fins, ligne hors périmètre.
5. `pipeline.log` : bloc accent sombre arrondi, seule place de la police mono.
6. Transparence et action pleine vers la veille, mention d'aide.
7. Tête de veille : `h1` « Veille » serif (sans le `_`), compte, dernière date, légende.
8. Matières : pilules cochables, voile d'accent si active.
9. Bascule de vue en pilule segmentée.
10. Cartes de la planche ; vue liste = `PublicationRangee` complète.

## Tasks to do

### `1)` Page connecteur

> Mêmes contenus, nouvelle forme.

1. Retirer `.etape-numero` (plaques et ombres dures) ; étapes, tableau, bloc code et action selon le wireframe ; textes inchangés.

### `2)` Page veille

> Lecture dense, mais douce.

1. Cartes : en-tête coloré remplacé par ligne pastille + source + date ; titre en serif ; « Lire » en lien de section ; mêmes liens et `aria-label`.
2. `.theme-toggle` et bascule de vue : pilules, jetons nouveaux, focus visible ; logique CSS (`:has`, radios) inchangée.
3. Tête : « Veille » sans `_`, compte et dernière date en Inter.

### `3)` Retirer la paire texte sur aplat

> Plus aucun texte sur couleur de famille.

1. Une fois les cartes sans en-tête coloré, retirer `texte`/`classeTexte` de `src/lib/familles.ts` et leurs assertions de `tests/familles.test.ts`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `/connecteur` conforme au wireframe à 375 et 1 440 px, clair et sombre ; mêmes textes qu'avant |
| 2 | `/veille` : filtre de matières et bascule de vue fonctionnent sans JavaScript ; cartes et liste conformes, clair et sombre |
| 3 | `grep classeTexte src tests` ne trouve rien ; `npm run typecheck` et `npm test` verts |
