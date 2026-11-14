# Review: veille des publications doctrinales de la CNIL (#55)

- Rounds: 2
- Started: 2026-11-14

## Round 1 · r-c098

- Date: 2026-11-14
- By: Beccariavf
- Diff: `1e2fa36...64d1d49`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 12/15 met, 3 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Source de veille `cnil_doctrine` — `veille/sources/cnil-doctrine.ts:1`, branchée en `veille/main.ts:188`
- [x] Pages de référence relues par la reconnaissance du corpus, en import — `veille/sources/cnil-doctrine.ts:26` importe `chargerTexte`, `extraireDocuments`, `parcourirReference` de `mcp/corpus/cnil-doctrine/liste.ts` ; comparaison au manifeste `veille/sources/cnil-doctrine.ts:309`
- [x] « Nouvelle » : absent du manifeste et de `couverts_par_cnil` — `veille/sources/cnil-doctrine.ts:335` ; passe réelle sur `/tmp` avec le guide retiré du manifeste : `1 nouveau(x)`, entrée `motif: "nouveau"` sur les pages de cnil.fr
- [ ] « Modifiée » : URL du PDF changée **ou date de publication changée** — seule l'URL est comparée (`veille/sources/cnil-doctrine.ts:339`). Les pages de référence interrogées le 2026-11-14 (`fr/mediatheque?field_scald_collection_tid=29`, `fr/autres-referentiels`, `fr/guides-aipd`) ne portent aucune date par document : l'écart est déclaré et contraint par le plan (pas de téléchargement de PDF), mais la réédition servie sous la même URL n'est pas signalée
- [x] Aucun PDF téléchargé dans la veille — `chargerPdf` n'est pas importé ; seules `chargerTexte`/`parcourirReference` le sont
- [x] Entrée : `document`, `type`, `titre`, `URL`, `motif`, sans résumé — `veille/sources/cnil-doctrine.ts:216` ; entrée écrite et relue par `src/lib/entries.ts` (`summary: null`, `motif: "nouveau"`)
- [x] `CORPUS_PAR_SOURCE.cnil_doctrine = "cnil_doctrine"` — `mcp/corpus/veille.ts:36`
- [x] `documentsDeLEntree` reconnaît ces entrées — `mcp/corpus/veille.ts:255`, `SLUG_DOCTRINE` ; sur le corpus réel, le slug du guide est dans `indexerDocumentsCorpus` et son URL dans `indexerVersionsCorpus`
- [x] `corpus:sync` relance sur un document manquant — `tests/corpus-sync.test.ts:685`, `appels.n === 1`, statut `present` après la passe
- [ ] Statut `perime` pour une modification — partiel : `perime` n'est atteint que si le nom de fichier du PDF ne change pas (`tests/corpus-sync.test.ts:751`). Un fichier renommé donne un nouveau slug et le statut `manquant` (écart déclaré). Les deux relancent la synchronisation
- [x] Requêtes polies — `delai_ms`, `tentatives`, pause entre requêtes repris du descripteur (`veille/sources/cnil-doctrine.ts:248`) ; 12 pages lues en 1 appel séquentiel par page
- [x] Une source en panne n'emporte pas la passe — `veille/main.ts:419` isole chaque source ; `passeDoctrine` lève sur liste vide (`veille/sources/cnil-doctrine.ts:306`)
- [x] `data/` intact, pas de `corpus:index`, textes en préparation et CJUE intouchés — `git diff 1e2fa36..HEAD --stat -- data/` vide, arbre de travail propre
- [x] Tests hors ligne sur les fixtures #54 — `tests/cnil-doctrine-veille.test.ts:105` (nouveau), `:134` (PDF changé → `modifie`), `:160` (inchangé), `:171` (couvert par `cnil`), `:186` (écarté), `tests/corpus-sync.test.ts:685` (mappage → relance) ; `npm test` : 1058 tests, 1057 pass, 1 skip
- [ ] Mémoire mise à jour sobrement — `architecture.md:51` et `data.md:71-76` sont écrits, mais `architecture.md:33` contredit le raccord livré (voir Findings) et `data.md:76` surestime la reprise d'une réédition sous la même URL

