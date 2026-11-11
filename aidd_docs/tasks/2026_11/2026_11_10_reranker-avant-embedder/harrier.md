---
phase: 7
status: done
observed: 2026-11-10
machine: macOS arm64 (Apple Silicon), 16 GB RAM, Unsloth Studio sur 127.0.0.1:8888
verdict: Harrier gagne 5 questions au top 5 sur dev, p = 0,0931, non_etabli ; adoption renvoyée
---

# Harrier dans une racine séparée : mêmes dimensions, autre espace

Tout ce qui suit a été produit le **2026-11-10** (UTC `14:45`–`15:19`) après le
**rééquilibrage du jeu CNIL étendu** : six recommandations sont passées de `dev`
à `test` et six avis l'inverse. Toute mesure `dev` antérieure à ce déplacement
est caduque, y compris celles de la première version de ce rapport. Les chiffres
ci-dessous viennent tous des JSON re-mesurés sous
`mesures/harrier-dev-*.json`, `mesures/doctrine-harrier.json` et
`mesures/noncnil/`.

Modèle : `mradermacher/harrier-oss-v1-0.6b-GGUF` (1 024 dimensions, Unsloth
Studio, `POST /v1/embeddings`). Index construit hors du dépôt, sous
`~/.cache/vitrine-harrier/root/`. Jeu : `questions-cnil-etendu.csv`, split `dev`
(60 questions : 54 conceptuelles, 6 pièges).

## 1. Porte de la phase

`eval-rerank.md` et `decision.md` refusent les deux rerankers mesurés en phase 5 :

| Candidat | top 5 brut | b | c | p | Verdict |
| --- | --- | --- | --- | --- | --- |
| `Qwen3-Reranker-0.6B` | 45/54 (+6) | 8 | 9 | 1,0 | `conserver` |
| `bge-reranker-v2-m3` | 45/54 (+6) | 13 | 6 | 0,1671 | `non_etabli` |

Chiffres re-mesurés sur le jeu rééquilibré, comme ceux de ce rapport
(`eval-rerank.md`, `decision.md`). Aucun n'obtient `adopter`. La raison d'ouvrir cette
expérience reste celle du plan : **le rappel plafonne, pas le classement**. Un
reranker ne peut pas hisser au top 5 une référence que la fenêtre dense n'a pas
ramenée ; un embedder de même taille change l'espace entier et peut la ramener.

## 2. Protocole

| Élément figé | Valeur | Pourquoi |
| --- | --- | --- |
| Jeu | `questions-cnil-etendu.csv`, split `dev` re-gelé | 54 questions sémantiques, 6 pièges. Six recommandations ont quitté `dev`, six avis y sont entrés. |
| Split | `dev` uniquement à cette étape | Le `test` ne se mesure qu'une fois. Aucun `--mesurer-test` n'a été passé ici ; il l'a été plus tard, une fois, pour Harrier et qwen3, voir `aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/confirmation.md`. |
| Vue du verdict | `--vue brute` | L'échelle de similarité change avec l'embedder : les seuils produit n'ont aucun sens sur Harrier. |
| Seuils | calibrage `dev` propre à chaque passe (0,73 / 0,78 / 0,01) | Sans `--seuils` : chaque modèle règle les siens, aucun n'hérite de ceux du témoin. |
| Index | `~/.cache/vitrine-harrier/root/data/corpus/index/index.db`, 29 299 unités | Hors du dépôt, donc l'index produit ne peut pas être mesuré par erreur : `harrier-dev-*.json` porte `index.chemin` sous la racine d'expérience. |
| Corpus copié | `data/corpus/cnil/` seulement | Le jeu est CNIL ; les cinq autres corpus n'auraient servi à rien. |

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
connu le révélerait — elle est désormais consignée en §12, pas implémentée.

## 4. Débit de construction

Passe de 100 unités réelles, rejouée après le rééquilibrage :

```text
100 passages contextualisés (chemin + texte), premiers 100 unités CNIL
116 173 caractères — médiane 1 437, maximum 1 560
texte seul des mêmes unités : médiane 1 396, maximum 1 500 (médiane 1 296 sur l'ensemble du corpus)
16,48 s à la re-mesure → 6,07 unités/s
(5,21 s à la première passe du matin → 19,2 unités/s)
```

La ligne précédente (médiane 1 437, maximum 1 560) était exacte pour ce qu'elle
mesurait — la concaténation `chemin + "\n" + texte` — mais elle se lisait comme
une statistique du corpus, dont les chiffres sont 1 296 / 1 500. Les deux
mesures portent sur des textes différents ; elles ne se comparent pas.

