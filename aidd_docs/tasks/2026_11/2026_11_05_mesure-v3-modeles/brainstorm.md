---
status: approved
---

# Jeu v3 et décision entre modèles

Trancher entre `qwen3-embedding:0.6b` et `4b` avec un jeu neuf, plus grand, et une règle fixée avant la mesure.

## Clear

- Nouveau jeu RGPD v3 de 80 questions : 40 `dev`, 40 `test`, écrit contre le texte avant toute mesure.
- Chaque split : 34 sémantiques, 3 références exactes, 3 pièges. Les références exactes testent la lecture, pas la recherche ; elles restent minoritaires pour ne pas gonfler le score.
- Les deux modèles sont mesurés **une fois chacun** sur le test, avec leurs seuils calibrés sur `dev` et figés.
- Règle de décision écrite **avant** la mesure : `4b` n'est adopté que si, sur les questions appariées, il gagne significativement (McNemar exact, p < 0,05) sans perdre au top 5.
- Si aucun modèle n'améliore nettement l'autre, la conclusion est que le modèle n'est pas le levier : le classement (reranker) devient la piste, pas un corpus de plus.
- Le jeu v2 et son test consommé ne sont ni touchés ni fusionnés.

## Assumed

- 34 questions sémantiques de test détectent un écart d'environ six questions ; pas deux. Un écart plus fin sera rapporté comme non établi.
- Les questions sont tirées des 99 articles, pas de la liste des échecs connus (`art_20`, `art_56`) : écrire contre les échecs mesurerait le système, pas le droit.
- `4b` coûte 6,9× l'indexation (5 min 40 s pour 565 unités contre 49 s) ; ce coût n'est acceptable que si la qualité progresse nettement.
- Le reranker reste hors périmètre : Ollama n'en sert pas, et l'ajouter demande un autre runtime.

## Open

- Aucun point bloquant.
