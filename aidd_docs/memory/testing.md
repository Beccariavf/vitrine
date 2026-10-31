# Testing

Comment le projet est testé : les couches, les outils et les conventions. Où vivent les tests et comment les lancer.

## Strategy

- Unitaire : parseur CNIL, canonisation d'URL, identifiant, écriture (idempotence, déplacement d'une entrée).
- Unitaire : nettoyage et troncature du résumé (`veille/summary.ts`) : entités doublement encodées, entités françaises, balises hors liste blanche, espaces, coupe sur frontière de mot dans le budget de 200, emoji non tranché.
- Unitaire : filtre de redondance titre/résumé (`isRedundantSummary`), y compris textes vides ou de ponctuation.
- Unitaire : lecteur d'entrées (`src/lib/entries.ts`), sur le `data/` committé et sur des racines temporaires : une entrée par fichier, `summary`, `officialTitle`, `references` et `themes` validés, tri décroissant avec les dates nulles en dernier, JSON ou champ invalide qui lève, `data/` absent qui lève, matières inactives masquées.
- Unitaire : extraction des références CJUE (`veille/references.ts`) : instruments, articles, listes, plages, espaces insécables, absence de référence.
- Unitaire : extraction CNIL (`extractCnilReferences`) : article avant instrument, alias RGPD/LIL/CPCE/ePrivacy/95-46/Code de la consommation, `L. 223-1`, `4.11`, `1er`, `et suivants`, plages, décrets ignorés, dédoublonnage.
- Unitaire : section CNIL (`parseCnilPageReferences`) sur des captures HTML réelles : FNAC, webinaire, titre singulier, page sans section, guillemets doubles, blocs « Pour approfondir » ignorés.
- Intégration : une passe avec pages simulées : la FNAC reçoit ses références et son snapshot HTML ; une page en panne réseau ou HTTP 500 laisse l'entrée avec `[]` et un avertissement sans rejeter la passe ; une page sans référence n'écrit pas de snapshot ; une page dont seules les parties volatiles changent n'ajoute pas de snapshot.
- Intégration : données committées (`tests/entries.test.ts`) : la FNAC porte `Loi Informatique et Libertés · art. 82`, une entrée sans section reste `[]`.
- Unitaire : catalogue et rattachement (`veille/themes.ts`) : quatre matières, instruments exacts, termes de repli, défauts CNIL/CEPD/ANSSI, faux positifs « droit d'accès à un avocat » et « relative », catalogue invalide, matière inactive conservée mais masquée.
- Unitaire : parseurs ANSSI, CEPD, ARCEP et Commission : dates, résumés, liens hors domaine, XML invalide, événements et consultations exclus, identifiants ARCEP distincts.
- Unitaire : client PISTE et sources CETAT/Judilibre : jeton réutilisé, 401 retenté, plafond d'appels, secrets absents, dates, URL officielles, fenêtres 90/30 jours, dédoublonnage multi-matières. Aucun appel réseau.
- Unitaire : parseur CJUE (`veille/sources/cjeu.ts`) : deux formats de titre, date de décision, `pubDate` en secours, `_SUM`/`_RES`, `_INF`, XML invalide.
- Intégration : `run` avec un `fetch` injecté, sur une racine temporaire, les sources demandées ; une panne ou un flux CJUE vide laisse CNIL ; une matière désactivée ne supprime rien ; un arrêt sorti du flux reste.
- Aucun test ne touche le réseau : les fixtures sont des captures du flux réel. Le build (`npm run build`) ne fait aucun appel réseau non plus.

## Tools

- `node:test` et `node:assert/strict` : runner et assertions, sans dépendance.
- `tsc --noEmit` : vérification des types.

## Conventions

- Tests dans `tests/`, fixtures dans `tests/fixtures/<source>/`.
- Les fixtures de flux sont des captures réelles ; les fixtures HTML sont des captures réduites des pages CNIL, avec leurs classes et guillemets d'origine.
- Un test par comportement observable.
- Les valeurs figées (identifiants, hashes) sont calculées indépendamment du code testé, jamais comparées à leur propre sortie.

## Run

- `npm test`
- `npm run typecheck`
- `npm run build` : la preuve que la page contient réellement `data/` (échoue sans `data/`).

## Manuel

- Ouvrir `tools/parametres.html` dans Chrome, charger `veille/themes.json`, désactiver une matière, enregistrer.
- Lancer `npm run build` : les publications de cette matière disparaissent ; réactiver et reconstruire : elles reviennent sans collecte.
- Lancer `npm run veille` puis `npm run build` : la carte et la ligne FNAC portent `Loi Informatique et Libertés · art. 82` ; une page sans section reste sans référence.
- Vérifier que le snapshot brut reste dans `data/raw/` et que les pages publiques ne chargent aucun script.
- Vérifier `/veille` : bloc matières, badges, sources et liens Légifrance/Cour de cassation.
