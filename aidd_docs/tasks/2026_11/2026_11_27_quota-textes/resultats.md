# Quota de textes dans le top 5 — #171

Mesure du 2026-11-26 sur l'index réel `data/corpus/index/index.db` (178 359 unités, 1 024 dimensions,
`leoipulsar/harrier-0.6b` sur Ollama), en lecture seule. `PLACES_TEXTE = 2`, fixé a priori et non ajusté
sur le jeu.

## Commandes

```sh
D=aidd_docs/tasks/2026_11/2026_11_27_quota-textes/mesures
# jeu de #164, mode par défaut et global, par groupe
for c in $(awk -F, 'NR>1{print $5}' mcp/eval/questions-sources-publiees.csv | sort -u); do
  node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" --sans-filtre --detection --json > "$D/defaut-$c.json"
  node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" --sans-filtre --json > "$D/sans-$c.json"
done

# non-régression : après (quota actif) et avant (--sans-quota, même code, même index)
node mcp/eval/run.ts --questions mcp/eval/questions-cnil-v2.csv --split dev --sans-filtre --detection --json > "$D/apres-cnil-v2-dev.json"
node mcp/eval/run.ts --questions mcp/eval/questions-cnil-v2.csv --split dev --sans-filtre --detection --sans-quota --json > "$D/avant-cnil-v2-dev.json"
for j in ce cjue cc cnil-doctrine; do
  node mcp/eval/run.ts --questions "mcp/eval/questions-$j.csv" --sans-filtre --detection --json > "$D/apres-$j.json"
  node mcp/eval/run.ts --questions "mcp/eval/questions-$j.csv" --sans-filtre --detection --sans-quota --json > "$D/avant-$j.json"
done

# agrégats : un --avec/--sans par fichier, sans les defaut-hybride-* de #170
node mcp/eval/agreger.ts --sources mcp/eval/sources-publiees.json \
  $(for f in "$D"/defaut-*.json; do case "$(basename "$f")" in defaut-hybride-*) continue;; esac; printf -- '--avec %s ' "$f"; done) \
  $(for f in aidd_docs/tasks/2026_11/2026_11_26_mode-defaut-hybride/mesures/defaut-*.json; do case "$(basename "$f")" in defaut-hybride-*) continue;; esac; printf -- '--sans %s ' "$f"; done) \
  > "$D/agregats-defaut.md"

# même agrégat pour le mode global (avant = mesures de #164)
node mcp/eval/agreger.ts --sources mcp/eval/sources-publiees.json \
  $(for f in "$D"/sans-*.json; do printf -- '--avec %s ' "$f"; done) \
  $(for f in aidd_docs/tasks/2026_11/2026_11_26_eval-sources-publiees/mesures/sans-*.json; do printf -- '--sans %s ' "$f"; done) \
  > "$D/agregats-sans.md"

# latence des deux requêtes (globale k = 5, texte k = 50)
node mcp/eval/latence-quota.ts > "$D/latence.json"
```

« Avant » du jeu de #164 : mesures de #170 (`2026_11_26_mode-defaut-hybride/mesures/defaut-*.json`,
dense seul) et de #164 (`2026_11_26_eval-sources-publiees/mesures/sans-*.json`). Dans
`agregats-defaut.md` et `agregats-sans.md`, « Avec filtre corpus » est l'après et « Sans filtre corpus »
l'avant : le libellé de `agreger.ts` parle du filtre de corpus, pas du quota. Les tableaux consolidés sont
dans `mesures/agregats.md`.

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

## Ce que le quota insère

- Mode par défaut : 48 passages texte insérés sur 27 questions ; 7 sont la référence attendue, les 41
  autres sont d'autres articles ou annexes. Le gain de rappel (+7) vient de ces 7 passages.
- Mode global : 65 passages insérés sur 37 questions ; 8 sont la référence attendue.

## Non-régression (mode par défaut)