Construction réelle du matin, lots de 32 (constante `LOT` de
`mcp/index/build.ts`) :

```console
$ node mcp/index/build.ts --root ~/.cache/vitrine-harrier/root \
    --fournisseur openai --embed-url http://127.0.0.1:8888 \
    --modele mradermacher/harrier-oss-v1-0.6b-GGUF --dim 1024
real 2174,46   # 36 min 14 s, 13,5 unités/s, 249 856 000 octets d'index
```

Construction de la racine non-CNIL, même jour, même machine :

```console
$ node mcp/index/build.ts --root ~/.cache/vitrine-harrier/root-noncnil ... 
698 unités indexées (mradermacher/harrier-oss-v1-0.6b-GGUF, 1024 dimensions)
real 277,75   # 4 min 37 s, 2,5 unités/s, 8 568 832 octets d'index
```

Le débit du service varie de **2,5 à 19,2 unités/s** entre trois passes de la
même journée (et 13,5 u/s pour la construction CNIL). Une projection de 25 min
pour 29 299 unités était donc la plus favorable ; à 6,07 u/s elle vaut 80 min,
et la seule mesure réelle reste 36 min 14 s. Ce n'est pas un débit garanti : il
dépend de l'état du service et des autres modèles qu'il garde chargés.

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
| `actuelle` (`INSTRUCTION_CNIL`) | **44/54 = 81,5 %** | 0,7404 | **38/54 = 70,4 %** | **44/54** | **38/54** | 16 / 38 / 0 | 5/6 |
| `neutre` | **44/54 = 81,5 %** | 0,7515 | **38/54 = 70,4 %** | 43/54 | 37/54 | 17 / 36 / 1 | 5/6 |

```console
$ node mcp/eval/compare.ts --vue brute \
    .../mesures/harrier-dev-actuelle.json .../mesures/harrier-dev-neutre.json
comparaison appariée : « mradermacher/harrier-oss-v1-0.6b-GGUF » (référence) contre « mradermacher/harrier-oss-v1-0.6b-GGUF » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « mradermacher/harrier-oss-v1-0.6b-GGUF » 44/54 (81.5 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 44/54 (81.5 %)
top 5 rendu : « mradermacher/harrier-oss-v1-0.6b-GGUF » 44/54 (81.5 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 43/54 (79.6 %)
top 1 brut : « mradermacher/harrier-oss-v1-0.6b-GGUF » 38/54 (70.4 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 38/54 (70.4 %)
top 1 rendu : « mradermacher/harrier-oss-v1-0.6b-GGUF » 38/54 (70.4 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 37/54 (68.5 %)
paires discordantes au rang 1 brut : b = 1 (candidat seul), c = 1 (référence seule)
McNemar exact : p = 1
verdict (brut) : non_etabli — moins de six paires discordantes (2) : aucune conclusion
```

Les deux passes sont identiques au top 5 et au rang 1 bruts ; `neutre` perd une
question au rendu, donc `actuelle` est retenue sans changer l'instruction du
produit.

Aucune des deux ne gagne **une seule question** au top 5 : la règle de rétention
n'est pas remplie. `neutre` gagne 0,0111 de MRR brut mais perd une question au
top 5 rendu et en fait passer une sous le seuil ; `actuelle` est donc **retenue**
par défaut, c'est-à-dire sans changer l'instruction du produit. L'écart au top 5
est de zéro question.

## 6. Comparaison appariée au témoin

```console
$ node mcp/eval/compare.ts --vue brute \
    aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/base-dev.json \
    aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev-actuelle.json
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « mradermacher/harrier-oss-v1-0.6b-GGUF » (candidat)
questions alignées : 60
domaine de décision : 54 questions sémantiques
top 5 brut : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 44/54 (81.5 %)
top 5 rendu : « qwen3-embedding:0.6b » 39/54 (72.2 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 44/54 (81.5 %)
top 1 brut : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 38/54 (70.4 %)
top 1 rendu : « qwen3-embedding:0.6b » 29/54 (53.7 %) ; « mradermacher/harrier-oss-v1-0.6b-GGUF » 38/54 (70.4 %)
paires discordantes au rang 1 brut : b = 16 (candidat seul), c = 7 (référence seule)
McNemar exact : p = 0.0931396484375
verdict (brut) : non_etabli — p = 0.0931 ≥ 0,05 : le gain n'est pas significatif
```

Code de sortie : `2`.

