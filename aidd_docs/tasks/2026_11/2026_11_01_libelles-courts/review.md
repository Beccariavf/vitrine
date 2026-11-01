# Revue : libellés courts

Statut : **cleared** sur `020bfb7` ; aucun bloqueur.

## Validation

| Commande | Résultat |
| -------- | -------- |
| `npm test` | 238 tests, 0 échec |
| `npm run typecheck` | propre |
| `npm run build` | 2 pages, aucune erreur |
| Page construite | `LIL · art. 8, 82, 20`, `CPCE · art. L. 34-5`, `RGPD · art. 83`, `C. conso · art. L. 223-1` |
| Survol | `title` porte le libellé complet |
| Liens | URL officielles inchangées, 270 paires `target="_blank" rel="noopener"` |
| Données | aucune entrée modifiée |

## Constats

- Les douze correspondances d'acronymes sont exactes et pointent vers le texte canonique.
- Un instrument inconnu garde son libellé complet ; aucun acronyme inventé.
- La carte et la liste affichent le même libellé, et `referenceUrl` continue de lire la référence canonique.
- Le libellé court n'est jamais utilisé comme clé d'URL.

## Suggestions ouvertes

- Ajouter un acronyme si un nouvel instrument entre dans les matières.
- Étudier un composant de pastille partagé entre la carte et la liste (duplication existante).
