---
status: pending
---

# Instruction: Paramètres

## Architecture projection

```txt
.
├── tools/
│   ├── parametres.html ✅
│   └── README.md ✅
└── aidd_docs/
    └── memory/
        ├── codebase-map.md ✏
        ├── deployment.md ✏
        └── testing.md ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor   |
| ------------ | ----------------------- | -------------------- | ------- |
| Setup        | Ouvrir `tools/parametres.html` dans Chrome | Les quatre tags et leur état sont affichés | browser |
| Happy path   | Désactiver RGPD, enregistrer, `npm run veille`, `npm run build` | Jautiva disparaît de `data/` et de la veille, les entrées CNIL restent | browser, cli |
| Happy path   | Réactiver RGPD, enregistrer, `npm run veille`, reconstruire | Jautiva revient | browser, cli |
| Edge case    | Activer IA, enregistrer, `npm run veille`, reconstruire | Les arrêts IA du flux apparaissent s'il y en a | browser, cli |
| Edge case    | Charger un JSON invalide | L'outil refuse et laisse la configuration inchangée | browser |
| Teardown     | Restaurer l'état initial, `npm run veille` | `tags.json` et les entrées reviennent à la sélection de départ | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────┐
│ (1) PARAMÈTRES DE LA VEILLE                  │
├──────────────────────────────────────────────┤
│ (2) [x] RGPD              motifs…            │
│     [x] Droits des données motifs…           │
│     [ ] IA                motifs…            │
│     [ ] Cybersécurité     motifs…            │
├──────────────────────────────────────────────┤
│ (3) [CHARGER tags.json] [ENREGISTRER]        │
├──────────────────────────────────────────────┤
│ (4) Statut ou erreur                         │
└──────────────────────────────────────────────┘
```

1. Titre de l'outil local.
2. Quatre tags avec case à cocher et motifs en lecture seule.
3. Chargement et enregistrement du fichier de configuration.
4. Message de statut ou d'erreur.

## Tasks to do

### `1)` Construire l'outil local

> Un écran de paramètres, sans serveur et sans build public.

1. Créer `tools/parametres.html` : quatre cases, les libellés et les motifs, les boutons charger et enregistrer.
2. Lire et écrire `veille/tags.json` avec l'API File System Access de Chrome ; aucune requête réseau.
3. Valider la forme : quatre tags, identifiants uniques, termes non vides, booléens `active`.
4. Enregistrer en JSON indenté, en conservant les motifs et les libellés.
5. Afficher un statut clair : fichier chargé, enregistré, erreur de forme.
6. Rédiger `tools/README.md` : ouvrir dans Chrome, charger `veille/tags.json`, cocher, enregistrer, reconstruire.

### `2)` Vérifier l'effet sur la publication

> Le catalogue change la publication ; le snapshot brut garde la preuve.

1. Désactiver RGPD, enregistrer, lancer `npm run veille` puis `npm run build` : Jautiva disparaît de `data/entries` et du site, les entrées CNIL restent.
2. Réactiver RGPD, enregistrer, relancer `npm run veille` et reconstruire : Jautiva revient.
3. Activer IA, enregistrer, relancer `npm run veille` et reconstruire : les arrêts IA du flux apparaissent s'il y en a.
4. Vérifier que le snapshot brut du dernier flux reste dans `data/raw/` et que les entrées CNIL n'ont pas bougé.

### `3)` Passer la porte complète

> La même porte que la CI.

1. Lancer `npm run typecheck`, `npm test` et `npm run build`.
2. Vérifier qu'aucune page publique ne contient de `<script>`.
3. Mettre à jour `testing.md` avec le test manuel de l'outil, `deployment.md` avec sa nature locale, et `codebase-map.md` avec `tools/`.
4. Vérifier la CI sur la branche.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | L'outil affiche les quatre tags, charge et enregistre `veille/tags.json`, conserve les motifs et refuse une forme invalide. |
| 2 | Désactiver RGPD retire Jautiva de `data/entries` et du site après `npm run veille` et reconstruction ; le réactiver le fait revenir ; activer IA publie les arrêts IA du flux s'il y en a ; le snapshot brut reste. |
| 3 | Typecheck, tests et build passent ; les pages publiques restent sans JavaScript ; la CI est verte ; les mémoires sont à jour. |
