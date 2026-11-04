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
- Unitaire : corpus RGPD (`tests/corpus.test.ts`) : 99 articles, 173 considérants, article 17 non vide et son chapitre III, en-têtes CELLAR et statut non 2xx, manifeste et nom du snapshot `sha256`, 272 lignes, idempotence des deux écritures, capture amputée de `art_17` qui lève avant toute écriture.
- Unitaire : index vectoriel (`tests/index.test.ts`) : embedder factice de 8 dimensions, six unités, `meta` (modèle, dimension, nombre), ordre cosinus et `k`, index absent qui nomme `npm run corpus:index`, dimension différente qui reconstruit l'index, `rowid` explicite en `BigInt`, second descripteur filtré par `document`, adaptateur Ollama sur un `fetch` injecté (en-têtes, normalisation, `ollama pull`), vrai modèle sauté sauf si `MCP_TEST_OLLAMA=1`.
- Unitaire : index incrémental (`tests/index.test.ts`) : embedder compteur, premier passage 6 vecteurs, second passage 0, ajout 1, modification 1, suppression 0, vecteurs inchangés identiques octet pour octet, `rowid` stable hors position, reconstruction complète sur changement de modèle ou de dimension, échec d'embedding qui annule tout le delta, empreinte dépendante du modèle, de la dimension et du passage, journal des quatre comptes.
- Unitaire : outils et serveur (`tests/mcp.test.ts`) : article exact, article absent qui ne rend pas de chaîne vide, court-circuit « article N » sans embedder, piège hors corpus rendu `aucun_resultat_fiable` sans passage, trois niveaux de confiance, deux outils vus par un client en mémoire, serveur sans index qui sert « article 17 » et refuse « article 100 » sans accuser l'index absent, aucun `fetch` dans `mcp/server.ts` ni `mcp/tools.ts`.
- Unitaire : évaluation (`tests/eval.test.ts`) : 50 questions (12 références, 28 conceptuelles, 10 pièges), 35 `dev` et 15 `test`, références toutes présentes dans `unites.jsonl`, `recall@5`, `MRR`, précision au rang 1, taux de citations invalides, calibration et quatre plis, garde qui refuse une question `test` à la calibration en la nommant, filtrage `dev`/`test`.
- Unitaire : bande article et confiance (`tests/mcp.test.ts`) : article à 0,79 devant un considérant à 0,80, considérant à 0,90 devant un article à 0,70, ordre stable entre deux articles, considérant conservé et étiqueté, similarité brute rendue, frontière de marge (à marge égale `incertain`, au-delà `confiant`), seuil bas et absence de résultat, passage portant `niveau`, `numero` et `chemin`.
- Le jeu de tests par défaut ne touche pas le réseau : les fixtures sont des captures du flux réel. Le build (`npm run build`) ne fait aucun appel réseau non plus.

## Tools

- `node:test` et `node:assert/strict` : runner et assertions, sans dépendance.
- `tsc --noEmit` : vérification des types.

## Conventions

- Tests dans `tests/`, fixtures dans `tests/fixtures/<source>/`.
- La fixture des textes du Conseil d'État est le `texte` intégral rendu par `/consult/juri`, sans retouche ; la fixture de consultation est la réponse complète pour 511155.
- Les fixtures de flux sont des captures réelles ; les fixtures HTML sont des captures réduites des pages CNIL, avec leurs classes et guillemets d'origine.
- Exception : `tests/fixtures/eurlex/rgpd.xhtml` est la capture intégrale du RGPD (876 859 octets, 99 ancres `art_N`, 173 `rct_N`), octet pour octet le snapshot `data/raw/6e/6e6495….xhtml`, sans réduction, parce que le parseur vérifie ces comptes et que le corpus committé doit en sortir à l'identique.
- L'index vectoriel n'est jamais une fixture : les tests le construisent dans une racine temporaire avec un embedder factice.
- Un test par comportement observable.
- Les valeurs figées (identifiants, hashes) sont calculées indépendamment du code testé, jamais comparées à leur propre sortie.

## Run

- `npm test`
- `npm run typecheck`
- `npm run build` : la preuve que la page contient réellement `data/` (échoue sans `data/`).

## Manuel

- `npm run corpus:build` : récupère CELLAR et écrit `data/corpus/rgpd/` (réseau).
- `npm run corpus:index` : construit ou met à jour `data/corpus/index/index.db` (Ollama et `qwen3-embedding:0.6b`) ; un second passage sur un corpus inchangé embarque zéro unité.
- `npm run mcp:smoke` : vérifie 1024 dimensions et la norme 1 auprès du vrai Ollama.
- `npm run mcp:eval -- --split dev` : calibre et mesure les 35 questions de développement sur l'index réel, hors CI.
- `npm run mcp:eval -- --split test` : constate sur les 15 questions tenues à l'écart, avec les seuils figés ; le rapport daté vit dans `aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`.
- `MCP_TEST_OLLAMA=1 npm test` : lance aussi le contrôle du vrai modèle (1024 dimensions, norme 1) ; sans cette variable, le test est sauté même si `OLLAMA_HOST` est défini.
- Ouvrir `tools/parametres.html` dans Chrome, charger `veille/themes.json`, désactiver une matière, enregistrer.
- Lancer `npm run build` : les publications de cette matière disparaissent ; réactiver et reconstruire : elles reviennent sans collecte.
- Lancer `npm run veille` puis `npm run build` : la carte et la ligne FNAC portent `LIL · art. 82`, avec `Loi Informatique et Libertés · art. 82` au survol ; une page sans section reste sans référence.
- Vérifier que la décision 25-10.664 porte la pastille `RGPD · art. 4, 5, 6` — `Règlement (UE) 2016/679 · art. 4, 5, 6` au survol — et qu'aucun code du travail n'apparaît ; la pastille ouvre EUR-Lex dans un nouvel onglet, comme le titre et « Lire ».
- Vérifier que la décision 501268 du Conseil d'État porte `CPCE · art. L. 34-5` et `LIL · art. 8, 82, 20`, et que 520279 n'en porte plus.
- Vérifier que le snapshot brut reste dans `data/raw/` et que les pages publiques ne chargent aucun script.
- Vérifier `/veille` : sélecteur à cinq matières, badges, sources et liens Légifrance/Cour de cassation.
- Vérifier à 375 px : les cinq pastilles tiennent sur deux lignes, sans débordement horizontal, et le décochage de Plateformes masque ses publications.
