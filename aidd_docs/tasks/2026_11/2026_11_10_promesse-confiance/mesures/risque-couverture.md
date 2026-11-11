# Risque et couverture des seuils de confiance

Ce que la promesse « confiant » vaut aujourd'hui, chiffré sur les sept jeux `dev`.
Tous les chiffres viennent des `--json` de ce dossier, produits par `mcp/eval/run.ts` ;
aucune valeur n'est recopiée d'un autre rapport. Le split `test` n'a pas été touché.

```sh
node mcp/eval/run.ts --questions <jeu>.csv --split dev --json > mesures/<jeu>.json
node mcp/eval/risque.ts mesures/<jeu>.json --seuils bas,haut,marge
```

## Définitions

- **sémantiques** : questions ni piège, ni référence exacte d'article (le court-circuit
  déterministe de `search` sert ces dernières sans vecteurs, leur niveau ne dit rien de la promesse).
- **couverture** : part des questions sémantiques étiquetées `confiant` ;
- **confiantes** : leur nombre, seul dénominateur du risque et de la borne ;
- **risque** : part des confiantes dont aucune référence attendue n'est satisfaite au top 5 brut,
  au sens de `refSatisfaite` : document entier pour la CNIL, la LIL, le Conseil d'État et le CEPD,
  `#art_N` pour le RGPD et l'AI Act ;
- **borne 95 %** : borne haute de Wilson du risque, calculée sur le nombre de confiantes, jamais
  sur la taille du jeu ; `—` quand aucune question n'est confiante, le risque n'est alors pas mesuré.

Le balayage `haut × marge` se fait sans refus (`bas = 0`) : sous `haut`, une question n'est de toute
façon jamais `confiante`, donc la couverture et le risque de l'étiquette ne dépendent pas de `bas`.
Le plancher a sa propre courbe, plus bas.

## Conditions de mesure

| Champ | Valeur |
| ----- | ------ |
| Date | 2026-11-10 |
| Modèle | `qwen3-embedding:0.6b`, 1024 dimensions |
| Index | `data/corpus/index/index.db`, 53143 unités |
| Recherche | dense |
| Split | dev pour les sept jeux |
| Jeu `test` | non mesuré |

| Jeu | Fichier | Questions | Sémantiques | Pièges | Références exactes |
| --- | ------- | --------: | ----------: | -----: | -----------------: |
| RGPD v2 | `rgpd-v2.json` | 30 | 19 | 5 | 6 |
| AI Act | `aiact.json` | 12 | 3 | 2 | 7 |
| CNIL étendu | `cnil-etendu.json` | 60 | 54 | 6 | 0 |
| LIL | `lil.json` | 10 | 10 | 0 | 0 |
| Conseil d'État | `ce.json` | 12 | 12 | 0 | 0 |
| CEPD | `cepd.json` | 10 | 10 | 0 | 0 |
| CNIL doctrine | `cnil-doctrine.json` | 10 | 10 | 0 | 0 |

## Aux seuils du produit (0,69 / 0,74 / 0,01)

| Jeu | Sémantiques | Confiantes | Couverture | Erreurs | Risque | Borne 95 % |
| --- | ----------: | ---------: | ---------: | ------: | -----: | ---------: |
| RGPD v2 | 19 | 16 | 84,2 % | 0 | 0,0 % | 19,4 % |
| AI Act | 3 | 0 | 0,0 % | 0 | — | — |
| CNIL étendu | 54 | 24 | 44,4 % | 5 | 20,8 % | 40,5 % |
| LIL | 10 | 4 | 40,0 % | 0 | 0,0 % | 49,0 % |
| Conseil d'État | 12 | 6 | 50,0 % | 1 | 16,7 % | 56,4 % |
| CEPD | 10 | 2 | 20,0 % | 0 | 0,0 % | 65,8 % |
| CNIL doctrine | 10 | 9 | 90,0 % | 6 | 66,7 % | 87,9 % |

## Aux seuils calibrés de chaque jeu

