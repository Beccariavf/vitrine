---
status: pending
---

# Instruction: Mesurer la précision, documenter et mettre la mémoire à jour

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── mcp/
│   └── eval/
│       └── citations.ts ✅
├── aidd_docs/
│   ├── memory/
│   │   ├── architecture.md ✏️
│   │   ├── codebase-map.md ✏️
│   │   └── testing.md ✏️
│   └── tasks/
│       └── 2026_11/
│           └── 2026_11_13_citations-decisions/
│               └── mesure.md ✅
└── README.md ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lancer `node mcp/eval/citations.ts cnil --taille 5`. | Cinq documents CNIL, leurs citations et le passage qui les porte sont affichés. | cli |
| Happy path   | Relancer la même commande. | La sortie est identique : l'échantillonnage est déterministe. | cli |
| Edge case    | Lancer sur un corpus sans décision (`rgpd`). | La commande refuse en nommant les corpus de décisions. | cli |
| Teardown     | Aucun fichier écrit par la commande. | `data/` reste inchangé. | cli |

## Tasks to do

### `1)` Écrire l'échantillonneur

> Un audit reproductible, sans choix manuel des documents.

1. Créer `mcp/eval/citations.ts` : `node mcp/eval/citations.ts <corpus> --taille <n>`, documents triés puis pris à pas régulier.
2. Afficher, pour chaque document, chaque citation et le passage du texte qui l'a produite.
3. Refuser un corpus hors `cnil`, `ce`, `cc`, `cjue`, `cepd` en nommant les corpus acceptés.

### `2)` Relire un échantillon et écrire la mesure

> La précision, son dénominateur et ses causes d'erreur.

1. Relire 5 documents par corpus (25 au total) avec l'échantillonneur.
2. Compter les citations justes, fausses et indécidables ; nommer chaque cause de faux positif.
3. Écrire `aidd_docs/tasks/2026_11/2026_11_13_citations-decisions/mesure.md` : date, commande, échantillon, tableau par corpus, précision avec dénominateur, limites (anaphore, instruments hors périmètre, articles non normalisés, décisions anglaises).
4. Corriger ou retirer la règle fautive dans `mcp/corpus/citations.ts` tant qu'un faux positif subsiste, puis relancer l'échantillon ; la fusion attend cet état.
5. Ne publier aucun seuil : #30 le fixe pour les citations entre décisions.

### `3)` Documenter le comportement

1. `README.md` : les réponses de `search` et `get_decision` portent les citations et leur lien officiel ; une liste vide est dite.
2. `aidd_docs/memory/architecture.md` : extraction à la lecture, périmètre fermé, pas de stockage avant #29.
3. `aidd_docs/memory/codebase-map.md` : `mcp/corpus/citations.ts` et `mcp/eval/citations.ts`.
4. `aidd_docs/memory/testing.md` : tests de l'extracteur et commande de mesure.

### `4)` Clore la feuille de route

1. Après fusion de la PR, cocher `#28` dans l'issue #65.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | La commande affiche cinq documents CNIL avec leurs citations et leurs passages ; deux exécutions donnent la même sortie ; `rgpd` est refusé en nommant les corpus acceptés. |
| 2 | `mesure.md` donne, par corpus et au total, le nombre de citations relues, justes et fausses, et la précision avec son dénominateur ; chaque faux positif porte sa cause et a été corrigé ou fait retirer la règle qui le produit. |
| 3 | Les quatre documents nomment le module, le comportement et la commande ; `npm run build` passe. |
| 4 | La case de #28 est cochée dans #65 après la fusion. |
