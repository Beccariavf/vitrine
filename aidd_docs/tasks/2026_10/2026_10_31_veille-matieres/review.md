# Review: Veille par matière

- Rounds: 1
- Started: 2026-10-31

## Round 1 · r-4c1a

- Date: 2026-10-31
- By: Beccariavf
- Diff: `main...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 13/17 met, 0 unmet, 4 unverified at runtime, 0 out of the diff

### Criteria

- [x] Phase 1 — `Entry` porte `themes`, le catalogue contient quatre matières, le rattachement est testé. — `veille/types.ts:19`, `veille/themes.ts:165`, `tests/themes.test.ts`
- [x] Phase 1 — Le pipeline écrit les entrées rattachées et ignore celles sans matière. — `veille/main.ts:195`, `veille/sources/cjeu.ts:142`
- [x] Phase 1 — Les onze entrées historiques portent au moins une matière ; le backfill est idempotent. — `veille/backfill.ts`, `data/entries/2026/10/8da07efb6db3ce65.json`
- [x] Phase 1 — Le sélecteur masque les publications décochées, la phrase explique le geste, les pages restent sans JavaScript. — `src/pages/veille/index.astro:72`
- [x] Phase 2 — Une actualité CERT-FR est écrite avec date, résumé, URL et matière cybersécurité ; lien hors domaine refusé. — `veille/sources/anssi.ts`, `tests/anssi.test.ts`
- [x] Phase 2 — Une actualité CEPD est écrite avec date, résumé, URL et matière données personnelles. — `veille/sources/cepd.ts`, `tests/cepd.test.ts`
- Unverified at runtime: Phase 2 — les deux sources écrivent leur snapshot et une panne n'empêche pas l'autre — le run live l'a montré, mais aucun enregistrement n'est encore annexé.
- [x] Phase 3 — Deux décisions ARCEP ont deux identifiants distincts ; l'URL complète est conservée. — `veille/sources/arcep.ts`, `tests/arcep.test.ts`
- [x] Phase 3 — Les événements et consultations Commission sont ignorés ; les actualités sont écrites. — `veille/sources/commission.ts`, `tests/commission.test.ts`
- Unverified at runtime: Phase 3 — ARCEP et Commission n'écrivent que les entrées rattachées et gardent leur snapshot — vérifié à la main, pas encore enregistré.
- [x] Phase 4 — Le client PISTE réutilise le jeton, retente un 401, plafonne et journalise. — `veille/piste.ts`, `tests/piste.test.ts`
- [x] Phase 4 — Une décision CETAT citant le RGPD est écrite avec date, résumé et URL Légifrance. — `veille/sources/cetat.ts`, `tests/cetat.test.ts`
- [x] Phase 4 — Une décision Judilibre citant le RGPD est écrite avec date, résumé et URL Cour de cassation. — `veille/sources/judilibre.ts`, `tests/judilibre.test.ts`
- Unverified at runtime: Phase 4 — les snapshots JSON sont écrits et une panne PISTE n'empêche pas les flux RSS — le run live l'a montré, pas encore enregistré.
- [x] Phase 5 — Les mémoires décrivent les quatre matières, les huit sources, le contrat `themes` et les fenêtres PISTE. — `aidd_docs/memory/architecture.md`, `aidd_docs/memory/data.md`, `aidd_docs/memory/design.md`
- Unverified at runtime: Phase 5 — la démonstration `/veille` montre le sélecteur et les badges — vérifié à la main, la QA d'acceptation le consigne.
- Unverified at runtime: Phase 5 — typecheck, tests, build et CI passent — les trois commandes passent localement ; la CI n'a pas encore tourné sur ce commit.

### Findings

- `veille/sources/judilibre.ts:119` : une seule phrase par matière, donc une seule décision sur la fenêtre ; ajouter les sigles (RGPD, AI Act, NIS2, Data Act) dans une passe ultérieure — 🟢 minor, fit.
- `veille/sources/cetat.ts:24` : la première date `JJ/MM/AAAA` du titre est retenue ; une date dans un nom de partie fausserait la publication — 🟢 minor, code-health.
