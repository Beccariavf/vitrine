# Review: Références CNIL

- Rounds: 2
- Started: 2026-10-31

## Round 1 · r-7a1c

- Date: 2026-10-31
- By: Beccariavf
- Diff: `da54b41...ef97d2d` plus the working tree (`run.md` untracked)
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 12/13 met, 0 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] Phase 1.1 — FNAC exact, alias canonical, `L. 34-5 et suivants` kept — `tests/references.test.ts:78-154`, `tests/cnil-page.test.ts:11-15`; `npm test` 119/119.
- [x] Phase 1.2 — only the target section, entities decoded, other blocks ignored, `[]` without throwing — `veille/sources/cnil.ts:70-105`; `tests/cnil-page.test.ts:11-40`.
- [x] Phase 1.3 — four fixtures are reduced real captures with original classes/quotes — `tests/fixtures/cnil/page-*.html`; their `li` texts match the committed raw snapshots' sections.
- [x] Phase 1.4 — spec cases covered; CJUE expectations untouched — `git diff` is additions only in `tests/references.test.ts`; `npm test`.
- [x] Phase 2.1 — optional `Source.references`; CNIL sets it, CJUE does not — `veille/main.ts:26-30,34-47`.
- [x] Phase 2.2 — FNAC fills references and writes a snapshot; failed page yields `[]` + warning without rejecting — `veille/main.ts:120-152`; `tests/write.test.ts:417-499`.
- [x] Phase 2.3 — `writeRaw` writes `.xml`/`.html`; CLI exposes warnings and pagePaths — `veille/write.ts:51-55`; `veille/main.ts:61-72,194-203`; `tests/write.test.ts:500-518`.
- [x] Phase 2.4 — FNAC, failure, no-section, CJUE and existing flow tests pass — `npm test` 119/119.
- [x] Phase 3.1 — FNAC exact, four `.html` snapshots, other CNIL entries `[]` — `data/entries/2026/10/1fb831fb8c3243d4.json:8` and the other three; re-parsing the committed snapshots reproduces the references; live lunettes/vos-droits pages have no target section.
- [x] Phase 3.2 — `npm test` fails if the FNAC reference disappears or a no-section entry gets one — `tests/entries.test.ts:92-108`.
- [x] Phase 3.3 — tag on card and line, CJUE tags remain, no `<script>`, 375 px — `run.md:15-18` (recorded on `ef97d2d`); built `dist/veille/index.html` contains the FNAC string twice and zero `<script>`.
- [x] Phase 3.4 — docs and `veille/types.ts` describe the new behavior — `aidd_docs/memory/architecture.md:35-36`, `data.md:29-32,42-43`, `codebase-map.md:18`, `testing.md:11-14`, `veille/types.ts:18`; task-level omissions logged as finding 3.
- Unverified at runtime: Phase 3.5 — typecheck, tests and build pass locally, but CI has not run: `origin` has only `main` (`git ls-remote`), and `run.md` records no CI. A CI run would show the workflow's typecheck/test/build on this branch.

### Findings

- `veille/main.ts:144-145` + `veille/write.ts:51-54` : full-page snapshots are content-addressed over volatile HTML. The committed FNAC snapshot differs from the live page in 28 lines, all `menu-toggler-*`/`form_build_id` tokens; the `ctn-gen-textes-references` block is byte-identical. Each CNIL cache variant therefore adds a new ~90–100 KB `.html` per referenced page (~386 KB per pass; the four pages are half of today's 780 KB `data/raw`). `aidd_docs/memory/data.md:41-44` documents CJUE churn only, not this. → Normalize volatile attributes before hashing/storing, snapshot only the reference section, or explicitly document/accept the churn with a retention policy — 🟡 major, `rot` (with a performance cost).
- `veille/main.ts:140` (label at `:99`) : the page warning duplicates the source/URL prefix. Output reads `cnil page <url>: cnil page fetch failed for <url>: …`. → Push the reason without re-prefixing, or have `fetchPage` produce a reason-only message — 🟢 minor, `error-handling`.
- `veille/sources/cnil.ts:70-76` : `htmlText` duplicates the decode/double-space/collapse pipeline of `veille/summary.ts:82-88`, and diverges on tag stripping (generic `<[^>]+>` vs the `TAG` whitelist that protects `1 < 2 > 0`). → Share a helper or document why page HTML must strip differently — 🟢 minor, `code-health`.
- `aidd_docs/memory/codebase-map.md:18` and `aidd_docs/memory/testing.md:12-14` : phase-3 tasks 4.3/4.4 are not fully applied. The map does not cite `extractCnilReferences`; testing.md records the page and failure tests but not the new committed-data FNAC/CEPD assertions. → Add the extractor name to the map and one committed-data test line — 🟢 minor, `conform`.

## Round 2 · r-2f9b

- Date: 2026-10-31
- By: Beccariavf
- Diff: `da54b41...94a50bd` plus the working tree (`run.md`)
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 12/13 met, 0 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] Phase 1.1 — FNAC exact, aliases canonical, `L. 34-5 et suivants` kept — `tests/references.test.ts:78-154`, `tests/cnil-page.test.ts:11-15`; `npm test` 120/120.
- [x] Phase 1.2 — only the target section, entities decoded, other blocks ignored, `[]` without throwing — `veille/sources/cnil.ts:81-107`; `tests/cnil-page.test.ts:11-40`.
- [x] Phase 1.3 — four fixtures are reduced real captures with original classes/quotes — `tests/fixtures/cnil/page-*.html`; their `li` texts match the committed raw snapshots' sections.
- [x] Phase 1.4 — spec cases covered; CJUE expectations untouched — `tests/references.test.ts` additions; `npm test` 120/120.
- [x] Phase 2.1 — optional `Source.references`; CNIL sets it, CJUE does not — `veille/main.ts:26-30,34-47`.
- [x] Phase 2.2 — FNAC fills references and writes a snapshot; failed page yields `[]` + warning without rejecting; unchanged references add no snapshot — `veille/main.ts:142-171`; `tests/write.test.ts:417-518`.
- [x] Phase 2.3 — `writeRaw` writes `.xml`/`.html`; CLI exposes warnings and pagePaths — `veille/write.ts:51-95`; `veille/main.ts:99-118,207-216`; `tests/write.test.ts:519-537`.
- [x] Phase 2.4 — FNAC, volatile-change, failure, no-section, CJUE and existing flow tests pass — `npm test` 120/120.
- [x] Phase 3.1 — FNAC exact, four `.html` snapshots, other CNIL entries `[]`; a second pass adds no snapshot — `data/entries/2026/10/1fb831fb8c3243d4.json:8`; `run.md:23-28`.
- [x] Phase 3.2 — `npm test` fails if the FNAC reference disappears or a no-section entry gets one — `tests/entries.test.ts:92-108`.
- [x] Phase 3.3 — tag on card and line, CJUE tags remain, no `<script>`, 375 px — `run.md:13-19` (recorded on `94a50bd`); built `/veille` shows the tag and zero `<script>`.
- [x] Phase 3.4 — docs, `veille/types.ts` and the map/testing gaps describe the new behavior — `aidd_docs/memory/architecture.md:35-36`, `data.md:29-32,42-44`, `codebase-map.md:18`, `testing.md:11-15`, `veille/types.ts:18`.
- Unverified at runtime: Phase 3.5 — typecheck, 120 tests and build pass locally in `run.md`; CI will run on the pushed branch. A CI run would show the workflow's typecheck/test/build on this head.
