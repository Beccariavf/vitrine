---
phase: 6
status: completed
observed: 2026-11-10
verdict: Harrier gagne sur le test ; adoption renvoyée ; promesse qwen3 tenue
---

# Tir unique sur le split `test` : modèle et promesse

Le split `test` de `questions-cnil-etendu.csv` (60 questions : 54 sémantiques,
6 pièges) a été mesuré une fois, le 2026-11-10, sur deux modèles pré-déclarés ici :
`qwen3-embedding:0.6b` avec la règle livrée (`--regle produit`), puis
`mradermacher/harrier-oss-v1-0.6b-GGUF` sur son index séparé, dans cet ordre.

Le marqueur `mcp/eval/questions-cnil-etendu.test-consomme.json` porte une entrée
par modèle, comme le veut la convention du harnais (`mesure-v3` a fait de même
pour `0.6b` et `4b`). Deux réserves à écrire plutôt qu'à taire : le garde est
**par nom de modèle**, pas par collection — un troisième modèle serait encore
accepté et consommerait un nouveau tir ; et il ne peut pas vérifier qu'un modèle
a été pré-déclaré. **Aucun tir ne se rejoue pour ces deux modèles.**

## 1. Verdict de modèle

| Configuration | top 5 | rang 1 | MRR | paires `b` / `c` | p | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `qwen3-embedding:0.6b` | 42/54 | 32/54 | 0,667 | — | — | — |
| Harrier 0.6B | **50/54** | **41/54** | **0,825** | 10 / 1 | **0,0117** | **`adopter`** |

`compare.ts --vue brute` : `b = 10`, `c = 1`, 11 paires discordantes, top 5 non
dégradé (42 → 50). La règle figée adopte. Le gain observé sur `dev` (`p = 0,0931`,
`non_etabli`) se confirme hors échantillon : c'est le seul résultat du dossier qui
passe le seuil de signification.

Ce que le test ne dit pas : la mesure porte sur 54 questions CNIL, pas sur les
cinq autres corpus ; et elle compare des classements, pas des réponses rédigées.

## 2. Promesse de confiance, côté qwen3

Mesure `test-qwen3.json`, avec la règle livrée (`--regle produit`, table CNIL
`0,67 / 0,67 / 0,02`) :

| | Dev (calibration) | Test (confirmation) |
| --- | --- | --- |
| Confiantes | 22 / 54 (40,7 %) | 26 / 54 (48,1 %) |
| Erreurs | 3 (13,6 %) | **1 (3,8 %)** |
| Borne haute 95 % | 33,3 % | **18,9 %** |
| Refusées | 0 | 2, dont **0** juste |

La promesse publiée (33,3 % au plus) est tenue hors échantillon, et de loin. Les
deux refus du test ne cachent aucune bonne réponse : le plancher ne coûte rien
ici.

## 3. Ce que le test ne confirme pas

Les niveaux de Harrier dans `test-harrier.json` (34 confiantes, 20 incertaines,
0 refusée) sont calculés avec le repli `0,69 / 0,74 / 0,01`, triplet produit calibré sur le RGPD v1 et non sur
l'échelle de Harrier :
sur une autre échelle de similarité, ils ne portent aucune promesse. La promesse
de Harrier reste à établir.

Elle peut l'être sans nouveau tir : les similarités du test sont conservées dans
`test-harrier.json`, donc la règle se calibre sur `dev` puis se constate sur ce
fichier — à condition de figer la règle **avant** de relire le test, sinon le tir
unique n'est plus qu'une discipline d'honneur.

Chiffres indicatifs, seuil haut au sommet du plateau de `dev` (`haut 0,73`,
`marge 0,01`, refus non comptés) : 28 confiantes, 2 erreurs (7,1 %), borne
22,6 % sur `dev` ; appliquée au test, 34 confiantes, 0 erreur, borne 10,2 %.
C'est le meilleur argument pour l'adoption, et il reste à figer par écrit dans le
lot suivant.

## 4. Conséquence

La question du modèle est tranchée : Harrier gagne. L'adoption n'est pas faite
ici, et ne peut pas l'être sans trois choses qui changent le produit :

1. reconstruire l'index complet avec Harrier (53 143 unités ; 36 min pour les
   29 299 unités CNIL, 2,5 à 19,2 unités/s selon la charge, donc de l'ordre d'une
   à plusieurs heures) ;
2. choisir le service qui le sert en production — Unsloth Studio est une
   application de bureau, pas un démon supervisé ;
3. recalibrer la table de confiance pour Harrier, puis la constater sur le test
   déjà mesuré.

Tant que ces trois points ne sont pas faits, le produit garde `qwen3-embedding:0.6b`
et sa table CNIL, dont la promesse vient d'être confirmée.

## 5. Limites

- Une seule collection (CNIL), 54 questions sémantiques.
- Les pièges sont cités 6/6 dans les deux configurations ; deux sont confiants.
- Le test est dépensé **pour ces deux modèles** : aucun d'eux ne se remesure, et
  un troisième nom serait encore accepté par le marqueur.
- Les six questions passées de `dev` à `test` au rééquilibrage avaient été
  mesurées en `dev` le même jour : la calibration de la règle livrée n'en contient
  aucune, donc aucun réglage n'a été fait sur des questions devenues `test`.
- Deux des six pièges sont `confiant` sur le test, comme sur `dev` : ils restent
  hors de la population de la promesse.
