---
status: approved
---

# Qualité v2 et second corpus AI Act

Mesurer la qualité sur un jeu neuf, corriger la recherche si le développement le confirme, et prouver l'extensibilité avec un deuxième corpus.

## Clear

- Nouveau jeu RGPD de 60 questions : 30 `dev`, 30 `test`, figé avant toute mesure.
- Le test v2 est mesuré **une seule fois**, après les corrections ; le test v1 reste une preuve d'époque, jamais fusionnée.
- Recherche hybride lexicale (SQLite FTS5) fusionnée au sémantique par RRF, mesurée sur `dev` v2 ; elle n'est conservée que si elle améliore sans dégrader les pièges.
- Deuxième corpus : **AI Act** (CELEX 32024R1689, 113 articles, 180 considérants), même route CELLAR que le RGPD.
- La LIL est reportée : elle demande un chemin DILA LEGI distinct, pas une simple ligne de descripteur.
- Chaque corpus a son propre rapport ; aucun score moyen commun.
- L'index incrémental couvre aussi la table lexicale : le delta met à jour les deux.

## Assumed

- 30 questions de test donnent un intervalle d'environ ±14 points ; suffisant pour un constat, pas pour trancher 3 points.
- 12 questions AI Act suffisent à prouver l'extensibilité, pas à classer le corpus.
- Le reranker reste hors périmètre : Ollama n'en sert pas.

## Open

- Aucun point bloquant.