| | top 5 brut | MRR | top 1 brut | Pièges cités | Pièges confiants |
| --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` (témoin) | 39/54 = 72,2 % | 0,6250 | 29/54 = 53,7 % | 6/6 | 4 |
| Harrier (`actuelle`) | **44/54 = 81,5 %** | **0,7404** | **38/54 = 70,4 %** | 5/6 | 0 |

Le gain est de **+5 questions au top 5** et **+9 au rang 1**. `p` vaut 0,0931 :
**l'écart est à une paire discordante du seuil** — avec `b = 17`, `c = 6`, la
même table donnerait `p = 0,0347`. Le verdict figé reste `non_etabli` : sur 54
questions, un seul cas de plus suffirait à changer la conclusion, ce qui dit
exactement la fragilité de la mesure, pas sa solidité. Un piège de moins reste
cité (5/6 au lieu de 6/6) et aucun piège n'est cité « confiant ».

## 7. Latence par question

Mesure **indicative, non conservée** : un script local hors harnais, 60 questions
`dev`, `search(k=5, corpus="cnil")` avec Harrier et son index, une passe
séquentielle après chargement. Sur deux rejeux elle donne 63,7 ms puis 129,1 ms
de moyenne (médiane 129,3 ms, p90 139,9 ms, min 94,7 ms, max 210,7 ms) : aucun
fichier ne l'archive, elle ne sert donc qu'à dire l'ordre de grandeur, pas à
conclure. Le coût par requête reste du même ordre que la recherche dense qwen3
(≈ 73 ms, également indicatif), mais la dispersion dit que le service n'offre pas
une latence stable. C'est le coût de **construction** qui change d'ordre de
grandeur : 36 min pour 29 299 unités, contre un index produit de 53 143 unités
déjà construit.

## 8. Tranches, limites et ce que la mesure ne prouve pas

### 8.1 Tranche doctrine (prémisse de l'issue #17)

Dix questions `questions-cnil-doctrine.csv`, même index Harrier, seuils calibrés
sur la passe (0,74 / 0,94 / 0,05), vue brute :

| | top 5 | top 1 | MRR | confiant | incertain |
| --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` (témoin) | **3/10** | **2/10** | **0,2250** | 8 | 2 |
| Harrier | 2/10 | 1/10 | 0,1200 | 0 | 10 |

```text
paires discordantes au rang 1 brut : b = 0 (candidat seul), c = 1 (référence seule)
McNemar exact : p = 1
verdict (brut) : non_etabli — moins de six paires discordantes (1) : aucune conclusion
```

Croisement **confiant × correct au top 5** :

