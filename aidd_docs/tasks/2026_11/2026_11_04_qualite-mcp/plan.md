---
objective: "Sur les 15 questions tenues à l'écart, la référence attendue est dans le top 5 à 90 % et aucun piège n'est cité avec confiance ; l'index ne recalcule que le delta."
status: implemented
---

# Plan: Qualité mesurée du MCP et index incrémental

Source: aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Jeu de 50 questions | [`phase-1.md`](./phase-1.md) | none |
| 2   | Articles prioritaires | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Confiance calibrée | [`phase-3.md`](./phase-3.md) | 1, 2 |
| 4   | Index incrémental | [`phase-4.md`](./phase-4.md) | none |
| 5   | Rapport et documentation | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://docs.ollama.com/api/embed | `POST /api/embed` avec `{ model, input }` rend `{ embeddings }` ; vérifié localement sur 0.6b et 4b. |
| https://ollama.com/library/qwen3-embedding | `qwen3-embedding:0.6b` rend 1 024 dimensions en Q8_0 ; `4b` rend 2 560 dimensions et place l'article 20 au rang 2 sur la paraphrase, pour 129,6 s sur 272 unités contre 19,3 s mesurés le 4 novembre 2026. |
| https://github.com/asg017/sqlite-vec | `vec0` accepte `DELETE` et `INSERT` par `rowid` ; aucune structure ANN à réentraîner, donc l'incrémental ne coûte que les nouveaux vecteurs. |
| https://nodejs.org/api/sqlite.html | `DatabaseSync` accepte `allowExtension: true` et des transactions explicites. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Mesuré : `qwen3-embedding:0.6b` indexe 272 unités en ~19 s ; `4b` en ~130 s. L'index incrémental ne paie que le delta. | 1, 4 |
| regression | La suite actuelle (295 tests) est rejouée à chaque phase ; les outils et le serveur gardent leur contrat. Risque : moyen sur le classement et la confiance, couvert par les tests existants. | 1, 2, 3 |
| architecture | L'index gagne une empreinte de contenu et un diff ; le classement gagne une bande de préférence ; la confiance gagne une marge. Aucun changement de transport ni de corpus. | 2, 3, 4 |
| documentation | `eval.md` porte les résultats de développement et de test, l'expérience 4b et les limites ; la mémoire et le README suivent. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Le jeu de tests par défaut ne touche pas le réseau. | L'embedder et l'index sont injectés ; `MCP_TEST_OLLAMA=1` reste opt-in. |
| Les 15 questions tenues à l'écart ne règlent aucun seuil. | Sinon la mesure finale ne prouve rien. |
| `data/` n'est jamais édité à la main. | `corpus:build` et `corpus:index` produisent les fichiers. |
| Versions épinglées. | Aucune dépendance nouvelle n'est nécessaire. |
| Un commit = une préoccupation. | Chaque phase se vérifie et se commite seule. |
| Aucune écriture sur `stdout` dans le serveur MCP. | `stdout` porte le JSON-RPC. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Garder `qwen3-embedding:0.6b` comme modèle du produit. | ~75 min pour la CNIL contre ~8,5 h avec 4b ; la barre choisie est une preuve crédible, pas un outil de production. |
| Documenter l'expérience 4b au lieu de l'intégrer. | Elle prouve que la limite de paraphrase vient du modèle, sans imposer un index 6,7 fois plus lent. |
| Un article passe devant un considérant dans une bande de similarité calibrée. | Le considérant éclaire, l'article pose la règle ; on ne supprime pas le contexte. |
| Marge de confiance non nulle. | `incertain` doit exister quand les deux premiers passages sont proches. |
| Index incrémental par empreinte de contenu et table `ref → rowid`. | Le `rowid` positionnel actuel glisse dès que l'ordre change. |
| Le découpage fin reste hors périmètre. | Les articles du RGPD sont déjà courts ; il servira aux délibérations CNIL. |
