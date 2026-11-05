# Évaluation du serveur MCP RGPD v2

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants) indexé avec `qwen3-embedding:0.6b` (1024 dimensions), Ollama 0.40.14 local. Ce rapport est distinct de celui de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) : les deux jeux ne sont jamais fusionnés.

Le jeu `mcp/eval/questions-v2.csv` compte 60 questions écrites contre le texte du corpus : 12 références exactes, 38 conceptuelles et 10 pièges. 30 questions servent au développement (`dev`) et règlent les seuils ; 30 questions sont tenues à l'écart (`test`) et ne seront mesurées qu'une fois, après la fin des corrections. La paraphrase « droit de récupérer mes données » est dans `test`, attendue sur `32016R0679#art_20`.

## Périmètre de l'évaluation : un document par jeu

L'index peut porter plusieurs corpus. Une question RGPD cherchée sur tout l'index concourrait donc aussi contre les unités de l'AI Act, et `dev` comme `test` mesureraient une tâche plus difficile que celle du rapport. Pour que les deux splits voient les mêmes conditions, le document de chaque jeu est déduit du préfixe des `sources_attendues` (avant `#`), puis passé à `search(..., { document })`. Un jeu qui mélange deux documents est refusé ; les pièges sans référence héritent du document des autres lignes. La recherche par défaut du produit, elle, peut toujours couvrir tous les corpus : seul le banc d'évaluation est filtré.

Le jeu `questions-aiact.csv` suit la même règle et se mesure avec `document = 32024R1689` ; son rapport est séparé.

## Base `dev` avant correction (phase 1)

Système d'avant la recherche hybride : voie dense seule, seuils calibrés sur les 30 questions `dev`. Le split `test` n'est pas mesuré ici.

| Métrique `dev` | Valeur |
| --- | --- |
| Références exactes (6) | rang 1 par construction, `recall@5` 1,000, `MRR` 1,000 |
| Recherche sémantique (19) | `recall@5` 0,947 (18/19), `MRR` 0,860 |
| Top-1 sémantique | 78,9 % (15/19) |
| `incertain` | 2/19 (10,5 %) |
| Pièges par seuil (4) | 0 cité, 0 marqué confiant |
| Piège déterministe (1) | « Que prévoit l'article 100 du RGPD ? », refusé par la branche article absent |
| Seuils calibrés sur `dev` | `bas = 0,680`, `haut = 0,730`, `marge = 0,010` |

La question sémantique manquée est « autorité de contrôle chef de file » : `art_56` est absent des cinq premiers et `art_51` passe en tête. Trois têtes de considérant précèdent l'article attendu (`art_25` derrière `rct_78`, `art_47` derrière `rct_110`, `art_89` derrière `rct_159`) ; leurs écarts de similarité dépassent la bande article.
