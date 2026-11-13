# Review: statut-application

- Rounds: 1
- Started: 2026-11-13

## Round 1 · r-6d1f

- Date: 2026-11-13
- By: Beccariavf
- Diff: `721a93c...2434c7a` (+ working tree ; les trois commits #33 sont `baa368d...2434c7a`, les six autres sont #32, PR #73 ouverte)
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/8 met, 2 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] 1. Chaque passage de `search`, chaque `get_article` trouvé et chaque décision de `get_decision` porte `statut_application` avec l'une des sept valeurs — `mcp/tools.ts:82,98,131,136,289,525-531,702-706` ; `tests/mcp.test.ts:1912-2010` ; rendus réels : RGPD 17 `en_vigueur`, LIL 1 `en_vigueur`, SAN-2026-015 `rendue`, CNILTEXT000055022778 `rendue`, CNILTEXT000043204856 `abroge`.
- [x] 2. `statut` garde sa valeur source, sans réécriture — `mcp/tools.ts:289,530` ; `mcp/index/search.ts:38` ; rendus réels : `VIGUEUR`, `ABROGE`, `ANNULE`, `finale`, `Arrêt de la Cour` restent lisibles à côté ; `tests/mcp.test.ts:1912-1985`.
- [ ] 3. La table rend les six vocabulaires, `ce`/`cc`/`cjue` → `rendue` quel que soit le statut source — la correspondance est exacte sur le corpus réel (`rgpd` 272, `aiact` 293, `lil` 133, `ce` 17 703, `cc` 7 048, `cjue` 16 916, `cepd` 5 443), mais `mcp/corpus/statut.ts:95` teste `ABROGE` avant le corpus : `statutApplication("ce","ABROGE")` et `("cc","ABROGE")` rendent `abroge`, contre « quel que soit le statut source » ; `("inconnu","ABROGE")` rend aussi `abroge`, contre `phase-1.md:47` (« tout autre corpus : inconnu »). Aucun corpus réel ne porte ces cas.
- [ ] 4. Une valeur source non reconnue rend `inconnu` — ambigu pour la CNIL : `mcp/corpus/statut.ts:95-105` ne consulte `statut` que pour `ABROGE`, puis décide sur `nature`. Les statuts CNIL `MODIFIE` (26 unités, 2 documents) et `ANNULE` (12 unités, 2 documents) rendent `adoptee` ; rendu réel : `CNILTEXT000017653821` → `statut_application: "adoptee"` alors que son texte commence par « DECISION ANNULEE PAR UNE DECISION DU CONSEIL D'ETAT DU 30 OCTOBRE 2001 ». Le contrat (critère 3 « avis et recommandation → adoptee », décision 3 « sauf abrogation déclarée ») ne tranche pas `ANNULE`/`MODIFIE` ; le résultat affirme l'adoption là où la source déclare l'annulation.
- [x] 5. `propose` et `pendant` existent dans le type et la table, et sont testés sur la fonction pure — `mcp/corpus/statut.ts:16-34,43-51` ; `tests/statut.test.ts:54-61`.
- [x] 6. Un article abrogé rend `abroge`, `date_fin` et `date_debut`, sans réécriture — `tests/mcp.test.ts:1941-1959` sur racine temporaire. Réserve : le corpus LIL réel écarte les 54 articles abrogés (`data/corpus/lil/manifest.json`, `couverture.articles_abroges_ecartes`) ; l'article 37 abrogé le 2025-05-03 rend « Article 37 introuvable », donc le cas réel n'existe pas.
- [x] 7. Un article de la loi 78-17 porte le statut et la date de la version consolidée rendue — rendu réel LIL 1 : `statut: "VIGUEUR"`, `statut_application: "en_vigueur"`, `date_debut: "2019-06-01"`, `date_fin: null`. Réserve : le corpus ne porte qu'une version par article et `getArticle` prend `[0]` sans trier par date (`mcp/tools.ts:274-280,288`) ; le test `tests/mcp.test.ts:1921-1935` est circulaire et ne prouve pas le rejet d'une version antérieure.
- [x] 8. Les descriptions nomment `statut_application` et l'interdit d'applicabilité ; `typecheck`, `test`, `build` passent — `mcp/server.ts:36-42,108,142,233` ; `tests/mcp.test.ts:1000-1016` ; `npm run typecheck` 0 ; `npm test` 812 tests, 811 pass, 1 skip (`MCP_TEST_OLLAMA`), 0 échec ; `npm run build` 3 pages. Aucune modification de `data/` ni de l'index (`git diff --stat main...HEAD -- data/` vide, index daté d'avant les commits).

