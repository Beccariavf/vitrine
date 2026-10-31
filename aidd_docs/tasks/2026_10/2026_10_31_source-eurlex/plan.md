---
objective: "La veille publie la jurisprudence CJUE filtrée par tags, avec ses références juridiques, et le propriétaire règle les tags depuis un espace local."
status: in-progress
---

# Plan: Jurisprudence CJUE via EUR-Lex

Source: aidd_docs/tasks/2026_10/2026_10_31_source-eurlex/spec.md

## Phases

| #   | Phase               | File                         | Depends on |
| --- | ------------------- | ---------------------------- | ---------- |
| 1   | contrat-references  | [`phase-1.md`](./phase-1.md) | none       |
| 2   | tags-et-filtre      | [`phase-2.md`](./phase-2.md) | none       |
| 3   | adaptateur-cjue     | [`phase-3.md`](./phase-3.md) | 1, 2       |
| 4   | site                | [`phase-4.md`](./phase-4.md) | 2, 3       |
| 5   | parametres          | [`phase-5.md`](./phase-5.md) | 2, 3, 4    |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163 | 100 arrêts, date de décision dans le titre, `pubDate` partiel, cas Jautiva, titres `#` et crochets. |
| https://eur-lex.europa.eu/content/legal-notice/legal-notice.html | Réutilisation sous CC BY 4.0 avec attribution. |

## Impact

| Category       | Verdict and evidence | Handled in |
| -------------- | -------------------- | ---------- |
| runtime        | Le pipeline appellera EUR-Lex ; le flux a répondu 200 avec l'agent du projet le 31/10/2026 ; les tests utilisent une fixture, le site ne fait aucune requête réseau. | 3 |
| regression     | Le contrat `Entry` gagne `references` ; lecteur, écrivain, fixtures, données et tests sont touchés ; risque moyen ; la phase 1 est le filet de sécurité du contrat. | 1 |
| architecture   | Deuxième adaptateur, catalogue de tags, filtre de publication, outil local ; aucun serveur de production, aucune base. | 2, 3, 4, 5 |
| documentation  | `data.md`, `architecture.md`, `ecosystem.md`, `design.md`, `codebase-map.md`, `testing.md`, `deployment.md`, `tools/README.md`. | 3, 4, 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le snapshot brut est conservé | Il prouve ce qui a été lu ; le filtre ne réécrit pas la source. |
| `data/` jamais édité à la main | Le contrat change ; les entrées seront régénérées par `npm run veille`. |
| Pages publiques sans JavaScript | L'outil de paramètres reste local, hors build public. |
| Un adaptateur par source | CNIL et CJUE restent isolés ; une panne n'emporte pas l'autre. |
| Références non inventées | Elles viennent du titre officiel ; aucun modèle, aucune reformulation. |
| CI comme porte | Typecheck, tests et build rejoués à chaque push. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| `Entry.references` | Les instruments et articles du titre officiel sont une donnée, pas un tag de filtre ; le site les affiche. |
| Catalogue dans `veille/tags.json` | Le pipeline et le site lisent la même configuration ; l'outil local l'écrit. |
| Ingestion sur les tags actifs, retrait des arrêts devenus inactifs | La passe applique la sélection ; le snapshot brut reste la preuve de ce qui a été lu. |
| Filtre et références sur le titre officiel | Le flux ne fournit pas de description ; le sujet et les articles sont dans le titre, le `pubDate` est un secours pour la date. |
| Identifiant sur l'URL complète ou le CELEX | `canonicalUrl` supprime la query EUR-Lex et donnerait le même id à tous les arrêts. |
| Panne partielle | Les sources réussies sont écrites ; la passe échoue ensuite avec un message clair. |
| Outil de paramètres local HTML | Pas de serveur, pas de build public, pas de JavaScript sur les pages publiques. |
