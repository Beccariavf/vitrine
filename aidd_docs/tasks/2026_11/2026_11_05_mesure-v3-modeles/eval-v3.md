# Évaluation du serveur MCP RGPD v3

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants, 272 unités), avec `qwen3-embedding:0.6b` (1024 dimensions) et `qwen3-embedding:4b` (2560 dimensions), Ollama 0.40.14 local. Ce rapport est indépendant de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) et de l'évaluation v2 (`aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-v2.md`) : les trois jeux ne sont jamais fusionnés.

**Le split `test` a été mesuré une seule fois par modèle le 5 novembre 2026**, après la calibration `dev` et après l'écriture des deux commandes ci-dessous. Aucune question `test` n'a servi à régler un seuil, une question ou une bande.

## Composition du jeu

`mcp/eval/questions-v3.csv` porte 80 questions écrites d'après `data/corpus/rgpd/unites.jsonl`, sans lire aucun résultat du système.

| Split | Sémantiques | Références exactes | Pièges | Total |
| --- | --- | --- | --- | --- |
| `dev` | 34 | 3 | 3 | 40 |
| `test` | 34 | 3 | 3 | 40 |
| **Total** | **68** | **6** | **6** | **80** |

Répartition : 68 questions sémantiques couvrent 68 articles distincts, les six références exactes six autres articles, et les pièges ne citent aucune source. Les 74 articles attendus se répartissent sur les onze chapitres du RGPD. Aucune question de `questions.csv` (v1) ni de `questions-v2.csv` (v2) n'est reprise.

## Règle de décision (figée avant toute mesure `test`)

Chaque modèle est mesuré **une seule fois** sur le split `test`, avec les seuils calibrés sur son propre `dev` et passés explicitement par `--seuils`. Les deux mesures sont alignées question par question.

- Succès au top 5 : au moins une référence attendue figure parmi les cinq passages rendus.
- Succès au rang 1 : la première référence attendue est le premier passage rendu.
- `b` : nombre de questions où `4b` réussit au rang 1 et `0.6b` échoue.
- `c` : nombre de questions où `0.6b` réussit au rang 1 et `4b` échoue.
- Test exact de McNemar bilatéral : `p = min(1, 2 × P(X ≤ min(b, c)))`, avec `X ~ Binomial(b + c, 1/2)`.
- `4b` est adopté si et seulement si `b > c`, `p < 0,05`, `b + c ≥ 6`, et si le top 5 rendu de `4b` n'est pas inférieur de plus d'une question à celui de `0.6b`.
- Si `b + c < 6`, aucune conclusion n'est tirée et `0.6b` reste le modèle du produit.

Aucune question, aucun seuil, aucune bande et aucun libellé de verdict ne seront modifiés après la mesure `test`.

## Calibration `dev` (avant le test)

Les 40 questions `dev` ont seules servi à calibrer les seuils. Les 40 questions `test` n'ont été ni mesurées ni comparées pendant cette étape ; aucun chiffre `test` n'existait à ce moment-là.

| Métrique `dev` (34 sémantiques) | `0.6b` | `4b` |
| --- | --- | --- |
| Top 5 brut | 33/34 (97,1 %) | 33/34 (97,1 %) |
| Top 1 brut | 26/34 (76,5 %) | 30/34 (88,2 %) |
| `MRR` brut | 0,853 | 0,927 |
| Top 5 rendu | 33/34 | 33/34 |
| Top 1 rendu | 26/34 | 30/34 |
| `MRR` rendu | 0,853 | 0,927 |
| Niveaux | 32 confiant, 2 incertain, 0 aucun | 27 confiant, 7 incertain, 0 aucun |
| Top 5 global hors pièges (37) | 36/37 (97,3 %) | 36/37 (97,3 %) |
| Pièges cités par seuil (3) | 0 | 1 |
| Pièges marqués confiant (3) | 0 | 1 |
| Seuils calibrés sur `dev` | `0,640 / 0,690 / 0,010` | `0,720 / 0,770 / 0,010` |

