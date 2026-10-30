# Coding Assertions

Les vérifications qui doivent passer pour qu'un code compte comme terminé. Minimales, après chaque changement.

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | — | aucune commande câblée à ce jour : pas encore de manifeste |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | — | aucune commande câblée à ce jour |

## Rules

- Un commit = une préoccupation ; message conventionnel à l'impératif.
- Chaque source a sa fixture et son test ; un adaptateur sans test n'est pas terminé.
- `data/` n'est jamais édité à la main.
- Aucun secret versionné.
- Versions épinglées ; une mise à jour est une branche dédiée.
