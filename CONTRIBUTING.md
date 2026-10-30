# Contributing to Vitrine

## Setup

See [`aidd_docs/INSTALL.md`](aidd_docs/INSTALL.md) for the stack, the decisions and the install steps.

## Workflow

1. Branch off `main`.
2. Implement inside the existing boundaries: one adapter per source in `veille/sources/`, no source logic leaking into `src/` or `data/`.
3. Add or extend tests alongside the code, with a fixture per source (`tests/fixtures/<source>/`).
4. Run the suite before opening a pull request.

## Conventions

- Commits: conventional commits (`<type>(<scope>): description`).
- One concern per commit. The body says why, not what.
- The CI runs the typecheck, the test suite and the build on every push and pull request; keep it green. It never fetches the watch sources.
- `data/` is written by the pipeline only. Never edit it by hand: a manual change breaks the audit trail.
- Never commit credentials. PISTE and Judilibre keys live in GitHub Actions secrets.
- Pin dependency versions exactly; upgrades are deliberate, one branch at a time.
