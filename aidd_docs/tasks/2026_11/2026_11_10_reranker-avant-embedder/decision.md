---
phase: 6
status: done
observed: 2026-11-10
verdict: aucun reranker adopté
---

# Décision : aucun reranker, produit inchangé

Le verdict ne se recalcule pas ici : il vient de `compare.ts` sur les mesures de
la phase 5 (`eval-rerank.md`). Ce document le reporte, puis consigne l'expérience
d'instruction menée dans cette phase.

## 1. Verdict par candidat

Témoin : `qwen3-embedding:0.6b` seul, `38/54` au top 5 brut (70,4 %), MRR
`0,6157`, top 1 brut `29/54` (53,7 %). Domaine de décision : les 54 questions
conceptuelles du split `dev`.

| Candidat | top 5 brut | MRR | top 1 brut | b | c | p | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | 42/54 = 77,8 % (+4) | 0,6108 (−0,0049) | 27/54 = 50,0 % (−2) | 8 | 10 | 0,8145 | `conserver` |
| `bge-reranker-v2-m3` | 42/54 = 77,8 % (+4) | 0,6812 (+0,0654) | 33/54 = 61,1 % (+4) | 11 | 7 | 0,4807 | `non_etabli` |

Latence moyenne du bloc `rerank` sur 60 questions : `3 603,6 ms` pour Qwen3,
`2 315,3 ms` pour bge, soit environ +3,53 s et +2,24 s par question contre une
recherche dense à ≈73 ms.

## 2. Pourquoi la règle figée refuse les deux

La règle figée de `mcp/eval/compare.ts` n'adopte que si les quatre conditions
tiennent ensemble sur la vue brute : `b > c`, `p < 0,05`, `b + c ≥ 6`, et un
top 5 non dégradé de plus d'une question.

- `Qwen3-Reranker-0.6B` échoue sur la première : `b = 8 < c = 10`. Il gagne
  quatre questions au top 5 mais en perd deux au rang 1 ; le désaccord va dans
  le sens du témoin.
- `bge-reranker-v2-m3` passe `b > c` (`11 > 7`) et le plancher de six paires
  discordantes (`18`), mais échoue sur la signification : `p = 0,4807 ≥ 0,05`.
  Dix-huit paires discordantes ne distinguent pas ce déséquilibre du hasard.

Aucun candidat n'atteint donc l'étage produit. Le refus vaut pour les deux : ni
l'un ni l'autre n'entre dans `mcp/server.ts`.

## 3. Ce que la mesure ne prouve pas

- **Le jeu fait 60 questions CNIL de `dev`**, dont 54 conceptuelles. Six pièges
  et 54 questions ne départagent pas deux rerankers à quatre paires discordantes
  près ; aucun chiffre ne se transporte au RGPD, à l'AI Act, à la LIL, au Conseil
  d'État ni au CEPD.
- **`conserver` pour Qwen3 ne prouve pas que le rerank nuit** : le top 5 brut
  gagne quatre questions. Il dit que le rang 1 ne s'améliore pas de façon
  crédible, et que la règle refuse d'adopter sur ce signal.
- **`non_etabli` pour bge ne prouve pas l'absence de gain** : `b = 11`, top 5 +4,
  MRR +0,065. Un jeu plus grand, ou un test centré sur le top 5 plutôt que sur le
  rang 1, pourrait conclure autrement ; ce n'est pas mesuré.
- **La vue rendue n'a pas été recalibrée** : les deux candidats ont été mesurés
  sous les seuils du témoin, donc leur rendu est constaté, pas optimisé.
- **La latence est celle d'une machine** (macOS arm64, 16 Go, `llama-server` par
  défaut, un client séquentiel) ; ni la concurrence ni un autre matériel ne sont
  couverts.
- **Les scores des deux rerankers ne se comparent pas entre eux** : seul l'effet
  sur l'ordre, mesuré sur les mêmes questions, est comparable.

## 4. Instruction de requête : mesurée, non retenue

Le produit envoie à l'embedder `INSTRUCTION_CNIL`, qui nomme « une délibération
de sanction ». Le jeu `dev` mêle 27 questions de doctrine (avis,
recommandations) et 27 de sanctions, avec six pièges. Une variante de même forme
qui ne nomme que le corpus a donc été mesurée :

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
| `actuelle` (`INSTRUCTION_CNIL`) | 38/54 = 70,4 % | 0,6157 | 29/54 = 53,7 % | 0,62 / 0,67 / 0,01 | 31 / 23 / 0 | 6/6 | 4 |
| `neutre` | **40/54 = 74,1 %** | **0,6441** | **31/54 = 57,4 %** | 0,62 / 0,67 / 0,01 | 34 / 20 / 0 | 6/6 | 2 |

Écart : top 5 **+2 questions**, top 1 **+2 questions**, MRR **+0,0284**. Les
seuils calibrés ne bougent pas.

```text
top 5 brut : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « qwen3-embedding:0.6b » 40/54 (74.1 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « qwen3-embedding:0.6b » 31/54 (57.4 %)
paires discordantes au rang 1 brut : b = 2 (candidat seul), c = 0 (référence seule)
McNemar exact : p = 0.5
verdict (brut) : non_etabli — moins de six paires discordantes (2) : aucune conclusion
```

La règle ne tranche pas : deux paires discordantes, aucune perdue. Le gain de
deux questions au top 5 n'est pas un résultat significatif, et l'instruction
n'entre pas dans le produit. Le changement est réel pour autant : 49 des 60
classements de passages diffèrent de la passe `actuelle`, pour deux questions
gagnées et aucune perdue, au top 5 comme au rang 1. L'instruction déplace
beaucoup l'ordre et ne change la justesse que de deux questions — trop peu pour
franchir le plancher de six paires discordantes. Contrôle d'intégrité : la passe
`actuelle` reproduit
`mesures/base-dev.json` à l'identique (aucune référence rendue ne diffère sur les
60 questions, agrégats égaux) ; `--instruction` absent laisse donc le harnais sur
le comportement d'avant.

## 5. Conséquences

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
5. **La capacité du harnais reste** : `--instruction actuelle|neutre` et
   `--rerank` mesurent une variante sans toucher au produit.