| | confiant, correct | confiant, faux | non confiant, correct | non confiant, faux |
| --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` | 3 | **5** | 0 | 2 |
| Harrier | 0 | 0 | 2 | 8 |

Harrier **ne corrige pas** la doctrine : il perd une question au top 5 et une au
rang 1. Sa calibration propre (0,74 / 0,94 / 0,05, sur 10 questions) refuse toute
confiance, donc il supprime les cinq erreurs confiantes du témoin sans rien
retrouver — un refus n'est pas une réponse. La prémisse de l'issue #17 (la
doctrine est le point faible) tient sur les deux modèles.

### 8.2 Tranche par nature

Nature du document attendu, lue dans `data/corpus/cnil/unites.jsonl` ; les six
pièges sont exclus. `confiant` compte les questions classées confiantes, `err.`
celles qui sont confiantes **et** hors du top 5.

| Modèle | Nature | n | top 5 | top 1 | MRR | confiant | err. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| qwen3 | Avis | 20 | 18/20 | 15/20 | 0,8250 | 12 | 0 |
| qwen3 | Recommandation/Lignes directrices | 7 | 6/7 | 4/7 | 0,7143 | 3 | 1 |
| qwen3 | Sanction | 27 | 15/27 | 10/27 | 0,4537 | 15 | **5** |
| Harrier | Avis | 20 | 19/20 | 17/20 | 0,8767 | 8 | 0 |
| Harrier | Recommandation/Lignes directrices | 7 | 5/7 | 4/7 | 0,6071 | 1 | 0 |
| Harrier | Sanction | 27 | **20/27** | **17/27** | **0,6741** | 7 | 0 |

Le gain de Harrier vient **d'abord des sanctions** (+5 au top 5, +7 au rang 1,
+0,220 de MRR) ; les avis gagnent une question et les recommandations en perdent
une, ce qui laisse le solde à +5. Le témoin concentre ses six erreurs confiantes
sur les sanctions (5) et les recommandations (1) ; Harrier n'en produit aucune,
mais avec deux fois moins de questions confiantes (16 contre 30).

### 8.3 Hors CNIL

Racine séparée `~/.cache/vitrine-harrier/root-noncnil/` : copies de
`data/corpus/{rgpd,aiact,lil}/` seulement, index Harrier de **698 unités**
(272 + 293 + 133), 8 568 832 octets. Chaque jeu est mesuré deux fois : qwen3 sur
la racine produit, Harrier sur la seconde racine, puis `compare.ts --vue brute`.

| Jeu | sémantiques | top 5 qwen3 → Harrier | top 1 | MRR | b / c | p |
| --- | --- | --- | --- | --- | --- | --- |
| `questions-v2.csv --split dev` (RGPD) | 19 | 18 → **19** | 15 → 15 | 0,8596 → 0,8860 | 2 / 2 | 1 |
| `questions-aiact.csv` | 3 | 2 → **3** | 0 → **2** | 0,2778 → 0,7333 | 2 / 0 | 0,5 |
| `questions-lil.csv --split dev` | 10 | **10 → 9** | 6 → 6 | 0,7500 → 0,7250 | 0 / 0 | 1 |

**Harrier régresse sur une seule tranche et d'une seule question** : LIL perd un
top 5 (10 → 9), sans perdre de rang 1 (`b = c = 0`). Ailleurs il gagne : une
question RGPD (« autorité de contrôle chef de file ») et deux rangs 1 sur trois
en AI Act. Les échantillons sont minuscules (19, 3 et 10 questions sémantiques) :
c'est un contrôle de non-régression, pas une preuve de gain.

### 8.4 Limites

- **54 questions CNIL de `dev`, un seul corpus pour le verdict.** Aucun chiffre
  ne se transporte au RGPD, à l'AI Act, à la LIL, au Conseil d'État ni au CEPD ;
  la tranche §8.3 ne fait que vérifier l'absence de régression, sur 32 questions.
- **Le `test` n'est pas mesuré.** C'est la **seule confirmation possible** : le
  gain de 5 questions est un résultat `dev`, `p = 0,0931` est à une paire
  discordante du seuil, et le `test` n'a pas été consommé. Il ne se rejoue pas.
- **Les seuils de Harrier ne sont pas calibrés pour le produit.** Le calibrage
  `dev` donne 0,73 / 0,78 / 0,01 contre 0,62 / 0,67 / 0,01 pour qwen3 : les
  similarités ne sont pas sur la même échelle. Le rendu mesuré n'est pas
  optimisé.
- **La doctrine reste le point faible des deux modèles** : 3/10 et 2/10, et cinq
  erreurs confiantes pour le témoin. La tranche fait 10 questions, son pouvoir
  est nul.
- **Le piège du repli silencieux est partiellement couvert.** Un nom inconnu rend
  les vecteurs du premier modèle chargé en écho et ne peut être distingué ni par
  le champ `model` ni par la dimension quand celle-ci coïncide. La construction
  s'est appuyée sur le nom exact chargé, vérifié par `/v1/models` (§12).
- **Le débit et la latence dépendent de l'état du service** : 2,5 à 19,2
  unités/s et 63,7 à 129,1 ms par question sur la même machine le même jour. Ni
  la concurrence, ni un autre matériel, ni une autre quantification ne sont
  couverts.

## 9. Écarts au protocole

1. **Un seul corpus copié** pour l'index CNIL : `data/corpus/cnil/` au lieu des
   six corpus de `phase-7.md`. Le jeu est CNIL ; les cinq autres corpus
   n'auraient produit aucun gain d'information et 24 000 unités de plus à
   embarquer. Le contrôle hors CNIL est fait dans une **seconde** racine (§8.3),
   pas dans celle du verdict.
2. **Deux fichiers de mesure au lieu d'un** :
   `mesures/harrier-dev-actuelle.json` et `mesures/harrier-dev-neutre.json`
   remplacent le `mesures/harrier-dev.json` de la projection d'architecture ; la
   comparaison au témoin utilise le fichier `actuelle`.
3. **Le piège ne se reproduit pas comme décrit** : voir §3. Le repli observé est
   Harrier en 1 024 dimensions avec le nom demandé en écho, pas
   `bge-small-en-v1.5` en 384 dimensions.
4. **La mesure de débit a été rejouée** après le rééquilibrage : 16,48 s au lieu
   de 5,21 s pour les mêmes 100 passages, et une construction de 698 unités à
   2,5 u/s. Le rapport donne la dispersion au lieu d'une projection unique.

## 10. Décision

1. **Le produit garde `qwen3-embedding:0.6b`.** Aucun fichier du produit ne
   change : ni `mcp/server.ts`, ni `mcp/confidence.ts`, ni `INSTRUCTION_CNIL`, ni
   l'index. L'adaptateur `mcp/embed/openai.ts` et les drapeaux `--fournisseur` /
   `--embed-url` restent des capacités de harnais, inactives par défaut.
2. **Harrier n'est pas adopté.** La recommandation repose désormais sur le jeu
   rééquilibré et les tranches : +5 au top 5 (+9 au rang 1) sur `dev`, gain
   concentré sur les sanctions, aucune erreur confiante, pas de régression hors
   CNIL — mais `p = 0,0931`, soit `non_etabli`, et la doctrine ne progresse pas.
   La construction n'est pas gratuite : 36 min pour les 29 299 unités CNIL
   (250 Mo hors du dépôt), et au moins 1 h 06 pour les 53 143 unités du produit
   à 13,5 u/s — jusqu'à plusieurs heures au débit de 2,5 u/s observé ensuite.
   Reconstruire l'index complet et recalibrer les seuils n'est **pas justifié
   par cette mesure seule** : ce serait payer ce coût pour un écart qui tient à
   une paire discordante.
3. **Le `test` a été consommé depuis.** Une mesure unique du split `test`, sur
   deux modèles pré-déclarés, a tranché : Harrier rend 50/54 au top 5 contre
   42/54 (`b = 10`, `c = 1`, `p = 0,0117`), verdict `adopter`. Le gain `dev` tenait.
4. **Le marqueur existe donc**, avec une entrée par modèle ; aucun des deux ne se
   remesure. Détail : `aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/confirmation.md`.

## 11. Intégrité du produit

| Contrôle | Résultat |
| --- | --- |
| `sha256 data/corpus/index/index.db`, référence après le dernier `corpus:index` connu | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` |
| idem, vérifié après toutes les passes, constructions et tranches | `07583570cfc2640a66e132ef1c414bda10fb02c97bb1dfcd39dc17a44944605c` |
| idem, après le contrôle `npm run corpus:index` postérieur (`15:41:25Z`) | `a6e3fd01…` — seul `meta.construit_le` a changé, zéro unité réembarquée |
| `git status --short` | les JSON de mesure de cette phase, `mesures/noncnil/` et `mesures/doctrine-harrier.json` ; aucun fichier du produit |
| Marqueur de test `questions-cnil-etendu` | absent à cette date ; créé depuis par le tir unique (deux modèles) |

