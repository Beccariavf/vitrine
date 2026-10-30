---
status: pending
---

# Instruction: Le résumé dans le contrat

## Architecture projection

```txt
.
├── veille/
│   ├── summary.ts ✅
│   ├── types.ts ✏
│   └── sources/
│       └── cnil.ts ✏
├── src/
│   ├── lib/
│   │   └── entries.ts ✏
│   └── pages/
│       └── veille/
│           └── index.astro ✏
└── tests/
    ├── summary.test.ts ✅
    ├── cnil.test.ts ✏
    ├── write.test.ts ✏
    └── entries.test.ts ✏
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Charger la fixture CNIL et ses descriptions | Dix descriptions brutes disponibles | cli |
| Happy path | Nettoyer une description | Texte sans balise, sans entité, espaces simples | cli |
| Edge case | Nettoyer un texte de 201 caractères | 200 caractères au total, ellipse comprise | cli |
| Edge case | Nettoyer un mot unique de 201 caractères | Coupé à 197, ellipse ajoutée, total 200 | cli |
| Edge case | Nettoyer une balise doublement encodée (`&amp;lt;p&amp;gt;`) | Décodée deux fois, puis retirée | cli |
| Edge case | Nettoyer un texte de moins de 200 caractères | Aucune ellipse ajoutée | cli |
| Edge case | Nettoyer une description vide ou absente | `null`, aucun bloc affiché | cli |
| Edge case | Lire une entrée sans champ `summary` | Le lecteur refuse l'entrée avec un message explicite | cli |
| Teardown | Aucun fichier temporaire | Dépôt inchangé | cli |

## Tasks to do

### `1)` Module de résumé

> Un seul endroit qui nettoie et tronque, réutilisable par les prochaines sources.

1. Créer `veille/summary.ts` : `toSummary(text: string | null): string | null`.
2. Décoder les entités **deux fois**, puis retirer les balises, remplacer les espaces insécables, normaliser les espaces.
3. Si le texte dépasse 200 caractères : garder au plus 197, couper au dernier espace s'il existe, sinon couper à 197, puis ajouter `…`.
4. Rendre `null` pour un texte absent ou vide après nettoyage.
5. Créer `tests/summary.test.ts` : balises, double encodage, espaces, 201 caractères, mot unique, absence d'ellipse, vide.

### `2)` Contrat atomique, données et affichage

> Le contrat, le lecteur, les données et la page changent dans le même commit : sinon le typecheck casse entre deux tâches.

1. Ajouter `summary: string | null` à `Entry` dans `veille/types.ts`.
2. Dans `veille/sources/cnil.ts`, passer le champ `description` à `toSummary` et remplir `summary`.
3. Dans `src/lib/entries.ts`, valider `summary` comme chaîne non vide ou `null`, et refuser son absence.
4. Dans `src/pages/veille/index.astro`, afficher `entry.summary` sur deux lignes maximum, ou rien s'il est nul.
5. Ajouter `summary` au littéral d'entrée de `tests/write.test.ts`.
6. Étendre `tests/cnil.test.ts` et `tests/entries.test.ts` au nouveau champ.
7. Lancer `npm run veille` pour régénérer les dix entrées de `data/`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `toSummary` gère balises, entités doublement encodées, espaces, troncature à 200 ellipse comprise, mot unique et vide |
| 2 | Le contrat expose `summary`, le lecteur le valide, la page l'affiche, et les dix entrées de `data/` le portent |
