---
status: pending
---

# Instruction: Page Connecteur

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── layouts/
│   │   └── ✏️ Base.astro
│   └── pages/
│       ├── ✅ connecteur.astro
│       └── ✏️ index.astro
└── aidd_docs/
    └── memory/
        ├── ✏️ codebase-map.md
        └── ✏️ design.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Phases 1 et 2 livrées, `data/corpus/` committé | nav, `sourcesCorpus`, `lireDemo` et `Demo` disponibles | cli |
| Edge case    | `src/demo/demo.json` présent | la variante complète avant / après s'affiche sous le hero | cli |
| Happy path   | `npm run build` | `dist/connecteur/index.html` existe, porte « En préparation », un tableau des 8 collections avec documents et date, un lien vers `/veille` et un vers GitHub | cli |
| Edge case    | Collection sans date (`rgpd`, `aiact`) | la cellule affiche « texte consolidé », pas une date vide | cli |
| Edge case    | `dist/connecteur/index.html` | ne contient ni « essai », ni tarif, ni « zéro hallucination », ni « conseil juridique » | cli |
| Edge case    | Largeur 375 px | le tableau des collections reste lisible sans défilement de page | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) En-tête : nav [Connecteur]* [Veille]                  │
├──────────────────────────────────────────────────────────┤
│ (2) Hero : EN PRÉPARATION                                 │
│  Votre IA, appuyée sur les sources officielles du droit   │
│  des données personnelles.  sous-titre                    │
├──────────────────────────────────────────────────────────┤
│ (3) Démo avant / après, si capturée                         │
├──────────────────────────────────────────────────────────┤
│ (4) Comment ça marche : 01 ajouter · 02 demander · 03 citer│
├──────────────────────────────────────────────────────────┤
│ (5) Ce que couvre la base                                 │
│  ┌ collection │ documents │ à jour au ┐  + ce qu'elle ne   │
│  └────────────┴───────────┴───────────┘    couvre pas     │
├──────────────────────────────────────────────────────────┤
│ (6) Comment c'est construit : bloc encre pipeline.log     │
├──────────────────────────────────────────────────────────┤
│ (7) Transparence : code et corpus ouverts · [GitHub]      │
├──────────────────────────────────────────────────────────┤
│ (8) Suite : [Consulter la veille →] en attendant          │
│     Outil d'aide à la recherche, ne remplace pas…         │
├──────────────────────────────────────────────────────────┤
│ (9) Pied de page signé (phase 1)                          │
└──────────────────────────────────────────────────────────┘
```

1. En-tête : « Connecteur » en page courante.
2. Hero : statut « En préparation » en mono, titre et sous-titre de la stratégie, au vouvoiement.
3. Démo : variante complète de `Demo`, absente si `lireDemo` rend `null`.
4. Trois étapes numérotées : ajouter le connecteur à votre IA, poser vos questions, chaque réponse cite sa source officielle.
5. Couverture : collections, nombre de documents, date ; une ligne sur le hors-périmètre (autres matières, doctrine privée).
6. Construction : le bloc `pipeline.log` déplacé de l'accueil, avec les commandes réelles du corpus.
7. Transparence : la phrase « Le code et le corpus sont ouverts » et le lien GitHub.
8. Suite : la veille comme action disponible, et la mention d'aide à la recherche.
9. Pied de page commun.

## Tasks to do

### `1)` Créer la page

> Expliquer le connecteur et ne laisser aucune impasse.

1. Créer `src/pages/connecteur.astro` sur `Base`, sections 2 à 8 du wireframe.
2. Tableau de couverture depuis `sourcesCorpus` : libellé, `documents`, `arrete_le` formaté ou « texte consolidé ».
3. Bloc `pipeline.log` en encre avec `npm run corpus:sync` et `npm run mcp`, sans chiffre inventé.
4. Rendre `Demo` en variante complète sous le hero quand `lireDemo` n'est pas `null`.
5. Action finale « Consulter la veille » vers `/veille`.

### `2)` Ouvrir l'accès au connecteur

> Relier l'accueil et la nav à la page, une fois qu'elle existe.

1. Dans `src/layouts/Base.astro`, ajouter « Connecteur » avant « Veille » dans la nav, avec `aria-current` sur `/connecteur`.
2. Dans `src/pages/index.astro`, le bouton principal du hero devient « Découvrir le connecteur » vers `/connecteur` ; « Consulter la veille » passe en lien secondaire.

### `3)` Mettre la mémoire à jour

> Que la mémoire décrive la troisième route.

1. `design.md` : module Connecteur.
2. `codebase-map.md` : `src/pages/connecteur.astro` dans les points d'entrée et les routes.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `npm run build` produit `dist/connecteur/index.html` avec « En préparation », 8 lignes de couverture, `href="/veille"` et le lien GitHub ; aucun terme interdit ; nav `aria-current="page"` sur « Connecteur ». |
| 2 | `dist/index.html` a un bouton `href="/connecteur"` « Découvrir le connecteur » et un lien `href="/veille"` ; la nav de `dist/index.html` et `dist/veille/index.html` porte « Connecteur ». |
| 3 | `design.md` et `codebase-map.md` nomment la route `/connecteur`. |