### Findings

- `src/lib/sources.ts:2` : `SOURCE_LABELS` n'a pas d'entrée `cnil_doctrine`, donc la veille affiche l'identifiant brut (`src/pages/veille/index.astro:172`, `src/components/PublicationRangee.astro:59`) ; vérifié à l'exécution : `sourceLabel("cnil_doctrine")` rend `"cnil_doctrine"` sur une entrée réellement écrite → ajouter `cnil_doctrine: "CNIL — doctrine"` — 🟡 major, fit
- `mcp/corpus/veille.ts:397` : `documentsEcartes` rend une carte vide pour tout corpus autre que `cjue`, donc un document de doctrine que `cnil-doctrine:sync` a écarté (`documents_ecartes` du manifeste) reste `manquant` ; vérifié sur une racine temporaire : statut `manquant` et `cnil-doctrine:sync` relancé pour un document écarté, et la ligne reste dans `etat_corpus` après la fenêtre par `fusionnerManquants` → lire `documents_ecartes` de `cnil_doctrine` (URL → slug par `slugDe`) et classer `ecarte` — 🟡 major, error-handling
- `aidd_docs/memory/architecture.md:33` : le paragraphe de `corpus:sync` contredit le changement sur quatre points — mappage limité à `document` d'une entrée `legi`, sources relancées « (`cnil`, `ce`, `cc`, `cjue`, et `lil` ou `textes_fr` sur une entrée `legi`) », `perime` limité à `legi`/`eurlex`, et sources sans fraîcheur limitées à « `lil`, `textes_fr` et les actes de l'Union » → nommer `cnil_doctrine` dans les quatre énumérations — 🟡 major, rot
- `veille/sources/cnil-doctrine.ts:103` : `lireDescripteur` reduplique `mcp/corpus/cnil-doctrine/liste.ts:350`, alors que le plan demande la reconnaissance du corpus en import, pas une copie → importer celle de `liste.ts` et retirer `readFileSync` — 🟢 minor, rot
- `veille/sources/cnil-doctrine.ts:126` : `lireManifeste` traite un manifeste illisible comme absent (`catch { return null }`), donc une corruption ferait annoncer les 58 documents comme `nouveau` au lieu d'échouer → distinguer l'absence (`ENOENT`) de l'erreur de lecture et lever sur la seconde — 🟢 minor, error-handling
- `aidd_docs/memory/data.md:76` : « `cnil-doctrine:sync` la voit à la synchronisation suivante par le contenu » est faux isolément : `cnil_doctrine` n'est pas dans les sources revérifiées à chaque passe (`mcp/corpus/sync-rapport.ts:21`), elle n'est lancée que sur signal ; une réédition sous la même URL n'est donc ingérée que si un autre signal la relance → le dire, ou ajouter un signal d'en-tête (`HEAD`, `Last-Modified`/`ETag`/`Content-Length`) qui ne télécharge pas le PDF — 🟢 minor, fit

## Round 2 · r-7f31

