# Coding Assertions

Les vérifications qui doivent passer pour qu'un code compte comme terminé. Minimales, après chaque changement.

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm run typecheck` | Typage strict de `veille/`, `src/lib/` et `tests/`, sans émission |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `npm test` | Suite hors ligne : normalisation, dates, idempotence, échecs, références CJUE/CNIL, lecteur du site |
| 2 | `npm run build` | Génération statique du site depuis `data/`, sans réseau |

## Rules

- La CI (`.github/workflows/ci.yml`) rejoue le contrôle des secrets PISTE, puis `npm run typecheck`, `npm test` et `npm run build` à chaque push et pull request : ce qui passe ici doit passer là-bas.
- Le hook `.githooks/pre-commit` refuse `.env` et les valeurs non vides de `PISTE_CLIENT_SECRET` et `PISTE_KEY_ID` ; l'activer avec `git config core.hooksPath .githooks`.

- Un commit = une préoccupation ; message conventionnel à l'impératif.
- Chaque source a sa fixture et son test ; un adaptateur sans test n'est pas terminé.
- `data/` n'est jamais édité à la main.
- Aucun secret versionné.
- Versions épinglées ; une mise à jour est une branche dédiée.