## 12. Provenance

### Modèle chargé

`GET http://127.0.0.1:8888/v1/models`, entrée chargée au moment des mesures :

```json
{"id":"mradermacher/harrier-oss-v1-0.6b-GGUF","object":"model","created":1794323990,"owned_by":"unsloth-studio","quant":"Q8_0","context_length":32000,"max_context_length":32000,"vram_fit_context_length":32000,"native_context_length":32768,"loaded":true,"status":{"value":"loaded"}}
```

Un seul modèle est chargé à la fois ; les autres entrées de la réponse sont
`loaded: false`.

### Fichier GGUF

| Élément | Valeur |
| --- | --- |
| Fichier | `harrier-oss-v1-0.6b.Q8_0.gguf` (cache Hugging Face, révision `d79decec1ab9442e969e79804515b9c31683d30e`) |
| Taille | 639 448 320 octets |
| `sha256` | `ba2c9408f82cfdb73aaf70aaea9f125f3fb24c5e76ce0efb469e1530e5ec53e4` |

### Empreinte de vecteur

Phrase fixe : **« Le droit à l’effacement des données personnelles. »**
(`POST /v1/embeddings`, `model: mradermacher/harrier-oss-v1-0.6b-GGUF`, 13 jetons).

| Élément | Valeur |
| --- | --- |
| Dimension | 1 024 |
| Quatre premières composantes | `−0,01967623271048069 · −0,1036849170923233 · −1,0870874116169598e−38 · −0,10130701214075089` |
| `sha256` du vecteur | `7f06e071e3609a0d98a26ed17d6e6ac17b6833ba426f2ac73143b475aeef2753` |

Le `sha256` porte sur les octets UTF-8 du tableau re-sérialisé en JSON compact
(`json.dumps(embedding, separators=(",", ":"))`), dans l'ordre rendu. Deux appels
identiques ont rendu la même empreinte : la réponse est déterministe sur ce
service. C'est cette empreinte, et non le champ `model`, qui distinguerait un
repli silencieux vers un autre modèle de même dimension.
