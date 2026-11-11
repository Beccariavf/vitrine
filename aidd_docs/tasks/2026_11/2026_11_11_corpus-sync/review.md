# Review: rafraîchir le corpus depuis la veille

- Rounds: 4
- Started: 2026-11-11

## Round 1 · r-4f2a

- Date: 2026-11-11
- By: Beccariavf
- Diff: `4ca59cb...b679658`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/7 met, 1 unmet (partial), 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1. `--dry-run` rend fraîcheur, documents présents/manquants/écartés/non mappés et sources, sans écrire — `mcp/corpus/sync.ts:297-300,329,339-371` ; exécution réelle `npm run corpus:sync -- --dry-run --depuis 2026-10-01` : 43 entrées, 14 présents, 1 manquant (`CNILTEXT000054978945`), 29 non mappés, `cnil : ignoree — dry-run : serait lancé`, aucun `data/corpus/sync.json`, `git status` propre.
- [x] 2. Une sanction CNIL ajoutée par incrément devient cherchable hors ligne — `tests/corpus-sync.test.ts:391-444` passe ; `syncCorpus` construit l'index puis `search` rend `CNILTEXT000000000002`. Limite : l'incrément DILA est simulé par un agent factice, pas par `syncIncrements`.
- [x] 3. Un document présent ne relance aucune source ; une seconde passe ne réextrait rien — `tests/corpus-sync.test.ts:445-472` (0 appel) ; vérification indépendante : seconde passe sur la même fenêtre, 0 appel d'agent, index `0 ajoutée, 0 modifiée, 1 inchangée`.
- [ ] 4. Une source en panne laisse le corpus identique octet pour octet, `panne`, `a_jour_au` inchangé — partiel : `tests/corpus-sync.test.ts:473-501` prouve les octets identiques et `a_jour_au` nul pour un agent qui lève **avant** d'écrire ; aucun test ne couvre une source qui écrit puis lève, et `mcp/corpus/sync.ts:114-125` expose ce cas (`flushUsage` en `finally` après une écriture de `syncCc`).
- [x] 5. `etat_corpus` rend `a_jour_au`, l'inventaire des huit corpus et les manquants ; quatre outils stdio — `mcp/tools.ts:40-55`, `mcp/server.ts:154-170`, `tests/server-stdio.test.ts` ; exécution réelle : huit corpus (`aiact,cc,ce,cepd,cjue,cnil,lil,rgpd`), `a_jour_au: null` avec le message qui nomme `corpus:sync` (aucun rapport commité). Le manquant du dry-run n'est donc pas encore exposé par l'outil.
- [x] 6. `--planifier --dossier <dir>` écrit `fr.vitrine.corpus-sync.plist` à `StartInterval` 259200 sans charger l'agent — `mcp/corpus/sync-planificateur.ts:13,44-109`, `mcp/corpus/sync.ts:342-353` ; exécution réelle dans un dossier temporaire : plist écrit, `<integer>259200</integer>`, `RunAtLoad` faux, aucune invocation `launchctl` dans le code, `~/Library/LaunchAgents` intact.
- [x] 7. `npm test`, `npm run typecheck`, `npm run build` passent — `npm test` : 693 tests, 692 pass, 1 skip conditionnel (`MCP_TEST_OLLAMA`), 0 échec ; `tsc --noEmit` propre ; build Astro code 0.

### Findings

