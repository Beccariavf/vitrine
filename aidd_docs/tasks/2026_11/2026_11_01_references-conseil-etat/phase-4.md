---
status: pending
---

# Instruction: Précision des griefs

## Architecture projection

```txt
.
├── ✏️ veille/references.ts
└── ✏️ tests/references.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Happy path   | Extraire « reproche … en application de l'article 82 » | Aucune référence | cli |
| Happy path   | Extraire « Selon la Cour de justice, en vertu de l'article 5 du RGPD » | `RGPD · art. 5` conservé | cli |
| Edge case    | Extraire « Selon la requérante, en vertu de l'article 82 » | Aucune référence | cli |
| Edge case    | Rejouer les six textes réels | Mêmes références qu'avant | cli |

## Tasks to do

### `1)` Étendre les verbes de grief

> Un grief peut se dire autrement que « soutient ».

1. Ajouter `reproche`, `reprochent`, `conteste`, `contestent`, `se plaint`, `se plaignent` au garde de discours rapporté.
2. Couvrir les formes avec et sans « que ».
3. Ajouter un test par forme.

### `2)` Restreindre « selon »

> « Selon la Cour de justice » introduit une formule appliquée, pas un grief.

1. Remplacer `selon <texte>` par `selon <partie>` : requérant, requérante, société, partie, ministre, administration, CNIL, défendeur, demandeur, et les pronoms `lui`, `elle`, `eux`, `elles`.
2. Tester `Selon la Cour de justice, en vertu de l'article 5 du RGPD` (conservé) et `Selon la requérante, …` (écarté).

### `3)` Vérifier le corpus

1. Rejouer les six fixtures : aucune référence ne change (non-régression).
2. Rejouer l'extraction sur les neuf textes de `data/raw/` et comparer aux entrées écrites : mêmes références.
3. Vérifier que les pastilles gardent `target="_blank"` et `rel="noopener"`.
4. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les six verbes, avec et sans « que », écartent la formule. |
| 2 | `Selon la Cour de justice, en vertu de l'article 5 du RGPD` rend `RGPD · art. 5` ; `Selon la requérante, …` rend `[]`. |
| 3 | Les six fixtures gardent leurs références, les neuf entrées sont inchangées, les pastilles gardent leur nouvel onglet, et `npm test` passe. |
