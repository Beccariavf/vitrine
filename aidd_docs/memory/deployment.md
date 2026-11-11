# Deployment

Où le projet tourne et comment il est livré.

## Pipeline

- GitHub Actions (`.github/workflows/ci.yml`) à chaque `push` et `pull_request` : contrôle des secrets PISTE, `npm ci`, typecheck, tests, build. Lecture seule (`contents: read`), 10 minutes.
- Aucune étape de déploiement : la CI vérifie, elle ne publie pas. La passe hebdomadaire des actualités est lancée à la main, `npm run veille`.
- Le corpus a un agent `launchd` de trois jours, généré par `npm run corpus:sync -- --planifier` : `~/Library/LaunchAgents/fr.vitrine.corpus-sync.plist`, `StartInterval` 259 200 s. La commande ne charge pas l'agent ; elle imprime `launchctl bootstrap gui/$(id -u) <plist>` et `launchctl bootout gui/$(id -u) <plist>`. Logs : `~/Library/Logs/vitrine-corpus-sync.log` et `.err` ; `--dossier <dir>` écrit ailleurs.
- GitHub Actions ne collecte pas le corpus : 1,32 Go de JADE et Ollama ne tiennent pas dans un runner.

## Environments

- Aucun environnement public : le site n'est pas déployé.
- `dist/` est un artefact local, régénéré par `npm run build` ; la preview Astro sert au contrôle visuel.
- L'outil de paramètres `tools/parametres.html` est local et non déployé : il écrit `veille/themes.json` via l'API File System Access de Chrome. Aucun serveur, aucun script sur les pages publiques.
- Les secrets PISTE vivent dans `.env`, ignoré par git ; `.env.example` documente les trois variables. Le hook pre-commit et la CI refusent leur versionnement ; aucun secret n'est nécessaire à la CI.

## Release

- Pas de version ni de tag : `main` est la référence, chaque fusion y ajoute un incrément.

## Monitoring

- Aucun service en production ; un échec de CI est la seule alerte.
- `data/corpus/sync.json` date la dernière passe réussie du corpus ; `etat_corpus` et la sortie de `corpus:sync` nomment les sources et l'index en panne, et les logs de l'agent gardent la trace.
