# Review: accueil-organisation

- Rounds: 1
- Started: 2026-11-13

## Round 1 · r-7c3e

- Date: 2026-11-13
- By: Beccariavf
- Diff: `d81fe66...b3c0050`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 9/11 met, 1 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 `sourcesCorpus` rend les 8 libellés dans l'ordre, `[]` sur racine vide — `tests/corpus-site.test.ts:30`, `:48` ; npm test 709 pass / 0 fail
- [x] P1.2 `dist/index.html` : promesse, `href="/veille"`, 8 libellés, 3 publications, ni Plugin / pipeline.log / 0 ko / 0 € — grep dist : 3 `data-publication`, termes interdits à 0
- [x] P1.3 « Valentin Fouich » et « Outil d'aide à la recherche » sur index et veille — `src/layouts/Base.astro`, grep dist
- [x] P1.4 Quatre fichiers de mémoire nomment `src/lib/corpus.ts` — grep `aidd_docs/memory/*.md`
- [ ] P2.1 `src/demo/demo.json` contient deux réponses réelles — fichier absent (capture manuelle laissée à l'auteur, assumée)
- [x] P2.2 Quatre cas de `tests/demo.test.ts` — `tests/demo.test.ts:46-64`
- Unverified at runtime: P2.3 avec le fichier, `dist/index.html` contient la question et les URL — aucun build avec capture ; la branche sans fichier passe (build 3 pages)
- [x] P2.4 Trois fichiers de mémoire nomment `src/lib/demo.ts` — grep
- [x] P3.1 `dist/connecteur/index.html` : « En préparation », 8 `data-collection`, `href="/veille"`, GitHub, aucun terme interdit, `aria-current="page"` — grep dist
- [x] P3.2 Bouton « Découvrir le connecteur » vers `/connecteur`, lien `/veille`, nav « Connecteur » sur index et veille — grep dist
- [x] P3.3 `design.md` et `codebase-map.md` nomment `/connecteur` — grep

### Findings

- `src/pages/connecteur.astro:154` : « La veille publie déjà les nouveautés des mêmes sources » est faux : la veille suit ANSSI, ARCOM, Commission/DMA (37 des 91 entrées) et aucun texte RGPD/AI Act/LIL → « La veille publie les nouveautés des autorités et juridictions du numérique, chacune liée à son texte officiel » — 🟡 major, fit
- `src/pages/index.astro:22` : la description « une veille juridique publiée depuis ces mêmes sources » porte la même inexactitude → aligner sur la formulation corrigée — 🟡 major, fit
- `src/pages/index.astro:64` : « À jour au » affiche la date la plus récente (11 nov.) au-dessus des 8 sources, alors que la CNIL est au 30 oct. et RGPD/AI Act sans date ; lu comme fraîcheur globale → « Dernière mise à jour le » ou la date la plus ancienne — 🟢 minor, fit (règle posée par le plan)
- `src/pages/connecteur.astro:110` : « ne couvre que le droit des données personnelles » alors que l'AI Act figure au tableau → « le droit des données personnelles et de l'IA » — 🟢 minor, rot
- `src/pages/connecteur.astro:11` : formateur de date identique à `index.astro:15` et `Demo.astro:13`, classe du bouton principal copiée de `index.astro:39` à `connecteur.astro:159` → acceptable à 3 pages, à extraire au prochain ajout — 🟢 minor, code-health
