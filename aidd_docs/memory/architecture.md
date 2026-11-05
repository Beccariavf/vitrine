# Architecture

La forme technique macro : la stack, comment les pièces s'articulent, et les décisions derrière. Pointer vers le code, ne pas le recopier.

## Stack

- TypeScript sur Node 24, exécuté par type stripping natif : aucun build step pour le pipeline.
- Astro en rendu statique, Tailwind pour le style. Aucune intégration de framework front ; la recherche viendra plus tard.
- Aucune base de données pour le site ni le pipeline, aucun serveur permanent : une passe hebdomadaire manuelle produit des fichiers, le site les rend. Le MCP local ajoute SQLite + `sqlite-vec` + FTS5 dans `data/corpus/index/`, un dérivé non commité.

## How it fits together

```mermaid
flowchart LR
  SRC["Sources officielles"] --> A["Adaptateurs"]
  A --> N["Normalisation"]
  N --> R["Snapshots bruts"]
  N --> U["Déduplication par hash"]
  U --> F["Diff"]
  F --> P["Publication"]
  P --> E["data/entries"]
  E --> S["Site Astro"]
  S --> W["Cloudflare Workers (cible, non configurée)"]
  CELLAR["CELLAR · EUR-Lex"] --> C["data/corpus"]
  C --> MCP["mcp/ — corpus + index + outils"]
  MCP --> IDX["data/corpus/index — dérivé, non commité"]
```

## Key decisions

