# La promesse de l'étiquette « confiant »

Ce que « confiant » garantit, chiffré, et ce qu'il ne garantit pas.
Toutes les valeurs viennent de `mesures/` (phase 1) ou de la réexécution de
`mcp/eval/risque.ts` décrite plus bas. Aucune n'est reprise d'un autre rapport.

## La promesse, figée

| Champ | Valeur |
| ----- | ------ |
| Date | 2026-11-10 |
| Corpus à promesse chiffrée | CNIL (`questions-cnil-etendu.csv`) |
| Seuils retenus (bas / haut / marge) | **0,67 / 0,67 / 0,02** |
| Couverture | **40,7 %** (22 questions sémantiques sur 54) |
| Risque ponctuel | **13,6 %** (3 erreurs sur 22 confiantes) |
| Plafond publié (borne haute à 95 %) | **33,3 %** |
| Population de la borne | les 54 questions sémantiques, **pièges exclus** (6 pièges hors population ; l'un est `confiant` et faux, voir §1) |
| Cible visée | 10 % — **non atteinte, écart de 23,3 points** |
| Repli des autres corpus | 0,69 / 0,74 / 0,01, sans promesse chiffrée |
| Split | dev ; le split `test` n'a pas été touché |
| Modèle, index, recherche | `qwen3-embedding:0.6b` 1024 d, `data/corpus/index/index.db` 53143 unités, dense |

Ces quatre valeurs — triplet, couverture, risque, plafond — sont le contrat de la
phase 3 : elle les code, elle ne les recalcule pas.

## 1. Population et règle de choix

**Population.** Les questions sémantiques de `questions-cnil-etendu.csv`,
c'est-à-dire ni piège ni référence exacte d'article, mesurées **dans le mode
borné au corpus** (`corpus` imposé). Ce sont 54 questions ; une recherche sans
`corpus`, ou qui fixe un document, est hors promesse (voir §4).

**Les 6 pièges sont hors population, l'un pourtant confiant.** La borne de
33,3 % décrit les 54 questions sémantiques, pas les 6 pièges du jeu. L'un d'eux,
« loueur de vélos en libre-service » (similarité 0,7978), est néanmoins rendu
`confiant` et faux : l'inclure donnerait 4 erreurs sur 23 confiantes (17,4 %,
borne 37,1 %). Le chiffre publié reste celui de la population sémantique, et
c'est elle qu'il décrit.

**Hors dénominateur.** `questions-cnil-doctrine.csv` vise le même corpus mais
reste rapporté à part : c'est un sous-ensemble adverse (une seule délibération
attendue parmi ses voisines) où 6 confiantes sur 9 se trompent aux seuils globaux d'alors, et 4 sur 6 à
la règle livrée. Le compter avec l'autre jeu laisserait son sous-ensemble dicter le
plafond de tous.

**Hors promesse par construction.** Une recherche **sans `corpus`**, ou qui ne
nomme **qu'un document**, suit le repli global : l'instruction de requête et le
bassin de candidats y changent, donc les similarités et les niveaux. Ce mode
n'est pas mesuré ici et ne porte aucune promesse.

**Règle de choix**, appliquée dans cet ordre :

1. maximiser la couverture sous borne ≤ 10 % ;
2. si aucun couple n'y arrive, minimiser la borne sans descendre sous la
   couverture utile de 20 réponses sur 54, soit 37,0 % ;
3. si même cela échoue, publier la borne minimale atteignable comme un constat.

**Application.**

| Étape | Résultat |
| ----- | -------- |
| Couples balayés | `haut` 0,30 → 0,95 par 0,01 × `marge` 0,01 / 0,02 / 0,05 (phase 1) |
| 1 — bornes ≤ 10 % | **aucune** : la borne la plus basse de toute la grille est 25,9 % |
| 2 — borne minimale à couverture ≥ 20/54 | **33,3 %**, à 22 confiantes (40,7 %) et 3 erreurs, `marge` 0,02, `haut` dans 0,30–0,67 |
| 3 — borne minimale sans condition de couverture | 25,9 %, mais à 11 confiantes (20,4 %) : sous la couverture utile |

L'étape 2 aboutit, l'étape 3 n'est donc pas retenue. Le plafond publié est bien
la borne atteinte, pas 10 %.

**Ce que la règle ne peut pas tenir, et de combien.** La cible de 10 % est
inatteignable sur ce jeu, à toute couverture : même en ne certifiant que 11
réponses sur 54, le meilleur réglage plafonne à 25,9 %, soit 15,9 points
au-dessus. À couverture utile, l'écart est de 23,3 points (33,3 % contre 10 %).
La cause est arithmétique autant que qualitative : une borne à 10 % avec zéro
erreur demande **35 réponses confiantes** (borne de Wilson à 0 sur 35 = 9,9 %,
contre 10,15 % sur 34), et le jeu n'en produit 22 qu'au prix de 3 erreurs. Aucun
plafond à 10 % ne peut être écrit sans mentir sur ce que 54 questions peuvent
démontrer.

