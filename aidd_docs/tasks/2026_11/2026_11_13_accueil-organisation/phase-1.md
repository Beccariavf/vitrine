---
status: pending
---

# Instruction: Accueil restructuré et pied de page signé

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── layouts/
│   │   └── ✏️ Base.astro
│   ├── lib/
│   │   └── ✅ corpus.ts
│   └── pages/
│       └── ✏️ index.astro
├── tests/
│   └── ✅ corpus-site.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ codebase-map.md
        ├── ✏️ design.md
        ├── ✏️ project-brief.md
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `data/corpus/` committé (8 manifestes) et `data/entries/` | lecteurs prêts, aucun réseau | cli |
| Happy path   | `npm test` puis `npm run build` | `dist/index.html` contient la promesse, « Consulter la veille », les 8 libellés de sources, 3 publications datées et « Valentin Fouich » | cli |
| Edge case    | Racine temporaire sans `data/corpus/` | `sourcesCorpus` rend `[]` et la date `null` ; le bandeau est omis, sans erreur | cli |
| Edge case    | Manifeste `rgpd` sans date | le libellé « RGPD » figure, la date globale vient des autres corpus | cli |
| Edge case    | Moins de 3 publications visibles | l'accueil en affiche autant qu'il y en a | cli |
| Edge case    | `dist/index.html` | ne contient ni « Plugin », « pipeline.log », « 0 ko », « 0 € », ni « essai », « tarif », « Qui suis-je », ni aucun `href="/connecteur"` | cli |
| Edge case    | Largeur 375 px | aucun défilement horizontal, boutons empilés | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) En-tête : VITRINE_ · nav [Veille]                     │
├──────────────────────────────────────────────────────────┤
│ (2) Hero                                                  │
│  Une IA juridique qui cite ses sources.                   │
│  sous-titre (vous)                                        │
│  [Consulter la veille →]  (connecteur : phase 3)          │
│  ┌──────────────────────────┐                             │
│  │ (3) Emplacement démo      │  (rempli en phase 2)        │
│  └──────────────────────────┘                             │
├──────────────────────────────────────────────────────────┤
│ (4) Bandeau sources : RGPD · AI Act · LIL · CNIL · CEPD · │
│     CJUE · Conseil d'État · Cour de cassation · à jour au │
├──────────────────────────────────────────────────────────┤
│ (5) Dernières publications                 Toute la veille│
│  ┌ jour │ source │ titre ──────────────────────────────┐  │
│  ├ jour │ source │ titre ──────────────────────────────┤  │
│  └ jour │ source │ titre ──────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ (6) Pied : Valentin Fouich · Juriste en droit du numérique│
│     Outil d'aide à la recherche · GitHub · crédits sources│
└──────────────────────────────────────────────────────────┘
```

1. En-tête : wordmark et nav inchangés ; « Connecteur » arrive en phase 3 avec sa page.
2. Hero : promesse et sous-titre au vouvoiement ; bouton « Consulter la veille » jusqu'à la phase 3, qui le remplace par « Découvrir le connecteur » pour ne publier aucun lien mort.
3. Emplacement démo : vide en phase 1, rempli en phase 2 ; à droite en `lg`, sous le texte en mobile.
4. Bandeau : les collections du connecteur et leur date la plus récente, la preuve de spécialisation.
5. Publications : les 3 plus récentes de la veille, rangées compactes, chaque titre lié à sa source officielle.
6. Pied de page : signature, mention « outil d'aide à la recherche », GitHub et crédits.

## Tasks to do

### `1)` Lire les collections du connecteur pour le site

> Donner au site la liste des sources couvertes et leur fraîcheur, sans réseau.

1. Créer `src/lib/corpus.ts` : `sourcesCorpus(rootDir)` appelle `inventaireCorpus` de `mcp/corpus/sync-rapport.ts`, mappe `corpus` vers un libellé (`rgpd` RGPD, `aiact` AI Act, `lil` Loi Informatique et Libertés, `cnil` CNIL, `cepd` CEPD, `cjue` CJUE, `ce` Conseil d'État, `cc` Cour de cassation) dans un ordre fixe : textes, autorités, juridictions.
2. Exposer `derniereMiseAJour(sources)` : la date `arrete_le` la plus récente, ou `null`.
3. Écrire `tests/corpus-site.test.ts` : `data/` committé (8 libellés, ordre), racine vide, corpus inconnu laissé à son identifiant, date absente.

### `2)` Réécrire l'accueil

> Une seule promesse, une action principale, des preuves réelles.

1. Dans `src/pages/index.astro`, supprimer les blocs « Dernière publication » rouge, le bandeau de chiffres, `pipeline.log`, « Comment ça marche » et « Trois produits ».
2. Hero : titre « Une IA juridique qui cite ses sources. », sous-titre au vouvoiement (connecteur entre votre IA et les sources officielles du droit des données personnelles, en préparation), bouton « Consulter la veille » vers `/veille`. Aucune section « problème » n'existe aujourd'hui : rien à retirer.
3. Réserver l'emplacement de démo dans la grille du hero, sans contenu.
4. Bandeau des sources depuis `sourcesCorpus`, avec « à jour au » formaté `fr-FR`, omis si la liste est vide.
5. Section « Dernières publications » : `getVisibleEntries().slice(0, 3)`, jour en mono, libellé de source, titre lié (`target="_blank"`, `rel="noopener"`), lien « Toute la veille ».
6. Mettre à jour `title` et `description` de la page.

### `3)` Signer le pied de page

> L'auteur est visible depuis toutes les pages.

1. Dans `src/layouts/Base.astro`, remplacer « Vitrine — veille juridique française, statique. » par « Valentin Fouich · Juriste en droit du numérique » et la mention « Outil d'aide à la recherche, ne remplace pas l'analyse d'un professionnel du droit ».
2. Garder les crédits de sources et le lien GitHub.

### `4)` Mettre la mémoire à jour

> Que la mémoire décrive le site livré.

1. `design.md` : module Accueil (hero, bandeau, publications), nav, pied de page signé.
2. `codebase-map.md` : `src/lib/corpus.ts` et sa dépendance à `inventaireCorpus`.
3. `project-brief.md` : vitrine aujourd'hui, abonnement au connecteur plus tard, cible juristes données personnelles.
4. `testing.md` : le test du lecteur de collections.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `npm test` passe ; `sourcesCorpus` rend les 8 libellés dans l'ordre fixe sur `data/` committé et `[]` sur une racine vide. |
| 2 | `dist/index.html` contient la promesse, un lien `href="/veille"`, les 8 libellés et exactement 3 publications ; aucune de « Plugin », « pipeline.log », « 0 ko », « 0 € ». |
| 3 | `dist/index.html` et `dist/veille/index.html` contiennent « Valentin Fouich » et « Outil d'aide à la recherche ». |
| 4 | Les quatre fichiers de mémoire nomment l'accueil réorganisé et `src/lib/corpus.ts`. |
