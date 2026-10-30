# Coding Assertions

Les vérifications qui doivent passer pour qu'un code compte comme terminé. Minimales, après chaque changement.

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run typecheck` | Typage strict de `veille/`, `src/lib/` et `tests/`, sans émission |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm test` | Suite hors ligne : normalisation, dates, idempotence, échecs, lecteur du site |

## Rules

- Un commit = une préoccupation ; message conventionnel à l'impératif.
- Chaque source a sa fixture et son test ; un adaptateur sans test n'est pas terminé.
- `data/` n'est jamais édité à la main.
- Aucun secret versionné.
- Versions épinglées ; une mise à jour est une branche dédiée.
