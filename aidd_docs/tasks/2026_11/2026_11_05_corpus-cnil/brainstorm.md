---
status: approved
---

# Corpus CNIL : historique DINUM et incréments DILA

Ajouter un troisième corpus, la CNIL, par la voie hybride décidée : l'historique dérivé de la DINUM, les nouveaux textes depuis les dumps DILA.

## Clear

- Corpus `cnil` : **délibérations de sanction** d'abord, 249 documents et 6 342 fragments (mesuré sur le parquet DINUM du 30 octobre 2026). Le filtre est un paramètre, pas une impasse : `--nature` élargira aux avis et recommandations.
- Deux origines déclarées par unité : `dinum` pour l'historique, `dila` pour les incréments. Chaque fragment porte son origine.
- Un fragment DINUM garde son `chunk_index` : la citation est « Délibération SAN-2026-015, fragment 3 », un index publié, pas inventé par nous.
- Les incréments DILA passent par un découpage local, étiqueté comme tel.
- Le `document` reste l'acte (identifiant `CNILTEXT…`) ; un champ `corpus` explicite le distingue. Les corpus existants ne changent pas de comportement.
- `get_article` reste réservé aux actes EUR-Lex ; `get_decision` sert la CNIL, par identifiant ou par numéro.
- Aucun mélange de vecteurs : les embeddings DINUM (`bge-m3`) ne sont pas réutilisés, tout est ré-embarqué avec `qwen3-embedding:0.6b`.

## Assumed

- Les 6 342 fragments de sanction tiennent dans un index construit en une dizaine de minutes et un JSONL de quelques mégaoctets, contrairement aux 64 466 fragments de tout le corpus.
- Le parquet DINUM reconstruit le texte officiel fidèlement ; ses `doc_id` sont ceux de la DILA, donc les deux origines partagent le même espace d'identifiants.
- Les incréments DILA sont peu nombreux (146 archives de 1,6 à 24 Ko depuis juillet 2025) : la reprise est rapide et idempotente.
- L'URL publique d'un texte CNIL est la route Légifrance `/cnil/id/<identifiant>` ; elle n'a pas pu être vérifiée depuis un robot (Cloudflare), elle sera déclarée comme non vérifiée.

## Open

- Aucun point bloquant.
