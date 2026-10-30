# Veille CNIL — premier maillon

## Target

Produire, pour chaque actualité publiée par la CNIL, une entrée normalisée et identifiée de façon stable, ré-exécutable sans doublon.

## Hard constraints

- La seule source est le flux d'actualités officiel de la CNIL.
- Aucune requête réseau pendant les tests.
- Une même actualité conserve le même identifiant d'une exécution à l'autre.
- Deux exécutions sur un flux inchangé produisent un résultat identique.
- Une source indisponible ou illisible provoque un échec explicite, sans résultat partiel.
- Aucune donnée personnelle collectée, aucun secret requis.
- L'identifiant d'une actualité est dérivé de son URL canonique.
- La réponse brute de la source est conservée, adressée par son contenu.

## Non-goals

- Les autres sources : Légifrance, Judilibre, EUR-Lex, data.gouv.
- La planification automatique (cron) et l'intégration continue.
- Le rendu sur le site, la recherche et l'index.
- Le résumé ou la reformulation par un modèle.
- Le diff entre versions et la déduplication entre sources.
- Le MCP et le plugin.
- La récupération du contenu de chaque page d'article.

## Done-when

- Une exécution produit exactement une entrée par actualité du flux, sans en inventer.
- Chaque entrée expose un identifiant stable, le titre, l'URL canonique, la date de publication et la source.
- Deux exécutions successives sur le même flux produisent des entrées identiques.
- Les tests automatisés passent hors ligne à partir d'un exemplaire figé du flux.
- Une source indisponible produit un échec explicite et aucun fichier partiel.
- Le premier run couvre l'intégralité du flux et conserve les entrées des runs précédents.
- Une actualité sans date valide reste présente, avec une date nulle.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: le site Vitrine (pages de veille), puis le MCP juridique

## Context

- Décisions d'architecture : [`aidd_docs/INSTALL.md`](../../../INSTALL.md) et [`aidd_docs/memory/architecture.md`](../../../memory/architecture.md).
