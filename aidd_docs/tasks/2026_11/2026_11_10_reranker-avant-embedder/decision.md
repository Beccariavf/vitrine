---
phase: 6
status: done
observed: 2026-11-10
verdict: aucun reranker adopté
---

# Décision : aucun reranker, produit inchangé

Le verdict ne se recalcule pas ici : il vient de `compare.ts` sur les mesures de
la phase 5 (`eval-rerank.md`), refaites après le rééquilibrage du jeu. Ce document
le reporte, puis consigne l'expérience d'instruction menée dans cette phase.

## 1. Verdict par candidat

Témoin : `qwen3-embedding:0.6b` seul, `39/54` au top 5 brut (72,2 %), MRR
`0,6250`, top 1 brut `29/54` (53,7 %). Domaine de décision : les 54 questions
conceptuelles du split `dev` (60 questions : 20 avis, 7 recommandations,
27 sanctions, 6 pièges).

| Candidat | top 5 brut | MRR | top 1 brut | b | c | p | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | 45/54 = 83,3 % (+6) | 0,6432 (+0,0182) | 28/54 = 51,9 % (−1) | 8 | 9 | 1,0 | `conserver` |
| `bge-reranker-v2-m3` | 45/54 = 83,3 % (+6) | 0,7423 (+0,1173) | 36/54 = 66,7 % (+7) | 13 | 6 | 0,1671 | `non_etabli` |

Latence moyenne du bloc `rerank` sur 60 questions : `9 332,0 ms` pour Qwen3,
`3 594,7 ms` pour bge, soit environ +9,26 s et +3,52 s par question contre une
recherche dense à ≈73 ms.

## 2. Pourquoi la règle figée refuse les deux

La règle figée de `mcp/eval/compare.ts` n'adopte que si quatre conditions
tiennent ensemble sur la vue brute, testées dans cet ordre : au moins six paires
discordantes (`b + c ≥ 6`), `b > c`, `p < 0,05`, et un top 5 non dégradé de plus
d'une question.

- `Qwen3-Reranker-0.6B` échoue sur la deuxième : `b = 8 < c = 9`. Il gagne six
  questions au top 5 mais en perd une au rang 1 ; le désaccord, sur 17 paires,
  va dans le sens du témoin. Le test exact vaut `p = 1` : le déséquilibre
  8 contre 9 est indiscernable du hasard.
- `bge-reranker-v2-m3` passe `b + c = 19 ≥ 6` et `b = 13 > c = 6`, mais échoue
  sur la signification : `p = 0,1671 ≥ 0,05`. Dix-neuf paires discordantes ne
  distinguent pas ce déséquilibre du hasard. `p` se calcule exactement :
  `2 × Σ(k = 0…6) C(19, k) / 2¹⁹ = 2 × 43 796 / 524 288 = 0,16707`.

Le gain au top 5 n'entre pas dans la règle : `+6` questions pour les deux
candidats ne sert qu'à écarter la condition de dégradation, jamais à adopter. Un
reranker qui améliore le rappel sans améliorer le rang 1 reste dehors.

Aucun candidat n'atteint donc l'étage produit. Le refus vaut pour les deux : ni
l'un ni l'autre n'entre dans `mcp/server.ts`.

## 3. Tranche doctrine : la prémisse tient, la preuve manque

Sur `questions-cnil-doctrine.csv` (10 questions de doctrine : 7 avis,
3 recommandations ou lignes directrices ; `dev`), sans `--seuils` :

| Configuration | top 5 | MRR | top 1 | `confiant` juste / faux |
| --- | --- | --- | --- | --- |
| témoin | 3/10 | 0,225 | 2/10 | 3 / 5 |
| + Qwen3 | 3/10 | 0,300 | 3/10 | 2 / 2 |
| + bge | 4/10 | 0,245 | 2/10 | 2 / 0 |

La prémisse de l'issue #17 se reproduit **sur son propre jeu** : le témoin place
la bonne délibération dans les cinq premiers trois fois sur dix, et se trompe avec
l'étiquette « confiant » cinq fois sur huit. Elle **ne s'étend pas** au jeu
élargi : sa tranche doctrinale vaut 24/27 au top 5 (18/20 avis, 6/7
recommandations), la plus forte des trois natures, les sanctions étant la plus
faible (15/27). L'écart n'est pas une contradiction mais une différence de
difficulté : `questions-cnil-doctrine.csv` attend une délibération précise parmi
plusieurs voisines traitant le même sujet, alors que le jeu élargi choisit des
documents au sujet distinctif. Le 3/10 décrit donc une famille de questions, pas
« la doctrine » en général.

