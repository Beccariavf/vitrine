---
status: pending
---

# Instruction: Couleurs signifiantes : une famille, une couleur

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── components/
│   │   └── ✅ Legende.astro
│   ├── lib/
│   │   └── ✅ familles.ts
│   └── pages/
│       ├── ✏️ index.astro
│       └── veille/
│           └── ✏️ index.astro
├── tests/
│   └── ✅ familles.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ codebase-map.md
        ├── ✏️ design.md
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Phase 1 livrée : jeton vert disponible | quatre couleurs de famille dans `@theme` | cli |
| Happy path   | `npm test` | chaque source de veille (`cnil`, `cjeu`, `anssi`, `cepd`, `arcep`, `commission`, `commission-dma`, `arcom`, `cetat`, `judilibre`) et chaque corpus (`rgpd`, `aiact`, `lil`, `cnil`, `cepd`, `cjue`, `ce`, `cc`) a sa famille | cli |
| Happy path   | `npm run build` | les cartes de veille prennent la couleur de leur famille ; chaque publication de l'accueil porte une pastille de famille ; une légende nomme les quatre familles sur les deux pages | cli |
| Edge case    | Source ou corpus inconnu | famille « autre », aplat béton et texte encre, sans erreur | cli |
| Edge case    | Lecture sans couleur (niveaux de gris) | la famille reste lisible par son libellé texte | browser |

## Tasks to do

### `1)` Définir les familles

> Une source unique pour la correspondance source → famille → couleur.

1. Créer `src/lib/familles.ts` : familles `textes` (bleu), `autorites` (rouge, « Autorités françaises »), `ue` (vert, « Union européenne »), `juridictions` (jaune, « Juridictions françaises »), `autre` (béton) ; chacune porte libellé, classe de fond et classe de texte contrastée.
2. `familleDeSource(id)` couvre les dix sources de veille et les huit corpus, y compris `cjeu` et `cjue`.
3. Écrire `tests/familles.test.ts` : couverture des dix-huit identifiants, inconnu en `autre`, classes de texte conformes aux paires autorisées par `tests/contrastes.test.ts`.

### `2)` Colorer par famille

> Que la couleur informe partout de la même façon.

1. `src/pages/veille/index.astro` : `CARD_COLORS` cède la place à `familleDeSource(entry.source)` pour l'en-tête des cartes ; chaque carte porte `data-source` et `data-famille` pour être vérifiable dans `dist/`.
2. `src/pages/index.astro` : pastille carrée de famille devant le libellé de source de chaque publication.
3. Créer `src/components/Legende.astro` : les quatre familles en pastilles et libellés mono ; la poser sous l'en-tête de la veille et, en phase 2 seulement, sous les publications de l'accueil (la phase 3 la déplace dans la façade : une seule légende par page).

### `3)` Mettre la mémoire à jour

> Remplacer la règle du cycle par celle des familles.

1. `design.md` : la couleur nomme une famille, plus de cycle rouge → bleu → jaune → béton ; légende.
2. `codebase-map.md` : `src/lib/familles.ts`, `components/Legende.astro`.
3. `testing.md` : le test des familles.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `npm test` passe ; les dix-huit identifiants ont une famille ; un inconnu rend `autre`. |
| 2 | Dans `dist/veille/index.html`, toutes les cartes `data-source="commission-dma"` portent `bg-green` et toutes les cartes `data-source="cnil"` `bg-red` ; `dist/index.html` a une pastille par publication. |
| 3 | `design.md` ne mentionne plus le cycle de quatre teintes et décrit les familles. |
