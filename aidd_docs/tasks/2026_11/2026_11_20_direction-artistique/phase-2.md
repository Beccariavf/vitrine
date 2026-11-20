---
status: pending
---

# Instruction: Coquille et éléments communs

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── public/
│   └── ✏️ favicon.svg
├── src/
│   ├── components/
│   │   ├── ✏️ Legende.astro
│   │   └── ✏️ PublicationRangee.astro
│   ├── layouts/
│   │   └── ✏️ Base.astro
│   ├── lib/
│   │   └── ✏️ familles.ts
│   └── styles/
│       └── ✏️ global.css
├── tests/
│   ├── ✏️ contrastes.ts
│   └── ✏️ familles.test.ts
└── aidd_docs/
    └── memory/
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `npm run dev` | les trois pages se chargent | browser |
| Happy path   | Ouvrir `/`, `/connecteur`, `/veille` à 375 et 1 440 px | fond blanc, titres en Instrument Serif, texte en Inter, en-tête et pied de la planche, navigation en pilules | browser |
| Happy path   | Système en sombre | fond, texte, en-tête et pied passent en sombre, texte lisible | browser |
| Happy path   | `npm test` | familles rangées comme avant ; chaque famille a un jeton de pastille testé à 3:1 | cli |
| Edge case    | Tabulation au clavier dans l'en-tête et le pied | contour de focus visible en accent, dans les deux thèmes | browser |
| Edge case    | 375 px | marque et navigation tiennent sans défilement horizontal | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────┐
│ (1) Vitrine (serif) · Droit du numérique   (2) ( Connecteur ) ( Veille ) │
├──────────────────────────────────────────────────────┤
│ (3) contenu de la page                                │
├──────────────────────────────────────────────────────┤
│ (4) ┌──────────────── surface arrondie ─────────────┐ │
│     │ Connecteur                                   │ │
│     │ Veille            (liens en grand serif)     │ │
│     │ Code source                                  │ │
│     │ (5) signature · mention · crédits sources    │ │
│     └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

1. Marque : « Vitrine » en serif, « Droit du numérique » en Inter douce, masqué sous 560 px.
2. Navigation : pilules, page courante sur voile d'accent, `aria-current`.
3. Contenu : fond blanc, largeur choisie par la page.
4. Pied : bloc surface arrondi, liens de navigation en grand serif.
5. Bas du pied : signature, mention d'aide à la recherche, crédits Légifrance, Cour de cassation, EUR-Lex (CC BY 4.0), lien du dépôt.

## Tasks to do

### `1)` Styles de base

> Typo et liens de la planche pour tout le site.

1. `@layer base` : `html` sur `fond`/`encre`, corps en `--font-texte` ; `h1` en `--font-serif` graisse 400, interlettrage -0,02em, interligne ~1 ; `h2`–`h4` en `--font-texte` graisse 500, interlettrage -0,025em.
2. Liens : soulignement fin `filet`, plus foncé au survol ; focus `accent` 2 px arrondi ; sélection sur `accent`.
3. `@media (prefers-reduced-motion: reduce)` coupe transitions et animations.

### `2)` En-tête, pied et favicon

> La coquille du wireframe.

1. `Base.astro` : marque, navigation en pilules, pied en surface arrondie ; retirer la loggia, les cadres et ombres dures ; `skip-link` restylée en Inter sur `fond`, filet `accent` (retirer `var(--font-mono)`, `Base.astro:139`).
2. `favicon.svg` : un « V » serif en encre sur fond, sans le rouge.

### `3)` Familles en pastilles

> La couleur de famille ne sert plus d'aplat sous du texte.

1. `familles.ts` : `fond` et `classeFond` pointent les jetons `textes`, `autorites`, `ue`, `juridictions` ; `autre` sur `filet` ; garder `texte`/`classeTexte` (encore lus par `src/pages/veille/index.astro:161`) jusqu'à la phase 4.
2. `Legende.astro` : pastilles rondes, libellés Inter 13 px en `encre-douce`, sans majuscules ni mono.
3. `PublicationRangee.astro` : date en Inter `tabular-nums`, pastille ronde, titre sans soulignement rouge, références en pastilles à filet arrondies, matières en pilules sur voile.
4. `tests/familles.test.ts` et `tests/contrastes.ts` : la paire texte/fond devient une pastille testée à 3:1 sur `fond` et `surface` dans les deux thèmes ; ligne familles de `testing.md`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Titres `h1` en Instrument Serif, texte en Inter, sur les trois pages (styles calculés) |
| 2 | En-tête et pied conformes au wireframe à 375 et 1 440 px, clair et sombre ; favicon visible dans l'onglet |
| 3 | `npm test` vert ; légende et rangées affichent des pastilles rondes suivies de leur libellé |
