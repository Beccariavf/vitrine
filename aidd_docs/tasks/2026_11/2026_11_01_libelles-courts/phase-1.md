---
status: pending
---

# Instruction: Libellé court et survol

## Architecture projection

```txt
.
├── ✏️ src/lib/references.ts
├── ✏️ src/pages/veille/index.astro
└── ✏️ tests/reference-links.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire le site depuis les données | `dist/veille/index.html` existe | cli |
| Happy path   | Ouvrir la carte de 501268 | `LIL · art. 8, 82, 20`, `CPCE · art. L. 34-5`, `RGPD · art. 83` | cli |
| Happy path   | Ouvrir la carte FNAC | `LIL · art. 82` | cli |
| Edge case    | Afficher un instrument inconnu | Le libellé complet reste affiché | cli |
| Edge case    | Survoler une pastille | `title` porte le libellé complet | cli |

## Tasks to do

### `1)` Raccourcir le libellé

> Une table statique, dérivée du libellé canonique.

1. Ajouter `referenceLabel(reference: string): string` dans `src/lib/references.ts`.
2. Couvrir `RGPD`, `LIL`, `CPCE`, `ePrivacy`, `C. conso`, `AI Act`, `DSA`, `DMA`, `DORA`, `NIS2`, `CRA`, `Data Act`.
3. Garder le suffixe ` · art. …` et rendre la référence entière quand l'instrument est inconnu.

### `2)` Afficher et documenter le libellé complet

> La carte et la liste partagent la même règle.

1. Remplacer le texte de la pastille par `referenceLabel(reference)` dans la carte et dans la liste.
2. Ajouter `title={reference}` sur le lien et sur le texte non cliquable.
3. Vérifier que `referenceUrl` continue de lire le libellé canonique.

### `3)` Verrouiller

> Des tests hors ligne et le build.

1. Tester chaque acronyme, un instrument inconnu, une référence sans suffixe et l'URL inchangée.
2. Vérifier `dist/veille/index.html` : libellés courts, `title` complet, liens officiels.
3. Lancer `npm test`, `npm run typecheck` et `npm run build`.

### `4)` Mettre à jour la mémoire

> Le design et la carte décrivent le libellé court et le survol.

1. `aidd_docs/memory/design.md` : pastille courte, libellé complet au survol.
2. `aidd_docs/memory/testing.md` : tests des libellés courts.
3. `aidd_docs/memory/codebase-map.md` : `referenceLabel` dans `src/lib/references.ts`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `Règlement (UE) 2016/679 · art. 5` rend `RGPD · art. 5` ; un instrument inconnu rend la référence entière. |
| 2 | La carte et la liste affichent le même libellé court, avec `title` complet. |
| 3 | Le build porte les libellés courts et les URL officielles inchangées ; les tests passent hors ligne. |
| 4 | Les trois documents de mémoire décrivent le libellé court et le survol. |
