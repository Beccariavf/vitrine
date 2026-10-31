---
status: completed
---

# Instruction: Finalisation

## Architecture projection

```txt
.
├── README.md ✏
├── aidd_docs/
│   └── memory/
│       ├── architecture.md ✏
│       ├── codebase-map.md ✏
│       ├── data.md ✏
│       ├── deployment.md ✏
│       ├── design.md ✏
│       └── testing.md ✏
└── tools/
    └── README.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Lire les mémoires et le README | L'état décrit est celui d'avant les matières | cli |
| Happy path   | Mettre à jour les mémoires | Sources, contrat, filtrage et tests décrivent l'état livré | cli |
| Happy path   | Lancer `npm run typecheck`, `npm test`, `npm run build` | Tout passe | cli |
| Edge case    | Ouvrir `/veille` sans matière active | Message lisible, aucun plantage | browser |
| Edge case    | Ouvrir `tools/parametres.html` | Les quatre matières et leurs sources sont visibles | browser |
| Teardown     | Vérifier `git status` | Aucun secret, aucun fichier de build versionné | cli |

## Tasks to do

### `1)` Mettre la mémoire à jour

> La mémoire décrit ce qui est, pas ce qui était.

1. Mettre à jour `architecture.md` : registre RSS/API, matières, filtrage au build, absence de purge.
2. Mettre à jour `data.md` : sources, contrat `themes`, migration, usage PISTE, fenêtres de 30 jours.
3. Mettre à jour `codebase-map.md`, `testing.md`, `design.md`, `deployment.md` et `tools/README.md`.
4. Mettre à jour `README.md` : quatre matières, sources, commandes `npm run veille`, `npm run backfill`, `npm run build`.
5. Vérifier qu'aucun secret ni `.env` n'apparaît dans `git status`.

### `2)` Vérifier la démonstration

> Le recruteur doit voir la sélection, les sources et les publications sans explanation.

1. Lancer `npm run veille` avec les secrets locaux et vérifier les snapshots des huit sources.
2. Lancer `npm run build` et ouvrir `/veille` : bloc matières, badges, sources, liens officiels.
3. Désactiver une matière dans l'outil local, relancer le build, vérifier qu'elle disparaît sans suppression de données.
4. Réactiver, relancer, vérifier qu'elle revient sans nouvelle collecte.
5. Vérifier 375 px, l'absence de `<script>` et l'absence de débordement.

### `3)` Passer la porte finale

> Ce qui passe ici passe en CI.

1. Lancer `npm run typecheck`, `npm test` et `npm run build`.
2. Vérifier que le build ne modifie pas `data/` et que la CI rejoue les trois commandes.
3. Vérifier qu'aucune page publique ne charge de JavaScript et qu'aucun appel réseau n'est fait au chargement.
4. Consigner dans la mémoire la fenêtre PISTE de 30 jours et le plafond d'appels.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les mémoires décrivent les quatre matières, les huit sources, le contrat `themes`, le filtrage au build et les fenêtres PISTE ; aucun secret n'est versionné. |
| 2 | `/veille` montre les matières, leurs textes et sources, et les publications avec badges ; une matière désactivée disparaît puis revient sans collecte. |
| 3 | Typecheck, tests, build et CI passent ; le build ne modifie pas `data/` ; aucune page publique ne charge de JavaScript. |