- Static-first : la passe est manuelle et hebdomadaire ; aucun cron n'est configuré ; le site n'est pas déployé, voir `deployment.md`.
- `mcp/` est une quatrième zone, distincte du pipeline et du site : corpus, index, outils, transport stdio. `veille/` et `src/` sont inchangés ; seuls `writeRaw` de `veille/write.ts` et le type `FetchLike` de `veille/fetch.ts` sont réutilisés.
- `npm run corpus:build` lit tous les descripteurs `mcp/corpus/*.json` et écrit `data/corpus/<corpus>/` (RGPD et AI Act) ; `--document <corpus>` n'en construit qu'un. `npm run corpus:index` construit `data/corpus/index/index.db`, jamais commité. `npm run mcp` ouvre le serveur sur stdio.
- L'index est incrémental : chaque unité porte une empreinte `sha256` du modèle, de la dimension et du passage contextualisé. La construction lit `ref → rowid, empreinte`, n'embarque que les unités ajoutées ou modifiées, supprime les absentes et laisse les autres vecteurs intacts. Le même delta met à jour `unites`, `vec_unites` et `fts_unites` dans une seule transaction ; les nouveaux `rowid` suivent le maximum existant, jamais la position ; un changement de modèle ou de dimension, ou un index sans table lexicale, reconstruit l'index complet.
- La table FTS5 `fts_unites` (même `rowid`, tokenizer `unicode61 remove_diacritics 2`) porte la voie lexicale. `rechercheHybride` prend jusqu'à 50 candidats denses et jusqu'à 50 lexicaux (davantage si `k` dépasse 50 ; sous filtre document, la voie dense interroge l'index global avant de filtrer et peut en rendre moins), applique la bande article à l'ordre dense, puis fusionne par `1 / (60 + rang)` ; la distance rendue reste la distance dense brute. Mesurée sur `dev` v2, elle gagne une question au top 5 mais perd 26,3 points de top 1 et 0,128 de MRR : elle n'est pas la voie par défaut, `search` reste dense, l'hybride se mesure avec `--recherche hybride` (`aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-v2.md`).
- L'évaluation est filtrée par document : le préfixe des `sources_attendues` (avant `#`) donne le document du jeu, refusé s'il en mélange deux, puis passé à `search(..., { document })`. `dev` et `test` voient ainsi la même tâche malgré deux corpus dans l'index. Le split `test` exige `--mesurer-test` et un marqueur commité (`questions-v2.test-consomme.json`) refuse la seconde mesure. Le marqueur est une trace de consommation, pas une preuve d'exécution : supprimer le fichier ou copier le CSV sous un autre nom contourne le garde ; c'est délibéré, il n'arrête qu'une seconde exécution accidentelle.
- `search` honore un document nommé dans la question quand `document` est absent : « RGPD » et « règlement général sur la protection des données » désignent `32016R0679`, « AI Act », « règlement sur l'intelligence artificielle » et « règlement IA » désignent `32024R1689` ; deux corpus nommés n'infèrent rien, et `document` fourni reste prioritaire. Le document inféré filtre le court-circuit exact et la recherche sémantique ; un numéro absent de ce document est refusé explicitement, jamais servi depuis l'autre corpus. Sans document nommé, un numéro présent dans les deux corpus reste rendu avec son ambiguïté `incertain`.
- Le classement d'une recherche ajoute `BANDE_ARTICLE = 0,02` à la similarité d'un article, sans changer la similarité rendue : à pertinence comparable, l'article passe devant le considérant, qui reste rendu et étiqueté. La bande est mesurée sur les questions `dev` dans `aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md` ; `0,02` est retenue pour rester minimale.
- L'embedding reste local : Ollama sur `127.0.0.1:11434` avec `qwen3-embedding:0.6b`, appelé seulement à l'indexation et à la requête. Le site ne lit aucune API.
- Git est la base : snapshots bruts + hash + JSON commités ; l'index se met à jour par delta avec `npm run corpus:index`.
- `src/` est jetable : les données survivent à un changement de générateur.
- Un adaptateur par source, isolé dans `veille/sources/` : CNIL, CJUE, ANSSI, CEPD, ARCEP, Commission, Commission DMA, ARCOM, Conseil d'État (CETAT) et Cour de cassation (Judilibre) — dix adaptateurs pour neuf autorités.
- Le site ne lit aucune API au runtime : il lit `data/`.
- Une panne de source n'emporte pas les autres : les écritures réussies restent, la passe échoue avec un message nommant la source.
- Le catalogue `veille/themes.json` est la seule configuration de sélection ; cinq matières actives, lues par le pipeline et le site. Le rattachement est stocké sur chaque entrée ; le site filtre au build, aucune purge.
- `Entry.references` porte les instruments et articles cités : titre officiel pour les arrêts CJUE, section « Textes de référence » de la page liée pour les actualités CNIL, texte intégral de la décision pour le Conseil d'État et pour la Cour de cassation.
- Une source API peut enrichir ses entrées retenues après le rattachement (`ApiResult.enrich`) : la Cour de cassation y lit le visa de la décision, le Conseil d'État le texte intégral par `/consult/juri`, un appel par décision, et n'exposent que les instruments des matières de l'entrée. Une entrée déjà écrite n'est pas rappelée ; une erreur ou un budget épuisé diffère l'entrée, relue à la passe suivante ; `[]` ne signifie qu'un texte sans article. Le Conseil d'État passe avant la Cour de cassation dans la passe et lui réserve six appels de recherche (`JUDILIBRE_SEARCH_RESERVE`).
- `Entry.themes` porte les matières calculées à l'ingestion : instruments cités d'abord, termes de repli ensuite, défauts de source pour CNIL, CEPD, ANSSI et Commission DMA ; les sources API ne pré-remplissent pas la matière, sauf Judilibre qui conserve la matière de sa requête comme indice pour ne pas perdre une décision que seul son visa rattache.
- Les sources PISTE (Conseil d'État, Cour de cassation) utilisent un jeton OAuth ou un `KeyId`, un plafond de 16 appels par passe et un journal dans `data/usage/`.
- Une page CNIL en échec laisse l'entrée publiée avec `references: []` et un avertissement ; les pages dont les références sont retenues sont conservées en snapshot HTML.
- Une source à flux peut enrichir chaque entrée par sa page (`Source.page`) : l'ARCOM y filtre le DSA et y prend son résumé, la Commission y prend la version française officielle ; une page en panne écarte l'entrée et avertit, sauf si la source déclare la page facultative.
- Les secrets PISTE restent dans `.env` ; `.gitignore`, le hook pre-commit et la CI refusent leur versionnement.

## Gotchas

- Les quotas PISTE ne sont pas publics et l'API n'offre qu'une cible de disponibilité de 95 %/jour.
- Sans Ollama et sans `qwen3-embedding:0.6b`, `corpus:index`, `mcp:smoke` et la recherche sémantique échouent ; le message nomme `ollama pull qwen3-embedding:0.6b`. La lecture d'un article exact (« article 17 ») reste servie sans index ni modèle.
- Le serveur MCP journalise sur `stderr` uniquement : `stdout` porte le protocole JSON-RPC.
- Aucun workflow planifié n'existe : une passe oubliée laisse les données en l'état.
