---
phase: 5
status: done
observed: 2026-11-10
machine: macOS arm64 (Apple Silicon), 16 GB RAM, llama.cpp 0.9.0
---

# Deux rerankers sur le même jeu : mesures appariées

Mesures **refaites le 2026-11-10** (UTC `15:00`–`15:25`) après le rééquilibrage du
jeu, sur la machine de la phase 3, avec `qwen3-embedding:0.6b` (1024 dimensions),
le split `dev` de `questions-cnil-etendu.csv` (60 questions : 54 conceptuelles,
6 pièges) et l'index produit `data/corpus/index/index.db` (53 143 unités).

Le rééquilibrage a déplacé six recommandations de `dev` vers `test` et six avis en
sens inverse : `dev` porte maintenant **20 avis + 7 recommandations + 27 sanctions
+ 6 pièges**. Toute mesure `dev` antérieure à ce gel est caduque, y compris les
figures de la première passe de cette phase et celles de l'expérience
d'instruction ; les deux ont été refaites.

## 1. Protocole

| Élément figé | Valeur | Pourquoi |
| --- | --- | --- |
| Seuils | `bas=0.62`, `haut=0.67`, `marge=0.01` (lus dans `mesures/base-dev.json`, passés par `--seuils`) | Sans seuils figés, deux configurations changeraient à la fois l'ordre des passages et leur rendu : le gain d'ordre se confondrait avec un changement de calibration. |
| Split | `dev` uniquement | Le `test` ne se mesure qu'une fois, après les corrections. Aucun `--split test` ni `--mesurer-test` n'a été passé. |
| Questions | les 60 du même CSV, dans l'ordre du fichier, vérifié JSON contre JSON | Un JSON candidat hors ordre fait lever `aligner` au rang décalé. |
| Vue du verdict | `--vue brute` | Sous les seuils du témoin, un premier passage reranké dont la similarité **dense** tombe sous `bas` viderait `refs` et effacerait un gain réel. La recalibration du rendu appartient à la phase 6. |
| Domaine de décision | 54 questions conceptuelles | Les 6 pièges n'ont pas de référence attendue, les références exactes sont déterministes (aucune dans ce jeu). |

Le rerank ne change jamais l'échelle de confiance : `mcp/tools.ts` conserve la
distance dense de chaque passage et ne réordonne que la liste, donc `seuils`
s'appliquent à la même grandeur dans les trois configurations.

## 2. Matériel

Serveur, identique aux deux mesures sauf le fichier de modèle :

```console
$ llama-server --reranking -m ~/.cache/vitrine-rerank/<gguf> --port 8080
```

