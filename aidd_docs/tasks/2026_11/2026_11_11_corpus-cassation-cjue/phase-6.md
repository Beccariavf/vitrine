# Phase 6 — Élargir la CJUE à la notion fine

## Livrables

- `mcp/corpus/cjue/descripteur.json` : notion `fd_578/4.11.01` et CELEX complémentaires.
- `requeteListe` / `requeteAvantBorne` : union de la matière `PDON` et de la notion fine.
- Entrées complémentaires datées par leur en-tête XHTML, comptées dans la couverture.
- Corpus, index et éval `dev` reconstruits ; documentation alignée.

## Vérification

- La Quadrature du Net (C-511/18), Prokuratuur (C-746/18) et Prokuratuur (C-511/19) sont dans `unites.jsonl`.
- Le manifeste porte `couverture.notion`, `celex_complementaires` et `complementaires_ajoutes`.
- Un CELEX complémentaire sans version française est écarté et compté, sans faire échouer les autres.

## État

Livré : 252 CELEX listés et 2 complémentaires, 152 décisions et 14 756 fragments. La Quadrature du Net (C-511/18), Prokuratuur C-746/18 et C-511/19 sont dans `unites.jsonl`. Index à 74 947 unités ; éval CJUE inchangée à 8/10 (MRR 0,750).
