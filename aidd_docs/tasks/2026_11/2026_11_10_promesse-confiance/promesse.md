# La promesse de l'étiquette « confiant »

Ce que « confiant » garantit, chiffré, et ce qu'il ne garantit pas, pour le modèle du produit depuis
le 2026-11-11 : `leoipulsar/harrier-0.6b` servi par Ollama. Toutes les valeurs viennent de
`aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/`. Les chiffres de
`qwen3-embedding:0.6b`, modèle précédent, restent dans
`aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/` et `confirmation.md` ; ils ne
décrivent plus le produit.

## La promesse, figée

| Champ | Valeur |
| ----- | ------ |
| Date | 2026-11-11 |
| Corpus à promesse chiffrée | CNIL (`questions-cnil-etendu.csv`) |
| Seuils retenus (bas / haut / marge) | **0,73 / 0,73 / 0,01** |
| Couverture | **51,9 %** (28 questions sémantiques sur 54) |
| Risque ponctuel | **7,1 %** (2 erreurs sur 28 confiantes) |
| Plafond publié (borne haute à 95 %) | **22,6 %** |
| Population de la borne | les 54 questions sémantiques, **pièges exclus** (6 pièges hors population ; 2 sont `confiant` et faux, voir §1) |
| Cible visée | 10 % — **non atteinte, écart de 12,6 points** |
| Repli des autres corpus | 0,69 / 0,74 / 0,01, sans promesse chiffrée |
| Split | dev ; le `test` est constaté sur ses similarités déjà stockées, sans nouveau tir |
| Modèle, index, recherche | `leoipulsar/harrier-0.6b` 1024 d, `data/corpus/index/index.db` 53143 unités, dense |

Ces quatre valeurs — triplet, couverture, risque, plafond — sont le contrat que le code applique : il
ne les recalcule pas. Le `test` confirme la borne et la resserre : 34 confiantes, 0 erreur, borne
**10,2 %**, couverture 63,0 % (`mesures/test-harrier-promesse.md`). Cette constatation n'est **pas
aveugle** : `mesures/confirmation.md` avait pré-publié le 2026-11-10 le couple `haut 0,73` /
`marge 0,01` et ses deux chiffres. Elle reste stable sur tout le plateau `dev` (0,30–0,73), donc le
test n'a pas choisi le triplet ; il pouvait le contredire, pas le sélectionner.

## 1. Population et règle de choix

**Population.** Les questions sémantiques de `questions-cnil-etendu.csv`, c'est-à-dire ni piège ni
référence exacte d'article, mesurées **dans le mode borné au corpus** (`corpus` imposé). Ce sont 54
questions ; une recherche sans `corpus`, ou qui fixe un document, est hors promesse (voir §4).

**Les 6 pièges sont hors population, deux pourtant confiants.** La borne de 22,6 % décrit les 54
questions sémantiques, pas les 6 pièges du jeu. En `dev`, cinq pièges sont cités et deux sont rendus
`confiant` et faux (compagnie aérienne, 0,7578 ; puces sous-cutanées, 0,7777) ; les inclure donnerait
30 confiantes et 4 erreurs (13,3 %, borne 29,7 %). En `test`, cinq sont cités et deux sont `confiant`
et faux (domotique, 0,7457 ; cantines, 0,7743) : 36 confiantes et 2 erreurs (5,6 %, borne 18,1 %).
Le chiffre publié reste celui de la population sémantique, et c'est elle qu'il décrit.

**Hors dénominateur.** `questions-cnil-doctrine.csv` vise le même corpus mais reste rapporté à part :
c'est un sous-ensemble adverse où une seule délibération est attendue parmi ses voisines. Il déclare
le corpus `cnil`, donc la table s'y applique, mais ses questions ne fixent pas le plafond commun ;
ses chiffres sont dans `mesures/autres-corpus.md`. Le compter avec l'autre jeu laisserait son
sous-ensemble dicter le plafond de tous.

**Hors promesse par construction.** Une recherche **sans `corpus`**, ou qui ne nomme **qu'un
document**, suit le repli global : l'instruction de requête et le bassin de candidats y changent,
donc les similarités et les niveaux. Ce mode n'est pas mesuré ici et ne porte aucune promesse.

**Règle de choix**, appliquée dans cet ordre :

1. maximiser la couverture sous borne ≤ 10 % ;
2. si aucun couple n'y arrive, minimiser la borne sans descendre sous la couverture utile de
   20 réponses sur 54, soit 37,0 % ;
3. si même cela échoue, publier la borne minimale atteignable comme un constat.

**Application.**