### Findings

- `README.md:118-126` : la documentation publique dit « un avis ou une recommandation `adoptee` » et rattache l'exception `ABROGE` aux seuls textes (`rgpd`, `aiact`, `lil`), alors que le code et `aidd_docs/memory/architecture.md:38` font primer `ABROGE` sur la nature CNIL/CEPD (471 unités CNIL, 46 documents) ; un lecteur du README conclut l'inverse du rendu. → ajouter « sauf `ABROGE` déclaré par la source » ou renvoyer à la règle canonique. — 🟡 major, rot.
- `aidd_docs/tasks/2026_11/2026_11_13_statut-application/plan.md:27`, `spec.md:46`, `phase-1.md:14` : l'inventaire annonce « huit/six vocabulaires sources » et ne relève pour la CNIL que `VIGUEUR` ; le corpus porte `VIGUEUR` (28 790), `ABROGE` (471), `MODIFIE` (26) et `ANNULE` (12). L'omission explique le trou du critère 4. → relever les quatre statuts CNIL. — 🟢 minor, conform.
- `tests/mcp.test.ts:1921-1935` : le test « version consolidée » est circulaire — `unitLil` fixe `date_debut: "2019-06-01"` et le test l'asserte ; il ne peut pas échouer sur « pas une version antérieure ». → fixture à deux versions et assertion sur la plus récente, ou test de l'invariant mono-version. — 🟢 minor, code-health.
- `mcp/corpus/lil/parse.ts:166-170` + `data/corpus/lil/manifest.json` : les articles abrogés sont écartés à l'ingestion ; `get_article` sur l'article 37 rend `trouve: false` / « Article 37 introuvable », jamais `abroge`. La promesse du critère 6 ne se produit pas sur le corpus réel, seulement sur une racine synthétique. → ticket suivant (#46 / versions abrogées). — 🟢 minor, fit (hors diff, pré-existant).
- `data/corpus/aiact/unites.jsonl` (293 unités `en_vigueur`, `date_debut: 2024-08-01`) + `mcp/corpus/parse.ts:154` : l'article 6(1) et les obligations Annex I ne s'appliquent qu'au 2027-08-02 (art. 113, présent au corpus) et rendent pourtant `en_vigueur` ; le champ ne distingue pas « en vigueur » de « applicable ». → ticket suivant (dates d'application par disposition), documenter la limite. — 🟢 minor, fit (hors diff, pré-existant).
- `mcp/tools.ts:113-116` : `normaliserNumero` jette le suffixe ; `getArticle` sur `20-1` rend l'article 20 (`numero: "20"`, `en_vigueur`), pas l'article 20-1. Pré-existant, hors diff, mais il affaiblit le critère 7 pour les articles suffixés (`20-1`, `22-1`, `124-1` à `124-5`). → ticket suivant. — 🟢 minor, fit.

## Round 2 · r-7b2e

- Date: 2026-11-13
- By: Beccariavf
- Diff: `6647b07...a9b23ed` (réparation des constats du round 1)
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 8/8 met, 0 unmet, 0 unverified at runtime ; 0,90 après la régression documentaire

### Findings

