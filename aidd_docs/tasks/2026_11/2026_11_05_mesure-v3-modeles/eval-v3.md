# Évaluation du serveur MCP RGPD v3

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants, 272 unités), avec `qwen3-embedding:0.6b` (1024 dimensions) et `qwen3-embedding:4b` (2560 dimensions), Ollama 0.40.14 local. Ce rapport est indépendant de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) et de l'évaluation v2 (`aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-v2.md`) : les trois jeux ne sont jamais fusionnés.

**Le split `test` n'est pas encore mesuré.** Le jeu a été écrit contre le texte des articles, avant toute mesure des modèles sur ce jeu.

## Composition du jeu

`mcp/eval/questions-v3.csv` porte 80 questions écrites d'après `data/corpus/rgpd/unites.jsonl`, sans lire aucun résultat du système.

| Split | Sémantiques | Références exactes | Pièges | Total |
| --- | --- | --- | --- | --- |
| `dev` | 34 | 3 | 3 | 40 |
| `test` | 34 | 3 | 3 | 40 |
| **Total** | **68** | **6** | **6** | **80** |

Répartition : 68 questions sémantiques couvrent 68 articles distincts, les six références exactes six autres articles, et les pièges ne citent aucune source. Les 74 articles attendus se répartissent sur les onze chapitres du RGPD. Aucune question de `questions.csv` (v1) ni de `questions-v2.csv` (v2) n'est reprise.

## Règle de décision (figée avant toute mesure `test`)

Chaque modèle est mesuré **une seule fois** sur le split `test`, avec les seuils calibrés sur son propre `dev` et passés explicitement par `--seuils`. Les deux mesures sont alignées question par question.

- Succès au top 5 : au moins une référence attendue figure parmi les cinq passages rendus.
- Succès au rang 1 : la première référence attendue est le premier passage rendu.
- `b` : nombre de questions où `4b` réussit au rang 1 et `0.6b` échoue.
- `c` : nombre de questions où `0.6b` réussit au rang 1 et `4b` échoue.
- Test exact de McNemar bilatéral : `p = min(1, 2 × P(X ≤ min(b, c)))`, avec `X ~ Binomial(b + c, 1/2)`.
- `4b` est adopté si et seulement si `b > c`, `p < 0,05`, `b + c ≥ 6`, et si le top 5 rendu de `4b` n'est pas inférieur de plus d'une question à celui de `0.6b`.
- Si `b + c < 6`, aucune conclusion n'est tirée et `0.6b` reste le modèle du produit.

Aucune question, aucun seuil, aucune bande et aucun libellé de verdict ne seront modifiés après la mesure `test`.
