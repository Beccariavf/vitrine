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
