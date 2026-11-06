---
status: approved
---

# Qualité mesurée du MCP, puis index incrémental

Traiter les cinq limites par des preuves mesurées, puis rendre l'index incrémental pour préparer la CNIL.

## Clear

- Barre : preuve crédible, pas outil de production.
- Étape 1, qualité : 50 questions, 35 de développement, 15 tenues à l'écart.
- Réussite sur les 15 : la référence attendue est dans le top 5 dans au moins 90 % des cas ; aucune citation fausse marquée `confiant` sur les pièges ; `incertain` apparaît réellement quand les deux premiers résultats sont proches.
- Considérants : rendus et étiquetés ; un article passe devant à pertinence comparable.
- La paraphrase « récupérer mes données » reste mesurée et rapportée. Avec `qwen3-embedding:0.6b`, elle échoue (article 20 absent du top 5) ; avec `4b`, elle passe au rang 2, mais l'indexation est 6,7 fois plus lente. Le produit garde `0.6b` ; l'expérience `4b` est documentée comme preuve que la limite vient du modèle, pas de l'architecture.
- Le découpage plus fin est hors périmètre : il servira aux délibérations CNIL.
- Étape 2, index incrémental : ajouter, modifier ou supprimer une unité ne recalcule que le delta ; les autres vecteurs restent identiques.
- La CNIL reste un chantier séparé.

## Assumed

- 50 questions suffisent pour cette barre ; 150 à 300 plus tard.
- Le jeu est écrit contre le texte, pas contre le code ; les 15 questions tenues à l'écart ne servent jamais à régler les seuils.
- La confiance reste une similarité, avec une marge non nulle et un libellé explicite.
- Le modèle de chat `LFM3-Omni-2B` n'est pas retenu : c'est un modèle de génération any-to-any, pas un modèle d'embedding.
