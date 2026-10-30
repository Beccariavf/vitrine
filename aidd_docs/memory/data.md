# Data

Le versant données : sources, pipeline et modèles.

## Sources

- CNIL, flux RSS officiel, seule source branchée.
- Prévues, non branchées : Légifrance (PISTE), Judilibre, EUR-Lex, data.gouv.

## Pipeline

```mermaid
flowchart LR
    RSS["Flux CNIL"] --> P["Parse + normalisation"]
    P --> RAW["data/raw — snapshot brut"]
    P --> E["data/entries — une entrée par actualité"]
```

## Summaries

- Chaque entrée porte un résumé extrait de la description de la source, nettoyé puis tronqué à 200 caractères ellipse comprise (`veille/summary.ts`) ; `null` quand la description manque.
- Nettoyage : entités décodées deux fois, balises retirées, espaces normalisés. La source n'est jamais réécrite.
- À l'affichage, un résumé qui répète une suite de 40 caractères ou plus du titre est masqué (`isRedundantSummary`) ; l'entrée reste affichée.

## Models

- Aucun modèle, aucune inférence : le pipeline est déterministe.

## Reproducibility

- Git : chaque snapshot brut est adressé par son `sha256`, chaque entrée par un `id` stable.
- Une passe sur un flux inchangé ne produit aucun diff.
- Aucune donnée personnelle : uniquement des textes publics.
