---
phase: 5
status: done
observed: 2026-11-10
machine: macOS arm64 (Apple Silicon), 16 GB RAM, llama.cpp 0.9.0
---

# Deux rerankers sur le même jeu : mesures appariées

Tout ce qui suit a été produit le **2026-11-10** (UTC `13:47`–`13:58`) sur la machine de la phase 3, avec `qwen3-embedding:0.6b` (1024 dimensions), le split `dev` de `questions-cnil-etendu.csv` (60 questions : 54 conceptuelles, 6 pièges) et l'index produit `data/corpus/index/index.db` (53 143 unités).

## 1. Protocole

| Élément figé | Valeur | Pourquoi |
| --- | --- | --- |
| Seuils | `bas=0.62`, `haut=0.67`, `marge=0.01` (lus dans `mesures/base-dev.json`, passés par `--seuils`) | Sans seuils figés, deux configurations changeraient à la fois l'ordre des passages et leur rendu : le gain d'ordre se confondrait avec un changement de calibration. |
| Split | `dev` uniquement | Le `test` ne se mesure qu'une fois, après les corrections. Aucun `--mesurer-test` n'a été passé. |
| Questions | les 60 du même CSV, dans l'ordre du fichier | Un JSON candidat hors ordre fait lever `aligner` au rang décalé. |
| Vue du verdict | `--vue brute` | Sous les seuils du témoin, un premier passage reranké dont la similarité **dense** tombe sous `bas` viderait `refs` et effacerait un gain réel. La recalibration du rendu appartient à la phase 6. |
| Domaine de décision | 54 questions conceptuelles | Les 6 pièges n'ont pas de référence attendue, les références exactes sont déterministes (aucune dans ce jeu). |

Le rerank ne change jamais l'échelle de confiance : `mcp/tools.ts` conserve la distance dense de chaque passage et ne réordonne que la liste, donc `seuils` s'appliquent à la même grandeur dans les trois configurations.

## 2. Matériel

Serveur, identique aux deux mesures sauf le fichier de modèle :

```console
$ llama-server --reranking -m ~/.cache/vitrine-rerank/<gguf> --port 8080
```

| Reranker | GGUF | Taille (octets) | `sha256` local | Score observé |
| --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | `ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF` → `qwen3-reranker-0.6b-q8_0.gguf` (téléchargé en phase 3) | 639 153 184 | `22c9979ce4fbcdc5acdc310c6641c32797eff1aa980b8f7a2db8a8ea23429a48` | `[0, 1]` |
| `bge-reranker-v2-m3` | `gpustack/bge-reranker-v2-m3-GGUF` → `bge-reranker-v2-m3-Q8_0.gguf` | 635 676 416 | `a43c7c9b11a4c1517e5bf95151960e1621d1b72f7a493364b01e386cf1aaa1d3` | logits (`5.805`, `-9.223` sur un essai) ; `relevance_score` fini mais hors `[0, 1]` |

`Q8_0` des deux côtés : la comparaison ne mélange pas deux quantifications. Le `sha256` bge correspond à la taille publiée par l'API Hugging Face (`635676416`).

Conséquence à retenir : les scores bge ne sont **ni** des cosinus **ni** des probabilités, et ne se comparent pas à ceux de Qwen3. L'adaptateur `createLlamaReranker` n'exige qu'un nombre fini, ce qui tient pour les deux.

## 3. Les trois configurations

`recall@5` et `MRR` sont calculés sur les 54 questions sémantiques ; « brut » = `refs` avant seuils, « rendu » = ce que le lecteur reçoit sous les seuils du témoin.

| Configuration | recall@5 (brut = rendu) | MRR | top 1 brut | top 1 rendu | Pièges cités | Niveaux (confiant / incertain / aucun) | Pièges confiants | Latence rerank moyenne |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` (témoin) | **38/54 = 70,4 %** | **0,6157** | 29/54 = 53,7 % | 29/54 | 6/6 | 31 / 23 / 0 | 4 | aucun étage |
| + `Qwen3-Reranker-0.6B` | **42/54 = 77,8 %** | **0,6108** | 27/54 = 50,0 % | 27/54 | 6/6 | 32 / 22 / 0 | 4 | **3 603,6 ms** |
| + `bge-reranker-v2-m3` | **42/54 = 77,8 %** | **0,6812** | 33/54 = 61,1 % | 33/54 | 6/6 | 23 / 30 / 1 | 2 | **2 315,3 ms** |

Écart contre le témoin :

| | recall@5 | MRR | top 1 brut |
| --- | --- | --- | --- |
| Qwen3 | +4 questions (+7,4 pts) | −0,0049 | −2 questions |
| bge | +4 questions (+7,4 pts) | +0,0654 | +4 questions |

Aucun des deux ne réduit les pièges cités : **6/6 restent cités** dans les trois configurations. Le niveau de confiance vient de la similarité dense du premier passage, que le rerank ne modifie pas ; seuls les pièges *confiants* baissent (4 → 4 pour Qwen3, 4 → 2 pour bge).

Une question passe sous `bas` en rendu avec bge (similarité dense du premier passage reranké `0,605`) : « Quelle sanction la CNIL a-t-elle prononcée contre l'application musical.ly devenue TikTok… », attendue `CNILTEXT000046977994`, premier passage `CNILTEXT000036403140#f20`. Elle échouait déjà dans la vue brute : `top 5 rendu` reste à 42/54 pour les deux candidats.

