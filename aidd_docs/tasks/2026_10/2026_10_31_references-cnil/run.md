# Run record — références CNIL

- Date: 2026-10-31
- Head: `94a50bd` (`feat/references-cnil`)
- Code tested: the references implementation, the review fixes and the regenerated data.

## Commands

- `npm run typecheck` → OK
- `npm test` → 120 tests, 120 pass, 0 fail
- `npm run build` → OK, 2 pages

## Browser

- `/veille` at 1000 px: the FNAC card shows `Loi Informatique et Libertés · art. 82`; the CJUE tag is still present; `scrollWidth` 985, no overflow.
- List view: the FNAC line shows the same tag.
- 375 px: `innerWidth = 375`, `clientWidth = 360` (scrollbar), `scrollWidth = 360`, no element beyond the viewport; screenshot checked.
- `document.querySelectorAll("script").length` → 0.

## Data

- FNAC entry: `references: ["Loi Informatique et Libertés · art. 82"]`.
- Four CNIL entries carry references: FNAC, Google, webinaire, reconstitution.
- Four `.html` snapshots exist in `data/raw/` for those pages.
- CEPD entry: `references: []`.
- A second real pass kept the four `.html` snapshots unchanged and changed no CNIL entry: volatile page tokens no longer create new snapshots.
- CJUE entry and its references are unchanged; its raw `.xml` snapshot can vary with the feed.
