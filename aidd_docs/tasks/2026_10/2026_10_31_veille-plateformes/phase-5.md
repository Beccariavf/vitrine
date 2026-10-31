---
status: done
---

# Instruction: Preuve des pages

## Architecture projection

```txt
.
├── data/
│   ├── entries/ ✏
│   ├── raw/ ✏
│   └── usage/ ✏
└── src/
    └── pages/
        └── veille/
            └── index.astro ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lancer `npm run veille` | Snapshots et entrées pour `commission-dma` et `arcom` ; journal PISTE à treize appels au plus | cli |
| Happy path   | Lancer `npm run backfill` puis `npm run build` | Les entrées existantes portent `plateformes` quand elles citent le DSA ou le DMA | cli |
| Happy path   | Inspecter `dist/veille/index.html` | Cinq libellés de matière, `f-plateformes`, badges DMA et ARCOM, zéro `<script>` | cli |
| Edge case    | Ouvrir `/veille` en 1280 px et 375 px, décocher puis recocher Plateformes | Les publications de la matière disparaissent puis reviennent ; aucun débordement horizontal | browser |
| Edge case    | Désactiver `plateformes` dans `themes.json`, reconstruire | Les entrées restent dans `data/`, la matière disparaît de la page | cli |
| Teardown     | Réactiver la matière, reconstruire, lancer typecheck et tests | Page et dépôt à l'état initial, tout passe | cli |

## Tasks to do

### `1)` Collecter les deux nouvelles sources

> La passe complète prouve que les adaptateurs vivent dans le pipeline, pas seulement en test.

1. Lancer `npm run veille`.
2. Relever le nombre d'entrées de `commission-dma` et `arcom`, et les avertissements éventuels.
3. Vérifier que `data/usage/<date>.json` journalise au plus treize appels PISTE.
4. Vérifier qu'un snapshot brut DMA et un snapshot brut ARCOM sont écrits.

### `2)` Recalculer les matières existantes

> Les entrées d'avant la cinquième matière doivent pouvoir la porter.

1. Lancer `npm run backfill`.
2. Vérifier qu'aucune entrée ne perd sa matière d'origine et que celles qui citent le DSA ou le DMA gagnent `plateformes`.

### `3)` Vérifier le rendu public

> La page doit montrer cinq matières sans charger de script.

1. Lancer `npm run build`.
2. Dans `dist/veille/index.html`, vérifier les cinq libellés, l'identifiant `f-plateformes`, les badges « Commission européenne — DMA » et « ARCOM ».
3. Dans `src/pages/veille/index.astro`, la boucle sur `themes` rend la cinquième pastille et le filtre CSS par sous-ensembles masque les entrées décochées ; une media query à 640 px réduit padding, taille et interlettrage pour tenir sur deux lignes à 375 px.
4. Vérifier l'absence de `<script>` et de requête réseau au chargement.
5. Vérifier qu'au moins une publication DMA, une publication DSA de la Commission et une publication ARCOM sont rendues.

### `4)` Vérifier le sélecteur en navigateur

> La cinquième pastille ne doit rien casser en mobile.

1. Ouvrir `/veille` en 1280 px : les cinq pastilles tiennent sur une ligne.
2. Passer en 375 px : les pastilles passent sur deux lignes, sans débordement horizontal.
3. Décocher Plateformes : les publications qui n'ont que cette matière disparaissent ; celles qui en ont une autre restent.
4. Recocher : le compte revient au compte initial, sans collecte.
5. Vérifier la console : aucune erreur.

### `5)` Verrouiller l'état final

> La preuve ne laisse ni matière désactivée ni fichier temporaire.

1. Réactiver `plateformes` dans `veille/themes.json` si le test l'a désactivée.
2. Relancer `npm run build`.
3. Lancer `npm run typecheck` et `npm test`.
4. Vérifier `git status` : seuls les snapshots, entrées et le journal PISTE attendus ont changé.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | La passe écrit des entrées `commission-dma` et `arcom`, un snapshot par source, et le journal PISTE reste sous seize appels. |
| 2 | Le backfill conserve les matières existantes et ajoute `plateformes` aux entrées qui citent le DSA ou le DMA. |
| 3 | La page rend cinq matières, les badges DMA et ARCOM, au moins une publication de chaque nouvelle source, et zéro `<script>`. |
| 4 | Le sélecteur fonctionne en 1280 px et 375 px ; décocher masque, recocher restaure ; aucun débordement ni erreur console. |
| 5 | `plateformes` est active, le build, le typecheck et les tests passent, et `git status` ne montre que les données attendues. |
