---
phase: 6
status: completed
observed: 2026-11-10
verdict: Harrier adopté sur le test ; promesse de confiance qwen3 tenue
---

# Tir unique sur le split `test` : modèle et promesse

Le split `test` de `questions-cnil-etendu.csv` (60 questions : 54 sémantiques,
6 pièges) a été mesuré une fois, le 2026-11-10, sur deux modèles pré-déclarés —
le marqueur `mcp/eval/questions-cnil-etendu.test-consomme.json` porte une entrée
par modèle, comme le veut la convention du harnais. Il ne reste plus de tir pour
cette collection.

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
0 refusée) sont calculés avec le repli `0,69 / 0,74 / 0,01`, calibré pour qwen3 :
sur une autre échelle de similarité, ils ne portent aucune promesse. La promesse
de Harrier reste à établir.

Elle peut l'être sans nouveau tir : les similarités du test sont conservées dans
`test-harrier.json`, donc la règle se calibre sur `dev` puis se constate sur ce
fichier. Un chiffre indicatif, à refaire proprement dans le lot d'adoption :
sur `harrier-dev-actuelle.json`, la règle de choix de `promesse.md` donne 28
confiantes, 2 erreurs (7,1 %), borne 22,6 % ; appliquée au test, 34 confiantes,
0 erreur, borne 10,2 %.

## 4. Conséquence

La question du modèle est tranchée : Harrier gagne. L'adoption n'est pas faite
ici, et ne peut pas l'être sans trois choses qui changent le produit :

1. reconstruire l'index complet avec Harrier (53 143 unités, ≈ 1 h 06) ;
2. choisir le service qui le sert en production — Unsloth Studio est une
   application de bureau, pas un démon supervisé ;
3. recalibrer la table de confiance pour Harrier, puis la constater sur le test
   déjà mesuré.

Tant que ces trois points ne sont pas faits, le produit garde `qwen3-embedding:0.6b`
et sa table CNIL, dont la promesse vient d'être confirmée.

## 5. Limites

- Une seule collection (CNIL), 54 questions sémantiques.
- Les pièges sont cités 6/6 dans les deux configurations ; deux sont confiants.
- Le test est dépensé pour cette collection : aucune autre mesure n'y est possible.