- Date: 2026-11-14
- By: Beccariavf
- Diff: `1e2fa36...a2e1507`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 13/15 met, 2 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Source de veille `cnil_doctrine` — `veille/sources/cnil-doctrine.ts:1`, branchée en `veille/main.ts:188`
- [x] Pages de référence relues par la reconnaissance du corpus, en import — `veille/sources/cnil-doctrine.ts:26` importe `chargerTexte`, `extraireDocuments`, `lireDescripteur`, `parcourirReference` de `mcp/corpus/cnil-doctrine/liste.ts` ; comparaison au manifeste `veille/sources/cnil-doctrine.ts:318`
- [x] « Nouvelle » : absent du manifeste et de `couverts_par_cnil` — `veille/sources/cnil-doctrine.ts:344` ; passe réelle 2026-11-14 sur le manifeste privé du guide : `1 nouveau(x)`, entrée écrite sous `/tmp` et relue par `src/lib/entries.ts`
- [ ] « Modifiée » : URL du PDF changée **ou date de publication changée** — seule l'URL est comparée (`veille/sources/cnil-doctrine.ts:348`) ; les trois pages de référence ne portent aucune date par document (vérifié le 2026-11-14). Écart déclaré, inchangé
- [x] Aucun PDF téléchargé dans la veille — `chargerPdf` n'est pas importé
- [x] Entrée : `document`, `type`, `titre`, `URL`, `motif`, sans résumé — `veille/sources/cnil-doctrine.ts:225` ; entrée relue par le site, `summary: null`
- [x] `CORPUS_PAR_SOURCE.cnil_doctrine = "cnil_doctrine"` — `mcp/corpus/veille.ts:37`
- [x] `documentsDeLEntree` reconnaît ces entrées — `mcp/corpus/veille.ts:256`, `SLUG_DOCTRINE`
- [x] `corpus:sync` relance sur un document manquant — `tests/corpus-sync.test.ts:685`, statut `present` après la passe
- [ ] Statut `perime` pour une modification — partiel : atteint seulement si le nom de fichier du PDF ne change pas (`tests/corpus-sync.test.ts:751`) ; un fichier renommé donne `manquant`. Écart déclaré, inchangé
- [x] Requêtes polies — `delai_ms`, `tentatives`, pause repris du descripteur (`veille/sources/cnil-doctrine.ts:257`)
- [x] Une source en panne n'emporte pas la passe — `veille/main.ts:419` isole chaque source ; manifeste illisible désormais signalé (`veille/sources/cnil-doctrine.ts:112`, test `tests/cnil-doctrine-veille.test.ts:212`)
- [x] `data/` intact, pas de `corpus:index`, textes en préparation et CJUE intouchés — `git diff 1e2fa36..HEAD -- data/` vide
- [x] Tests hors ligne sur les fixtures #54 — `tests/cnil-doctrine-veille.test.ts:105,134,160,171,186,212`, `tests/corpus-sync.test.ts:685,751,898` ; `npm test` : 1061 tests, 1060 pass, 1 skip
- [x] Mémoire mise à jour — `architecture.md:33` nomme `cnil_doctrine` dans les quatre énumérations (mappage, sources relancées, `perime`, sources sans fraîcheur) ; `data.md:76` dit la limite réelle (relance sur signal seulement)

### Findings

- `mcp/corpus/veille.ts:407` : la branche `cnil_doctrine` classe `ecarte` **toute** raison de `documents_ecartes`, y compris une panne de téléchargement ou d'extraction que `cnil-doctrine:sync` rejoue (`telechargeur.oublier`, `mcp/corpus/cnil-doctrine/sync.ts:454`), alors que la branche CJUE juste en dessous ne retient que `MOTIFS_DURABLES` (`:424`). Un échec passager supprime donc le signal de relance : l'entrée reste dans la fenêtre, la veille ne la réémet pas, et le document peut manquer au corpus jusqu'au prochain signal doctrinal. Vérifié sur une racine temporaire : statut `ecarte` et zéro relance pour une raison non durable → ne tenir pour durables que les mentions contraires (`couverture.mentions_contraires` compte déjà par ce préfixe) et laisser les autres en `manquant` — 🟡 major, error-handling
- `mcp/corpus/veille.ts:391` : le commentaire « Seule la CJUE publie une liste par identifiant ; les comptes des autres corpus ne disent pas quel document a été écarté » est faux depuis que `cnil_doctrine` en publie une par URL → corriger le commentaire — 🟢 minor, rot
- `a2e1507` : le commit mêle le correctif, la mémoire et le rapport de revue, contre « une seule préoccupation par commit » (`aidd_docs/GUIDELINES.md:8`) → séparer le rapport de revue du correctif — 🟢 minor, conform
