---
status: approved
---

# MCP juridique multi-corpus

Pour un avocat ou un recruteur : retrouver un texte officiel par référence exacte ou par le sens, avec sa provenance.

## Clear

- La recherche par le sens est indispensable, pas un bonus.
- Multi-corpus dès le modèle : RGPD d'abord, puis LIL, CJUE, CEPD, CNIL, Conseil d'État.
- Static-first conservé : aucun service permanent, aucun Docker pour celui qui teste.
- Aucun texte reformulé : identifiant, version, date et URL toujours rendus.
- Premier succès : « article 17 » et « effacement » renvoient tous deux l'article 17, texte exact + provenance.
- Moteur : SQLite + sqlite-vec derrière une interface de retrieval. Postgres reste la cible de la version hébergée, pas du slice local.
- Distribution : portfolio ouvert d'abord (preuve de compétence), version hébergée payante plus tard. Pas de licence locale.
- L'index vectoriel est reconstruit à l'installation, jamais committé : dépôt petit, options ouvertes.
- Séparation public/propriétaire reportée à la phase hébergée : tout est public au premier slice, jeu d'évaluation compris.
- Embedding local par Ollama (`qwen3-embedding:0.6b`, Q8_0, 1 024 dimensions) : pas d'ONNX embarqué, pas d'API cloud.
- Corpus RGPD lu directement depuis CELLAR en XHTML, sans la CLI `eurlex`.
- Deuxième corpus prévu : délibérations CNIL (64 466 chunks déjà vectorisés en bge-m3, Etalab 2.0), avec index incrémental et découpage parent avant ingestion.
- Seuils de confiance calibrés par validation croisée à 4 plis.
- Premier slice : RGPD seul, exact + sémantique + jeu de 22 questions.

## Assumed

- Embeddings précalculés à l'ingestion.
- Pas de reranker au premier slice.
- MCP local (stdio), non déployé.

## Open

- Aucun point bloquant pour le premier slice.