| Étape | Résultat |
| ----- | -------- |
| Couples balayés | `haut` 0,30 → 0,95 par 0,01 × `marge` 0,01 / 0,02 / 0,05, 198 couples |
| 1 — bornes ≤ 10 % | **aucune** |
| 2 — borne minimale à couverture ≥ 20/54 | **22,6 %**, à 28 confiantes (51,9 %) et 2 erreurs, `marge` 0,01, `haut` dans 0,30–0,73 |
| 3 — borne minimale sans condition de couverture | 19,4 %, mais à 16 confiantes (29,6 %) : sous la couverture utile |

L'étape 2 aboutit, l'étape 3 n'est donc pas retenue. Le plafond publié est la borne atteinte, pas
10 %.

**Ce que la règle ne peut pas tenir, et de combien.** La cible de 10 % est inatteignable sur ce jeu :
même le meilleur réglage plafonne à 19,4 %, à 29,6 % de couverture seulement, soit 9,4 points
au-dessus de la cible. À couverture utile, l'écart est de 12,6 points (22,6 % contre 10 %). Une
borne à 10 % avec zéro erreur demande **35 réponses confiantes** (borne de Wilson à 0 sur 35 = 9,9 %,
contre 10,15 % sur 34) ; le jeu n'en produit 34 qu'en `test`, et 16 sans erreur en `dev`.

**Ce que l'étiquette sépare.** Hors pièges, `incertain` se trompe plus que `confiant` : 8 erreurs sur
26 incertaines en `dev` (30,8 %), contre 2 sur 28 (7,1 %). L'étiquette ordonne deux risques ; elle ne
tranche pas la justesse.

**La phrase que la documentation devra porter.**

> « Confiant » ne promet pas 10 % d'erreur : sur les 54 questions sémantiques CNIL, la borne haute à
> 95 % est de 22,6 % (2 erreurs sur 28 réponses confiantes, 51,9 % de couverture) ; le `test` déjà
> stocké la resserre à 10,2 % (0 erreur sur 34 confiantes, 63,0 % de couverture), et aucun réglage
> mesuré sur `dev` ne descend sous 19,4 %.

**`haut` = 0,73 dans un plateau mesuré 0,30–0,73.** Toute valeur de ce plateau donne les mêmes
28 confiantes : c'est la `marge` de 0,01 qui les sépare, pas le seuil. On prend le haut du plateau,
le plus exigeant à résultat égal : une similarité plus faible n'est pas certifiée sans que la mesure
y gagne quoi que ce soit. À ce même `haut`, `marge` 0,02 donne 19 confiantes et 1 erreur (borne
24,6 %) et `marge` 0,05 donne 2 confiantes (borne 65,8 %).

## 2. Un triplet par corpus, un repli pour le reste

| Corpus | Triplet | Promesse chiffrée |
| ------ | ------- | ----------------- |
| CNIL (`questions-cnil-etendu.csv`) | 0,73 / 0,73 / 0,01 | **oui — 22,6 % à 51,9 % de couverture** |
| RGPD, AI Act, LIL, Conseil d'État, CEPD, tout corpus inconnu, recherche sans `corpus` ou à document unique | 0,69 / 0,74 / 0,01 | non |