Sous les seuils du produit (0,69 / 0,74 / 0,01) et non la calibration `dev`, le
même jeu rend **9 réponses confiantes dont 6 fausses** sur 10 questions
(`mesures/doctrine-qwen-seuils-produit.json`) : les étiquettes du produit sont
donc plus affirmées, et plus fausses, que le constat de l'issue.

Aucun reranker ne déplace ce résultat de plus d'une question. `+ 1/10` au top 5
pour bge, `+ 1/10` au top 1 pour Qwen3, avec une ou deux paires discordantes au
rang 1 : dix questions ne départagent rien, et la règle figée exige six paires
discordantes. Rien ne change donc au verdict du §1, et ce n'est pas ce qui le
renverserait.

## 3 bis. Ce que le produit répond aujourd'hui sur ce jeu

Le harnais calibre ses seuils sur `dev` (0,62 / 0,67 / 0,01) ; le produit tourne
avec les constantes `0,69 / 0,74 / 0,01`. Une mesure complémentaire, mêmes
questions, même index, seuils du produit
(`mesures/base-dev-seuils-produit.json`) donne la seule vue qui compte pour le
lecteur :

| Niveau | Questions | Document attendu au top 5 |
| --- | --- | --- |
| `confiant` | 24 | 19 justes, **5 fausses** |
| `incertain` | 26 | 20 justes, 6 fausses |
| `aucun_resultat_fiable` | 4 | — |

Le classement brut est identique (39/54, MRR 0,6250, top 1 29/54) : seules les
étiquettes changent. La vue rendue, elle, recule : `search` ne rend aucun passage
sous `aucun_resultat_fiable`, donc 37/54 au top 5, 27/54 au rang 1, MRR 0,588 —
quatre questions sans réponse, dont deux qui cachaient un bon document. Les cinq
erreurs confiantes sont 4 sanctions sur 9 réponses confiantes et 1 recommandation
sur 3 ; les 12 réponses confiantes visant un avis sont toutes justes. La prémisse de l'issue — des réponses confiantes fausses —
est donc reproduite sur 60 questions et elle se loge dans les sanctions, pas
dans la doctrine majoritaire.

## 4. Ce que la mesure ne prouve pas

- **Le jeu fait 60 questions CNIL de `dev`**, dont 54 conceptuelles. Six pièges
  et 54 questions ne départagent pas deux rerankers à dix-sept et dix-neuf
  paires discordantes près ; aucun chiffre ne se transporte au RGPD, à l'AI Act,
  à la LIL, au Conseil d'État ni au CEPD.
- **La tranche doctrine fait 10 questions.** Elle a motivé l'expérience et
  fournit une ligne de base ; elle ne conclut rien.
- **`conserver` pour Qwen3 ne prouve pas que le rerank nuit** : le top 5 brut
  gagne six questions. Il dit que le rang 1 ne s'améliore pas de façon crédible,
  et que la règle refuse d'adopter sur ce signal.
- **`non_etabli` pour bge ne prouve pas l'absence de gain** : `b = 13`, top 5 +6,
  top 1 +7, MRR +0,117. Un jeu plus grand, ou un test centré sur le top 5 plutôt
  que sur le rang 1, pourrait conclure autrement ; ce n'est pas mesuré.
- **La vue rendue n'a pas été recalibrée** : les deux candidats ont été mesurés
  sous les seuils du témoin, donc leur rendu est constaté, pas optimisé.
- **La latence est celle d'une machine** (macOS arm64, 16 Go, `llama-server` par
  défaut, un client séquentiel, deux serveurs d'embedding actifs) ; ni la
  concurrence ni un autre matériel ne sont couverts, et la mesure Qwen3 est
  2,6 fois la sonde de la phase 3.
- **Les scores des deux rerankers ne se comparent pas entre eux** : seul l'effet
  sur l'ordre, mesuré sur les mêmes questions, est comparable.

## 5. Instruction de requête : mesurée, non retenue

Le produit envoie à l'embedder `INSTRUCTION_CNIL`, qui nomme « une délibération
de sanction ». Le jeu `dev` mêle 27 questions de doctrine (20 avis,
7 recommandations) et 27 de sanctions, avec six pièges. Une variante de même
forme qui ne nomme que le corpus a donc été mesurée :

```text
Instruction : retrouve les passages d'une délibération de la CNIL qui répondent à la question
Requête :
```

La variante vit dans `mcp/eval/run.ts` (`INSTRUCTION_CNIL_NEUTRE`), derrière
`--instruction neutre` ; `INSTRUCTION_CNIL` n'a pas changé.

Commandes, split `dev`, voie dense, sans `--seuils` (chaque passe calibre la
sienne) :