Les seuils `0.6b` du jeu v3 (`0,640 / 0,690 / 0,010`) ne reprennent pas ceux du jeu v2 (`0,680 / 0,730 / 0,010`) : le jeu de calibration a changé.

Questions sémantiques manquées au top 5 : les deux modèles placent « transmission directe des données d'un responsable à un autre » (`art_20`) hors des cinq premiers. Aucune autre question sémantique ne manque le top 5.

Questions sémantiques hors du rang 1 :

- `0.6b` : `art_9` (rang 2), `art_12` (rang 4), `art_20` (absent), `art_21` (rang 2), `art_35` (rang 4), `art_46` (rang 2), `art_70` (rang 2), `art_82` (rang 2) ;
- `4b` : `art_20` (absent), `art_25` (rang 2), `art_27` (rang 2), `art_70` (rang 2).

Le piège cité par `4b` est « Quelles mentions obligatoires figurent sur une facture d'électricité ? », marqué `confiant` ; les deux autres pièges sont refusés. `0.6b` refuse les trois.

### Coût mesuré

| Opération | `0.6b` | `4b` |
| --- | --- | --- |
| Index complet de 565 unités | 48,74 s | 754,48 s |
| Passe `dev` de 40 questions | 1,88 s | 15,88 s |

L'index `4b` coûte 15,5× l'index `0.6b` sur cette machine, et la passe de requêtes 8,4×. La mesure `4b` a été faite dans `/private/var/folders/w5/r26t3rn17nxctjpckqp8jhmw0000gn/T/opencode/vitrine-v3-4b`, sans toucher `data/corpus/index/index.db`.

## Commandes de mesure `test` (figées ici avant le test)

Les deux commandes suivantes seront lancées une seule fois chacune. Aucun seuil, aucune question et aucun libellé de verdict ne sera modifié après leur exécution.

```bash
node mcp/eval/run.ts --questions questions-v3.csv --split test --mesurer-test --seuils 0.64,0.69,0.01 --recherche dense --json > aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-0.6b.json
```

```bash
ROOT=/private/var/folders/w5/r26t3rn17nxctjpckqp8jhmw0000gn/T/opencode/vitrine-v3-4b
node mcp/eval/run.ts --questions questions-v3.csv --split test --mesurer-test --root "$ROOT" --modele qwen3-embedding:4b --dim 2560 --seuils 0.72,0.77,0.01 --recherche dense --json > aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-4b.json
```

Comparaison :

```bash
node mcp/eval/compare.ts aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-0.6b.json aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-4b.json
```

## Mesure `test` (une fois par modèle)

Mesure du 5 novembre 2026, avec les seuils calibrés sur `dev` et passés par `--seuils`, la voie dense et `document = 32016R0679`. Chaque modèle a été mesuré une seule fois ; la seconde exécution de `0.6b` a été refusée avant tout appel au modèle : « Test déjà consommé pour le modèle « qwen3-embedding:0.6b » le 2026-11-05 […] Chaque modèle ne se mesure qu'une fois. »

| Métrique `test` (34 sémantiques) | `0.6b` | `4b` |
| --- | --- | --- |
| Top 5 brut | 30/34 (88,2 %) | 31/34 (91,2 %) |
| Top 1 brut | 26/34 (76,5 %) | 25/34 (73,5 %) |
| `MRR` brut | 0,816 | 0,814 |
| Top 5 rendu | 29/34 (85,3 %) | 31/34 (91,2 %) |
| Top 1 rendu | 25/34 (73,5 %) | 25/34 (73,5 %) |
| `MRR` rendu | 0,787 | 0,814 |
| Niveaux | 23 confiant, 10 incertain, 1 aucun | 25 confiant, 9 incertain, 0 aucun |
| Top 5 global hors pièges (37) | 33/37 brut, 32/37 rendu | 34/37 brut et rendu |
| Pièges cités par seuil (3) | 1 | 0 |
| Pièges marqués confiant (3) | 0 | 0 |
| Références exactes (3) | rang 1 par construction | rang 1 par construction |
| Seuils utilisés | `0,640 / 0,690 / 0,010` | `0,720 / 0,770 / 0,010` |

