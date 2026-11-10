---
status: completed
---

# Instruction: Choisir le plafond d'erreur et la règle

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ✅ aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/promesse.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `mesures/risque-couverture.md` produit en phase 1 | les courbes et les bornes sont disponibles | cli |
| Happy path   | Appliquer la règle de choix au jeu CNIL | un triplet (bas, haut, marge), avec couverture, risque et borne | cli |
| Edge case    | Aucun couple n'atteint la cible sous couverture utile | la règle retenue minimise la borne, et l'écart à la cible est écrit | cli |

## Tasks to do

### `1)` Fixer la population et la règle de choix

> Sans population figée, la borne mesure autre chose que ce qu'elle prétend.

1. Figer la population de la promesse : les questions sémantiques de `questions-cnil-etendu.csv` mesurées **avec `corpus` imposé**, c'est-à-dire le mode borné au corpus ; `questions-cnil-doctrine.csv` est rapporté à part et n'entre jamais dans le dénominateur, faute de quoi son sous-ensemble adverse dicterait le plafond. Une recherche sans `corpus`, ou qui ne nomme qu'un document, n'est pas couverte : elle change l'instruction de requête et le bassin de candidats, donc la similarité ; elle suit le repli global.
2. Poser 10 % comme cible de risque et 20 réponses sur 54 comme couverture utile : ce plancher vaut pour la CNIL, seul jeu assez fourni pour arbitrer ; les autres corpus n'ont pas la puissance nécessaire et prennent le repli.
3. Appliquer cette règle de choix, dans cet ordre : maximiser la couverture sous borne ≤ 10 % ; si aucun couple n'y arrive, minimiser la borne sans descendre sous la couverture utile ; si même cela échoue, prendre la borne minimale atteignable et l'écrire comme un constat.
4. Écrire la borne et la couverture retenues : c'est le plafond publié, pas 10 % par principe.

### `2)` Choisir la règle par corpus

> Un triplet par corpus, un repli pour le reste.

1. Retenir le triplet `(bas, haut, marge)` de la CNIL : `haut` et `marge` selon la règle de choix, `bas` selon la courbe du refus. Les autres corpus gardent le repli global, calibré sur le RGPD ; aucun n'a la puissance de fixer sa propre borne.
2. Définir le triplet global de repli, utilisé quand aucun corpus n'est connu et pour les corpus trop petits pour être ajustés : ils n'ont pas d'entrée dans la table (AI Act : 3 questions sémantiques).
3. Ne publier de promesse chiffrée que pour la CNIL ; les autres corpus sont déclarés non mesurables et suivent le repli.

### `3)` Baisser le plancher de refus

> Ne plus taire une bonne réponse.

1. Lire la courbe du plancher : combien de questions muettes, combien de bonnes réponses tues.
2. Fixer `bas` par corpus pour supprimer les deux bonnes réponses tues aujourd'hui (`0,677` et `0,681` dans le rapport de base) ; si un compromis est nécessaire, l'écrire et chiffrer ce qui reste tu.
3. Vérifier que les pièges cités ne montent pas : ils sont déjà à 6/6, donc aucune marge.

### `4)` Écrire la promesse

> Ce que l'étiquette garantit, et ce qu'elle ne garantit pas.

1. Consigner les triplets retenus, leur couverture, leur risque et la borne.
2. Nommer les corpus couverts par une promesse chiffrée et ceux qui ne le sont pas, faute de questions.
3. Nommer ce qui reste hors promesse : justesse rédactionnelle, fragment exact, rang 1, corpus non mesuré, et le sous-ensemble doctrinal `questions-cnil-doctrine.csv`, dont le risque mesuré est publié mais qui n'est pas couvert par le plafond CNIL.
4. Dater et figer le document : la phase 3 code ces valeurs, il ne les invente pas.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | la population est `questions-cnil-etendu` avec `corpus` imposé, la cible, la couverture utile et la portée hors `corpus` sont écrites, et le plafond publié est la borne retenue avec sa couverture |
| 2 | la CNIL a son triplet, le repli global est écrit et sert aux autres corpus, et seule la CNIL porte une promesse chiffrée |
| 3 | le `bas` retenu ne tue plus aucune bonne réponse, ou nomme celles qui restent ; les pièges cités ne dépassent pas 6/6 |
| 4 | `promesse.md` sépare les corpus à promesse chiffrée des autres, et ne cite aucune valeur non mesurée |