**Ce que l'étiquette sépare, et ce qu'élargir ne donnerait pas.** Hors pièges,
`incertain` se trompe à 37,5 % (12 sur 32) : l'étiquette sépare donc 13,6 % de
37,5 %, elle ordonne deux risques, elle ne tranche pas la justesse. Élargir
le jeu ne changerait pas la cible : à taux d'erreur constant de 13,6 %, la borne
ne se resserre vers cette valeur qu'avec le nombre de confiantes — environ 150
confiantes pour publier 20 % — et aucune quantité de questions ne fait descendre
13,6 % sous 10 %. Sans meilleure règle, la borne tend vers 13,6 %, pas vers 10 %.

**La phrase que la documentation devra porter.**

> « Confiant » ne promet pas 10 % d'erreur : sur les 54 questions sémantiques
> CNIL, la borne haute à 95 % est de 33,3 % (3 erreurs sur 22 réponses
> confiantes, 40,7 % de couverture) ; aucun réglage mesuré ne descend sous 25,9 %,
> et 10 % demanderait au moins 35 réponses confiantes sans une seule erreur.

**`haut` = 0,67 dans un plateau mesuré 0,30–0,67.** Toute valeur de ce plateau
donne les mêmes 22 confiantes : c'est la `marge` de 0,02 qui les sépare, pas le
seuil. On prend le haut du plateau, le plus exigeant à résultat égal : une
similarité plus faible n'est pas certifiée sans que la mesure y gagne quoi que ce
soit.

## 2. Un triplet par corpus, un repli pour le reste

| Corpus | Triplet | Promesse chiffrée |
| ------ | ------- | ----------------- |
| CNIL (`questions-cnil-etendu.csv`) | 0,67 / 0,67 / 0,02 | **oui — 33,3 % à 40,7 % de couverture** |
| RGPD, AI Act, LIL, Conseil d'État, CEPD, tout corpus inconnu, recherche sans `corpus` ou à document unique | 0,69 / 0,74 / 0,01 | non |