| Jeu | Seuils (bas / haut / marge) | Sémantiques | Confiantes | Couverture | Erreurs | Risque | Borne 95 % |
| --- | --------------------------- | ----------: | ---------: | ---------: | ------: | -----: | ---------: |
| RGPD v2 | 0,68 / 0,73 / 0,01 | 19 | 17 | 89,5 % | 0 | 0,0 % | 18,4 % |
| AI Act | 0,69 / 0,74 / 0,01 | 3 | 0 | 0,0 % | 0 | — | — |
| CNIL étendu | 0,62 / 0,67 / 0,01 | 54 | 30 | 55,6 % | 6 | 20,0 % | 37,3 % |
| LIL | 0,64 / 0,69 / 0,01 | 10 | 7 | 70,0 % | 0 | 0,0 % | 35,4 % |
| Conseil d'État | 0,70 / 0,75 / 0,01 | 12 | 6 | 50,0 % | 1 | 16,7 % | 56,4 % |
| CEPD | 0,77 / 0,87 / 0,01 | 10 | 2 | 20,0 % | 0 | 0,0 % | 65,8 % |
| CNIL doctrine | 0,71 / 0,76 / 0,01 | 10 | 8 | 80,0 % | 5 | 62,5 % | 86,3 % |

L'AI Act n'a pas de colonne `split` : ses seuils sont les constantes figées, pas une calibration.

## Lecture

**CNIL étendu reproduit exactement le chiffre qui a déclenché ce plan** : aux seuils du produit,
24 confiantes, 5 fausses, soit 20,8 %, borne haute 40,5 %, pour une couverture de 44,4 %.
La calibration du jeu (0,62 / 0,67) ajoute 6 confiantes, dont une fausse de plus :
le risque reste à 20,0 % et la borne ne se resserre que de 40,5 % à 37,3 %.

**RGPD v2 ne fait aucune erreur sur 16 confiantes**, à 84,2 % de couverture. Ce zéro est fragile :
l'unique échec de rappel du jeu (« autorité de contrôle chef de file ») a un premier passage à 0,793
et un second à 0,783, soit un écart de 0,0100 que la marge de 0,01 rejette de justesse.
La promesse tient ici par un cheveu, pas par une marge confortable : la borne à 19,4 %
tient à zéro faute sur seize, et la première fausse confiante la ferait monter à 28,3 %.

**La doctrine est le jeu adverse** : 6 fausses sur 9 confiantes (66,7 %, borne 87,9 %) aux seuils du
produit, 5 sur 8 (62,5 %, borne 86,3 %) aux seuils calibrés. Elle ne fixe pas la promesse, elle
montre ce qu'un sous-ensemble où une seule délibération est attendue parmi ses voisines fait à l'étiquette.

**L'AI Act n'est pas mesurable sur ce jeu** : 3 questions sémantiques seulement, car sept références
d'article sont écartées, et aucune n'est confiante aux seuils du produit. La question à 0,869 est
écartée par la marge (écart 0,008). Couverture nulle, risque non mesuré : ce jeu ne prouve rien,
ni dans un sens ni dans l'autre.

**LIL, Conseil d'État et CEPD restent trop petits pour démontrer un plafond** : 10, 12 et 10 questions
sémantiques, 4, 6 et 2 confiantes. Zéro faute sur 2 confiantes laisse une borne à 65,8 % ;
le CEPD ne peut donc rien promettre, même quand son risque ponctuel est nul.

La borne suit le nombre de confiantes, pas la taille du jeu : c'est elle qui dit ce que la
promesse peut affirmer, et elle est large partout où les confiantes sont rares.

## La courbe du plancher

Le plancher `bas` ne déplace pas l'étiquette, il décide seulement quelles questions ne rendent
rien. La courbe donne, pour chaque valeur de `bas`, le nombre de questions sémantiques sans
passage et, parmi elles, celles dont une référence attendue était pourtant au top 5 brut :
c'est le coût du refus. `—` vaut `0 / 0`.

