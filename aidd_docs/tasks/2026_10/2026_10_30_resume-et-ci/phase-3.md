---
status: completed
---

# Instruction: Filtrer les résumés redondants

## Architecture projection

```txt
.
├── src/
│   ├── lib/
│   │   └── entries.ts ✏
│   └── pages/
│       └── veille/
│           └── index.astro ✏
└── tests/
    └── entries.test.ts ✏
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Charger les entrées de `data/` | Dix titres et résumés disponibles | cli |
| Happy path | Comparer un titre et un résumé sans longue séquence commune | Le résumé est affiché | cli |
| Edge case | Comparer le titre FNAC et son résumé | Séquence de plus de 40 caractères → résumé masqué | cli |
| Edge case | Comparer deux textes partageant trois mots courants | Séquence courte → résumé affiché | cli |
| Edge case | Une entrée au résumé masqué | L'entrée reste affichée avec son titre et sa date | cli |
| Teardown | Aucun fichier modifié | Dépôt inchangé | cli |

## Tasks to do

### `1)` Détecteur de redondance

> Une règle déterministe, jamais une réécriture.

1. Ajouter `isRedundantSummary(title: string, summary: string): boolean` dans `src/lib/entries.ts`.
2. Normaliser casse, accents et ponctuation, puis chercher la plus longue séquence contiguë de mots commune aux deux textes.
3. Rendre `true` quand cette séquence fait 40 caractères ou plus.
4. Tester : titre FNAC → masqué ; « Journée RGPD » → affiché ; trois mots communs → affiché.

### `2)` Affichage conditionnel

> Le titre et la date restent, le résumé redondant disparaît.

1. Dans `src/pages/veille/index.astro`, calculer le résumé affichable avec le détecteur.
2. Ne rien rendre quand il est redondant, sans masquer l'entrée.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le détecteur masque la séquence FNAC et laisse passer les séquences courtes |
| 2 | La page n'affiche aucun résumé redondant et conserve toutes les entrées |
