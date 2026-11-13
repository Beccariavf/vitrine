# Review: Identité polychrome : la façade est le corpus

- Rounds: 1
- Started: 2026-11-13

## Round 1 · r-7c1e

- Date: 2026-11-13
- By: Beccariavf
- Diff: `67cf39a...010716e`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 12/14 met, 0 unmet, 2 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `global.css` porte vert, béton sombre, pierre — src/styles/global.css:16-19
- [x] P1.2 build passe ; un seul `.woff2` Archivo (latin, 90 ko) chargé ; aucune URL externe — `npm run build` ok ; `performance` à 1 280 px : `archivo-latin-wdth-normal.woff2` seul
- [x] P1.3 « VITRINE » sans tiret bas, en police de titre — dist/index.html, src/layouts/Base.astro:42
- [x] P1.4 `npm test` passe (732 pass, 0 fail, 1 skipped) ; `#3a7d44` échoue en nommant la paire — tests/contrastes.test.ts:23-26
- [x] P1.5 `design.md` sans « Aucune web font », nomme Archivo, vert, béton sombre, pierre — aidd_docs/memory/design.md:13
- [x] P2.1 dix-huit identifiants classés, inconnu en `autre` — tests/familles.test.ts
- [x] P2.2 `commission-dma` 30/30 `bg-green`, `cnil` 16/16 `bg-red` ; 3 pastilles pour 3 publications — dist/veille/index.html, dist/index.html
- [x] P2.3 `design.md` décrit les familles, plus de cycle — grep « cycle » vide
- [x] P3.1 `etagesFacade(272)=3`, `(29299)=5`, `(0)=1` — tests/corpus-site.test.ts:96-106
- [x] P3.2 façade à huit libellés, `aria-label` avec volumes ; deux builds identiques — shasum identique après rebuild
- [x] P3.3 sans démo, hero en une colonne ; `scrollWidth == clientWidth` à 375 et 1 280 px ; pied de page béton sombre — src/pages/index.astro:22-23, navigateur
- [x] P3.4 mémoire à jour ; typecheck, test, build passent
- Unverified at runtime: P1.2 « capture comparée à la référence » — aucune capture de référence enregistrée à côté du plan
- Unverified at runtime: P3.3 à 1 440 px avec barres de défilement classiques — seuls 375 et 1 280 px observés ici

### Findings

- `src/components/Facade.astro:56` : nombre affiché sans unité ; sur `/connecteur` il côtoie le tableau « Documents » (CJUE 16 916 au-dessus de 166 ; CEPD 5 443 pour 36) : un juriste lit 16 916 arrêts. La hauteur mesure le découpage en fragments, pas la couverture → nommer l'unité sous chaque colonne (« 16 916 fragments », « 272 articles et considérants ») ou afficher les documents, et l'écrire dans la légende — 🟡 major, fit
- `src/lib/corpus.ts:53,62` : `ETAGES_MIN` exporté sans lecteur externe, et `Math.max(ETAGES_MIN, …)` inatteignable après la garde `unites > 1` → garder la constante privée et retirer le `Math.max` — 🟢 minor, code-health
- `src/pages/index.astro:107,112` : `familleDeSource(entry.source)` calculé deux fois par publication → une variable locale, comme dans la veille — 🟢 minor, code-health
