# Évaluation du serveur MCP RGPD v3

Mesure ouverte le 5 novembre 2026 sur le corpus `data/corpus/rgpd/` (99 articles, 173 considérants, 272 unités), avec `qwen3-embedding:0.6b` (1024 dimensions) et `qwen3-embedding:4b` (2560 dimensions), Ollama 0.40.14 local. Ce rapport est indépendant de l'évaluation v1 (`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`) et de l'évaluation v2 (`aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-v2.md`) : les trois jeux ne sont jamais fusionnés.

**Le split `test` n'est pas encore mesuré.** Le jeu a été écrit contre le texte des articles, avant toute mesure des modèles sur ce jeu.

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

Les 40 questions `dev` ont seules servi à calibrer les seuils. Les 40 questions `test` n'ont été ni mesurées ni comparées pendant cette étape ; aucun chiffre `test` n'existe encore.

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