- `mcp/corpus/sync.ts:254` : la fenêtre par défaut ignore `precedent.depuis` quand `a_jour_au` est `null` ; après un premier échec, la passe suivante recalcule `date - 7` et perd les entrées du jour le plus ancien. Vérifié : entrée du 2026-11-04, panne le 2026-11-11, passe du 2026-11-12 → `depuis: 2026-11-05`, `entrees: 0`, `CNILTEXT...099` jamais repris. → `precedent?.a_jour_au ?? precedent?.depuis ?? joursAvant(...)` et test de reprise après un premier échec — 🟡 major (majeur), `fit` / bug de reprise.
- `mcp/corpus/sync.ts:254,317` : `a_jour_au` avance à la date de passe, alors que la veille est hebdomadaire et la passe tous les trois jours ; une entrée écrite par la veille après la passe, mais publiée avant, tombe sous `a_jour_au` et n'est jamais lue. Vérifié : passe du 2026-11-11 (`a_jour_au: 2026-11-11`), entrée datée du 2026-11-10 ajoutée ensuite, passe du 2026-11-12 → `depuis: 2026-11-11`, `entrees: 0`. → chevaucher la fenêtre (par exemple `min(a_jour_au, date - 7)`) ou faire tourner la veille avant la passe, puis test d'une entrée écrite après une passe réussie — 🟡 major (majeur), `fit` / besoin non servi.
- `mcp/corpus/sync.ts:314-327`, `mcp/corpus/sync-rapport.ts:80-97`, `mcp/tools.ts:45` : le rapport est réécrit à chaque passe et ne couvre que la dernière fenêtre ; un document encore absent après une synchronisation réussie disparaît de `etat_corpus.manquants` dès que `a_jour_au` avance. Vérifié : passe du 2026-11-05 (`manquants: 1`, `etat: 1`), passe du 2026-11-06 (`depuis: 2026-11-05`, `entrees: 0`, `manquants: 0`, `etat: 0`) alors que `CNILTEXT...099` est toujours absent du corpus. → conserver une liste durable des manquants (ou recalculer à la lecture les documents des entrées récentes absents du corpus), et tester la persistance — 🟡 major (majeur), `fit` / besoin non servi.
- `mcp/corpus/sync.ts:297-312` : l'index est reconstruit à chaque passe non sèche, alors que `phase-2.md` (tâche 7) et le périmètre de la spec le prévoient seulement « quand une source a écrit ». Le choix est justifié par le réessai après une panne d'Ollama et reste bon marché quand rien ne change, mais le plan et la spec ne le disent pas. → conditionner à « une source a écrit **ou** l'index précédent était en panne », ou mettre à jour plan/spec — 🟢 minor (mineur), `conform`.
- `mcp/corpus/sync.ts:114-125` : `flushUsage` est appelé dans le `finally` de l'agent `cc` ; s'il lève après l'écriture de `syncCc`, la source est rapportée `panne` et `a_jour_au` n'avance pas alors que le corpus a changé. → isoler l'échec du journal d'usage (le rapporter sans marquer la source en panne) ou restaurer les octets, et tester une source qui écrit puis lève — 🟢 minor (mineur), `error-handling`.
- `mcp/corpus/veille.ts:234-238` : `documentsEcartes` retient **tous** les motifs, y compris `echec_telechargement` ; une panne transitoire inscrite au manifeste devient `ecarte` et ne relance plus la CJUE. → ne traiter comme `ecarte` que `avis_avocat_general`, `autre_type` et `version_francaise_absente` ; laisser `echec_telechargement` en `manquant`/réessai — 🟢 minor (mineur), `fit`.
- `mcp/corpus/veille.ts:224-227` : seules les exclusions CJUE sont lues ; une entrée CE ou Cassation hors du filtre du corpus reste `manquant`, déclenche la source (archive JADE de 1,32 Go ou budget PISTE) puis reste manquante. Aucun cas observé sur la fenêtre courante, mais le coût est celui que la décision 3 veut éviter. → après une synchronisation réussie, marquer un document CE/CC toujours absent `non_ajoute`/`ecarte` avec son motif, ou consulter les filtres du manifeste avant de lancer — 🟢 minor (mineur), `fit`.
- `mcp/tools.ts:45` : `rapport?.documents.filter(...)` lève si `sync.json` est un JSON valide mais incomplet (`{}`) ; `lireRapport` (`sync-rapport.ts:69-77`) ne valide que la syntaxe. Vérifié : `etatCorpus` sur `{}` → `Cannot read properties of undefined (reading 'filter')`. → valider la forme dans `lireRapport` ou `rapport?.documents?.filter(...) ?? []` — 🟢 minor (mineur), `error-handling`.
- `README.md:321` et `mcp/demo.ts:6` : « les trois outils » contredit les « quatre outils » du reste de la documentation ; la démonstration en appelle trois sur quatre. → « trois des quatre outils » — 🟢 minor (mineur), `rot`.
- `tests/corpus-sync.test.ts:308` : le test « inventorie les huit corpus » n'en crée que cinq (`ce, cepd, cnil, lil, rgpd`) ; par ailleurs aucun test ne couvre `agentsParDefaut` (transmission de `rootDir`, `flushUsage` de `cc`), l'identifiant invalide de `phase-1.md`, l'ordre des sources et la poursuite après panne de `phase-2.md`, ni la seconde passe sans réextraction du critère 3. → compléter ces cas — 🟢 minor (mineur), `code-health`.
- `aidd_docs/tasks/2026_11/2026_11_11_corpus-sync/plan.md:3` et `phase-1.md` à `phase-5.md:2` : les statuts restent `pending` alors que le lot est livré, contrairement à la convention des autres tâches (`completed`/`done`/`implemented`). → mettre à jour après la revue — 🟢 minor (suggestion), `rot`.
- `mcp/corpus/veille.ts:156` : l'extraction des `CNILTEXT…` balaie tous les liens de la page, pas seulement les « Textes de référence » ; un lien de navigation ou « sur le même sujet » peut créer un faux manquant et relancer l'incrément CNIL. Aucun faux positif observé sur les six snapshots actuels. → restreindre à la section de références ou au bloc de liens retenus, et tester un lien annexe — 🟢 minor (suggestion), `fit`.
- `mcp/corpus/veille.ts:26,181` : `ID_JUDILIBRE = /^[a-z0-9]+$/` et le CELEX acceptent n'importe quel jeton (`CELEX:garbage`) ; un identifiant malformé devient un document manquant et lance la source. → `^[0-9a-f]{24}$` pour Judilibre et `^6\d{4}[A-Z]{2}\d+$` pour le CELEX, avec un test d'identifiant invalide — 🟢 minor (suggestion), `standards`.
- `mcp/corpus/sync-rapport.ts:131` : `documents: nombre(manifeste.documents, 1)` invente `1` pour tout manifeste sans champ `documents` ; c'est exact pour RGPD/AI Act mais trompeur pour un manifeste incomplet. → défaut explicite par corpus ou `0` — 🟢 minor (suggestion), `standards`.
- `mcp/corpus/sync.ts:342-353`, `mcp/corpus/sync-planificateur.ts:102` : `--planifier --dry-run` écrit quand même le plist, `--dossier` crée malgré tout `~/Library/Logs`, et les chemins imprimés pour `launchctl` ne sont pas cités (un chemin avec espace casse la commande). → honorer `--dry-run`, ne créer les logs que pour le dossier par défaut, citer les chemins — 🟢 minor (suggestion), `standards`.
- `mcp/corpus/sync.ts:356-363` : `--date` ne date que le rapport ; les sources utilisent la date réelle pour `lu_le`/`date_extraction`, d'où un rapport daté et un manifeste daté différemment. → propager `date` aux sources ou documenter l'option comme « date du rapport » — 🟢 minor (suggestion), `conform`.
- `mcp/corpus/sync-rapport.ts:156-161` : le texte humain agrège les 29 non mappés (8 CNIL à expliquer + 21 sources hors corpus) sous un seul compte ; la décision 2 (« le rapport doit dire pourquoi ») n'est lisible qu'en `--json`. → nommer les non mappés CNIL et leur motif dans le texte, ou distinguer « source hors corpus » — 🟢 minor (suggestion), `fit`.

