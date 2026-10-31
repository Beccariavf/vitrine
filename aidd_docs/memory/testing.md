# Testing

Comment le projet est testé : les couches, les outils et les conventions. Où vivent les tests et comment les lancer.

## Strategy

- Unitaire : parseur CNIL, canonisation d'URL, identifiant, écriture (idempotence, déplacement d'une entrée).
- Unitaire : nettoyage et troncature du résumé (`veille/summary.ts`) : entités doublement encodées, entités françaises, balises hors liste blanche, espaces, coupe sur frontière de mot dans le budget de 200, emoji non tranché.
- Unitaire : filtre de redondance titre/résumé (`isRedundantSummary`), y compris textes vides ou de ponctuation.
- Unitaire : lecteur d'entrées (`src/lib/entries.ts`), sur le `data/` committé et sur des racines temporaires : une entrée par fichier, `summary` et `references` validés, tri décroissant avec les dates nulles en dernier, JSON ou champ invalide qui lève, `data/` absent qui lève.
- Unitaire : extraction des références (`veille/references.ts`) : instruments, articles, listes, plages, espaces insécables, absence de référence.
- Unitaire : catalogue et filtre (`veille/tags.ts`) : quatre tags, tags actifs/inactifs, faux positifs « droit d'accès à un avocat » et « relative », configuration invalide.
- Unitaire : parseur CJUE (`veille/sources/cjeu.ts`) : deux formats de titre, date de décision, `pubDate` en secours, `_SUM`/`_RES`, `_INF`, XML invalide.
- Intégration : `run` avec un `fetch` injecté, sur une racine temporaire, une ou deux sources ; une panne CJUE laisse CNIL ; un tag désactivé retire les arrêts CJUE.
- Aucun test ne touche le réseau : les fixtures sont des captures du flux réel. Le build (`npm run build`) ne fait aucun appel réseau non plus.

## Tools

- `node:test` et `node:assert/strict` : runner et assertions, sans dépendance.
- `tsc --noEmit` : vérification des types.

## Conventions

- Tests dans `tests/`, fixtures dans `tests/fixtures/<source>/`.
- Un test par comportement observable.
- Les valeurs figées (identifiants, hashes) sont calculées indépendamment du code testé, jamais comparées à leur propre sortie.

## Run

- `npm test`
- `npm run typecheck`
- `npm run build` : la preuve que la page contient réellement `data/` (échoue sans `data/`).

## Manuel

- Ouvrir `tools/parametres.html` dans Chrome, charger `veille/tags.json`, désactiver RGPD, enregistrer.
- Lancer `npm run veille` puis `npm run build` : Jautiva disparaît. Réactiver RGPD, relancer : il revient.
- Vérifier que le snapshot brut reste dans `data/raw/` et que les pages publiques ne chargent aucun script.
