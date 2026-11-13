---
status: completed
---

# Instruction: Démo avant/après capturée

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── components/
│   │   └── ✅ Demo.astro
│   ├── demo/
│   │   └── ✅ demo.json
│   ├── lib/
│   │   └── ✅ demo.ts
│   └── pages/
│       └── ✏️ index.astro
├── tests/
│   └── ✅ demo.test.ts
└── aidd_docs/
    └── memory/
        ├── ✏️ codebase-map.md
        ├── ✏️ design.md
        └── ✏️ testing.md
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Valentin Fouich pose une question de base légale à Claude sans puis avec le connecteur et copie les deux réponses mot pour mot | deux réponses réelles, datées, avec le modèle utilisé | system |
| Happy path   | `src/demo/demo.json` présent, `npm run build` | l'accueil montre la question, la réponse citée et ses sources, chacune liée au texte officiel | cli |
| Edge case    | `src/demo/demo.json` absent | `lireDemo` rend `null` ; l'accueil se construit sans emplacement vide | cli |
| Edge case    | JSON sans `sources` ou réponse vide | `lireDemo` lève en nommant le champ ; le build échoue | cli |
| Edge case    | Source dont l'URL n'est pas `https` | `lireDemo` lève | cli |
| Edge case    | Réponse longue | texte sur papier, jamais sur aplat coloré ; tronqué nulle part | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) QUESTION · capturée le JJ mois AAAA · modèle          │
│     « Quelle base légale pour … ? »                       │
├────────────────────────────┬─────────────────────────────┤
│ (2) SANS CONNECTEUR         │ (3) AVEC CONNECTEUR          │
│  réponse brute              │  réponse brute               │
│                             │  ┌ (4) Sources ───────────┐  │
│                             │  │ RGPD · art. 6 →        │  │
│                             │  │ CEPD · LD 2/2019 →     │  │
│                             │  └────────────────────────┘  │
├────────────────────────────┴─────────────────────────────┤
│ (5) Capture réelle, non retouchée.                         │
└──────────────────────────────────────────────────────────┘
```

1. Question : texte exact, date et modèle de la capture.
2. Colonne avant : la réponse sans connecteur, sur papier.
3. Colonne après : la réponse avec connecteur, filet rouge.
4. Sources : pastilles mono à filet 1 px, chacune liée au texte officiel.
5. Mention d'authenticité. Sur l'accueil, seules (1), (3) et (4) apparaissent, en format compact.

## Tasks to do

### `1)` Capturer la démo

> Une preuve réelle, choisie là où l'IA seule reste vague ou se trompe.

1. Valentin Fouich pose la même question de base légale à Claude sans le connecteur, puis avec, dans deux conversations neuves.
2. Copier question, réponses, sources citées, date et modèle dans `src/demo/demo.json`, sans retouche.

### `2)` Lire et valider la démo

> Refuser au build toute démo incomplète.

1. Créer `src/lib/demo.ts` : `lireDemo(rootDir)` rend `null` si le fichier manque, sinon valide `question`, `capturee_le`, `modele`, `sans`, `avec`, `sources[]` (`libelle`, `url` en `https`) et lève en nommant le champ fautif.
2. Écrire `tests/demo.test.ts` : fichier absent, fichier valide, champ manquant, URL non `https`.

### `3)` Afficher la démo

> Montrer la preuve à l'endroit réservé.

1. Créer `src/components/Demo.astro` avec une variante compacte (accueil) et complète (connecteur).
2. Brancher `Demo` dans l'emplacement du hero de `index.astro`, rendu seulement si `lireDemo` n'est pas `null` ; la page Connecteur l'utilise en phase 3.

### `4)` Mettre la mémoire à jour

> Que la mémoire décrive la démo et son contrat.

1. `design.md` : module Démo.
2. `codebase-map.md` : `src/demo/demo.json`, `src/lib/demo.ts`, `src/components/`.
3. `testing.md` : le test du lecteur de démo.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `src/demo/demo.json` contient deux réponses réelles, une date et un modèle. |
| 2 | `npm test` passe sur les quatre cas de `tests/demo.test.ts`. |
| 3 | Avec le fichier, `dist/index.html` contient la question et chaque URL de source ; sans le fichier, le build passe sans bloc démo. |
| 4 | Les trois fichiers de mémoire nomment la démo et `src/lib/demo.ts`. |