| Reranker | GGUF | Taille (octets) | `sha256` local | Échelle des scores |
| --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | `ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF` → `qwen3-reranker-0.6b-q8_0.gguf` | 639 153 184 | `22c9979ce4fbcdc5acdc310c6641c32797eff1aa980b8f7a2db8a8ea23429a48` | `[0, 1]` |
| `bge-reranker-v2-m3` | `gpustack/bge-reranker-v2-m3-GGUF` → `bge-reranker-v2-m3-Q8_0.gguf` | 635 676 416 | `a43c7c9b11a4c1517e5bf95151960e1621d1b72f7a493364b01e386cf1aaa1d3` | logits (`0,088` et `−8,546` sur l'essai de fumée) ; `relevance_score` fini mais hors `[0, 1]` |

Les deux empreintes ont été revérifiées avant les mesures. `Q8_0` des deux
côtés : la comparaison ne mélange pas deux quantifications.

Conséquence à retenir : les scores bge ne sont **ni** des cosinus **ni** des
probabilités, et ne se comparent pas à ceux de Qwen3. L'adaptateur
`createLlamaReranker` n'exige qu'un nombre fini, ce qui tient pour les deux.

## 3. Les trois configurations

`recall@5` et `MRR` sont calculés sur les 54 questions sémantiques ; « brut » =
`refs` avant seuils, « rendu » = ce que le lecteur reçoit sous les seuils du
témoin.

| Configuration | recall@5 (brut = rendu) | MRR | top 1 brut | top 1 rendu | Pièges cités | Niveaux (confiant / incertain / aucun) | Pièges confiants | Latence rerank moyenne |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` (témoin) | **39/54 = 72,2 %** | **0,6250** | 29/54 = 53,7 % | 29/54 | 6/6 | 30 / 24 / 0 | 4 | aucun étage |
| + `Qwen3-Reranker-0.6B` | **45/54 = 83,3 %** | **0,6432** | 28/54 = 51,9 % | 28/54 | 6/6 | 30 / 24 / 0 | 4 | **9 332,0 ms** |
| + `bge-reranker-v2-m3` | **45/54 = 83,3 %** | **0,7423** | 36/54 = 66,7 % | 36/54 | 6/6 | 24 / 29 / 1 | 2 | **3 594,7 ms** |

Écart contre le témoin :

| | recall@5 | MRR | top 1 brut | Pièges confiants |
| --- | --- | --- | --- | --- |
| Qwen3 | +6 questions (+11,1 pts) | +0,0182 | −1 question | 4 → 4 |
| bge | +6 questions (+11,1 pts) | +0,1173 | +7 questions | 4 → 2 |

Aucun des deux ne réduit les pièges cités : **6/6 restent cités** dans les trois
configurations. Le niveau de confiance vient de la similarité dense du premier
passage, que le rerank ne modifie pas ; seuls les pièges *confiants* baissent
(4 → 4 pour Qwen3, 4 → 2 pour bge).

Une question bascule en `aucun_resultat_fiable` avec bge : « Quelle sanction la
CNIL a-t-elle prononcée contre l'application musical.ly devenue TikTok ? ». Le
témoin la plaçait au rang 1 ; bge pousse `CNILTEXT000046977994` hors des cinq
premiers, et le premier passage de son nouvel ordre porte une similarité dense de
`0,605`, sous `bas`. Elle échouait déjà au top 5 dans la vue brute, donc
`top 5 rendu` reste à 45/54 : le refus ne retire pas de question gagnée, il en
masque une perdue.

Distribution du rang de la première référence attendue (54 questions) :

| Configuration | rang 1 | rang 2 | rang 3 | rang 4 | rang 5 | absent |
| --- | --- | --- | --- | --- | --- | --- |
| témoin | 29 | 9 | 0 | 1 | 0 | 15 |
| + Qwen3 | 28 | 9 | 4 | 2 | 2 | 9 |
| + bge | 36 | 7 | 1 | 1 | 0 | 9 |

Les deux rerankers ramènent de 15 à 9 le nombre de questions sans attendue dans
les cinq premiers. Qwen3 paie ce gain au rang 1 (−1) ; bge le convertit (+7).

## 4. Comparaisons appariées, sorties verbatim

### Qwen3-Reranker-0.6B

```text
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 45/54 (83.3 %)
top 5 rendu : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 45/54 (83.3 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 28/54 (51.9 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank Qwen3-Reranker-0.6B » 28/54 (51.9 %)
paires discordantes au rang 1 brut : b = 8 (candidat seul), c = 9 (référence seule)
McNemar exact : p = 1
verdict (brut) : conserver — le candidat ne gagne pas plus de paires qu'il n'en perd (b=8, c=9)
```

Code de sortie : `0`.

### bge-reranker-v2-m3

```text
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 45/54 (83.3 %)
top 5 rendu : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 45/54 (83.3 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 36/54 (66.7 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b + rerank bge-reranker-v2-m3 » 36/54 (66.7 %)
paires discordantes au rang 1 brut : b = 13 (candidat seul), c = 6 (référence seule)
McNemar exact : p = 0.1670684814453125
verdict (brut) : non_etabli — p = 0.1671 ≥ 0,05 : le gain n'est pas significatif
```

Code de sortie : `2` — `non_etabli`, pas un échec du protocole.

## 5. Tranche doctrine (prémisse de l'issue #17)

`questions-cnil-doctrine.csv`, 10 questions de doctrine (7 avis, 3 recommandations
ou lignes directrices), split `dev`, voie dense, **sans `--instruction` et sans
`--seuils`** (chaque configuration calibre les siens, et les trois ont le même
embedder : seul l'ordre change, les seuils calibrés ne servent ici qu'à compter
les niveaux) :

```sh
node mcp/eval/run.ts --questions questions-cnil-doctrine.csv --split dev --json \
  [--rerank <modèle> --rerank-url http://127.0.0.1:8080]
```

| Configuration | top 5 | MRR | top 1 | Seuils calibrés | Niveaux (confiant / incertain) | Latence rerank moyenne |
| --- | --- | --- | --- | --- | --- | --- |
| témoin `qwen3-embedding:0.6b` (`mesures/doctrine-qwen.json`) | 3/10 = 30,0 % | 0,225 | 2/10 = 20,0 % | 0,71 / 0,76 / 0,01 | 8 / 2 | — |
| + `Qwen3-Reranker-0.6B` (`mesures/doctrine-qwen3rerank.json`) | 3/10 = 30,0 % | 0,300 | 3/10 = 30,0 % | 0,68 / 0,73 / 0,02 | 4 / 6 | 3 450,0 ms |
| + `bge-reranker-v2-m3` (`mesures/doctrine-bge.json`) | 4/10 = 40,0 % | 0,245 | 2/10 = 20,0 % | 0,66 / 0,76 / 0,02 | 2 / 8 | 2 285,8 ms |

Croisement « niveau × justesse » au top 5 :

| Configuration | `confiant` juste | `confiant` faux | `incertain` juste | `incertain` faux |
| --- | --- | --- | --- | --- |
| témoin | 3 | 5 | 0 | 2 |
| + Qwen3 | 2 | 2 | 1 | 5 |
| + bge | 2 | 0 | 2 | 6 |

Lecture de la tranche :

- Le témoin place la bonne délibération dans les cinq premiers 3 fois sur 10,
  dont **5 erreurs étiquetées « confiant »** sur 8 : c'est bien la prémisse de
  l'issue #17.
- Qwen3 remonte une question au top 1 (2 → 3) et porte le MRR de 0,225 à 0,300
  sur ces dix questions, mais **ne gagne aucune question au top 5** ; ses niveaux
  se déplacent (8 confiant → 4), sans que le nombre de bonnes réponses bouge.
- bge gagne une question au top 5 (4/10) et ne bouge pas le top 1 ; il ne reste
  que 2 réponses « confiant », toutes justes.
- Les écarts sont minces : au rang 1, Qwen3 gagne une paire et n'en perd aucune
  (`b=1, c=0`), bge en gagne une et en perd une (`b=1, c=1`). Dix questions ne
  distinguent aucun de ces résultats du bruit, et la règle figée exige six
  paires discordantes : elle ne s'applique pas ici.

## 6. Coût

`rerank.latence_ms_moyenne` de chaque JSON, 60 questions, 50 candidats par
question :

| | Latence moyenne du bloc `rerank` | Surcoût par question |
| --- | --- | --- |
| Sans rerank | — | ≈ 73 ms pour la recherche dense seule (ordre de grandeur hors protocole) |
| `Qwen3-Reranker-0.6B` | **9 332,0 ms** | ≈ +9,26 s |
| `bge-reranker-v2-m3` | **3 594,7 ms** | ≈ +3,52 s |

bge est **2,6 fois plus rapide** que Qwen3 à quantification égale. Les deux
coûtent 49 à 128 fois la recherche dense seule.

La latence Qwen3 est **2,6 fois** celle de la sonde de la phase 3 (3 646 ms de
médiane sur 50 passages) comme celle de la première passe de cette phase
(3 603,6 ms) ; bge, lui, passe de 2 315,3 ms à 3 594,7 ms (×1,55). Modèle et
réglages identiques : la machine portait aussi les deux `llama-server` d'Unsloth
Studio pendant les passes. Le rapport peut donc surestimer Qwen3 ; c'est le
rapport entre les deux candidats, mesuré dans les mêmes conditions, qui reste
utilisable. Aucun verdict ne dépend de ce chiffre.

## 7. Ce que ces verdicts ne prouvent pas

- **60 questions CNIL de `dev`, un seul corpus.** Six pièges et 54 questions
  sémantiques ne départagent pas deux rerankers à 17 et 19 paires discordantes
  près ; aucun chiffre ici ne se transporte au RGPD, à l'AI Act ou à la LIL.
- **La tranche doctrine ne fait que 10 questions.** Elle motive l'expérience,
  elle ne conclut rien : voir §5.
- **`conserver` pour Qwen3 ne prouve pas que le rerank nuit** : le top 5 brut
  gagne 6 questions (+11,1 pts). Il dit seulement que le rang 1 ne s'améliore
  pas de façon crédible (b=8 < c=9) et que la règle figée refuse d'adopter sur
  ce signal.
- **`non_etabli` pour bge ne prouve pas l'absence de gain** : b=13 contre c=6,
  top 5 +6 questions, top 1 +7, MRR +0,117. Le test exact sur 19 paires
  discordantes ne distingue pas ce déséquilibre du hasard (p=0,167). Un jeu plus
  grand, ou un test centré sur le top 5 au lieu du rang 1, pourrait conclure
  autrement — ce n'est pas mesuré.
- **La vue rendue n'est pas recalibrée.** Sous les seuils du témoin, bge perd une
  question par un premier passage dense sous `bas` ; le rendu des deux candidats
  est donc mesuré, pas optimisé.
- **La latence est celle de cette machine**, avec les réglages par défaut de
  `llama-server` (4 slots, contexte 40 960), un seul client séquentiel, et deux
  serveurs d'embedding actifs. Ni la concurrence, ni un contexte réduit, ni un
  autre matériel ne sont couverts.
- **Les scores des deux rerankers ne se comparent pas** entre eux : seul l'effet
  sur l'ordre, mesuré sur les mêmes questions, est comparable.

## 8. Intégrité du produit

| Contrôle | Résultat |
| --- | --- |
| `sha256 data/corpus/index/index.db` avant la mesure Qwen3 (`15:00:08 UTC`) | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` |
| idem juste avant la mesure bge | identique |
| idem après l'arrêt des deux serveurs (`15:24:58 UTC`) | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` — octet pour octet, le fichier n'a pas été touché |
| `git status --short` | aucun fichier sous `data/corpus/` |

`npm run corpus:index` n'a pas été relancé entre les deux mesures : il réécrit
`meta.construit_le` à chaque passage, ce qui détruirait précisément l'empreinte
identique relevée avant et après. Le contrôle a été fait après coup, hors de la
fenêtre des mesures : `53143 unités indexées … 0 ajoutées, 0 modifiées,
0 supprimées, 53143 inchangées`. Le critère de la phase 5 est donc tenu — rien à
réembarquer — sans que l'empreinte ci-dessus serve de preuve pour autant.

## 9. Écarts au protocole

1. Le dépôt du GGUF bge est `gpustack/bge-reranker-v2-m3-GGUF` (consigne de la
   phase), pas `BAAI/bge-reranker-v2-m3` (formulation de `phase-5.md`) ; `BAAI`
   ne publie pas de GGUF. Fichier `Q8_0` choisi pour égaler la quantification du
   témoin Qwen3.
2. La latence Qwen3 de cette passe est 2,6 fois celle de la sonde de phase 3,
   sans changement de modèle ni de réglage : la machine était plus chargée. Seul
   le rapport entre candidats est lu.
3. Les seuils calibrés de la tranche doctrine diffèrent de ceux du jeu `dev`
   complet (`0,68/0,73/0,02` pour Qwen3, `0,66/0,76/0,02` pour bge) : `calibrer`
   choisit sur dix questions, et ce n'est pas la calibration retenue pour le
   produit.
4. Une première exécution de la mesure Qwen3 a été interrompue par une coupure de
   la session de travail (JSON vide, plus un `Reranker injoignable` dans
   `stderr`) ; elle a été relancée en entier et la sortie conservée est celle de
   la relance, avec `exit=0`.
5. Les deux serveurs ont été arrêtés après les mesures ; le port 8080 est libre.