| Jeu | Premier refus | Au plancher du produit (0,69) | Au plancher calibré |
| --- | ------------- | ----------------------------- | ------------------- |
| RGPD v2 | bas 0,72 : 1 / 1 | 0 refusées, 0 justes | 0 refusées, 0 justes |
| AI Act | bas 0,70 : 1 / 0 | 0 refusées, 0 justes | 0 refusées, 0 justes |
| CNIL étendu | bas 0,68 : 1 / 1 | 4 refusées, 2 justes | 0 refusées, 0 justes |
| LIL | bas 0,70 : 1 / 1 | 0 refusées, 0 justes | 0 refusées, 0 justes |
| Conseil d'État | bas 0,76 : 3 / 2 | 0 refusées, 0 justes | 0 refusées, 0 justes |
| CEPD | bas 0,78 : 1 / 1 | 0 refusées, 0 justes | 0 refusées, 0 justes |
| CNIL doctrine | bas 0,75 : 1 / 0 | 0 refusées, 0 justes | 0 refusées, 0 justes |

Aux seuils du produit, seul le CNIL étendu refuse : 4 questions, dont 2 avaient la bonne référence
au top 5. Les seuils calibrés, eux, ne refusent rien sur les sept jeux.

Courbe complète, `refusées / justes refusées` :

