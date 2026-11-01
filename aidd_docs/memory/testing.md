# Testing

Comment le projet est testé : les couches, les outils et les conventions. Où vivent les tests et comment les lancer.

## Strategy

- Unitaire : parseur CNIL, canonisation d'URL, identifiant, écriture (idempotence, déplacement d'une entrée).
- Unitaire : nettoyage et troncature du résumé (`veille/summary.ts`) : entités doublement encodées, entités françaises, balises hors liste blanche, espaces, coupe sur frontière de mot dans le budget de 200, emoji non tranché.
- Unitaire : filtre de redondance titre/résumé (`isRedundantSummary`), y compris textes vides ou de ponctuation.
- Unitaire : lecteur d'entrées (`src/lib/entries.ts`), sur le `data/` committé et sur des racines temporaires : une entrée par fichier, `summary`, `officialTitle`, `references` et `themes` validés, tri décroissant avec les dates nulles en dernier, JSON ou champ invalide qui lève, `data/` absent qui lève, matières inactives masquées, décision Judilibre sans visa masquée.
- Unitaire : extraction des références CJUE (`veille/references.ts`) : instruments, articles, listes, plages, espaces insécables, absence de référence.
- Unitaire : visa de la Cour de cassation (`extractVisaReferences`) sur le visa réel de 25-10.664 : balises HTML, `§ 1`, virgules, LIL, CPCE, directive, AI Act, DMA, DSA, DORA, NIS2, deux instruments avec articles avant ou après, doublon, visa sans article, code du travail et code de justice administrative ignorés.
- Unitaire : URL et libellé d'une référence (`src/lib/references.ts`) : RGPD, LIL, CPCE, ePrivacy, Code de la consommation, règlements et directives par CELEX, instrument inconnu qui rend `null` ou sa référence entière, libellé court des douze instruments abrégés (RGPD, LIL, CPCE, ePrivacy, C. conso, AI Act, DSA, DMA, DORA, NIS2, CRA, Data Act) avec suffixe ` · art. …` conservé, référence sans article, URL officielle toujours calculée depuis le libellé canonique.
- Intégration : enrichissement d'une source API (`tests/main.test.ts`) : visa écrit après le rattachement, entrée déjà écrite non rappelée même sans référence, panne ou plafond qui diffère l'entrée sans la perdre, snapshot brut écrit après l'enrichissement.
- Unitaire : lecture d'une décision Judilibre : URL, `KeyId`, journal `decision`, budget restant, visa vide, instrument hors matières, décision retenue par sa requête malgré un résumé muet, plafond atteint qui avertit.
- Unitaire : extraction des références du Conseil d'État (`extractCetatReferences`) sur les textes intégraux réels de six décisions (`tests/fixtures/cetat/textes.json`) : 501268 (LIL `8, 82, 20`, CPCE `L. 34-5`, ePrivacy `13`, RGPD `83`), 509210 (considérant et anaphore `du même règlement`), 509589 (liste `8 et 20`), 511155, 513996, 520279 (`[]`), l'article 8 cité « en vertu des dispositions du I de l'article 8 » retenu, un moyen des parties écarté, une formule introduite par un grief écartée — les verbes `soutient`, `allègue`, `invoque`, `fait valoir`, `reproche`, `conteste`, `se plaint`, avec et sans « que », et leurs pluriels, ainsi que « est soutenu que » et « moyen/grief tiré de ce que » —, « selon » écarté devant une partie seulement (requérant, requérante, société, partie, ministre, administration, CNIL, défendeur, demandeur, lui, elle, eux, elles) et « Selon la Cour de justice » qui reste retenu, un moyen écarté qui précède une formule appliquée conservé, « il résulte de l'instruction » écarté, un texte sans « Considérant ce qui suit » qui ne rend rien, anaphore sans instrument nommé, plages, texte vide.
- Unitaire : `consultJuri` : URL `/consult/juri`, jeton Bearer, corps `{ textId }`, journal `legifrance/consult`, budget restant.
- Intégration : enrichissement CETAT : articles lus dans le texte (`tests/fixtures/cetat/consult.json`), snapshot brut poussé après la lecture, instrument hors matières écarté, texte vide qui rend `[]`, budget réservé aux six recherches Judilibre qui diffère l'entrée et avertit sans appeler.
- Unitaire : extraction CNIL (`extractCnilReferences`) : article avant instrument, alias RGPD/LIL/CPCE/ePrivacy/95-46/Code de la consommation, `L. 223-1`, `4.11`, `1er`, `et suivants`, plages, décrets ignorés, dédoublonnage.
- Unitaire : section CNIL (`parseCnilPageReferences`) sur des captures HTML réelles : FNAC, webinaire, titre singulier, page sans section, guillemets doubles, blocs « Pour approfondir » ignorés.
- Intégration : une passe avec pages simulées : la FNAC reçoit ses références et son snapshot HTML ; une page en panne réseau ou HTTP 500 laisse l'entrée avec `[]` et un avertissement sans rejeter la passe ; une page sans référence n'écrit pas de snapshot ; une page dont seules les parties volatiles changent n'ajoute pas de snapshot.
- Intégration : données committées (`tests/entries.test.ts`) : la FNAC porte `Loi Informatique et Libertés · art. 82`, une entrée sans section reste `[]`.
- Unitaire : catalogue et rattachement (`veille/themes.ts`) : cinq matières, instruments exacts, termes de repli, requêtes PISTE, défauts CNIL/CEPD/ANSSI/Commission DMA, faux positifs « droit d'accès à un avocat », « relative » et « plateforme » seule, catalogue invalide, matière inactive conservée mais masquée.
- Unitaire : parseurs ANSSI, CEPD, ARCEP, Commission et Commission DMA : dates, résumés, liens hors domaine, XML invalide, événements et consultations exclus, identifiants ARCEP distincts, publications DMA conservées.
- Unitaire : parseur ARCOM : doublons FR/EN, page article, filtre DSA, résumé de page, exclusion de l'audiovisuel.
- Unitaire : page française Commission (`PAGE`) : bascule `/en/` → `/fr/`, titre `og:title`, résumé meta, page anglaise laissée telle quelle ; intégration de la passe et page facultative en panne.
- Unitaire : client PISTE et sources CETAT/Judilibre : jeton réutilisé, 401 retenté, plafond d'appels, secrets absents, dates, URL officielles, fenêtres 90/30 jours, dédoublonnage multi-matières, deux requêtes pour Plateformes. Aucun appel réseau.
- Unitaire : journal d'usage (`flushUsage`) : deux passes du même jour fusionnées dans `data/usage/<date>.json`, ordre des appels conservé, fichier du jour absent ou illisible qui repart de zéro sans lever.
- Unitaire : parseur CJUE (`veille/sources/cjeu.ts`) : deux formats de titre, date de décision, `pubDate` en secours, `_SUM`/`_RES`, `_INF`, XML invalide.
- Intégration : `run` avec un `fetch` injecté, sur une racine temporaire, les sources demandées ; une panne ou un flux CJUE vide laisse CNIL ; une matière désactivée ne supprime rien ; un arrêt sorti du flux reste ; une page ARCOM absente écarte l'entrée et avertit.
- Aucun test ne touche le réseau : les fixtures sont des captures du flux réel. Le build (`npm run build`) ne fait aucun appel réseau non plus.

