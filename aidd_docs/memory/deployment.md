# Deployment

Où le projet tourne et comment il est livré.

## Pipeline

- GitHub Actions (`.github/workflows/ci.yml`) à chaque `push` et `pull_request` : `npm ci`, typecheck, tests, build. Lecture seule (`contents: read`), 10 minutes.
- Aucune étape de déploiement, aucun workflow planifié : la CI vérifie, elle ne publie pas.

## Environments

- Aucun environnement public : le site n'est pas déployé.
- `dist/` est un artefact local, régénéré par `npm run build` ; la preview Astro sert au contrôle visuel.
- L'outil de paramètres `tools/parametres.html` est local et non déployé : il écrit `veille/tags.json` via l'API File System Access de Chrome. Aucun serveur, aucun script sur les pages publiques.

## Release

- Pas de version ni de tag : `main` est la référence, chaque fusion y ajoute un incrément.

## Monitoring

- Aucun : pas de service en production. Un échec de CI est la seule alerte.
