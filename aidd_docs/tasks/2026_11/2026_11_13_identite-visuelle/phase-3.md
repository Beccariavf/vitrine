---
status: pending
---

# Instruction: La façade du corpus et la mise en page

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── components/
│   │   └── ✅ Facade.astro
│   ├── layouts/
│   │   └── ✏️ Base.astro
│   ├── lib/
│   │   └── ✏️ corpus.ts
│   ├── pages/
│   │   ├── ✏️ connecteur.astro
│   │   └── ✏️ index.astro
│   └── styles/
│       └── ✏️ global.css
├── tests/
│   └── ✏️ corpus-site.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ codebase-map.md
        ├── ✏️ design.md
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Phases 1 et 2 livrées ; `data/corpus/` committé | familles, jetons et police disponibles | cli |
| Happy path   | `npm test` | `sourcesCorpus` rend `unites` ; `etagesFacade` rend 3 pour RGPD (272), 5 pour CNIL (29 299), borné entre 1 et 5 | cli |
| Happy path   | `npm run build` | l'accueil montre la façade sous le hero, huit colonnes libellées, couleur de famille, légende « hauteur = volume indexé » ; `/connecteur` la montre au-dessus du tableau de couverture | cli |
| Edge case    | Aucune démo | le hero tient sur une colonne, aucun emplacement vide ; avec démo, elle occupe la colonne droite | cli |
| Edge case    | Racine sans `data/corpus/` | aucune façade, aucune erreur | cli |
| Edge case    | 375 et 1 440 px, barres de défilement classiques | `scrollWidth <= clientWidth` sur les trois pages ; les libellés de la façade restent lisibles (8 colonnes ou 4 × 2) | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) En-tête papier : VITRINE · [Connecteur] [Veille]      │
├───────────────────────────────┬──────────────────────────┤
│ (2) Hero                       │ (3) Démo (si capturée)    │
│  DROIT DES DONNÉES PERSONNELLES│  Q. …                     │
│  UNE IA JURIDIQUE              │  réponse réelle           │
│  QUI CITE SES SOURCES.         │  [RGPD · art. 6] […]      │
│  [Découvrir le connecteur →]   │                           │
├───────────────────────────────┴──────────────────────────┤
│ (4) Façade du corpus, bande papier pleine largeur         │
│        ▣        ▣                                         │
│  ▣  ▣  ▣  ▣  ▣  ▣  ▣  ▣   colonnes de 3 à 5 étages         │
│  ▣  ▣  ▣  ▣  ▣  ▣  ▣  ▣                                    │
│ ═══════════════════════  socle encre                      │
│ RGPD AI Act LIL CNIL CEPD CJUE C.d'État Cass.             │
│ ■ textes ■ autorités FR ■ UE ■ juridictions FR · hauteur  │
├──────────────────────────────────────────────────────────┤
│ (5) Dernières publications : pastille de famille + titre  │
├──────────────────────────────────────────────────────────┤
│ (6) Socle béton sombre : signature · mention · GitHub     │
└──────────────────────────────────────────────────────────┘
```

1. En-tête : marque en police de titre (phase 1).
2. Hero : surtitre mono, titre Archivo condensé, bouton principal ; une colonne sans démo.
3. Démo : variante compacte existante, ombre dure, seulement si capturée.
4. Façade : une colonne par collection, étages alternant aplat de famille et loggia papier, cadre encre, socle ; libellés mono ; légende ; fond papier étendu sur toute la largeur.
5. Publications : rangées avec pastille de famille (phase 2).
6. Socle : béton sombre, texte papier, liens et crédits en pierre.

## Tasks to do

### `1)` Calculer la façade

> Des données du corpus à une élévation stable.

1. Dans `src/lib/corpus.ts`, ajouter `unites` à `SourceCorpus` (déjà lu par `inventaireCorpus`) et `etagesFacade(unites)` = `ceil(log10(unites))` borné à [1, 5].
2. Étendre `tests/corpus-site.test.ts` : `unites` sur `data/` committé, bornes, 0 unité.

### `2)` Dessiner la façade

> L'illustration unique du site, qui prouve la couverture.

1. Créer `src/components/Facade.astro` : props `sources` ; sa légende réutilise `Legende.astro` suivie de « hauteur = volume indexé » ; HTML/CSS ou SVG inline calculé au build ; couleur via `familleDeSource` ; étages alternés aplat/loggia ; libellés en texte réel ; `role="img"` et `aria-label` résumant collections et volumes, cases décoratives masquées.
2. Variante mobile : 8 colonnes étroites ou deux rangées de 4, libellés lisibles.

### `3)` Composer les pages

> La démo à droite, la façade en bande, le socle en bas.

1. `global.css` : `.pleine-largeur` étend le fond par `box-shadow: 0 0 0 100vmax <couleur>` et `clip-path: inset(0 -100vmax)`, sans `100vw`.
2. `index.astro` : hero en `lg:grid-cols-12` seulement si une démo existe, sinon une colonne ; façade en bande `pleine-largeur` papier sous le hero, à la place du bandeau de pastilles ; retirer la `Legende` posée sous les publications en phase 2, une seule légende par page.
3. `connecteur.astro` : façade au-dessus du tableau de couverture.
4. `Base.astro` : pied de page en socle béton sombre, texte papier, liens et crédits en pierre.

### `4)` Mettre la mémoire à jour

> Que la mémoire décrive la façade et le socle.

1. `design.md` : module Façade du corpus (règle des étages, couleurs de famille, accessibilité), hero, socle.
2. `codebase-map.md` : `Facade.astro`, `etagesFacade`, `unites`.
3. `testing.md` : cas ajoutés au test du lecteur de collections.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `npm test` passe ; `etagesFacade(272) === 3`, `etagesFacade(29299) === 5`, `etagesFacade(0) === 1`. |
| 2 | `dist/index.html` contient la façade avec huit libellés et un `aria-label` qui cite les volumes ; deux builds rendent un HTML identique. |
| 3 | Sans démo, aucune colonne vide dans le hero ; à 375 et 1 440 px, `scrollWidth <= clientWidth` sur les trois pages ; le pied de page est en béton sombre. |
| 4 | `design.md` et `codebase-map.md` nomment la façade, `etagesFacade` et le socle ; `npm run typecheck`, `npm test`, `npm run build` passent. |
