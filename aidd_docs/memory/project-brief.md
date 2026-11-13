# Project Brief

Ce que ce projet est, le problème qu'il résout et son vocabulaire métier. Le « pourquoi » non-dérivable, pas le « comment ».

## What it is

- Vitrine : le site de Valentin Fouich, juriste en droit du numérique. Aujourd'hui une vitrine : l'accueil réorganisé met en avant le connecteur en préparation, liste ses collections réelles (`src/lib/corpus.ts`) et publie la veille.
- Plus tard : un abonnement au connecteur, qui relie l'IA du juriste aux sources officielles du droit des données personnelles.
- Cible : les juristes en données personnelles (cabinets, directions juridiques, DPO).
- Il démontre, par des outils qui fonctionnent réellement, sa capacité à automatiser des tâches juridiques récurrentes.

## Why it exists

- Prouver par des données réelles avant de vendre : aucune offre n'est publiée tant que le connecteur n'est pas livrable.
- Objectif secondaire mais prioritaire : la montée en compétence de son auteur en développement. Chaque livraison doit être expliquée, pas seulement fonctionnelle.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Veille | Détection des nouveautés publiées par les autorités sur un périmètre donné. |
| Matière | Un des cinq blocs sélectionnables : données personnelles, IA, cybersécurité, données non personnelles, plateformes. |
| Source officielle | Texte ou décision publié par une autorité (Légifrance, Judilibre, EUR-Lex, CNIL). |
| Snapshot | La réponse brute d'une source, conservée telle quelle pour prouver ce qui a été lu. |
| Entrée | Une nouveauté normalisée, identifiée par un hash, prête à être publiée. |
| Adaptateur | Le module qui parle à une source et rend des entrées normalisées. |
| MCP | Serveur exposant des outils à un modèle, sur les sources officielles. |

## Key features

- Veille sélectionnable par matière : données personnelles, IA, cybersécurité, données non personnelles, plateformes.
- Neuf autorités officielles, dix adaptateurs : CNIL, CJUE, ANSSI, CEPD, ARCEP, Commission (numérique et DMA), ARCOM, Conseil d'État, Cour de cassation.
- MCP juridique sur sources officielles.
- Mode « Explique-moi » : chaque livraison explique le code et les choix.