## Round 2 · r-8c3d

- Date: 2026-11-11
- By: Beccariavf
- Diff: `b679658...27f6c47` (+ working tree : statuts `phase-3.md` et `phase-5.md`)
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 7/7 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1. `--dry-run` rend fraîcheur, statuts, sources, sans écrire — exécution réelle `npm run corpus:sync -- --dry-run --depuis 2026-10-01` : 43 entrées, 14 présents, 1 manquant (`CNILTEXT000054978945`), 29 non mappés (21 source hors corpus, 8 CNIL sans identifiant), `cnil : ignoree — dry-run : serait lancé` ; aucun `data/corpus/sync.json` ; `mcp/corpus/sync.ts:361-378`.
- [x] 2. Sanction CNIL ajoutée par incrément puis cherchable hors ligne — `tests/corpus-sync.test.ts:433-486` passe ; l'agent factice ajoute l'unité, `search` rend `CNILTEXT000000000002`. Réserve inchangée : l'incrément DILA réel n'est pas exercé.
- [x] 3. Document présent → 0 source ; seconde passe sans réextraction — `tests/corpus-sync.test.ts:487-514` (0 appel) et `:850-883` (seconde passe, 1 appel au total, source `ignoree`, index par delta) ; vérification indépendante : 0 appel, index `0 ajoutée, 0 modifiée, 1 inchangée`.
- [x] 4. Source en panne → corpus identique, `panne`, `a_jour_au` inchangé ; fenêtre reprise — `tests/corpus-sync.test.ts:515-543` (octets identiques, panne, `a_jour_au` nul) et `:740-777` (reprise de `depuis` après un premier échec) ; `mcp/corpus/sync.ts:117-137` neutralise le seul échec post-écriture connu (`flushUsage`). Le test d'un agent qui écrirait puis lèverait reste absent (finding).
- [x] 5. `etat_corpus` rend `a_jour_au`, les huit corpus, les manquants ; quatre outils stdio — `mcp/tools.ts:40-56`, `mcp/corpus/sync-rapport.ts:68-87` ; `tests/corpus-sync.test.ts:328-366` invente les huit manifestes, `:415-432` refuse `{}` ; `tests/server-stdio.test.ts` expose les quatre outils ; exécution réelle : huit corpus, `a_jour_au: null` et message qui nomme `corpus:sync` (aucun rapport commité).
- [x] 6. `--planifier --dossier <dir>` écrit le plist `StartInterval` 259200 ; `--dry-run` n'écrit pas ; chemins cités — `mcp/corpus/sync-planificateur.ts:98-125`, `mcp/corpus/sync.ts:401-419` ; test `tests/corpus-sync.test.ts:937-955` ; exécution réelle : dry-run = 0 fichier, écriture normale = plist à `<integer>259200</integer>`, aucune invocation `launchctl`.
- [x] 7. `npm test`, `npm run typecheck`, `npm run build` passent — 700 tests, 699 pass, 1 skip conditionnel (`MCP_TEST_OLLAMA`), 0 échec ; `tsc --noEmit` propre ; build Astro code 0.

