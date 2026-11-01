# Revue du candidat

Statut : **cleared**, aucun bloqueur. Revue indépendante et challenge terminés sur `dd01537`.

## Validation

| Commande | Résultat |
| -------- | -------- |
| `npm test` | 209 tests, 0 échec |
| `npm run typecheck` | propre |
| `npm run build` | 2 pages, aucune erreur |
| Passe Judilibre ciblée | 6 recherches + 3 décisions, 9 appels PISTE, tous 200 |
| Page construite | seule la décision 25-10.664 apparaît ; 262 `target="_blank"` / 262 `rel="noopener"` ; pastille FNAC inchangée |

## Constats

| # | Sévérité | Constat | Suite |
| - | -------- | ------- | ----- |
| F1 | majeur | Une décision pouvait être écartée avant la lecture de son visa. | Corrigé : la matière de la requête est conservée comme indice ; test dédié. |
| F2 | majeur | Une entrée déjà écrite avec `[]` était relue à chaque passe. | Corrigé : toute entrée écrite est ignorée ; test dédié. |
| F3 | mineur | Deux instruments dans un visa se partageaient les articles. | Corrigé : fenêtres par instrument, articles avant ou après, virgule et « ainsi que ». |
| F4 | mineur | Le bloc de pastilles est dupliqué entre carte et liste. | Laissé en suggestion ; aucune duplication fonctionnelle. |
| F5 | mineur | Des références héritées pouvaient ne pas venir du visa. | Sans objet : aucune entrée Judilibre committée n'était concernée. |
| N1 | mineur | Commentaire de `main.ts` obsolète. | Corrigé. |
| N2 | mineur | Fenêtres d'articles chevauchantes. | Corrigé et testé. |
| N3 | produit | Un instrument du visa hors des matières pré-attribuées est filtré. | Décision assumée : le visa ne crée pas de matière. |
| N4 | contrat | `spec.md` décrit encore une carte sans pastille, alors que le site masque une décision sans référence. | Note au propriétaire ; la spec n'est pas réécrite. |

## Challenge

Confiance : **82 %**. Aucun bloqueur.

- Le visa non lu est différé, plus jamais transformé en silence définitif.
- Les trois décisions sans visa de la passe sont conservées en donnée mais masquées : la page ne publie que des cartes avec référence.
- Les choix qui réduisent la couverture — masquer une décision sans visa, filtrer un instrument hors matières — sont documentés dans `plan.md`, `data.md` et `design.md`.

## Suggestions ouvertes

- Aligner `spec.md` sur la règle de masquage, ou rouvrir le contrat pour la décider explicitement.
- Revoir N3 : réattribuer les matières après lecture du visa si une décision d'une matière cite un instrument d'une autre.
- Extraire la pastille de référence dans un composant, pour supprimer F4.
- Journaliser « visa lu, aucun instrument suivi, entrée masquée » pour expliquer les disparitions.
