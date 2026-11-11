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
- Test de bout en bout : `tests/server-stdio.test.ts` vérifie que le schéma de `search` n'a pas bougé. Le schéma de `get_decision` n'est pas couvert par un test stdio ; il l'est par le type `PartieDecision` et par le refus du serveur pour une valeur inconnue.
