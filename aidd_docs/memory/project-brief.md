# Project Brief

Ce que ce projet est, le problème qu'il résout et son vocabulaire métier. Le « pourquoi » non-dérivable, pas le « comment ».

## What it is

- Vitrine : portfolio technique d'un avocat en droit du numérique, destiné aux recruteurs et aux associés de cabinets (droit du numérique, IP-IT, data).
- Il démontre, par des outils qui fonctionnent réellement, sa capacité à automatiser des tâches juridiques récurrentes.

## Why it exists

- Prouver une compétence, pas vendre un SaaS : le site est la vitrine, les trois produits en sont les preuves.
- Objectif secondaire mais prioritaire : la montée en compétence de son auteur en développement. Chaque livraison doit être expliquée, pas seulement fonctionnelle.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Veille | Détection des nouveautés publiées par les autorités sur un périmètre donné. |
| Source officielle | Texte ou décision publié par une autorité (Légifrance, Judilibre, EUR-Lex, CNIL). |
| Snapshot | La réponse brute d'une source, conservée telle quelle pour prouver ce qui a été lu. |
| Entrée | Une nouveauté normalisée, identifiée par un hash, prête à être publiée. |
| Adaptateur | Le module qui parle à une source et rend des entrées normalisées. |
| MCP | Serveur exposant des outils à un modèle, sur les sources officielles. |

## Key features

- Veille automatisée sur le droit du numérique : RGPD, AI Act, NIS2/DORA, CRA, Data Act.
- MCP juridique sur sources officielles.
- Plugin de workflows juridiques déterministes, inspiré d'AIDD.
- Mode « Explique-moi » : chaque livraison explique le code et les choix.