## Tools

- `node:test` et `node:assert/strict` : runner et assertions, sans dépendance.
- `tsc --noEmit` : vérification des types.

## Conventions

- Tests dans `tests/`, fixtures dans `tests/fixtures/<source>/`.
- La fixture des textes du Conseil d'État est le `texte` intégral rendu par `/consult/juri`, sans retouche ; la fixture de consultation est la réponse complète pour 511155.
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
- Lancer `npm run veille` puis `npm run build` : la carte et la ligne FNAC portent `LIL · art. 82`, avec `Loi Informatique et Libertés · art. 82` au survol ; une page sans section reste sans référence.
- Vérifier que la décision 25-10.664 porte la pastille `RGPD · art. 4, 5, 6` — `Règlement (UE) 2016/679 · art. 4, 5, 6` au survol — et qu'aucun code du travail n'apparaît ; la pastille ouvre EUR-Lex dans un nouvel onglet, comme le titre et « Lire ».
- Vérifier que la décision 501268 du Conseil d'État porte `CPCE · art. L. 34-5` et `LIL · art. 8, 82, 20`, et que 520279 n'en porte plus.
- Vérifier que le snapshot brut reste dans `data/raw/` et que les pages publiques ne chargent aucun script.
- Vérifier `/veille` : sélecteur à cinq matières, badges, sources et liens Légifrance/Cour de cassation.
- Vérifier à 375 px : les cinq pastilles tiennent sur deux lignes, sans débordement horizontal, et le décochage de Plateformes masque ses publications.
