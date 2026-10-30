# VCS

Les conventions de versionnage du projet : branches, commits et plateforme.

## Setup

- Main branch: `main`
- Platform: `github` (`Beccariavf/vitrine`, dépôt public, remote SSH)
- Tickets: aucun tracker pour l'instant
- Hooks: aucun hook local ; la CI (`.github/workflows/ci.yml`) exécute typecheck, tests et build à chaque `push` et `pull_request`

## Branches

- Format: `<type>/<description-courte>`
- Types: `feat`, `fix`, `chore`, `docs`

## Commits

- Convention: conventional commits
- Format: `type(scope): description`
- Rules: impératif, une préoccupation par commit, le corps dit pourquoi

## Commit Strategy

AI should auto commit: `after task done`
