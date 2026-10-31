---
status: pending
---

# Instruction: Site

## Architecture projection

```txt
.
├── src/
│   ├── layouts/
│   │   └── Base.astro ✏
│   ├── lib/
│   │   └── sources.ts ✅
│   └── pages/
│       ├── index.astro ✏
│       └── veille/
│           └── index.astro ✏
└── aidd_docs/
    └── memory/
        ├── codebase-map.md ✏
        └── design.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | `npm run build` | Deux pages construites | cli |
| Happy path   | Ouvrir `/veille` | Jautiva apparaît avec ses références et le tag CJUE | browser |
| Happy path   | Ouvrir `/` | Les sources CNIL et CJUE sont comptées | browser |
| Edge case    | Réduire à 375 px | Aucun débordement horizontal | browser |
| Edge case    | Inspecter le HTML livré | Aucune balise `<script>` client | browser |
| Teardown     | Vérifier `data/` | Aucun fichier modifié par le build | cli |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ · DROIT DU NUMÉRIQUE                 VEILLE     │
├──────────────────────────────────────────────────────────────┤
│ (2) VEILLE_ · CNIL + CJUE · 10 ACTUALITÉS                    │
│     FILTRES : RGPD · DROITS DES DONNÉES                      │
├──────────────────────────────────────────────────────────────┤
│ (3) CARTE 29 OCT. CNIL                                       │
│     TITRE / RÉSUMÉ / LIRE                                    │
├──────────────────────────────────────────────────────────────┤
│ (4) LIGNE 03 SEPT. CJUE                                      │
│     TITRE / RÉSUMÉ / RÉFÉRENCES / CJUE                       │
├──────────────────────────────────────────────────────────────┤
│ (5) PIED : SOURCES · EUR-LEX CC BY                           │
└──────────────────────────────────────────────────────────────┘
```

1. En-tête commun, navigation.
2. Tête de veille : sources réelles, compte des entrées publiées, tags actifs.
3. Carte CNIL : titre, résumé, lien.
4. Ligne CJUE : titre, résumé, références juridiques, label de source.
5. Pied : sources et attribution EUR-Lex.

## Tasks to do

### `1)` Afficher les sources et les tags actifs

> Le pipeline a déjà appliqué les tags ; le site montre ce qui est publié.

1. Créer `src/lib/sources.ts` avec les libellés `CNIL` et `CJUE` et un helper `sourceLabel`.
2. Dans `src/pages/index.astro` et `src/pages/veille/index.astro`, utiliser les entrées publiées pour les comptes, les sources et les cartes.
3. Afficher en tête de veille : `CNIL + CJUE` et `Filtres : …` avec les tags actifs.
4. Remplacer les mentions fixes « CNIL » de l'accueil et de la veille par les sources réelles.
5. Vérifier que le site ne filtre pas une deuxième fois : la seule porte est la passe de veille.

### `2)` Afficher les références et l'attribution

> Chaque arrêt dit les articles qu'il vise, et la source est créditée.

1. Sur les cartes et les lignes de veille, afficher `entry.references` en petits tags lisibles.
2. Remplacer les mentions fixes « CNIL » de l'accueil, de la veille et du pied de page par les sources réelles.
3. Ajouter au pied de page la mention « Textes CJUE via EUR-Lex, CC BY 4.0 » avec le lien vers l'avis juridique.
4. Adapter la copie de la carte produit, la description de la page et le bloc `pipeline.log`.
5. Mettre à jour `design.md` et `codebase-map.md`.

### `3)` Vérifier le rendu

> Le site reste statique, lisible et sans JavaScript.

1. Construire et capturer `/` et `/veille` en 1280 px et 375 px.
2. Vérifier Jautiva, ses références, le label CJUE et les tags actifs.
3. Vérifier qu'aucune page publique ne contient de `<script>` et qu'aucun débordement n'apparaît.
4. Vérifier que le build ne modifie pas `data/`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les comptes et les cartes utilisent les entrées publiées ; les sources et les tags actifs sont visibles ; le pipeline est la seule porte de publication. |
| 2 | Chaque arrêt CJUE affiche ses références ; les sources et l'attribution EUR-Lex sont visibles ; `design.md` et `codebase-map.md` sont à jour. |
| 3 | Les pages se construisent, Jautiva est visible, 375 px ne déborde pas, aucun script client n'est livré et `data/` est inchangé. |
