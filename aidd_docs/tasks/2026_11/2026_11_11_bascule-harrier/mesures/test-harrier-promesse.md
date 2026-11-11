# Promesse de Harrier constatée sur le `test` déjà stocké

Date : 2026-11-11. Triplet figé en `mesures/calibration.md` **avant** lecture de ce fichier :
`0,73 / 0,73 / 0,01`. Source : `aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/mesures/test-harrier.json`,
produit le 2026-11-10 par Unsloth Studio sur `mradermacher/harrier-oss-v1-0.6b-GGUF`. Le paquet
Ollama `leoipulsar/harrier-0.6b` rend des vecteurs identiques (cosinus 1,00000000) : aucune mesure
n'est rejouée, le tir unique reste dépensé.

## Chiffres

| | `dev` (calibration) | `test` (constatation) |
| --- | --- | --- |
| Confiantes | 28 / 54 (51,9 %) | 34 / 54 (63,0 %) |
| Erreurs | 2 (7,1 %) | **0 (0,0 %)** |
| Borne haute à 95 % | **22,6 %** | **10,2 %** |
| Refusées | 0 | 0 |
| Dont bonnes réponses tues | 0 | 0 |

Commande : `node mcp/eval/risque.ts …/test-harrier.json --seuils 0.73,0.73,0.01`.
La borne publiée est celle de `dev`, **22,6 % au plus à 51,9 % de couverture** ; hors échantillon,
le `test` rend 10,2 % à 63,0 % de couverture, donc la promesse tient et se resserre.

## Population et limites

- Les 6 pièges sont hors population. Ils sont cités 5/6 en `dev` et 5/6 en `test` ; **2 sont
  `confiant` et faux dans chaque split** au triplet retenu (compagnie aérienne et puces sous-cutanées
  en `dev` ; domotique et cantines en `test`). Les inclure donnerait 30 confiantes et 4 erreurs en
  `dev` (13,3 %, borne 29,7 %) et 36 et 2 en `test` (5,6 %, borne 18,1 %) : la borne publiée reste
  celle des 54 questions sémantiques.
- Aucune question n'est refusée, en `dev` comme en `test` : le plancher ne cache aucune bonne
  réponse.
- Le `test` n'a pas été remesuré : les similarités de `test-harrier.json` suffisent parce que le
  modèle est le même. Aucune commande `--mesurer-test` n'a tourné.
- Le garde du marqueur est par nom de modèle : `leoipulsar/harrier-0.6b` n'y figure pas et ne doit
  pas y être ajouté par une mesure. La correspondance des vecteurs est la preuve, pas une seconde
  exécution.
