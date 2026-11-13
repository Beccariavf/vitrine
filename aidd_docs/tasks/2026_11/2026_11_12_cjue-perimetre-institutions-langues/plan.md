---
objective: "La CJUE indexe les décisions du CEPD (EDPS) contre les institutions, notion CELLAR 2.04, et lit le XHTML en français puis en anglais — C-413/23 P compris."
status: pending
---

# Plan: Élargir le corpus CJUE au contentieux du CEPD et au XHTML anglais

Source: conversation du 2026-11-12 — « il faut couvrir les décisions CEPD (option 2) et si jamais les décisions ne sont pas en français je pense que finalement on les intègres ».

## Phases

| #   | Phase           | File                         | Depends on |
| --- | --------------- | ---------------------------- | ---------- |
| 1   | notion-2.04     | [`phase-1.md`](./phase-1.md) | none       |
| 2   | repli-anglais   | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | corpus-et-docs  | [`phase-3.md`](./phase-3.md) | 1, 2       |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| `https://publications.europa.eu/webapi/rdf/sparql` | Mesuré le 2026-11-12 hors dépôt, non rejouable (ni requête ni réponse conservées) : `62023CJ0413` existe, daté 2025-09-04, porteur de `fd_578/2.04` et `4.12.01` seulement — ni matière `PDON`, ni notion `4.11.01` : le trou vient du classement CELLAR. 56 décisions `CJ`/`TJ` portent `2.04` depuis 2014 : 9 déjà au corpus, 15 joignables en XHTML, 32 sans XHTML dont 4 déjà écartées ; 47 manquaient. La liste élargie attend donc 166 décisions et 55 exclusions `xhtml_absent` (27 héritées + 28 nouvelles). La phase 3 fait foi sur les chiffres observés et explique tout écart. |
| `https://publications.europa.eu/resource/celex/62023CJ0413` | Mesuré le 2026-11-12 hors dépôt, non rejouable : XHTML servi en `fra` (200, 164 303 o) et en `eng` (200, 154 623 o) ; la version française existe, seule la sélection l'écartait. Les classes `sum-title-1`, `index` et `count id="pointN"` sont identiques dans les deux langues ; seuls la date, le numéro d'affaire et le dispositif diffèrent. Le test de la phase 2 le prouve sur la fixture anglaise. |
| `https://publications.europa.eu/resource/celex/62015TJ0684` et les 26 autres CELEX de `couverture.documents_ecartes` | Mesuré le 2026-11-12 hors dépôt, non rejouable : interrogés un par un en `fra` puis en `eng` avec `Accept: application/xhtml+xml` : 404 partout, et 404 aussi avec `Accept: application/pdf`. Aucune manifestation téléchargeable à cette adresse : ce n'est pas un défaut de langue. |
| `https://curia.europa.eu/jcms/upload/docs/application/pdf/2025-09/cp250107en.pdf` | Mesuré le 2026-11-12 hors dépôt, non rejouable : confirme la date (4 septembre 2025) et l'objet de C-413/23 P, EDPS c. SRB. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Observé : CELLAR répond (SPARQL et XHTML) ; `npm run cjue:sync` exige le réseau et `npm run corpus:index` exige Ollama, non vérifié ici. | 3 |
| regression | Moyen : `tests/cjue-corpus.test.ts` couvre liste, découpage, synchronisation et corpus commité ; `MOTIFS_DURABLES` (`mcp/corpus/veille.ts`, non exporté) dépend du renommage, et `tests/corpus-sync.test.ts` ne couvre aujourd'hui que `avis_avocat_general` et `echec_telechargement` — le cas `xhtml_absent` → `ecarte` est une couverture nouvelle, pas une dépendance. `parse.ts` sert aussi les entrées de la veille. Filet : phases 1 et 2 étendent ces tests avant la resynchronisation. | 1, 2 |
| architecture | Aucun lien nouveau : une sélection SPARQL élargie, un téléchargement essayé en deux langues, une URL EUR-Lex par langue. | 1, 2 |
| documentation | `aidd_docs/memory/data.md` §Corpus CJUE, `aidd_docs/memory/architecture.md` (huit corpus et `corpus/cjue/`), `aidd_docs/memory/codebase-map.md` (deux entrées), `aidd_docs/memory/testing.md` (deux entrées), `README.md` §corpus, `aidd_docs/tasks/2026_11/2026_11_11_corpus-cassation-cjue/coverage.md` (tableau et détail `cjue`). | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `data/` n'est jamais édité à la main | le corpus CJUE ne change qu'en lançant `npm run cjue:sync`. |
| Le corpus n'est écrit qu'après validation de toutes ses unités | une décision illisible ne doit pas amputer le corpus existant. |
| Un CELEX listé dans `couverture.documents_ecartes` est écarté et ne relance pas la CJUE | renommer le motif doit conserver cette durabilité, y compris pour les marqueurs déjà écrits sous `data/raw/cjue/`. |
| Chaque source a sa fixture et son test | le repli anglais et la notion 2.04 arrivent avec leurs cas. |
| `npm run typecheck` avant commit, `npm test` avant push | `mcp/` et `tests/` sont dans le périmètre typé. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Un seul XHTML par document, dans la première langue disponible (`fra`, puis `eng`) | l'index porte un texte par unité ; deux langues dupliqueraient les `ref` et fausseraient la recherche. |
| Déduire la langue du texte capturé (mois, « On those grounds »), sans fichier annexe | le cache ne porte qu'un XHTML par CELEX ; une provenance déduite garde la seconde passe idempotente et le manifeste stable. |
| Nommer le motif `xhtml_absent`, en continuant de lire `version_francaise_absente` | mesuré : les 32 documents `2.04` sans XHTML répondent 404 dans toutes les langues ; l'ancien nom décrit un fait faux, mais les marqueurs existants doivent rester durables. |
| Une coupure réseau ou un 5xx n'écrit jamais de marqueur durable | sans cette règle, un `fra` en panne suivi d'un `eng` en 404 écarterait définitivement une décision disponible en français. |
| L'URL EUR-Lex suit la langue du texte (`/FR/` ou `/EN/`) | une unité anglaise ne doit pas renvoyer vers une page française vide. |
| Porter la langue dans `chemin`, pas dans une colonne d'index | l'index n'a pas de colonne langue ; `chemin` est déjà rendu par `search` et suffit à signaler « texte anglais ». |
| Un `429` interrompt la synchronisation sans écrire de marqueur | le quota CELLAR est transitoire ; le confondre avec `echec_telechargement` le rendrait invisible et rejouerait tous les téléchargements à chaque passe. |
| Ne pas prédire `documents_lus` | il compte aussi les exclusions nouvelles (`avis_avocat_general`, `autre_type`) que la requête `2.04` n'a pas dénombrées ; la phase 3 constate et explique l'écart au lieu de le figer. |
| Pas de repli PDF | mesuré : `Accept: application/pdf` répond aussi 404 sur les documents écartés ; il faudrait une autre source, hors de ce plan. |
| Divergence préexistante de `documents_lus` sur une entrée de veille écartée au classement | `sync.ts` compte l'écart sans compter l'entrée ; reproduit par `tests/cjue-corpus.test.ts` (« conclusions d'avocat général »). Hors périmètre, déclarée pour ne pas la confondre avec une régression du repli anglais. |