**Pourquoi aucun autre corpus ne porte de chiffre.** Le plafond se dimensionne
sur le nombre de confiantes, pas sur la taille du jeu, et 35 confiantes sans
erreur sont nécessaires pour afficher 10 %. Les jeux disponibles en comptent 19
(RGPD v2), 12 (Conseil d'État), 10 (LIL), 10 (CEPD) et 3 (AI Act) questions
sémantiques — donc au mieux 19 confiantes, et une borne plancher de 16,8 % même à
zéro erreur sur les 19. Aucun n'a la puissance de fixer sa propre borne ni de
justifier un chiffre : ils gardent le repli, qui est le triplet du produit calibré
sur le RGPD, et leur mesure reste publiée dans `mesures/risque-couverture.md`.

## 3. Le plancher de refus

`bas` ne déplace pas l'étiquette : il décide seulement quelles questions ne
rendent aucun passage. Il est donc fixé sur la courbe du refus, pas sur celle du
risque.

| `bas` | Questions refusées (CNIL, sémantiques) | Dont la bonne référence était au top 5 |
| ----- | ------------------------------------: | -------------------------------------: |
| 0,69 (repli) | 4 | 2 |
| **0,67 (retenu)** | **0** | **0** |

Les deux bonnes réponses tues aujourd'hui sont à **0,677** et **0,6812** ; toutes
deux franchissent un plancher à 0,67. Aucune autre bonne réponse n'est tue : il
n'en reste aucune. Sur les 4 questions que le plancher rend en plus, 2 n'ont pas
leur référence au top 5 : le refus ne les cachait pas par justesse, il les cachait
par score.

Aucune confiante n'est perdue par le refus : à 0,67, `bas` égale `haut`, donc
tout refus porte sur une similarité qui serait restée `incertain` de toute façon.
Le triplet ne retire rien de ce que la mesure sans refus certifie.

**Les pièges cités ne montent pas.** Ils sont à 6 sur 6, et le plancher ne peut
pas les faire monter : la plus faible similarité de tête d'un piège est 0,6906,
au-dessus des deux planchers. Un piège déjà cité le reste, aucun ne s'ajoute.

## 4. Ce que la promesse couvre, et ce qu'elle exclut

**Elle couvre** : une recherche dont le `corpus` est connu, sur le corpus CNIL,
dont les passages rendus satisfont le document attendu **dans les cinq premiers
du top 5 brut**, dans au plus **33,3 %** des cas sur les réponses étiquetées
`confiant` (borne haute à 95 % ; mesuré à 13,6 %, soit 3 erreurs sur 22
confiantes, sur les 54 questions sémantiques, pièges exclus).

**Elle exclut** :

- **la réponse prise une à une** : c'est une moyenne de corpus. Aucun signal par
  passage ne dit que le premier résultat est le bon article ; une réponse
  `confiante` peut rester fausse et la promesse ne la couvre pas ;
- **le fragment exact** : la mesure est au **document**, pas à l'article ni au
  fragment. `refSatisfaite` compare le document entier pour la CNIL ;
- **le rang 1** : le top 5 suffit à satisfaire la référence. La promesse ne dit
  rien du classement interne ;
- **le sous-ensemble doctrinal** `questions-cnil-doctrine.csv` : mesuré et publié
  (9 confiantes, 6 erreurs, 66,7 %, borne 87,9 % aux seuils globaux d'alors, 0,69 / 0,74 / 0,01 ;
  6 confiantes, 4 erreurs, 66,7 %, borne 90,3 % à la règle retenue), mais hors
  plafond ;
- **les pièges** : 6 questions sans réponse attendue, hors population et hors
  borne ; l'une est pourtant rendue `confiante` et fausse (voir §1) ;
- **la recherche sans `corpus` ou à document unique** : elle suit le repli et
  n'est pas mesurée ;
- **une recherche CNIL filtrée** (`nature`, `date_min`, `date_max`,
  `type_sanction`, `montant_min`, `montant_max`, `numero`) : le bassin change et
  le harnais n'exerce pas ces filtres ; le sous-ensemble doctrinal, qui est une
  CNIL restreinte, trompe 4 fois sur 6 ;
- **un `k` inférieur à 5** : la promesse est mesurée sur les cinq premiers
  passages ; en dessous, le test de satisfaction ne décrit plus ce que le
  lecteur reçoit ;
- **la justesse rédactionnelle** : le style, l'exhaustivité ou l'à-propos de la
  réponse ne sont pas mesurés ;
- **les autres corpus** : aucune promesse chiffrée (voir §2).

## 5. Ce que la règle livrée donne sur les sept jeux

La règle livrée applique la table CNIL au corpus `cnil` (jeu étendu **et** doctrine,
qui déclare le même corpus) et le repli `0,69 / 0,74 / 0,01` partout ailleurs.
Mesures de la phase 4, `mesures/dev-apres.md` :

| Jeu | Règle | Confiantes | Couverture | Erreurs | Risque | Borne 95 % | Refusées |
| --- | --- | ---------: | ---------: | ------: | -----: | ---------: | -------: |
| CNIL étendu | table 0,67 / 0,67 / 0,02 | 22 | 40,7 % | 3 | 13,6 % | **33,3 %** | 0 |
| CNIL doctrine | table, hors promesse | 6 | 60,0 % | 4 | 66,7 % | 90,3 % | 0 |
| RGPD v2 | repli | 16 | 84,2 % | 0 | 0,0 % | 19,4 % | 0 |
| AI Act | repli | 0 | 0,0 % | 0 | non mesuré | non mesuré | 0 |
| LIL | repli | 4 | 40,0 % | 0 | 0,0 % | 49,0 % | 0 |
| Conseil d'État | repli | 6 | 50,0 % | 1 | 16,7 % | 56,4 % | 0 |
| CEPD | repli | 2 | 20,0 % | 0 | 0,0 % | 65,8 % | 0 |

Seule la ligne CNIL étendu porte une promesse. Les autres sont documentaires :
avec 19, 12, 10 et 3 questions sémantiques, aucune ne peut soutenir un plafond, et
la doctrine reste un sous-ensemble adverse dont le risque est publié sans être
couvert.

Une simulation appliquant le triplet CNIL aux sept jeux existe dans l'historique
de la phase 2 ; elle ne décrit pas ce qui part et ne doit pas être citée.

## 6. Ce qui invaliderait ce document

- un changement d'embedder, d'index ou de mode de recherche : l'échelle de
  similarité se déplace et la table se recalibre ;
- toute modification du top 5, de `refSatisfaite` ou du découpage des jeux ;
- la mesure du split `test`, qui se fait une fois, après les corrections, et qui
  peut resserrer ou élargir la borne sans changer la règle.

Tant que ces conditions tiennent, « confiant » vaut **33,3 % au plus, à 40,7 % de
couverture, sur le corpus CNIL** — et rien de plus.