### Findings

- `mcp/corpus/sync.ts:301-311` : la détection d'un échec par `a_jour_au !== derniere_tentative` rate une passe **le même jour** qu'un succès ; avec `--depuis` plus ancien que 7 jours, la passe suivante revient au recouvrement de 7 jours et ne reprend pas la fenêtre échouée (entrée du 2026-10-15 non relue). La ligne reste visible par `fusionnerManquants`, mais la source n'est pas réessayée. → détecter la panne dans `precedent.sources`/`precedent.index` ou ajouter un statut de tentative — 🟢 minor (mineur), `fit`.
- `mcp/corpus/sync-rapport.ts:70-84` : `lireRapport` vérifie que `documents` est un tableau, pas la forme de ses éléments ; un rapport `{"version":1,"documents":[null],...}` passe et `mcp/tools.ts:48` lève encore `Cannot read properties of null (reading 'statut')`. Le cas `{}` est couvert, `documents:[null]` ne l'est pas. → valider chaque ligne ou filtrer `document && typeof document === "object"` — 🟢 minor (mineur), `error-handling`.
- `mcp/corpus/sync.ts:120` : `let resultat;` est implicitement `any` ; `mcp/corpus/sync.ts:203` colle deux instructions sur la même ligne (`function compter(...) {  const comptes = ...`). → typer `Awaited<ReturnType<typeof syncCc>>` et rétablir le saut de ligne — 🟢 minor (mineur), `code-health`.
- `tests/corpus-sync.test.ts` : la résilience de `flushUsage` (`mcp/corpus/sync.ts:117-137`) n'a aucun test, et aucun test n'exerce `agentsParDefaut` (transmission de `rootDir`, appel de `flushUsage`) alors que `phase-2.md` (tâche 3) le demande encore. → tester un `data/usage` non inscriptible avec un `syncCc` injecté, ou refactorer l'agent pour l'injection — 🟢 minor (mineur), `code-health`.
- `README.md:227` : « `--date` date la passe » surpromet ; `mcp/corpus/sync.ts:419-425` ne transmet `date` qu'à `syncCorpus`, les quatre agents utilisent leur propre date du jour (`lu_le`, `date_extraction`). → dire « date le rapport et la fenêtre » ou propager `date` aux agents — 🟢 minor (mineur), `conform`.
- `aidd_docs/tasks/2026_11/2026_11_11_corpus-sync/phase-3.md:2` et `phase-5.md:2` : les statuts `completed` sont dans le worktree mais pas dans `27f6c47` (le commit les laisse `pending`) ; `git status` reste sale hors `review.md`. → committer ces deux statuts ou les retirer — 🟢 minor (mineur), `rot`.
- `mcp/corpus/sync-rapport.ts:198` : le texte rend « 21 source hors corpus » au pluriel sans accord ; la ligne groupe les motifs mais le libellé reste au singulier. → accorder (« sources hors corpus ») — 🟢 minor (suggestion), `rot`.

