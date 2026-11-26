# Quota de textes dans le top 5 — #171

Mesure du 2026-11-26 sur l'index réel `data/corpus/index/index.db` (178 359 unités, 1 024 dimensions,
`leoipulsar/harrier-0.6b` sur Ollama), en lecture seule. `PLACES_TEXTE = 2`, fixé a priori et non ajusté
sur le jeu.

## Méthode

- Jeu de #164 (`mcp/eval/questions-sources-publiees.csv`, 60 questions), par groupe `--corpus`, deux modes :
  par défaut (`--sans-filtre --detection`) et global (`--sans-filtre`).
- « Avant » : mesures de #170 (`2026_11_26_mode-defaut-hybride/mesures/defaut-*.json`) et de #164
  (`2026_11_26_eval-sources-publiees/mesures/sans-*.json`). « Après » : `mesures/defaut-*.json` et
  `mesures/sans-*.json`, mêmes commandes.
- Non-régression : `--sans-filtre --detection`, avant = même code avec `--sans-quota` (option de mesure qui
  désactive le quota via `SearchDeps.quota_texte`), après = quota actif, même index.
- Tableaux reproductibles : `mesures/agregats.md`, `mesures/agregats-defaut.md`, `mesures/agregats-sans.md`
  (dans les deux derniers, « Avec filtre corpus » est l'après et « Sans filtre corpus » l'avant : le libellé
  de `agreger.ts` parle du filtre de corpus, pas du quota).

## Jeu de #164, mode par défaut

| champ | avant | après |
| --- | ---: | ---: |
| données personnelles | 6/20 | 10/20 |
| données non personnelles | 7/15 | 8/15 |
| IA | 7/15 | 8/15 |
| santé | 7/10 | 7/10 |
| **textes seuls** | **19/42** | **26/42** |
| doctrine | 1/7 | 0/7 |
| décisions | 7/11 | 7/11 |
| **total** | **27/60** (MRR 0,346) | **33/60** (MRR 0,370) |

MRR des textes seuls : 0,351 → 0,389.

## Jeu de #164, global sans détection

| champ | avant | après |
| --- | ---: | ---: |
| données personnelles | 7/20 | 11/20 |
| données non personnelles | 7/15 | 8/15 |
| IA | 7/15 | 9/15 |
| santé | 8/10 | 8/10 |
| **textes seuls** | **19/42** | **27/42** |
| doctrine | 3/7 | 2/7 |
| décisions | 7/11 | 7/11 |
| **total** | **29/60** (MRR 0,359) | **36/60** (MRR 0,386) |

MRR des textes seuls : 0,321 → 0,365.

## Non-régression (mode par défaut)

| jeu | avant | après | MRR avant | MRR après |
| --- | ---: | ---: | ---: | ---: |
| `questions-cnil-v2.csv --split dev` | 16/25 | 13/25 | 0,483 | 0,453 |
| `questions-ce.csv` | 3/12 | 3/12 | 0,194 | 0,194 |
| `questions-cjue.csv` | 3/10 | 2/10 | 0,220 | 0,200 |
| `questions-cc.csv` | 6/10 | 4/10 | 0,440 | 0,400 |
| `questions-cnil-doctrine.csv` | 3/10 | 2/10 | 0,153 | 0,133 |

Les pertes sont les questions de décisions ou de doctrine qui ne nomment ni juridiction ni décision
(« Quelle amende a visé… », « Le juge peut-il ordonner… », « Le droit d'accès permet-il… ») : le quota y
remplace les deux derniers passages non texte, comme prévu. `viseJurisprudence` reste la liste explicite du
plan ; l'étendre (« amende », « juge ») est une piste séparée, non appliquée ici.

## Latence

- Seconde recherche bornée aux corpus texte (`vec0`, `IN`, 50 candidats) : médiane **105,8 ms**, p95 109,7 ms
  sur les 60 questions.
- Le quota se déclenche sur 27/60 questions en mode par défaut ; coût moyen rapporté au jeu ≈ **48 ms** par
  requête.
- Delta du temps total de `search` avant/après : médiane 0,8 ms, total négatif — dominé par la variance
  d'Ollama, non exploitable. La première recherche globale mesure 258 ms en médiane.

## Validation

- `npm run typecheck`, `npm test` (1 517 tests) et `npm run build` verts.
- `tests/quota-textes.test.ts` : insertion (t = 0, 1, 2 ; k = 5, k = 2 ; rang 1 jamais remplacé ; pas de
  doublon ; marquage des seuls insérés), `viseJurisprudence` (15 positifs, 13 négatifs dont « article 9 du
  RGPD », « données de santé », « arrêt de travail », « décision n'était »), quota inactif avec `corpus`,
  `document`, document détecté, numéro, lexical, question visant une juridiction, et confiance identique
  avant/après. `tests/index.test.ts` vérifie `corpus_parmi` (`IN` de sqlite-vec 0.1.9) et `niveaux_exclus`.
- Critère 1 vérifié sur les 60 questions des deux modes : une seule question sous deux passages texte, « Le
  Conseil d'État a-t-il annulé le décret… », exclue par le critère 3.