**Pourquoi aucun autre corpus ne porte de chiffre.** Le plafond se dimensionne sur le nombre de
confiantes, et 35 confiantes sans erreur sont nécessaires pour afficher 10 %. Les jeux disponibles en
comptent 19 (RGPD v2), 12 (Conseil d'État), 10 (LIL), 10 (CEPD) et 3 (AI Act) questions sémantiques —
au mieux 19 confiantes, et une borne plancher de 16,8 % même à zéro erreur sur les 19. Aucun n'a la
puissance de fixer sa propre borne ni de justifier un chiffre : ils gardent le repli. Leur
comportement sous Harrier reste mesuré en `dev` seulement et publié dans `mesures/autres-corpus.md`.

## 3. Le plancher de refus

`bas` ne déplace pas l'étiquette : il décide seulement quelles questions ne rendent aucun passage.
Il est donc fixé sur la courbe du refus, pas sur celle du risque.

| `bas` | Questions refusées (CNIL, sémantiques) | Dont la bonne référence était au top 5 |
| ----- | ------------------------------------: | -------------------------------------: |
| 0,72 | 0 | 0 |
| **0,73 (retenu)** | **0** | **0** |
| 0,74 | 1 | 1 |

La plus faible similarité d'une bonne réponse vaut **0,7304** ; le plancher à 0,73 la rend, avec
4 × 10⁻⁴ de marge seulement. À 0,74, une bonne réponse est tue. Aucune confiante n'est perdue par le
refus : à 0,73, `bas` égale `haut`, donc tout refus porterait sur une similarité qui serait restée
`incertain` de toute façon.

Les pièges cités ne montent pas : cinq sur six le sont déjà en `dev`, et le plancher ne peut pas les
faire monter au-delà de leur tête de classement.

## 4. Ce que la promesse couvre, et ce qu'elle exclut

**Elle couvre** : une recherche dont le `corpus` est connu, sur le corpus CNIL, dont les passages
rendus satisfont le document attendu **dans les cinq premiers du top 5 brut**, dans au plus
**22,6 %** des cas sur les réponses étiquetées `confiant` (borne haute à 95 % ; mesuré à 7,1 %, soit
2 erreurs sur 28 confiantes, sur les 54 questions sémantiques, pièges exclus).

**Elle exclut** :

- **la réponse prise une à une** : c'est une moyenne de corpus. Aucun signal par passage ne dit que
  le premier résultat est le bon article ; une réponse `confiante` peut rester fausse et la promesse
  ne la couvre pas ;
- **le fragment exact** : la mesure est au **document**, pas à l'article ni au fragment ;
- **le rang 1** : le top 5 suffit à satisfaire la référence. La promesse ne dit rien du classement
  interne ;
- **le sous-ensemble doctrinal** `questions-cnil-doctrine.csv` : mesuré et publié dans
  `mesures/autres-corpus.md`, mais hors plafond ;
- **les pièges** : 6 questions sans réponse attendue, hors population et hors borne ; deux sont
  pourtant rendues `confiantes` et fausses (voir §1) ;
- **la recherche sans `corpus` ou à document unique** : elle suit le repli et n'est pas mesurée ;
- **une recherche CNIL filtrée** (`nature`, `date_min`, `date_max`, `type_sanction`, `montant_min`,
  `montant_max`, `numero`) : le bassin change et le harnais n'exerce pas ces filtres ; le
  sous-ensemble doctrinal, qui est une CNIL restreinte, reste un cas adverse ;
- **un `k` inférieur à 5** : la promesse est mesurée sur les cinq premiers passages ;
- **la justesse rédactionnelle** : le style, l'exhaustivité ou l'à-propos de la réponse ne sont pas
  mesurés ;
- **les autres corpus** : aucune promesse chiffrée (voir §2).

## 5. Ce que la règle livrée donne sur les sept jeux

La règle livrée applique la table CNIL au corpus `cnil` (jeu étendu **et** doctrine, qui déclare le
même corpus) et le repli `0,69 / 0,74 / 0,01` partout ailleurs. Mesures `dev` sous Harrier
(`mesures/autres-corpus.md`) :

| Jeu | Règle | Confiantes | Couverture | Erreurs | Risque | Borne 95 % | Refusées |
| --- | --- | ---------: | ---------: | ------: | -----: | ---------: | -------: |
| CNIL étendu | table 0,73 / 0,73 / 0,01 | 28 | 51,9 % | 2 | 7,1 % | **22,6 %** | 0 |
| CNIL doctrine | table, hors promesse | 3 | 30,0 % | 3 | 100,0 % | 100,0 % | 0 |

Les cinq autres jeux suivent le repli : 5 confiantes sans erreur sur le RGPD, 0 sur l'AI Act, 2 sur la
LIL, 2 sur le Conseil d'État et 3 sur le CEPD, toutes sans erreur ; 1 bonne réponse RGPD est refusée
par le plancher. Aucune ne porte de promesse. Le détail, avec top 5, rang 1 et MRR, est dans
`mesures/autres-corpus.md` et n'est pas recopié ici.

## 6. Ce qui invaliderait ce document

- un changement d'embedder, d'index ou de mode de recherche : l'échelle de similarité se déplace et
  la table se recalibre ;
- toute modification du top 5, de `refSatisfaite` ou du découpage des jeux ;
- une nouvelle mesure du split `test`, qui se fait une fois et peut resserrer ou élargir la borne
  sans changer la règle. Le tir est dépensé pour `qwen3-embedding:0.6b` et
  `mradermacher/harrier-oss-v1-0.6b-GGUF` ; `leoipulsar/harrier-0.6b` n'en a pas consommé et ne doit
  pas en consommer : il est équivalent au modèle mesuré (rangs et niveaux identiques sur `dev`, écart de similarité ≤ 7,0 × 10⁻⁵).

Tant que ces conditions tiennent, « confiant » vaut **22,6 % au plus, à 51,9 % de couverture, sur le
corpus CNIL** — et rien de plus. Le `test` constate 10,2 % à 63,0 %.
