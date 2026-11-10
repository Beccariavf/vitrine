---
phase: 7
status: done
observed: 2026-11-10
machine: macOS arm64 (Apple Silicon), 16 GB RAM, Unsloth Studio sur 127.0.0.1:8888
verdict: Harrier gagne sur dev ; adoption renvoyée à un lot suivant
---

# Harrier dans une racine séparée : mêmes dimensions, autre espace

Tout ce qui suit a été produit le **2026-11-10** (UTC `14:06`–`15:5x`) sur la
machine des phases 3 et 5, avec `mradermacher/harrier-oss-v1-0.6b-GGUF`
(1 024 dimensions, Unsloth Studio, `POST /v1/embeddings`), le split `dev` de
`questions-cnil-etendu.csv` (60 questions : 54 conceptuelles, 6 pièges) et un
index construit hors du dépôt, sous `~/.cache/vitrine-harrier/root/`.

## 1. Porte de la phase

`eval-rerank.md` et `decision.md` refusent les deux rerankers mesurés en phase 5 :

| Candidat | top 5 brut | b | c | p | Verdict |
| --- | --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | 42/54 (+4) | 8 | 10 | 0,8145 | `conserver` |
| `bge-reranker-v2-m3` | 42/54 (+4) | 11 | 7 | 0,4807 | `non_etabli` |

Aucun n'obtient `adopter`. La raison d'ouvrir cette expérience est donc celle du
plan : **le rappel plafonne, pas le classement**. Un reranker ne peut pas hisser
au top 5 une référence que la fenêtre dense n'a pas ramenée ; un embedder de
même taille, lui, change l'espace entier et peut la ramener.

## 2. Protocole

| Élément figé | Valeur | Pourquoi |
| --- | --- | --- |
| Split | `dev` uniquement | Le `test` ne se mesure qu'une fois. Aucun `--mesurer-test` n'a été passé ; `mcp/eval/questions-cnil-etendu.test-consomme.json` n'existe pas. |
| Vue du verdict | `--vue brute` | L'échelle de similarité change avec l'embedder : les seuils produit n'ont aucun sens sur Harrier. |
| Seuils | calibrage `dev` propre à chaque passe (0,73 / 0,78 / 0,01) | Sans `--seuils` : chaque modèle règle les siens, aucun n'hérite de ceux du témoin. |
| Index | `~/.cache/vitrine-harrier/root/data/corpus/index/index.db`, 29 299 unités | Hors du dépôt, donc l'index produit ne peut pas être mesuré par erreur : `harrier-dev-*.json` porte `index.chemin` sous la racine d'expérience. |
| Corpus copié | `data/corpus/cnil/` seulement | Le jeu est CNIL ; les cinq autres corpus n'auraient servi à rien (écart au plan, voir §8). |

L'index répond bien à Harrier et non à qwen3 : `modele` vient de `--modele` et ne
prouve rien, mais `index.chemin` et `index.unites` sont relus dans le JSON, et la
construction a journalisé `29299 unités … (mradermacher/harrier-oss-v1-0.6b-GGUF,
1024 dimensions, complet (index absent))`.

## 3. L'adaptateur et son piège

`mcp/embed/openai.ts` poste `{model, input}` sur `{url}/v1/embeddings`, lit
`data[].embedding`, refuse une réponse dont le champ `model` diffère du modèle
demandé — en nommant les deux — et refuse tout vecteur dont la longueur diffère
de `dim`, en nommant les deux aussi. Les vecteurs sont normalisés par
`normaliser()`, comme l'adaptateur Ollama ; `embedQuery(texte, portee)` suit la
même table d'instructions.

Sonde sur le service réel, `input: ["droit à l effacement"]` :

| `model` demandé | `model` rendu | Dimension | Sens |
| --- | --- | --- | --- |
| `mradermacher/harrier-oss-v1-0.6b-GGUF` | identique | 1 024 | le modèle attendu |
| `modele-inexistant-xyz` | `modele-inexistant-xyz` (écho) | 1 024 | **repli silencieux** : mêmes trois premières composantes que Harrier (`0,02825 · −0,1013 · −0,0`) |
| `text-embedding-3-small` | écho | 1 024 | même repli |
| `unsloth/bge-small-en-v1.5` | `llama-server:unsloth/bge-small-en-v1.5:unsloth/bge-small-en-v1.5-GGUF` | **384** | l'autre modèle chargé |

Le piège décrit par la phase (« un nom inconnu rend silencieusement
`bge-small-en-v1.5` en 384 dimensions ») **ne se reproduit pas tel quel** : le
repli se fait vers le premier modèle chargé, ici Harrier, et le nom demandé est
réémis tel quel. Conséquence pour l'adaptateur : le contrôle du champ `model`
n'attrape pas ce repli-là (le nom est écho), et la dimension ne l'attrape pas non
plus (1 024 = 1 024). Ce qui est attrapé, c'est l'autre modèle effectivement
chargé : nom préfixé différent et 384 dimensions. Un repli vers un modèle de même
dimension resterait indétectable par l'API ; seule une empreinte de vecteur
connu le révélerait, et ce n'est pas implémenté.

