---
objective: "Le MCP indexe et interroge avec `leoipulsar/harrier-0.6b` servi par Ollama, sa table CNIL est recalibrée sur `dev` et sa promesse constatée sur le `test` déjà stocké."
status: completed
---

# Plan: Basculer l'embedding sur Harrier 0.6B servi par Ollama

Source: ticket GitHub #20, `Basculer l'embedding sur Harrier 0.6B servi par Ollama`

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Index d'expérience et reproduction du `dev` | [`phase-1.md`](./phase-1.md) | none |
| 2   | Calibration sur `dev` et plancher de refus | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Promesse constatée sur le `test` stocké | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Reconstruction de l'index produit et seconde passe | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | Mesures `dev` des cinq autres corpus et de la doctrine | [`phase-5.md`](./phase-5.md) | 4 |
| 6   | Bascule du produit, de la table et de la documentation | [`phase-6.md`](./phase-6.md) | 5 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://ollama.com/leoipulsar/harrier-0.6b | paquet Ollama Q8_0, 1 024 dimensions, architecture qwen3, 639 Mo, vérifié le 2026-11-11 |
| https://github.com/Beccariavf/vitrine/issues/20 | contrat, étapes, critères d'acceptation et hors-périmètre |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | `MODELE_DEFAUT` (`mcp/embed/embedder.ts:12`) change de modèle et l'index produit de 53 143 unités doit être reconstruit : `ouvrirExistant` refuse un index d'un autre modèle puis le reconstruit. | 4, 6 |
| regression | `tests/mcp.test.ts:752-857` fige la table et lit `promesse.md` ; `tests/index.test.ts:179,244,253,384` fige le modèle par défaut ; `tests/eval.test.ts:395` fige la table CNIL via `seuilsDeMesure`. | 6 |
| documentation | README (`:34,51-52,190,207-238`), `mcp/server.ts` (`CONSIGNE_PROMESSE`), `promesse.md`, `aidd_docs/memory/{architecture,data,testing}.md`, et le commentaire de `mcp/corpus/cnil/historique.ts:6-7` qui nomme l'espace vectoriel du produit. | 6 |
| architecture | none — le fournisseur Ollama, l'index incrémental et la mécanique des seuils par corpus ne changent pas. | none |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| La table de confiance est liée au couple (modèle, corpus) | Un changement d'embedder déplace l'échelle de similarité : `promesse.md` §6 l'énonce comme condition d'invalidation. |
| Le split `test` ne se mesure qu'une fois | `test-harrier.json` existe déjà ; aucune commande `--mesurer-test` ne doit tourner dans ce lot. |
| Une règle se fige avant de relire le test | `confirmation.md` §3 exige de figer le triplet sur `dev` avant de le constater sur le `test` stocké. |
| Le garde du test est par nom de modèle | `questions-cnil-etendu.test-consomme.json` porte `qwen3-embedding:0.6b` et `mradermacher/harrier-oss-v1-0.6b-GGUF` ; le nom `leoipulsar/harrier-0.6b` ne doit jamais être mesuré en `--split test`, et la limite se dit dans la documentation. |
| Un second passage d'indexation n'embarque rien | `aidd_docs/memory/data.md` : l'empreinte (modèle, dimension, passage) décide du delta. |
| Aucun appel réseau dans la CI | `npm test` construit ses index avec un embedder factice ; seul `corpus:index` touche Ollama. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| `promesse.md` est réécrit pour Harrier plutôt que doublé | Il porte le contrat de la table que le code applique, et `tests/mcp.test.ts` lit ses lignes « Seuils retenus » et « Repli » ; les chiffres qwen3 restent dans `mesures/` et `confirmation.md`. |
| L'index produit est reconstruit avant les mesures des autres corpus | Il sert de base commune et évite une seconde indexation de 53 143 unités dans la racine d'expérience. |
| Le service de production est Ollama | Le paquet `leoipulsar/harrier-0.6b` est équivalent au modèle mesuré (rangs et niveaux identiques sur `dev`, écart de similarité ≤ 7,0 × 10⁻⁵) ; Unsloth Studio est une application de bureau, pas un démon supervisé. |
| L'index d'expérience vit hors du dépôt | `--root ~/.cache/vitrine-harrier-ollama/root` laisse `data/corpus/index/index.db` intact jusqu'à la bascule. |