| jeu | avant | après | MRR avant | MRR après |
| --- | ---: | ---: | ---: | ---: |
| `questions-cnil-v2.csv --split dev` | 16/25 | 13/25 | 0,483 | 0,453 |
| `questions-ce.csv` | 3/12 | 3/12 | 0,194 | 0,194 |
| `questions-cjue.csv` | 3/10 | 2/10 | 0,220 | 0,200 |
| `questions-cc.csv` | 6/10 | 4/10 | 0,440 | 0,400 |
| `questions-cnil-doctrine.csv` | 3/10 | 2/10 | 0,153 | 0,133 |

Les pertes sont les questions de décisions ou de doctrine qui ne nomment ni juridiction ni décision
(« Quelle amende a visé… », « Quelle sanction a été prononcée… », « Le juge peut-il ordonner… », « Le droit
d'accès permet-il… », « Quel encadrement la CNIL recommande-t-elle… ») : le quota y remplace les deux
derniers passages non texte. La plus forte perte par jeu est de 3 questions, sous le plancher de six paires
discordantes de `compare.ts` : aucune n'est individuellement significative. `viseJurisprudence` reste la
liste explicite du plan ; ajouter « amende », « juge » ou les formes plurielles est une piste séparée, non
appliquée ici.

## Latence

`mesures/latence.json`, produit par `mcp/eval/latence-quota.ts` sur les 60 questions :

- seconde requête bornée aux corpus texte (`vec0`, `IN`, k = 50 soit 500 candidats, sans considérant) :
  médiane **109,7 ms**, p95 279,9 ms, min 105,2, max 324,4 ;
- première requête de `search` (k = 5 soit 50 candidats) : médiane 206,3 ms ; la seconde coûte donc
  ≈ +53 % quand elle tourne ;
- la seconde requête tourne sur 29 des 60 questions (27 insèrent au moins un passage), soit ≈ 53 ms en
  moyenne par requête sur le jeu.

Le temps total de `search` avant/après n'est pas exploitable : la variance d'Ollama dépasse l'écart.

## Limites

- Un top 5 déjà rempli de passages texte (4 considérants + 1 article) ne libère aucune place : seuls les
  passages non texte sont retirés, comme imposé. Deux questions du jeu sont dans ce cas
  (`cnil_doctrine`, `donnees`) ; le critère 1 reste tenu au sens littéral (les considérants sont des
  passages texte), mais la règle n'y gagne pas d'article.
- `niveau_confiance` est calculé avant le quota, comme imposé : il ne porte pas sur les passages réservés.
  La description de `search` le dit.
- Les filtres de l'appel (`nature`, dates, type et montant de sanction) suivent la seconde recherche : un
  passage réservé ne contredit jamais la demande.
- Les données des corpus ne sont pas modifiées : seuls les passages rendus changent.

## Validation

- `npm run typecheck`, `npm test` (1 525 tests : 1 524 passent, 1 sauté) et `npm run build` verts.
- `tests/quota-textes.test.ts` : insertion (t = 0, 1, 2 ; k = 5, k = 3, k = 2 ; rang 1 jamais remplacé ;
  pas de doublon ; considérant jamais réservé ; marquage des seuls insérés), `viseJurisprudence` (15
  positifs, 13 négatifs dont « article 9 du RGPD », « données de santé », « arrêt de travail », « décision
  n'était »), quota inactif avec `corpus`, `document`, document détecté, `numero`, mode lexical ou question
  visant une juridiction, quota actif en hybride et après rerank, seconde recherche réellement bornée
  (60 décisions devant les articles, hors fenêtre globale), filtre de date respecté, confiance identique
  avant/après. `tests/index.test.ts` vérifie `corpus_parmi` (`IN` de sqlite-vec 0.1.9) et `niveaux_exclus`.
- Critère 1 vérifié sur les 60 questions des deux modes : une seule question sous deux passages texte, « Le
  Conseil d'État a-t-il annulé le décret… », exclue par le critère 3.