## 4. Débit de construction

Première mesure, une passe `embedPassages` de 100 unités réelles :

```text
100 passages, 116 173 caractères (médiane 1 437, maximum 1 560)
5,21 s → 19,2 unités/s → projection 29 299 unités ≈ 25,4 min
```

Construction réelle, lots de 32 (constante `LOT` de `mcp/index/build.ts`) :

```console
$ node mcp/index/build.ts --root ~/.cache/vitrine-harrier/root \
    --fournisseur openai --embed-url http://127.0.0.1:8888 \
    --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024
real 2174,46   # 36 min 14 s, 13,5 unités/s, 249 856 000 octets d'index
```

La projection de 25,4 min ne dépasse pas la limite de 60 min, donc la
construction a été menée. L'écart à la mesure (36,2 min contre 25,4 min, +42 %)
vient des lots de 32 et de l'écriture SQLite, absents de la passe de 100.

## 5. Instruction de requête

Deux passes, même index, même jeu, `--json`, sans `--seuils` :

```sh
node mcp/eval/run.ts --questions questions-cnil-etendu.csv --split dev --json \
  --root ~/.cache/vitrine-harrier/root --fournisseur openai \
  --embed-url http://127.0.0.1:8888 \
  --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024 \
  --instruction actuelle > mesures/harrier-dev-actuelle.json
node mcp/eval/run.ts ... --instruction neutre > mesures/harrier-dev-neutre.json
```

| Instruction | top 5 brut | MRR | top 1 brut | top 5 rendu | top 1 rendu | Niveaux (confiant / incertain / aucun) | Pièges cités |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `actuelle` (`INSTRUCTION_CNIL`) | **45/54 = 83,3 %** | 0,7769 | **40/54 = 74,1 %** | 45/54 | 40/54 | 18 / 36 / 0 | 5/6 |
| `neutre` | **45/54 = 83,3 %** | 0,7824 | **40/54 = 74,1 %** | 44/54 | 39/54 | 20 / 33 / 1 | 5/6 |

```text
top 5 brut : « mradermacher/harrier-oss-v1-0.6b-GGUF » 45/54 (83.3 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 45/54 (83.3 %)
top 1 brut : « mradermacher/harrier-oss-v1-0.6b-GGUF » 40/54 (74.1 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 40/54 (74.1 %)
paires discordantes au rang 1 brut : b = 1 (candidat seul), c = 1 (référence seule)
McNemar exact : p = 1
verdict (brut) : non_etabli — moins de six paires discordantes (2) : aucune conclusion
```

Aucune des deux ne gagne **une seule question** au top 5 : la règle de rétention
n'est pas remplie. `neutre` gagne 0,0055 de MRR brut mais perd une question au
top 5 rendu et en fait passer une sous le seuil ; `actuelle` est donc **retenue**
par défaut, c'est-à-dire sans changer l'instruction du produit. L'écart au top 5
est de zéro question.

## 6. Comparaison appariée au témoin

```console
$ node mcp/eval/compare.ts --vue brute \
    /Users/val/Developer/Vitrine-mcp/aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json \
    /Users/val/Developer/Vitrine-mcp/aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev-actuelle.json
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « mradermacher/harrier-oss-v1-0.6b-GGUF » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 45/54 (83.3 %)
top 5 rendu : « qwen3-embedding:0.6b » 38/54 (70.4 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 45/54 (83.3 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 40/54 (74.1 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 40/54 (74.1 %)
paires discordantes au rang 1 brut : b = 17 (candidat seul), c = 6 (référence seule)
McNemar exact : p = 0.03468966484069824
verdict (brut) : adopter — b=17 > c=6, p = 0.0347 < 0,05, 23 paires discordantes, top 5 brut non dégradé (38 → 45)
```

Code de sortie : `0`.

