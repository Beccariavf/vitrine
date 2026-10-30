# Page de veille statique

## Target

Un visiteur peut consulter, sur une page générée statiquement, les actualités CNIL collectées, de la plus récente à la plus ancienne, avec un lien vers la source officielle.

## Hard constraints

- Le rendu est statique : au moment de la génération, la page ne lit que `data/`, jamais une API au runtime.
- Aucune requête réseau pendant la génération ni pendant les tests.
- Chaque entrée affiche son titre, sa date (ou l'absence de date), sa source et un lien vers l'URL officielle.
- Tri décroissant par date de publication ; les entrées sans date viennent en dernier.
- La génération échoue explicitement si `data/` est absent ou si une entrée est illisible : jamais de page vide silencieuse.
- Aucune donnée personnelle, aucun secret.

## Non-goals

- Design system complet, recherche, pagination, filtres.
- Déploiement, cron, autres sources.
- Page de détail par actualité : le lien renvoie à la source officielle.
- MCP, plugin, mode « Explique-moi ».
- Conformité d'accessibilité certifiée : on vise un HTML sémantique de base.

## Done-when

- La génération produit une page contenant tous les titres présents dans `data/`.
- L'ordre affiché est décroissant par date de publication.
- Chaque titre est un lien vers une URL `https://www.cnil.fr/`.
- Une entrée sans date reste affichée, sans date inventée.
- Une entrée illisible fait échouer la génération.
- `npm test` couvre le lecteur d'entrées (tri, dates nulles, entrée illisible).

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui visite la vitrine

## Context

- Décisions d'architecture : [`aidd_docs/INSTALL.md`](../../../INSTALL.md) et [`aidd_docs/memory/architecture.md`](../../../memory/architecture.md).
- Contrat de données : `veille/types.ts`.
