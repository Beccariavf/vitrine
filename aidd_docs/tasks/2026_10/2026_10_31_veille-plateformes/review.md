# Review: Matière Plateformes

- Rounds: 2
- Started: 2026-11-01

## Round 1 · r-9b3e

- Date: 2026-11-01
- By: Beccariavf
- Diff: `veille/matieres-piste...HEAD`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 19/28 met, 0 unmet, 9 unverified at runtime, 0 out of the diff

### Criteria

- [x] Phase 1 — le catalogue contient cinq matières et Plateformes porte ses instruments, termes et requêtes — `veille/themes.json:147`, `tests/themes.test.ts:162`
- [x] Phase 1 — `readThemes` valide cinq matières et `queries`, et refuse un catalogue de quatre — `veille/themes.ts:102`, `tests/themes.test.ts:55`
- Unverified at runtime: Phase 1 — l'outil local charge cinq matières et réenregistre `queries` — un passage dans `tools/parametres.html` le montrerait.
- [x] Phase 1 — DSA et DMA rattachent Plateformes, RGPD + DSA porte les deux matières, « plateforme » seule est rejetée — `tests/themes.test.ts:162`
- Unverified at runtime: Phase 1 — typecheck, tests et build passent, et la page rend cinq matières sans entrée Plateformes — aucun relevé de commande n'est annexé au plan.
- [x] Phase 2 — le parseur DMA rend trois entrées datées, sourcées et dédupliquées, avec `themes` vide — `tests/commission-dma.test.ts:14`
- [x] Phase 2 — `commission-dma` est dans `SOURCES`, porte Plateformes par défaut et son badge — `veille/main.ts:91`, `veille/themes.ts:174`, `src/lib/sources.ts:9`
- [x] Phase 2 — la fixture DMA couvre les publications, l'hôte, le XML invalide et le doublon — `tests/commission-dma.test.ts:38`
- Unverified at runtime: Phase 2 — typecheck et tests passent — aucun relevé de commande n'est annexé.
- [x] Phase 3 — `Source.page` lit la page, écarte les entrées non retenues, remplace le résumé et avertit sans bloquer — `veille/main.ts:237`, `tests/write.test.ts:592`
- [x] Phase 3 — le flux ARCOM ne garde que le français, Mym est retenue avec un résumé DSA, les fréquences sont écartées et l'hôte est contrôlé — `tests/arcom.test.ts:19`
- [x] Phase 3 — `arcom` est dans `SOURCES` avec `page`, son badge et sans matière par défaut — `veille/main.ts:105`, `src/lib/sources.ts:10`
- [x] Phase 3 — la passe simulée écrit une seule entrée ARCOM, la rattache à Plateformes et prend le résumé de la page — `tests/write.test.ts:565`
- Unverified at runtime: Phase 3 — typecheck et tests passent — aucun relevé de commande n'est annexé.
- [x] Phase 4 — `themeQueries` rend les deux requêtes de Plateformes et le premier terme des autres matières — `veille/themes.ts:115`
- [x] Phase 4 — CETAT émet deux recherches, réutilise un jeton et déduplique — `tests/cetat.test.ts:94`
- [x] Phase 4 — Judilibre émet deux recherches et déduplique — `tests/judilibre.test.ts:97`
- Unverified at runtime: Phase 4 — une matière sans `queries` garde une recherche, cinq matières restent sous seize appels, et typecheck et tests passent — les tests de compte existent, mais les commandes n'ont pas de relevé annexé.
- [x] Phase 5 — la passe écrit les entrées et snapshots DMA et ARCOM, et le journal PISTE reste à treize appels — `data/entries/2025/`, `data/raw/4e/`, `data/usage/2026-10-31.json`
- [x] Phase 5 — le backfill conserve les matières et ajoute Plateformes aux entrées qui citent le DSA ou le DMA — `data/entries/2026/10/`
- Unverified at runtime: Phase 5 — la page rend cinq matières, les badges DMA et ARCOM, les publications et zéro `<script>` — un build rendu le montrerait.
- Unverified at runtime: Phase 5 — le sélecteur fonctionne en 1280 px et 375 px, le décochage masque et le recochage restaure, sans débordement ni erreur console — un parcours navigateur le montrerait.
- Unverified at runtime: Phase 5 — Plateformes est active, le build, le typecheck et les tests passent, et `git status` ne montre que les données attendues — aucun relevé de commande n'est annexé.
- [x] Phase 6 — `data.md` nomme ARCOM, le flux DMA, cinq matières, le défaut `commission-dma`, `queries` et le plafond réel — `aidd_docs/memory/data.md:14`
- [x] Phase 6 — `architecture.md`, `codebase-map.md` et `ecosystem.md` décrivent dix adaptateurs et cinq matières — `aidd_docs/memory/architecture.md:31`
- [x] Phase 6 — `project-brief.md` définit cinq matières et neuf autorités ; `design.md` décrit cinq pastilles et le repli mobile — `aidd_docs/memory/project-brief.md:20`
- [x] Phase 6 — `testing.md`, `README.md` et `tools/README.md` sont à jour et aucune mention de « quatre matières » ou « huit sources » ne subsiste — `aidd_docs/memory/testing.md:16`
- Unverified at runtime: Phase 6 — typecheck et tests passent — aucun relevé de commande n'est annexé.

### Findings

- `veille/sources/commission-dma.ts:1` : le parseur RSS du flux DMA duplique presque tout `commission.ts` ; un parseur RSS partagé paramétré par hôte et filtre éviterait deux copies à maintenir → extraire le socle commun — 🟢 minor, code-health
- `veille/sources/arcom.ts:49` : la liste `DSA_MARKERS` du filtre de page duplique les termes de `veille/themes.json` ; une évolution de la matière peut laisser le filtre en arrière → dériver les marqueurs d'une constante partagée — 🟢 minor, rot
- `veille/sources/arcom.ts:122` : sans `<main>`, le parseur retombe sur tout le HTML ; un lien « DSA » de la navigation pourrait retenir un communiqué hors sujet → refuser ou restreindre au conteneur d'article — 🟢 minor, error-handling
- `src/pages/veille/index.astro:330` : à 640 px et moins, les pastilles passent à `0.62rem` (environ 9,9 px), sous l'échelle `0.7rem` du reste des labels → garder `0.7rem` et réduire le padding, quitte à accepter trois lignes — 🟢 minor, frontend

## Round 2 · r-5c2a

- Date: 2026-11-01
- By: Beccariavf
- Diff: `veille/matieres-piste...HEAD`
- Axes: code, relevancy
- Verdict: approve
- Score: not scored