| | top 5 brut | MRR | top 1 brut | Pièges cités | Pièges confiants |
| --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` (témoin) | 38/54 = 70,4 % | 0,6157 | 29/54 = 53,7 % | 6/6 | 4 |
| Harrier (`actuelle`) | **45/54 = 83,3 %** | **0,7769** | **40/54 = 74,1 %** | 5/6 | 0 |

Le gain est de **+7 questions au top 5** et **+11 au rang 1**, `p = 0,0347` :
la règle figée adopte. Un piège de moins reste cité (5/6 au lieu de 6/6) et
aucun piège n'est cité « confiant ».

## 7. Latence par question

Mesurée hors harnais, 60 questions `dev`, `search(k=5, corpus="cnil")` avec
Harrier et son index, une passe séquentielle après chargement :

| Moyenne | Médiane | p90 | Min | Max |
| --- | --- | --- | --- | --- |
| **63,7 ms** | 62,9 ms | 66,5 ms | 58,8 ms | 100,9 ms |

La recherche dense qwen3 était donnée à ≈ 73 ms par question en phase 5 (mesure
indicative, hors protocole). Le coût par requête ne change donc pas d'ordre de
grandeur ; c'est le coût de **construction** qui change (36 min pour 29 299
unités, contre un index produit de 53 143 unités déjà construit).

## 8. Ce que cette mesure ne prouve pas

- **60 questions CNIL de `dev`, un seul corpus.** Aucun chiffre ne se transporte
  au RGPD, à l'AI Act, à la LIL, au Conseil d'État ni au CEPD. L'index
  d'expérience ne contient que `cnil` (29 299 unités) ; l'index produit en
  contient 53 143.
- **Le `test` n'est pas mesuré.** Le gain de 7 questions est un résultat `dev`
  sur 54 questions ; la confirmation exige une mesure unique du `test`, qui n'a
  pas eu lieu et ne se rejoue pas.
- **Les seuils de Harrier ne sont pas calibrés pour le produit.** Le calibrage
  `dev` de cette passe donne 0,73 / 0,78 / 0,01, contre 0,62 / 0,67 / 0,01 pour
  qwen3 : les similarités ne sont pas sur la même échelle. Le rendu mesuré ici
  n'est pas optimisé.
- **Le piège du repli silencieux est partiellement couvert.** Un nom inconnu rend
  les vecteurs du premier modèle chargé en écho et ne peut pas être distingué par
  le champ `model` ni par la dimension quand celle-ci coïncide. La construction
  s'est appuyée sur le nom exact chargé, vérifié par `/v1/models`.
- **Le débit dépend du service.** Unsloth Studio, un client séquentiel, lots de
  32 ; ni la concurrence, ni un autre matériel, ni une autre quantification ne
  sont couverts.
- **L'écart de MRR entre les deux instructions ne tranche rien** : une paire
  discordante de chaque côté, `p = 1`.

## 9. Écarts au protocole

1. **Un seul corpus copié** : `data/corpus/cnil/` au lieu des six corpus de
   `phase-7.md`. Le jeu est CNIL ; les cinq autres corpus n'auraient produit
   aucun gain d'information et 24 000 unités de plus à embarquer.
2. **Deux fichiers de mesure au lieu d'un** :
   `mesures/harrier-dev-actuelle.json` et `mesures/harrier-dev-neutre.json`
   remplacent le `mesures/harrier-dev.json` de la projection d'architecture ; la
   comparaison au témoin utilise le fichier `actuelle`.
3. **Le piège ne se reproduit pas comme décrit** : voir §3. Le repli observé est
   Harrier en 1 024 dimensions avec le nom demandé en écho, pas
   `bge-small-en-v1.5` en 384 dimensions.
4. **La mesure de débit** est une passe unique de 100 passages, comme demandé,
   alors que la construction réelle travaille par lots de 32 : la projection est
   donc optimiste de 42 %.

## 10. Décision

1. **Le produit garde `qwen3-embedding:0.6b`.** Aucun fichier du produit ne
   change : ni `mcp/server.ts`, ni `mcp/confidence.ts`, ni `INSTRUCTION_CNIL`, ni
   l'index. L'adaptateur `mcp/embed/openai.ts` et les drapeaux `--fournisseur` /
   `--embed-url` restent des capacités de harnais, inactives par défaut.
2. **Harrier est proposé pour un lot suivant**, pas adopté ici. Le lot devrait :
   reconstruire l'index produit complet (53 143 unités, ≈ 1 h 05 à 13,5 unités/s),
   recalibrer les seuils (`bas`/`haut`/`marge`) sur Harrier, puis consommer une
   mesure unique du split `test`. Le gain `dev` (`+7` au top 5, `+11` au rang 1,
   `p = 0,0347`) justifie ce lot ; il ne le remplace pas.
3. **Aucune mesure du `test` n'a été consommée** : `--split test` et
   `--mesurer-test` n'ont pas été passés, et aucun marqueur
   `questions-cnil-etendu.test-consomme.json` n'existe.

## 11. Intégrité du produit

| Contrôle | Résultat |
| --- | --- |
| `sha256 data/corpus/index/index.db` avant la construction (UTC 14:06:19) | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` |
| idem après la construction et les deux passes (UTC 15:5x) | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` |
| `git status --short` | seuls `mcp/embed/openai.ts`, `mcp/index/build.ts`, `mcp/eval/run.ts`, `tests/index.test.ts` et les deux JSON de mesure |
| Marqueur de test | absent |
