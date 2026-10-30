# Règles de pilotage IA

Comment ce projet pilote les assistants IA. Court et spécifique au dépôt.

## Règles de la maison

- Toute affirmation de succès s'appuie sur une preuve : sortie de commande, fichier, diff. Jamais « ça devrait marcher ».
- Une seule préoccupation par commit ; le corps dit pourquoi, pas quoi.
- `data/` n'est écrit que par le pipeline : jamais d'édition manuelle, sous peine de casser la piste d'audit.
- Un adaptateur par source ; aucune logique de source en dehors de `veille/sources/`.
- Les versions des dépendances sont épinglées ; toute montée de version est une branche dédiée, jamais une mise à jour subie.
- Aucun secret dans le dépôt : PISTE et Judilibre vivent dans les secrets GitHub Actions.

## Profondeur de validation

- Documentation ou style : relecture rapide.
- Changement dans `veille/` ou `src/` : tests et build verts avant merge.
- Modification d'un adaptateur : fixture mise à jour et test de la source vert.

## Quand l'IA dérive

- Reformuler l'objectif en une phrase, puis recharger la mémoire projet.
- Si le désaccord persiste, revenir au plan dans `aidd_docs/tasks/` et trancher là, pas dans la conversation.

Pour le playbook AIDD général (planification, boucles de revue, hygiène de contexte, anti-patterns) : <https://github.com/ai-driven-dev/framework>.
