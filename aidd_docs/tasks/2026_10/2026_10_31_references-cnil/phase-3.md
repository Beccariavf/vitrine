---
status: pending
---

# Instruction: Publier les données et vérifier

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── veille/
│   └── types.ts ✏
├── data/
│   ├── entries/
│   │   └── 2026/10/
│   │       ├── 1fb831fb8c3243d4.json ✏
│   │       ├── 4b3a739cc4e144e1.json ✏
│   │       ├── 6b483b1190c73ddb.json ✏
│   │       └── 8da07efb6db3ce65.json ✏
│   └── raw/ ✅
├── tests/
│   └── entries.test.ts ✏
└── aidd_docs/
    └── memory/
        ├── architecture.md ✏
        ├── codebase-map.md ✏
        ├── data.md ✏
        └── testing.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lancer `npm run veille` sur les vraies sources, puis `npm run build`. | Les entrées et les snapshots sont régénérés ; le site se construit hors réseau. | cli |
| Happy path   | Lire l'entrée FNAC et ouvrir `/veille`. | `references` contient `Loi Informatique et Libertés · art. 82` ; la carte et la ligne FNAC affichent le tag. | browser |
| Edge case    | Lire une actualité sans section, par exemple les lunettes connectées. | `references: []` et aucun snapshot `.html` pour sa page. | cli |
| Edge case    | Inspecter `data/raw/`. | Un `.html` par page dont les références sont retenues ; les flux restent `.xml`. | cli |
| Edge case    | Vérifier les pages publiques à 1440 px et 375 px. | Les tags CNIL et CJUE s'affichent, aucun `<script>`, aucun débordement. | browser |

## Tasks to do

### `1)` Régénérer les données réelles

> La preuve vient de la page vivante, pas d'une fixture.

1. Lancer `npm run veille` sur les deux sources.
2. Vérifier l'entrée FNAC : `Loi Informatique et Libertés · art. 82`.
3. Vérifier les autres pages référencées : Google, webinaire, reconstitution.
4. Vérifier qu'une page sans section, comme les lunettes connectées, reste `[]`.
5. Vérifier les snapshots `.html` des pages retenues, dont un contient le texte de la section, et l'absence de snapshot pour les autres ; le passage CJUE peut ajouter des `.xml` bruts sans changer ses entrées. Ne jamais éditer `data/` à la main.

### `2)` Tester la donnée committée

> Le contrat exige la donnée réelle, pas seulement la passe simulée.

1. Dans `tests/entries.test.ts`, retrouver l'entrée FNAC par son URL et vérifier sa référence.
2. Vérifier qu'une entrée sans section garde `references: []`.
3. Vérifier que chaque référence committée reste une chaîne non vide.

### `3)` Vérifier l'affichage

> Les références utilisent les tags existants, sans nouvelle vue.

1. Construire le site et le servir sur `4329`.
2. Ouvrir `/veille` et vérifier le tag sur la carte et la ligne FNAC.
3. Vérifier que les références CJUE sont toujours affichées.
4. Vérifier l'absence de `<script>` et l'absence de débordement à 375 px.

### `4)` Mettre la mémoire projet à jour

> La mémoire dit encore que les entrées CNIL portent `[]`.

1. `architecture.md` : corriger la phrase « du titre officiel » pour couvrir la page CNIL, puis ajouter l'avertissement sans blocage et le snapshot des pages retenues.
2. `data.md` : corriger la section References (titre officiel pour la CJUE, page pour la CNIL) et décrire les snapshots `.html` et les erreurs de page.
3. `codebase-map.md` : citer `extractCnilReferences` et `parseCnilPageReferences`.
4. `testing.md` : ajouter les tests de page, d'échec et de donnée committée, et rappeler que les fixtures HTML sont des captures réduites des pages réelles.
5. `veille/types.ts` : mettre à jour le commentaire de `references` pour couvrir le titre officiel et la page CNIL.

### `5)` Vérifier le contrat complet

> Chaque contrainte du spec est observée.

1. Lancer `npm run typecheck`, `npm test`, `npm run build`.
2. Vérifier la FNAC, la page sans section, l'échec de page simulé et les snapshots.
3. Vérifier que les pages publiques restent sans JavaScript et que le build ne fait aucun appel réseau.
4. Vérifier que la CI passe.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | L'entrée FNAC porte exactement `Loi Informatique et Libertés · art. 82` ; les pages référencées ont un `.html` dans `data/raw/` ; les autres restent `[]`. |
| 2 | `npm test` échoue si la référence FNAC disparaît ou si une entrée sans section reçoit une référence. |
| 3 | Le tag FNAC apparaît sur la carte et la ligne ; les tags CJUE restent ; aucune page publique n'a de `<script>` et 375 px ne déborde pas. |
| 4 | `architecture.md`, `data.md`, `codebase-map.md`, `testing.md` et le commentaire de `veille/types.ts` décrivent le nouveau comportement. |
| 5 | Typecheck, tests, build et CI passent ; le build reste hors réseau. |