## Round 3 · r-9b1e

- Date: 2026-11-11
- By: Beccariavf
- Diff: `27f6c47...5d675f6` (+ working tree : statuts `phase-3.md`/`phase-5.md`, à committer avec ce rapport)
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 7/7 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1. `--dry-run` rend fraîcheur, statuts, sources, sans écrire — exécution réelle : 43 entrées, 14 présents, 1 manquant (`CNILTEXT000054978945`), 29 non mappés (`source hors corpus : 21`, `aucun identifiant CNILTEXT dans la page snapshotée : 8`), `cnil : serait lancé` ; aucun `data/corpus/sync.json` ; `mcp/corpus/sync.ts:361-378`.
- [x] 2. Sanction CNIL ajoutée par incrément puis cherchable hors ligne — `tests/corpus-sync.test.ts:433-486` ; agent factice, `search` rend `CNILTEXT000000000002`. Réserve inchangée : l'incrément DILA réel n'est pas exercé.
- [x] 3. Document présent → 0 source ; seconde passe sans réextraction — `tests/corpus-sync.test.ts:487-514` et `:850-883` ; harness : 0 appel, index `0/0/1`.
- [x] 4. Source en panne → corpus identique, `panne`, `a_jour_au` inchangé, fenêtre reprise — `tests/corpus-sync.test.ts:515-543`, `:740-777` et `:892-936` (panne le même jour qu'un succès, reprise `depuis: 2026-10-01`, entrée relue) ; `flushUsage` en panne est signalé sans faire échouer `cc` (`:938-955`, `mcp/corpus/sync.ts:117-155`). Le cas d'une source qui écrirait puis lèverait reste non testé ; les sources réelles valident avant d'écrire.
- [x] 5. `etat_corpus` rend `a_jour_au`, les huit corpus, les manquants ; quatre outils stdio — `mcp/tools.ts:40-60`, `sync-rapport.ts:68-90` ; test des huit manifestes (`:328-366`), rapport `{}` et `documents:[null]` refusés (`:415-432`), `etat_corpus` sans levée ; stdio quatre outils ; exécution réelle : huit corpus, `a_jour_au: null` + message (aucun rapport commité).
- [x] 6. `--planifier --dossier <dir>` écrit le plist `StartInterval` 259200 ; `--dry-run` n'écrit pas ; chemins cités — `sync-planificateur.ts:98-125`, `sync.ts:401-419` ; test `:937-955` ; exécution réelle : dry-run 0 fichier, écriture normale 259200, pas de `launchctl`.
- [x] 7. `npm test`, `npm run typecheck`, `npm run build` passent — 702 tests, 701 pass, 1 skip conditionnel (`MCP_TEST_OLLAMA`), 0 échec ; `tsc --noEmit` propre ; build Astro code 0.

### Findings

- `mcp/corpus/sync-rapport.ts:75-90` + `mcp/corpus/sync.ts:319-322` : `lireRapport` valide les lignes de `documents`, pas `sources` ni `index` ; un rapport `{"version":1,"documents":[],"corpus":[],"sources":[null],"depuis":"…"}` ou sans `index`/avec `index:null` est accepté, puis `syncCorpus` lève dans `echecPrecedent` (`source.statut`, `precedent.index.statut`). Vérifié sur trois racines temporaires ; `etat_corpus`, lui, ne lève pas. → valider `sources` (objets avec `statut` chaîne) et `index` (`statut` chaîne), ou garder `precedent.index?.statut` et `source?.statut` — 🟢 minor (mineur), `error-handling`.
- `mcp/corpus/sync.ts:221` : `compter` colle toujours deux instructions sur une ligne (`function compter(...) {  const comptes = ...`) ; le typage de `resultat` est corrigé, pas cette forme. → rétablir le saut de ligne — 🟢 minor (mineur), `code-health`.
- `tests/corpus-sync.test.ts:938-955` : le test de `flushUsage` couvre `cc`, mais n'assure pas que `rootDir` est transmis (`syncCc` injecté ignore `options`), et les agents `cnil`/`ce`/`cjue` ne sont pas injectables ; `phase-2.md` dit encore « chaque agent reçoit `rootDir` ». Vérifié à la main : `agentsParDefaut("/tmp/racine-test", …).cc()` reçoit bien `/tmp/racine-test`. → asserter `options.rootDir` dans le `syncCc` injecté, ou étendre `AgentsParDefautDeps` — 🟢 minor (mineur), `code-health`.

## Round 4 · r-c2f7

- Date: 2026-11-11
- By: Beccariavf
- Diff: `5d675f6...e677ca6`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 7/7 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1. `--dry-run` rend fraîcheur, statuts, sources, sans écrire — exécution réelle : 43 entrées, 14 présents, 1 manquant (`CNILTEXT000054978945`), 29 non mappés (`source hors corpus : 21`, `aucun identifiant CNILTEXT dans la page snapshotée : 8`), `cnil : serait lancé` ; aucun `data/corpus/sync.json` ; `mcp/corpus/sync.ts:361-378`.
- [x] 2. Sanction CNIL ajoutée par incrément puis cherchable hors ligne — `tests/corpus-sync.test.ts:433-486` ; agent factice, `search` rend `CNILTEXT000000000002`. Réserve inchangée : l'incrément DILA réel n'est pas exercé.
- [x] 3. Document présent → 0 source ; seconde passe sans réextraction — `tests/corpus-sync.test.ts:487-514` et `:850-883` ; harness : 0 appel, index `0/0/1`.
- [x] 4. Source en panne → corpus identique, `panne`, `a_jour_au` inchangé, fenêtre reprise — `tests/corpus-sync.test.ts:515-543`, `:740-777`, `:892-936` ; `flushUsage` en panne signalé sans faire échouer `cc` (`:938-955`) ; `rootDir` transmis à `syncCc` est désormais asserté (`:957-975`).
- [x] 5. `etat_corpus` rend `a_jour_au`, les huit corpus, les manquants ; quatre outils stdio — `mcp/tools.ts:40-60`, `sync-rapport.ts:68-95` ; test des huit manifestes (`:328-366`), `{}`, `[null]`, `sources:[null]` et index absent refusés (`:415-453`), `etat_corpus` sans levée ; stdio quatre outils ; réel : huit corpus, `a_jour_au: null` + message (aucun rapport commité).
- [x] 6. `--planifier --dossier <dir>` écrit le plist `StartInterval` 259200 ; `--dry-run` n'écrit pas ; chemins cités — `sync-planificateur.ts:98-125`, `sync.ts:401-419` ; test `:937-955` ; exécution réelle : dry-run 0 fichier, écriture normale 259200, pas de `launchctl`.
- [x] 7. `npm test`, `npm run typecheck`, `npm run build` passent — 702 tests, 701 pass, 1 skip conditionnel (`MCP_TEST_OLLAMA`), 0 échec ; `tsc --noEmit` propre ; build Astro code 0.

### Findings

- `mcp/corpus/sync-rapport.ts:74-92` : `lireRapport` valide désormais `documents`, `sources` et `index`, mais pas le type de `a_jour_au`/`derniere_tentative` (`string | null`) ni `comptes` ; un rapport `a_jour_au: 42` passe, `etat_corpus` le rend tel quel, et `syncCorpus` retombe sur la fenêtre par défaut sans lever. Cas de rapport édité à la main, jamais produit par la commande. → valider ces champs ou les normaliser — 🟢 minor (suggestion), `error-handling`.
