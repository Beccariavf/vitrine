# Phase 2: Sélectionner les fragments rendus

## Acceptance

- `getDecision` accepte `partie: "dispositif" | "tous"`, défaut `"dispositif"`.
- La réponse porte `partie` et `fragments_total`.
- Le premier fragment rendu est celui qui contient la borne ; les fragments restent entiers.
- `search`, `get_article` et l'index sont inchangés.
- Les tests qui attendaient tous les fragments passent `partie: "tous"`.

## Evidence

- `premierFragmentDuDispositif` reporte la borne calculée sur le texte recollé vers les fragments ; aucun texte n'est coupé.
- Tests : `rend la seule partie opératoire par défaut`, `borne aussi une décision sans « PAR CES MOTIFS »`, `rend tous les fragments d'un document dans l'ordre numérique` (avec `partie: "tous"`).
- Test de bout en bout : `tests/server-stdio.test.ts` vérifie que le schéma de `search` n'a pas bougé ; `get_decision` gagne `partie` dans le sien.
