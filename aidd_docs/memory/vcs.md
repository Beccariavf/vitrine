# VCS

Les conventions de versionnage du projet : branches, commits et plateforme.

## Setup

- Main branch: `main`
- Platform: `github` (`Beccariavf/vitrine`, dépôt public, remote SSH)
- Tickets: aucun tracker pour l'instant
- Hooks: `.githooks/pre-commit` refuse `.env` et les valeurs non vides de `PISTE_CLIENT_SECRET` et `PISTE_KEY_ID` ; activer avec `git config core.hooksPath .githooks`. La CI (`.github/workflows/ci.yml`) rejoue le même contrôle, puis typecheck, tests et build à chaque `push` et `pull_request`

## Branches

- Format: `<type>/<description-courte>`
- Types: `feat`, `fix`, `chore`, `docs`

## Commits

- Convention: conventional commits
- Format: `type(scope): description`
- Rules: impératif, une préoccupation par commit, le corps dit pourquoi

## Commit Strategy

AI should auto commit: `after task done`
