---
status: completed
---

# Instruction: Références cliquables

## Architecture projection

```txt
.
├── ✅ src/lib/references.ts
├── ✏️ src/pages/veille/index.astro
└── ✅ tests/reference-links.test.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Construire le site depuis les données | `dist/veille/index.html` existe | cli |
| Happy path   | Ouvrir une carte avec référence | La pastille est un lien officiel, nouvel onglet | cli |
| Happy path   | Ouvrir la carte CNIL FNAC | La pastille `Loi Informatique et Libertés · art. 82` est inchangée | cli |
| Edge case    | Afficher une référence inconnue | La pastille reste un texte sans lien | cli |
| Teardown     | Supprimer la sortie de build | Aucun artefact | cli |

## Wireframe

```txt
┌─────────────────────────────────────┐
│ (1) En-tête : date · source         │
├─────────────────────────────────────┤
│ (2) Titre — lien nouvel onglet      │
│ (3) Résumé                          │
│ (4) Références — liens nouvel onglet│
│ (5) Matières                        │
│ (6) Lire — lien nouvel onglet       │
└─────────────────────────────────────┘
```

1. En-tête : date et source, sans lien.
2. Titre : lien vers l'actualité, nouvel onglet.
3. Résumé : texte, aucun lien.
4. Références : une pastille par instrument, lien vers le texte officiel, nouvel onglet.
5. Matières : étiquettes, aucun lien.
6. Lire : lien vers l'actualité, nouvel onglet.

## Tasks to do

### `1)` Résoudre l'URL

> Une table canonique, sans requête réseau.

1. Créer `src/lib/references.ts` avec `referenceUrl`.
2. Couvrir RGPD, LIL, CPCE, ePrivacy, Code de la consommation, directives et règlements génériques.
3. Tester les correspondances et l'inconnu.

### `2)` Séparer les liens de la carte

> La carte ne peut plus être un lien unique.

1. Remplacer le wrapper `<a>` par un conteneur.
2. Garder le titre et « Lire » comme liens distincts.
3. Rendre chaque pastille lien si l'URL existe, texte sinon.

### `3)` Ouvrir dans un nouvel onglet

> Aucun clic ne quitte la veille.

1. Ajouter `target="_blank"` et `rel="noopener"` aux liens d'actualité et de référence, carte et liste.
2. Vérifier que le filtre et l'affichage ne dépendent pas du wrapper.

### `4)` Vérifier le rendu

> La page construite porte les liens attendus.

1. Lancer `npm run build`.
2. Chercher les URL officielles et `target="_blank"` dans `dist/veille/index.html`.
3. Vérifier que la carte FNAC porte toujours `Loi Informatique et Libertés · art. 82`.
4. Lancer `npm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | RGPD, LIL, CPCE, ePrivacy et Code de la consommation rendent l'URL officielle ; un instrument inconnu rend `null`. |
| 2 | Le titre, « Lire » et chaque pastille sont des liens distincts. |
| 3 | Les liens d'actualité et de référence portent `target="_blank"` et `rel="noopener"`. |
| 4 | Le build produit une page avec les URL officielles, les liens en nouvel onglet, et la carte FNAC inchangée. |