```sh
node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json --instruction actuelle \
  > mesures/instruction-actuelle.json
node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json --instruction neutre \
  > mesures/instruction-neutre.json
node mcp/eval/compare.ts --vue brute mesures/instruction-actuelle.json mesures/instruction-neutre.json
```

| Instruction | top 5 brut | MRR | top 1 brut | Seuils calibrés | Niveaux (confiant / incertain / aucun) | Pièges cités | Pièges confiants |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `actuelle` (`INSTRUCTION_CNIL`) | 39/54 = 72,2 % | 0,6250 | 29/54 = 53,7 % | 0,62 / 0,67 / 0,01 | 30 / 24 / 0 | 6/6 | 4 |
| `neutre` | **41/54 = 75,9 %** | **0,6503** | **31/54 = 57,4 %** | 0,62 / 0,67 / 0,01 | 33 / 21 / 0 | 6/6 | 2 |

Écart : top 5 **+2 questions**, top 1 **+2 questions**, MRR **+0,0253**. Les
seuils calibrés ne bougent pas.

```text
top 5 brut : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « qwen3-embedding:0.6b » 41/54 (75.9 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b » 31/54 (57.4 %)
paires discordantes au rang 1 brut : b = 2 (candidat seul), c = 0 (référence seule)
McNemar exact : p = 0.5
verdict (brut) : non_etabli — moins de six paires discordantes (2) : aucune conclusion
```

La règle ne tranche pas : deux paires discordantes, aucune perdue. Le gain de
deux questions au top 5 n'est pas un résultat significatif, et l'instruction
n'entre pas dans le produit. Le changement est réel pour autant : 48 des 60
classements de passages diffèrent de la passe `actuelle`, pour deux questions
gagnées et aucune perdue, au top 5 comme au rang 1 ; deux pièges confiants en
moins. L'instruction déplace beaucoup l'ordre et ne change la justesse que de
deux questions — trop peu pour franchir le plancher de six paires discordantes.
Contrôle d'intégrité : la passe `actuelle` reproduit `mesures/base-dev.json` à
l'identique (aucune référence rendue ne diffère sur les 60 questions, agrégats
égaux) ; `--instruction` absent laisse donc le harnais sur le comportement
d'avant.

## 6. Issue #17, point 6 : « recalibrer instructions et seuils pour le modèle retenu »

Le point 6 ne s'applique pas, et il faut le dire sans détour :

1. **Aucun modèle n'est retenu.** La recalibration des seuils de confiance est
   une opération relative à un étage adopté : elle prend le premier passage de la
   configuration retenue et refixe `bas` / `haut`. Sans adoption, il n'y a pas de
   « modèle retenu » dont recalibrer les seuils, et écrire `0,62 / 0,67 / 0,01`
   dans `mcp/confidence.ts` calibrerait le produit sur un reranker qui n'y est
   pas. La recalibration est donc **vacante**, pas reportée : il n'y a rien à
   calibrer.
2. **La recalibration des instructions a été faite, et refusée.** La variante
   `neutre` a été mesurée sur le nouveau `dev` (§5) : +2 questions au top 5, +2
   au rang 1, MRR +0,025, deux paires discordantes et zéro perdue. C'est
   exactement le cas où la règle refuse de conclure (`b + c = 2 < 6`). Le
   produit garde `INSTRUCTION_CNIL`.
3. **Le point 6 n'est donc pas un reste à faire.** Il se rouvrirait avec la
   première adoption : un reranker retenu imposerait de recalibrer sur sa propre
   vue rendue (le premier passage change, la similarité dense stockée change), et
   d'y rejouer l'instruction concurrente. Ce chemin est décrit, pas emprunté.

La capacité du harnais reste : `--instruction actuelle|neutre`, `--rerank` et
`--rerank-url` mesurent une variante sans toucher au produit.

## 7. Conséquences

1. **Produit inchangé** : `mcp/server.ts`, `mcp/confidence.ts` et
   `INSTRUCTION_CNIL` ne changent pas ; aucun `RERANK_URL` n'est lu, aucun
   reranker n'est créé.
2. **Aucun recalibrage de seuils** : le produit garde `0,69 / 0,74 / 0,01` ; la
   calibration CNIL de `dev` (`0,62 / 0,67 / 0,01`) reste une mesure, pas une
   valeur écrite.
3. **Aucune mesure du split `test`** : `--split test` et `--mesurer-test` n'ont
   pas été passés ; aucun marqueur `questions-cnil-etendu.test-consomme.json`
   n'existe.
4. **Le `test` du jeu reste non consommé** : les 60 questions `test` de
   `questions-cnil-etendu.csv` restent disponibles pour une configuration future.