| bas | RGPD v2 | AI Act | CNIL étendu | LIL | Conseil d'État | CEPD | CNIL doctrine |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0,20 | — | — | — | — | — | — | — |
| 0,21 | — | — | — | — | — | — | — |
| 0,22 | — | — | — | — | — | — | — |
| 0,23 | — | — | — | — | — | — | — |
| 0,24 | — | — | — | — | — | — | — |
| 0,25 | — | — | — | — | — | — | — |
| 0,26 | — | — | — | — | — | — | — |
| 0,27 | — | — | — | — | — | — | — |
| 0,28 | — | — | — | — | — | — | — |
| 0,29 | — | — | — | — | — | — | — |
| 0,30 | — | — | — | — | — | — | — |
| 0,31 | — | — | — | — | — | — | — |
| 0,32 | — | — | — | — | — | — | — |
| 0,33 | — | — | — | — | — | — | — |
| 0,34 | — | — | — | — | — | — | — |
| 0,35 | — | — | — | — | — | — | — |
| 0,36 | — | — | — | — | — | — | — |
| 0,37 | — | — | — | — | — | — | — |
| 0,38 | — | — | — | — | — | — | — |
| 0,39 | — | — | — | — | — | — | — |
| 0,40 | — | — | — | — | — | — | — |
| 0,41 | — | — | — | — | — | — | — |
| 0,42 | — | — | — | — | — | — | — |
| 0,43 | — | — | — | — | — | — | — |
| 0,44 | — | — | — | — | — | — | — |
| 0,45 | — | — | — | — | — | — | — |
| 0,46 | — | — | — | — | — | — | — |
| 0,47 | — | — | — | — | — | — | — |
| 0,48 | — | — | — | — | — | — | — |
| 0,49 | — | — | — | — | — | — | — |
| 0,50 | — | — | — | — | — | — | — |
| 0,51 | — | — | — | — | — | — | — |
| 0,52 | — | — | — | — | — | — | — |
| 0,53 | — | — | — | — | — | — | — |
| 0,54 | — | — | — | — | — | — | — |
| 0,55 | — | — | — | — | — | — | — |
| 0,56 | — | — | — | — | — | — | — |
| 0,57 | — | — | — | — | — | — | — |
| 0,58 | — | — | — | — | — | — | — |
| 0,59 | — | — | — | — | — | — | — |
| 0,60 | — | — | — | — | — | — | — |
| 0,61 | — | — | — | — | — | — | — |
| 0,62 | — | — | — | — | — | — | — |
| 0,63 | — | — | — | — | — | — | — |
| 0,64 | — | — | — | — | — | — | — |
| 0,65 | — | — | — | — | — | — | — |
| 0,66 | — | — | — | — | — | — | — |
| 0,67 | — | — | — | — | — | — | — |
| 0,68 | — | — | 1 / 1 | — | — | — | — |
| **0,69** | — | — | 4 / 2 | — | — | — | — |
| 0,70 | — | 1 / 0 | 4 / 2 | 1 / 1 | — | — | — |
| 0,71 | — | 1 / 0 | 4 / 2 | 2 / 2 | — | — | — |
| 0,72 | 1 / 1 | 2 / 1 | 7 / 5 | 3 / 3 | — | — | — |
| 0,73 | 1 / 1 | 2 / 1 | 11 / 6 | 5 / 5 | — | — | — |
| 0,74 | 2 / 2 | 2 / 1 | 13 / 6 | 5 / 5 | — | — | — |
| 0,75 | 5 / 5 | 2 / 1 | 17 / 9 | 5 / 5 | — | — | 1 / 0 |
| 0,76 | 7 / 7 | 2 / 1 | 26 / 15 | 5 / 5 | 3 / 2 | — | 1 / 0 |
| 0,77 | 7 / 7 | 2 / 1 | 30 / 18 | 5 / 5 | 5 / 3 | — | 2 / 1 |
| 0,78 | 9 / 9 | 2 / 1 | 32 / 19 | 6 / 6 | 6 / 3 | 1 / 1 | 2 / 1 |
| 0,79 | 11 / 11 | 2 / 1 | 35 / 21 | 6 / 6 | 6 / 3 | 1 / 1 | 3 / 1 |
| 0,80 | 12 / 11 | 2 / 1 | 39 / 25 | 6 / 6 | 7 / 4 | 2 / 2 | 6 / 2 |
| 0,81 | 13 / 12 | 2 / 1 | 42 / 27 | 8 / 8 | 9 / 5 | 2 / 2 | 6 / 2 |
| 0,82 | 15 / 14 | 2 / 1 | 45 / 30 | 8 / 8 | 10 / 6 | 3 / 3 | 8 / 3 |
| 0,83 | 15 / 14 | 2 / 1 | 48 / 33 | 8 / 8 | 10 / 6 | 3 / 3 | 9 / 3 |
| 0,84 | 15 / 14 | 2 / 1 | 50 / 35 | 9 / 9 | 10 / 6 | 5 / 5 | 9 / 3 |
| 0,85 | 16 / 15 | 2 / 1 | 50 / 35 | 9 / 9 | 12 / 8 | 5 / 5 | 10 / 3 |
| 0,86 | 16 / 15 | 2 / 1 | 52 / 37 | 10 / 10 | 12 / 8 | 5 / 5 | 10 / 3 |
| 0,87 | 18 / 17 | 3 / 2 | 53 / 38 | 10 / 10 | 12 / 8 | 6 / 6 | 10 / 3 |
| 0,88 | 18 / 17 | 3 / 2 | 53 / 38 | 10 / 10 | 12 / 8 | 7 / 7 | 10 / 3 |
| 0,89 | 18 / 17 | 3 / 2 | 53 / 38 | 10 / 10 | 12 / 8 | 8 / 8 | 10 / 3 |
| 0,90 | 18 / 17 | 3 / 2 | 53 / 38 | 10 / 10 | 12 / 8 | 9 / 9 | 10 / 3 |
| 0,91 | 18 / 17 | 3 / 2 | 54 / 39 | 10 / 10 | 12 / 8 | 10 / 10 | 10 / 3 |
| 0,92 | 19 / 18 | 3 / 2 | 54 / 39 | 10 / 10 | 12 / 8 | 10 / 10 | 10 / 3 |
| 0,93 | 19 / 18 | 3 / 2 | 54 / 39 | 10 / 10 | 12 / 8 | 10 / 10 | 10 / 3 |
| 0,94 | 19 / 18 | 3 / 2 | 54 / 39 | 10 / 10 | 12 / 8 | 10 / 10 | 10 / 3 |
| 0,95 | 19 / 18 | 3 / 2 | 54 / 39 | 10 / 10 | 12 / 8 | 10 / 10 | 10 / 3 |

## Ce que ce rapport ne dit pas

- Aucun chiffre de split `test` : la promesse se confirme une fois, après les corrections.
- Aucune promesse par réponse : le risque est une moyenne de corpus, pas un signal par passage.
- Les deux jeux CNIL restent séparés ici ; leur fusion est l'affaire de la phase suivante.
- L'AI Act n'a aucune confiante en `dev` : rien n'y est mesuré.
