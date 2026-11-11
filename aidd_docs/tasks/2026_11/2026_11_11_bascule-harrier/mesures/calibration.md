# Calibration Harrier sur `dev` : triplet retenu et plancher de refus

Date : 2026-11-11. Modèle : `leoipulsar/harrier-0.6b` (Ollama, Q8_0, 1 024 dimensions).
Index : `~/.cache/vitrine-harrier-ollama/root/data/corpus/index/index.db`, 29 299 unités CNIL.
Mesure : `mesures/dev-harrier-ollama.json`, 60 questions, 54 sémantiques, 6 pièges exclus.
Cette page n'est **pas** une confirmation aveugle : `mesures/confirmation.md` du 2026-11-10 avait
déjà publié le couple `haut 0,73` / `marge 0,01` et ses chiffres `dev` et `test`. Le choix retenu ici
ne doit rien au test pour autant : 0,73 est le sommet du plateau `dev` 0,30–0,73, et tout `haut` de
ce plateau rend les mêmes 28 confiantes en `dev` et 34 sans erreur en `test`. Le plancher 0,73 vient
de la courbe du refus, pas du test.

## Reproduction du modèle mesuré

Le `dev` rend 44/54 au top 5 sémantique, 38/54 au rang 1, MRR 0,7404, 5 pièges cités sur 6 et
aucun piège confiant à la calibration `dev` du harnais : identique en rangs et en niveaux à
`aidd_docs/tasks/2026_11/2026_11_10_reranker-avant-embedder/mesures/harrier-dev-actuelle.json`
(44/54, 38/54, 0,7404, 5 pièges, 0 piège confiant), les similarités différant de 7,0 × 10⁻⁵ au plus.
Le portage Ollama est fidèle ; aucun écart à expliquer.

## Règle de choix appliquée

La règle de `promesse.md` §1, dans l'ordre :

1. maximiser la couverture sous borne haute à 95 % ≤ 10 % ;
2. si aucun couple n'y arrive, minimiser la borne sans descendre sous 20 confiantes sur 54
   (37,0 %) ;
3. si même cela échoue, publier la borne minimale atteignable.

Grille : `haut` 0,30 → 0,95 par 0,01 × `marge` 0,01 / 0,02 / 0,05, sans refus (`mesures/risque-dev-harrier.txt`).

| Étape | Résultat |
| ----- | -------- |
| Couples balayés | 198 (66 `haut` × 3 `marge`) |
| 1 — bornes ≤ 10 % | **aucune** |
| 2 — borne minimale à couverture ≥ 20/54 | **22,6 %**, à 28 confiantes (51,9 %) et 2 erreurs, `marge` 0,01, `haut` dans 0,30–0,73 |
| 3 — borne minimale sans condition de couverture | 19,4 %, mais à 16 confiantes (29,6 %) : sous la couverture utile |

L'étape 2 aboutit, l'étape 3 n'est pas retenue.

**`haut` = 0,73 dans un plateau mesuré 0,30–0,73.** Toute valeur du plateau donne les mêmes
28 confiantes et les mêmes erreurs : c'est la `marge` de 0,01 qui les sépare. On prend le haut du
plateau, le plus exigeant à résultat égal. À ce même `haut`, `marge` 0,02 donne 19 confiantes et
1 erreur (borne 24,6 %) et `marge` 0,05 donne 2 confiantes (borne 65,8 %) : `marge` 0,01 est
retenue.

## Plancher de refus

`bas` ne déplace pas l'étiquette ; il se fixe sur la courbe du refus.

| `bas` | Refusées | Dont la bonne référence était au top 5 |
| ----- | -------: | -------------------------------------: |
| 0,72 | 0 | 0 |
| **0,73 (retenu)** | **0** | **0** |
| 0,74 | 1 | 1 |

La plus faible similarité d'une bonne réponse vaut **0,7304** ; le plancher à 0,73 la rend, avec
4 × 10⁻⁴ de marge, soit plus que l'écart observé entre les deux services (7,0 × 10⁻⁵). La marge
tient, mais elle est mince : un modèle qui dériverait de plus de 4 × 10⁻⁴ tairait cette réponse.
À 0,74, une bonne réponse est tue. `bas` = 0,73 égale `haut` : aucun refus ne porte sur une réponse qui
aurait été confiante.

## Triplet retenu

| Champ | Valeur |
| ----- | ------ |
| Triplet (bas / haut / marge) | **0,73 / 0,73 / 0,01** |
| Confiantes `dev` | 28 / 54 (51,9 %) |
| Erreurs `dev` | 2 (7,1 %) |
| Borne haute à 95 % `dev` | **22,6 %** |
| Refusées `dev` | 0 |
| Pièges cités | 5 / 6 ; **2 confiants et faux** |

Deux pièges sont `confiant` au triplet retenu (compagnie aérienne, 0,7578 ; puces sous-cutanées,
0,7777) ; le troisième des plus proches (implants cérébraux, 0,7286) est refusé par le plancher. Ils
restent hors population comme hors borne ; les inclure donnerait 30 confiantes et 4 erreurs (13,3 %,
borne 29,7 %).

La phrase que la documentation portera : sur les 54 questions sémantiques CNIL, la borne haute à
95 % est de **22,6 %** (2 erreurs sur 28 réponses confiantes, 51,9 % de couverture) ; le meilleur
réglage mesuré sur `dev` plafonne à 19,4 %, à 29,6 % de couverture seulement (16 confiantes).
