---
objective: "Le corpus se rafraîchit depuis la veille par une commande idempotente, rapporte sa fraîcheur et s'expose dans le MCP, avec un agent launchd de trois jours."
status: pending
---

# Plan: Rafraîchir le corpus depuis la veille

Source: aidd_docs/tasks/2026_11/2026_11_11_corpus-sync/spec.md

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1 | Correspondance veille → corpus | [`phase-1.md`](./phase-1.md) | none |
| 2 | Orchestrateur, rapport et index | [`phase-2.md`](./phase-2.md) | 1 |
| 3 | Outil MCP `etat_corpus` | [`phase-3.md`](./phase-3.md) | 2 |
| 4 | Ordonnanceur launchd | [`phase-4.md`](./phase-4.md) | 2 |
| 5 | Documentation, mémoire et validation | [`phase-5.md`](./phase-5.md) | 2, 3, 4 |

## Impact

| Catégorie | Verdict et preuve | Phase |
| --- | --- | --- |
| runtime | Quatre synchronisations réseau deviennent déclenchables par une seule commande ; `ce` peut télécharger 1,32 Go, `cc` consomme le budget PISTE, `cjue` interroge CELLAR, `cnil` liste les archives DILA. L'index ajoute un delta Ollama. | 2 |
| régression | Nouveau script `corpus:sync`, nouveau fichier `data/corpus/sync.json`, quatrième outil MCP et instructions du serveur ; les tests stdio attendent quatre outils. | 2, 3 |
| architecture | Un module de correspondance, un orchestrateur, un rapport et un générateur de plist ; aucune modification des synchronisations existantes ni du schéma d'index. | 1–4 |
| documentation | README, `architecture.md`, `codebase-map.md`, `testing.md`, `deployment.md` et `data.md` nomment la commande, le rapport, l'outil et l'agent. | 5 |

## Rules

- `data/` n'est jamais édité à la main ; le rapport est écrit par la commande.
- Aucun appel réseau dans `npm test` : les quatre sources sont injectées.
- Une source en panne n'écrit pas ; le corpus existant reste intact.
- `data/corpus/index/` reste ignoré par git.
- `npm test`, `npm run typecheck` et `npm run build` passent avant tout push.
