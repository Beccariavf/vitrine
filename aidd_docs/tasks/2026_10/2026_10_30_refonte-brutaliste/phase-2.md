---
status: completed
---

# Instruction: Accueil, deux variantes

## Architecture projection

```txt
.
└── src/
    ├── pages/
    │   ├── index.astro ✏
    │   └── variante-b.astro ✅
    └── styles/
        └── global.css ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | `npm run build` puis lancer la preview | `/` et `/variante-b` répondent | cli |
| Happy path   | Ouvrir `/` | La variante Registre s'affiche | browser |
| Happy path   | Ouvrir `/variante-b` | La variante Béton s'affiche | browser |
| Edge case    | Réduire à 375 px | Une colonne, aucun débordement horizontal | browser |
| Edge case    | Comparer les chiffres au contenu de `data/entries` | Le nombre d'actualités et de sources correspond | browser |
| Edge case    | Inspecter le HTML livré | Aucune balise `<script>` client | browser |

## Wireframe

```txt
Variante A — Registre
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ · DROIT DU NUMÉRIQUE            VEILLE →        │
├──────────────────────────────────────────────────────────────┤
│ (2) HERO                            │ (3) BLOC ROUGE          │
│ LA VEILLE JURIDIQUE,                │ 10                      │
│ PUBLIÉE EN STATIQUE.                │ ACTUALITÉS              │
│ [CONSULTER LA VEILLE]               │ 1 SOURCE                │
├────────────┬────────────┬───────────┴────────────┬───────────┤
│ (4) 10     │ 1 SOURCE   │ 0 KO JS                │ 0 €       │
├──────────────────────────────────────────────────────────────┤
│ (5) PIPELINE.LOG — fond encre                                │
├──────────────────────────────────────────────────────────────┤
│ (6) 01 COLLECTE │ 02 NORMALISATION │ 03 PUBLICATION           │
├──────────────────────────────────────────────────────────────┤
│ (7) 01 VEILLE │ 02 MCP │ 03 PLUGIN                          │
├──────────────────────────────────────────────────────────────┤
│ (8) PIED — source · dépôt · contact                          │
└──────────────────────────────────────────────────────────────┘

Variante B — Béton
┌──────────────────────────────────────────────────────────────┐
│ (1) VITRINE_ — VEILLE JURIDIQUE                  /VEILLE     │
├──────────────────────────────────────────────────────────────┤
│ (2) TITRE ÉDITORIAL                    │ (3) LOGGIAS CSS    │
│ LA VEILLE JURIDIQUE,                   │ ▦ ▦ ▦ ▦            │
│ PUBLIÉE EN STATIQUE.                   │ ▦ ▦ ▦ ▦            │
│ ────────────────────────────           │                    │
│ [LIRE LA VEILLE]                       │ 10 ACTUALITÉS      │
├──────────────────────────────────────────────────────────────┤
│ (4) TABLEAU DE MÉTHODE — 3 colonnes bordées                  │
├──────────────────────────────────────────────────────────────┤
│ (5) PIPELINE.LOG — papier, bordure encre                     │
├──────────────────────────────────────────────────────────────┤
│ (6) PRODUITS — lignes numérotées, filets rouge/bleu/jaune      │
├──────────────────────────────────────────────────────────────┤
│ (7) PIED — mono                                              │
└──────────────────────────────────────────────────────────────┘
```

1. En-tête commun : wordmark terminal, navigation, bordure basse.
2. Hero : promesse et appel à l'action.
3. Variante A : bloc rouge avec le compte d'actualités. Variante B : motif de loggias en CSS et compte.
4. Bandeau de chiffres : actualités, sources, JavaScript, coût.
5. Preuve du pipeline : deux commandes et leurs sorties.
6. Méthode en trois étapes numérotées.
7. Trois produits, disponibles ou à venir.
8. Pied de page : source, dépôt, contact.

## Tasks to do

### `1)` Construire les modules d'accueil

> Une seule vérité de données, deux compositions.

1. Calculer les chiffres depuis `entries` : nombre d'actualités et nombre de sources.
2. Écrire le bandeau de chiffres, le bloc `pipeline.log`, les trois étapes et les trois produits dans `src/pages/index.astro`.
3. Ne coder aucun compte en dur ; les commandes affichent le compte réel.
4. Garder le lien vers `/veille` et l'ancre vers la méthode.

### `2)` Dessiner la variante A, Registre

> Une affiche dense, proche de la référence.

1. Hero asymétrique avec un aplat rouge portant le compte.
2. Bandeau de quatre cellules bordées, ombre dure.
3. Bloc terminal sur fond encre, texte papier.
4. Produits en cartes papier bordées : un seul aplat chromatique dans la section, les autres portent un filet de couleur.
5. Ombre dure au survol des cartes et du CTA.

### `3)` Dessiner la variante B, Béton

> Une façade en grille, plus architecturale, plus calme.

1. Hero en deux colonnes avec un motif de loggias en CSS : rectangles rouge, bleu, jaune et papier, bordures encre.
2. Tableau de méthode en trois colonnes séparées par des filets.
3. Bloc terminal en papier bordé, pas en fond noir.
4. Produits en lignes numérotées, filet de couleur à gauche ; aucun aplat plein supplémentaire.

### `4)` Capturer les deux variantes

> La preuve visuelle avant le choix.

1. Lancer le build et la preview.
2. Capturer `/` et `/variante-b` en 1280 px et en 375 px.
3. Présenter les quatre captures, sans commit d'image.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les chiffres affichés correspondent à `data/entries` ; le bloc pipeline montre le compte réel. |
| 2 | La variante A s'affiche à `/` avec hero, chiffres, terminal, étapes et produits. |
| 3 | La variante B s'affiche à `/variante-b` avec loggias CSS, tableau, terminal et produits. |
| 4 | Quatre captures existent et aucune page ne déborde à 375 px. |