## 4. Comparaisons appariées, sorties verbatim

### Qwen3-Reranker-0.6B

```text
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 42/54 (77.8 %)
top 5 rendu : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 42/54 (77.8 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 27/54 (50.0 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 27/54 (50.0 %)
paires discordantes au rang 1 brut : b = 8 (candidat seul), c = 10 (référence seule)
McNemar exact : p = 0.8145294189453125
verdict (brut) : conserver — le candidat ne gagne pas plus de paires qu'il n'en perd (b=8, c=10)
```

Code de sortie : `0`.

### bge-reranker-v2-m3

```text
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 42/54 (77.8 %)
top 5 rendu : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 42/54 (77.8 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 33/54 (61.1 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 33/54 (61.1 %)
paires discordantes au rang 1 brut : b = 11 (candidat seul), c = 7 (référence seule)
McNemar exact : p = 0.480682373046875
verdict (brut) : non_etabli — p = 0.4807 ≥ 0,05 : le gain n'est pas significatif
```

Code de sortie : `2` — `non_etabli`, pas un échec du protocole.

## 5. Coût

| | Latence moyenne du bloc `rerank` (60 questions) | Total observé par question |
| --- | --- | --- |
| Sans rerank | — | 4,4 s pour les 60 questions ≈ **73 ms** (mesure indicative hors protocole, voir §7) |
| `Qwen3-Reranker-0.6B` | **3 603,6 ms** | 3 min 44 s pour 60 questions ≈ **3,74 s** |
| `bge-reranker-v2-m3` | **2 315,3 ms** | 2 min 25 s ≈ **2,41 s** |

Le rerank coûte **30 à 50 fois** la recherche dense seule : ≈ +3,53 s par question avec Qwen3, +2,24 s avec bge. bge est **1,56 fois plus rapide** que Qwen3 à quantification égale.

## 6. Ce que ces verdicts ne prouvent pas

- **60 questions CNIL de `dev`, un seul corpus.** Six pièges et 54 questions sémantiques ne départagent pas deux rerankers à 4 paires discordantes près ; aucun chiffre ici ne se transporte au RGPD, à l'AI Act ou à la LIL.
- **`conserver` pour Qwen3 ne prouve pas que le rerank nuit** : le top 5 brut gagne 4 questions (+7,4 pts). Il dit seulement que le rang 1 ne s'améliore pas de façon crédible (b=8 < c=10) et que la règle figée refuse d'adopter sur ce signal.
- **`non_etabli` pour bge ne prouve pas l'absence de gain** : b=11 contre c=7, top 5 +4 questions, MRR +0,065. Le test exact sur 18 paires discordantes ne distingue pas ce déséquilibre du hasard (p=0,48). Un jeu plus grand, ou un test centré sur le top 5 au lieu du rang 1, pourrait conclure autrement — ce n'est pas mesuré.
- **La vue rendue n'est pas recalibrée.** Sous les seuils du témoin, un candidat peut perdre une question par un premier passage dense sous `bas` ; le rendu des deux candidats est donc mesuré, pas optimisé.
- **La latence est celle de cette machine**, avec les réglages par défaut de `llama-server` (4 slots, contexte 40 960) et un seul client séquentiel. Ni la concurrence, ni un contexte réduit, ni un autre matériel ne sont couverts.
- **Les scores des deux rerankers ne se comparent pas** entre eux : seul l'effet sur l'ordre, mesuré sur les mêmes questions, est comparable.

## 7. Intégrité du produit

| Contrôle | Résultat |
| --- | --- |
| `sha256 data/corpus/index/index.db` avant la mesure Qwen3 (13:49:08 UTC) | `a1f93b75d24376356c8825bc0925eeb0ae1646276f52447647f560a6526d60f4` |
| idem juste avant la mesure bge | identique |
| idem juste après la mesure bge (13:58:20 UTC) | identique |
| `npm run corpus:index` | `53143 unités indexées … 0 ajoutées, 0 modifiées, 0 supprimées, 53143 inchangées, 0 métadonnées rafraîchies` |
| `sha256` après `corpus:index` | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` — le fichier change d'octets à ce passage (le contrôle avant/après mesure est donc pris hors `corpus:index`), mais aucune unité n'est réembarquée |
| `git status --short` | aucun fichier sous `data/corpus/` ; seuls les deux JSON de mesure et ce rapport sont nouveaux |

## 8. Écarts au protocole

1. Le dépôt du GGUF bge est `gpustack/bge-reranker-v2-m3-GGUF` (consigne de la phase), pas `BAAI/bge-reranker-v2-m3` (formulation de `phase-5.md`) ; `BAAI` ne publie pas de GGUF. Fichier `Q8_0` choisi pour égaler la quantification du témoin Qwen3.
2. La sonde à deux questions a servi de test de fumée pour Qwen3 uniquement (CSV temporaire, puis supprimé). Pour bge, un appel `POST /reranking` direct a tenu ce rôle.
3. Le chiffre « sans rerank ≈ 73 ms par question » vient d'une passe `dev` supplémentaire sans `--rerank`, mesurée hors des deux exécutions du protocole, sortie jetée. Il sert d'ordre de grandeur au surcoût, il n'est pas dans `base-dev.json`.
4. Les deux serveurs ont été arrêtés après les mesures ; le port 8080 est libre.