Questions sémantiques manquées au top 5 :

- `0.6b` : `art_4`, `art_45`, `art_69`, `art_79` ; la question `art_95` est classée au rang 1 mais refusée sous le seuil bas, donc absente du top 5 rendu.
- `4b` : `art_1`, `art_4`, `art_52`.

Le seul piège cité par `0.6b` est « Quel est le délai de carence applicable en cas d'arrêt de travail ? », au niveau `incertain`. `4b` refuse les trois pièges.

Paires discordantes au rang 1 (brut, celui que compte `compare.ts`) :

- `b = 2` en faveur de `4b` : « ressources mises à disposition du délégué à la protection des données » (`art_38`, rang 1 contre rang 2) et « juridiction compétente du lieu de résidence de la personne concernée » (`art_79`, rang 1 contre absent) ;
- `c = 3` en faveur de `0.6b` : « libre circulation des données personnelles au sein de l'Union » (`art_1`, rang 1 contre absent), « compléter des données incomplètes par une déclaration » (`art_16`, rang 1 contre rang 3) et « articulation avec la directive ePrivacy » (`art_95`, rang 1 mais refusé, contre rang 2).

## Comparaison et verdict

Commande exécutée :

```bash
node mcp/eval/compare.ts aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-0.6b.json aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/mesure-test-4b.json
```

Sortie exacte :

```text
comparaison appariée : « qwen3-embedding:0.6b » (référence) contre « qwen3-embedding:4b » (candidat)
questions alignées : 40
domaine de décision : 34 questions sémantiques
top 5 retourné : « qwen3-embedding:0.6b » 30/34 (88.2 %) ; « qwen3-embedding:4b » 31/34 (91.2 %)
top 1 retourné : « qwen3-embedding:0.6b » 26/34 (76.5 %) ; « qwen3-embedding:4b » 25/34 (73.5 %)
paires discordantes au rang 1 : b = 2 (candidat seul), c = 3 (référence seule)
McNemar exact : p = 1
verdict : non_etabli — moins de six paires discordantes (5) : aucune conclusion
```

**Verdict : non établi.** `b + c = 5`, sous le plancher de six paires discordantes fixé avant la mesure. Le test ne distingue pas les deux modèles : `4b` gagne une question au top 5 et en perd une au rang 1 (26 → 25), tandis que `0.6b` en refuse une que `4b` rend. `0.6b` reste le modèle du produit ; aucun chiffre ne justifie de payer 15,5× l'indexation.

Lecture rendue, en sensibilité : si le refus de `0.6b` sur `art_95` retire aussi son succès au rang 1, `b = 2`, `c = 2`, `b + c = 4`, `p = 1`. Le verdict reste « non établi ». Cette lecture n'est pas celle de `compare.ts`, qui compte l'ordre rendu par la recherche (`refs`) et laisse le refus dans `niveau` ; elle ne change aucune décision.

## Limites

- Une seule mesure par modèle, sans réexécution : le test ne peut pas être rejoué pour vérifier sa stabilité. Le marqueur `mcp/eval/questions-v3.test-consomme.json` en est la trace de consommation, pas une preuve d'exécution.
- Le vivier sous filtre `document` reste tronqué à `max(10 × k, 50)` candidats globaux, comme en v2 ; la mesure `v3` n'a pas été refaite avec une surlecture. Le top 5 de chaque modèle peut donc être sous-estimé.
- `4b` cite un piège en `dev` (« mentions obligatoires sur une facture d'électricité », `confiant`) et aucun en `test`. Le taux de pièges cités reste mesuré sur trois questions par split : trop peu pour conclure.
- Le coût d'indexation `4b` a été mesuré à 754,48 s, soit 15,5× les 48,74 s de `0.6b` sur cette machine, et non le rapport de 6,9× indiqué par une mesure antérieure.
- Aucun reranker n'est mesuré ni ajouté : Ollama n'en sert pas dans ce chantier.