- `README.md:133`, `mcp/server.ts:41-42`, `aidd_docs/memory/architecture.md:38` : « les dates d'application échelonnées de l'AI Act vivent dans `date_debut` » est faux — les 293 unités portent `date_debut: 2024-08-01`, alors que l'article 113 du corpus fixe l'application de l'article 6(1) au 2027-08-02. Contredit la section « Limites assumées » de la spec, sur le point exact que le ticket doit éviter. — 🔴 blocking, conform.
- `aidd_docs/memory/testing.md:61` (« les six vocabulaires sources ») et `plan.md:27` (attribution `ABROGE`/`ANNULE`/`MODIFIE` à « LIL, CNIL » quand la LIL ne porte que `VIGUEUR`) : inventaire encore inexact. — 🟢 minor, conform.
- `tests/mcp.test.ts:1921-1947` : la preuve sur le corpus réel ne vérifie pas l'unicité de version, seulement l'absence de date postérieure à la consolidation. — 🟢 minor, code-health.
- `spec.md` critère 6 : « un article abrogé est rendu » ne dit pas que 54 articles abrogés de la LIL sont écartés à l'ingestion et n'ont aucun ticket. — 🟢 minor, fit.
- `mcp/tools.ts:113-116` : `normaliserNumero` jette le suffixe (`20-1` rend l'article 20). Pré-existant, hors diff, à ticket. — 🟢 minor, fit.
- `review.md` : le round 1 reste seul consigné. — 🟢 minor, rot.

### Réparé depuis

Les trois phrases sur `date_debut` sont corrigées (le corpus ne porte pas ces dates), l'inventaire est exact, le test vérifie l'unicité de version, le critère 6 dit « présent au corpus » et nomme les 54 articles écartés sans ticket. Code, tests et build inchangés par ces corrections.

## Round 3 · r-8c4d

- Date: 2026-11-13
- By: Beccariavf
- Diff: `9d53291` (réparation des constats du round 2)
- Axes: code, functional, relevancy, challenge
- Verdict: approved
- Score: 8/8 met, 0 unmet, 0 unverified at runtime ; confiance 0,92

### Criteria

- [x] 1. `statut_application` sur les trois sorties, une des sept valeurs — `mcp/tools.ts:82,98,131,136,289,525-531,702-706` ; rendus réels RGPD 17, LIL 1, SAN-2026-015, CNILTEXT000017653821 (`ANNULE` → `abroge`), CNILTEXT000017654669 (`MODIFIE` → `inconnu`).
- [x] 2. `statut` source jamais réécrit — `VIGUEUR`, `ABROGE`, `ANNULE`, `finale`, `Arrêt de la Cour` restent lisibles.
- [x] 3. Table par corpus, `ce`/`cc`/`cjue` → `rendue` quel que soit le statut source, priorité du statut sans effet bornée à `cnil`/`cepd` — `mcp/corpus/statut.ts:84-116` ; `tests/statut.test.ts:45-72`.
- [x] 4. Valeur non reconnue → `inconnu`, dont `MODIFIE` et une ligne directrice CEPD non finale — `tests/statut.test.ts:63-72`.
- [x] 5. `propose` et `pendant` déclarés et testés sans corpus porteur — `tests/statut.test.ts:74-81`.
- [x] 6. Article abrogé présent au corpus → `abroge` avec ses dates — `tests/mcp.test.ts:1941-1959` ; les 54 articles abrogés de la LIL, écartés à l'ingestion, sont nommés au contrat et sans ticket.
- [x] 7. LIL : une seule version consolidée, prouvée sur le corpus réel (unicité de `numero`, statut `VIGUEUR`, aucune date postérieure à la consolidation) — `tests/mcp.test.ts:1921-1947`.
- [x] 8. Descriptions nommant le champ, l'interdit d'applicabilité et le statut source — `mcp/server.ts:36-44` ; `tests/mcp.test.ts:1001-1017` ; typecheck 0, 814 tests (813 ok, 1 skip), build 3 pages, `data/` intact.

### Challenge

- `en_vigueur` dit la force du document, pas l'applicabilité par disposition : l'article 6 de l'AI Act s'appliquera au 2027-08-02, une date que ni le champ ni `date_debut` ne portent. Limite documentée, ticket suivant sous #24.
- `rendue` ne dit pas si une décision est définitive ou frappée d'un recours ; la LIL n'a qu'une version (#46) ; `adoptee` ne dit pas si une doctrine a été remplacée.

### Findings restants

- `mcp/tools.ts:113-116` : `normaliserNumero` jette le suffixe (`20-1` rend l'article 20). Pré-existant, ticket suivant.
- Dates d'application par disposition de l'AI Act (art. 113) : ticket suivant sous #24.
- Ingestion des articles abrogés de la LIL (54 écartés) : documenté, ticket à ouvrir.
- Branche empilée sur #32 (PR #73) : la PR de #33 vise `feat/classement-documents-absents` jusqu'à la fusion.
