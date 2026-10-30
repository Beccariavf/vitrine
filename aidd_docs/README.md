# Documentation projet

Contexte structuré que l'assistant IA lit pour travailler sur ce projet, sans redécouvrir le codebase à chaque session. AIDD génère ce dossier et le maintient synchronisé.

## Ce qui vit ici

- `memory/` : la banque de mémoire projet, chargée à chaque session. Voir [`memory/README.md`](memory/README.md).
- `recipes/` : recettes propres au projet, créées ou mises à jour par la skill cook.
- `GUIDELINES.md` : comment l'équipe pilote l'IA sur ce projet.
- `tasks/` : specs, plans et comptes rendus, créés au fil du travail.
- `INSTALL.md` : la vision technique, les décisions et les étapes d'installation.

Le bloc de mémoire projet dans chaque fichier de contexte IA (`AGENTS.md`, `CLAUDE.md`, etc.) est généré et maintenu en synchronisation : jamais édité à la main. Pour changer ce que l'IA voit, ajouter ou retirer des fichiers sous `memory/`. Voir [`memory/README.md`](memory/README.md) pour les niveaux de chargement et l'index courant.

## Le framework

AIDD fournit skills, agents, règles et générateurs sous forme de marketplace de plugins. Catalogue complet, guide d'installation et workflow de bout en bout : <https://github.com/ai-driven-dev/framework>.
