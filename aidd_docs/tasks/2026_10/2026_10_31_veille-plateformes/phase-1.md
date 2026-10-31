---
status: done
---

# Instruction: Catalogue à cinq matières

## Architecture projection

```txt
.
├── veille/
│   ├── themes.json ✏
│   └── themes.ts ✏
├── tools/
│   └── parametres.html ✏
└── tests/
    └── themes.test.ts ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Lire `veille/themes.json` et lancer `npm test` | Cinq matières, dont `plateformes`, toutes actives | cli |
| Happy path   | Rattacher une entrée citant « règlement sur les services numériques » | `plateformes` | cli |
| Happy path   | Rattacher une entrée citant « Digital Markets Act » | `plateformes` | cli |
| Edge case    | Rattacher une entrée dont le seul indice est « plateforme » | Aucune matière | cli |
| Edge case    | Lire un catalogue de quatre matières | `readThemes` lève « exactly five themes » | cli |
| Teardown     | Restaurer `themes.json` et relancer `npm test` | Tout passe | cli |

## Tasks to do

### `1)` Ajouter la matière au catalogue

> La cinquième matière est une donnée, pas un cas particulier du code.

1. Dans `veille/themes.json`, ajouter après les quatre existantes : `id` `plateformes`, `label` `Plateformes`, description `DSA et DMA : plateformes en ligne, contrôleurs d'accès et marchés numériques.`
2. Porter `instruments` `["Règlement (UE) 2022/2065", "Règlement (UE) 2022/1925"]`, `sources` `["Commission européenne", "ARCOM", "CJUE", "Conseil d'État", "Cour de cassation"]`, `active` `true`, `queries` `["2022/2065", "2022/1925"]`.
3. Porter les termes DSA : `règlement sur les services numériques`, `Digital Services Act`, `DSA`, `RSN`, `2022/2065`, `très grande plateforme`, `VLOP`, `modération des contenus`, `contenus illicites`, `signaleur de confiance`, `coordinateur pour les services numériques`, `comité européen pour les services numériques`.
4. Porter les termes DMA : `règlement sur les marchés numériques`, `Digital Markets Act`, `DMA`, `2022/1925`, `contrôleur d'accès`, `gatekeeper`, `services de plateforme essentiels`, `autopréférence`.
5. Ne pas ajouter `plateforme` seul, `marché numérique` seul ni `interopérabilité`.

### `2)` Accepter cinq matières et les requêtes de jurisprudence

> Le catalogue valide cinq entrées et une matière peut nommer ses requêtes PISTE.

1. Dans `veille/themes.ts`, remplacer le contrôle « exactly four themes » par cinq, avec le même message explicite.
2. Ajouter `queries?: string[]` au type `Theme` : requêtes propres à la matière, absentes pour les quatre matières existantes.
3. Dans `validateTheme`, valider `queries` comme une liste non vide de chaînes non vides quand elle est présente, et l'omettre quand elle est absente ; `exactOptionalPropertyTypes` interdit de l'affecter à `undefined`.
4. Conserver `themesForEntry`, `assignThemes` et `matchesTheme` inchangés : `queries` ne sert qu'à la recherche PISTE de la phase 4.

### `3)` Aligner l'outil local

> L'outil qui écrit le catalogue doit accepter la cinquième matière sans perdre ses requêtes.

1. Dans `tools/parametres.html`, remplacer le contrôle `value.themes.length !== 4` par cinq et le message par « exactement cinq matières ».
2. Dans `validate`, lire `queries` quand elle est présente, la valider avec `strings`, et la conserver dans l'objet rendu ; ne pas l'inventer quand elle manque.
3. Vérifier que `save` réécrit `queries` : il sérialise les objets rendus, donc la propriété doit survivre à `render`.

### `4)` Verrouiller le rattachement et les faux positifs

> Les tests disent ce que la matière attrape et ce qu'elle n'attrape pas.

1. Dans `tests/themes.test.ts`, remplacer « quatre matières » par cinq et ajouter `plateformes` à la liste des identifiants attendus.
2. Remplacer le test du catalogue à trois matières par un catalogue à quatre matières, avec `/exactly five themes/`.
3. Ajouter : une entrée citant le DSA relève de `plateformes` ; une entrée citant le DMA aussi ; une entrée dont le seul indice est « plateforme » ne relève d'aucune matière.
4. Ajouter : une entrée citant à la fois le RGPD et le DSA porte `donnees-personnelles` et `plateformes` ; une référence `Règlement (UE) 2022/2065 · art. 24` rattache `plateformes` par instrument ; une entrée `plateformes` déjà rattachée n'est pas dupliquée.
5. Ajouter : `readThemes` conserve `queries` ; un catalogue dont `queries` est vide lève.

### `5)` Passer les portes

> Le catalogue et le site lisent le même fichier.

1. Lancer `npm run typecheck`.
2. Lancer `npm test`.
3. Lancer `npm run build` et vérifier que `/veille` rend cinq pastilles, sans erreur, alors qu'aucune entrée ne porte encore `plateformes`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le catalogue contient cinq matières ; `plateformes` porte les deux instruments, les termes DSA/DMA et les deux requêtes ; aucun terme générique n'y figure. |
| 2 | `readThemes` rend `plateformes` avec `queries` ; un catalogue de quatre matières lève ; une matière sans `queries` reste valide. |
| 3 | L'outil local charge le catalogue à cinq matières et le réenregistre avec `queries` intactes. |
| 4 | Le DSA et le DMA rattachent `plateformes` ; une entrée RGPD + DSA porte les deux matières ; « plateforme » seul est rejeté ; les quatre matières existantes gardent leur comportement. |
| 5 | Typecheck, tests et build passent ; la page publique montre cinq matières, y compris quand `plateformes` n'a aucune entrée. |
