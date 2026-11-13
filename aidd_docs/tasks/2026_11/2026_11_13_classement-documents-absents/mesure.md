---
date: 2026-11-13
corpus: cnil, ce, cc, cjue, cepd
---

# Mesure : le classement des documents hors corpus

Relevé réel du classement que `npm run corpus:sync` écrit dans `data/corpus/sync.json` et que
`etat_corpus` rend en lecture seule. Aucune promesse de précision n'est publiée : ce relevé compte
des citations reconnues, il ne dit pas si l'extracteur de #28 les reconnaît toutes ni si toutes
celles qu'il rend sont justes.

## Commande

```
node mcp/eval/citations.ts --classement
```

La commande lit `data/corpus/<corpus>/unites.jsonl` des cinq corpus de décisions et les manifestes,
calcule le classement par la même fonction que la synchronisation (`classementHorsCorpus`), et
n'écrit rien : ni rapport, ni index, ni cache. Vérifié après le relevé : `git status --short data/`
reste vide. Deux exécutions le même jour donnent la même sortie ; seule la date d'en-tête suit le
jour.

## Résultat

Corpus réel au 2026-11-13 :

```
classement des documents hors corpus au 2026-11-13 : 6 document(s), 410 citation(s)
CPCE (LEGITEXT000006070987) — absent : 130 citation(s) — CNIL 82, Conseil d'État 25, Cour de cassation 21, CJUE 2
directive 95/46/CE (31995L0046) — absent : 97 citation(s) — CJUE 38, CNIL 22, Conseil d'État 22, CEPD 10, Cour de cassation 5
ePrivacy (32002L0058) — absent : 73 citation(s) — Cour de cassation 26, CJUE 17, CNIL 15, Conseil d'État 14, CEPD 1
code pénal (LEGITEXT000006070719) — absent : 63 citation(s) — CNIL 39, Cour de cassation 16, Conseil d'État 7, CJUE 1
2016/680 (32016L0680) — absent : 34 citation(s) — Conseil d'État 17, CJUE 10, Cour de cassation 3, CEPD 2, CNIL 2
2018/1725 (32018R1725) — absent : 13 citation(s) — CJUE 11, CEPD 2
```

| Rang | Document | Libellé | Citations | CNIL | Conseil d'État | Cour de cassation | CJUE | CEPD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `LEGITEXT000006070987` | CPCE | 130 | 82 | 25 | 21 | 2 | 0 |
| 2 | `31995L0046` | directive 95/46/CE | 97 | 22 | 22 | 5 | 38 | 10 |
| 3 | `32002L0058` | ePrivacy | 73 | 15 | 14 | 26 | 17 | 1 |
| 4 | `LEGITEXT000006070719` | code pénal | 63 | 39 | 7 | 16 | 1 | 0 |
| 5 | `32016L0680` | 2016/680 | 34 | 2 | 17 | 3 | 10 | 2 |
| 6 | `32018R1725` | 2018/1725 | 13 | 0 | 0 | 0 | 11 | 2 |
| **Total** | | | **410** | **160** | **85** | **71** | **79** | **15** |

Deux instruments du catalogue n'y figurent pas parce qu'ils sont au corpus : le RGPD
(`data/corpus/rgpd/manifest.json`) et la loi 78-17 (`data/corpus/lil/manifest.json`). Le classement
ne porte que les documents absents, conformément au contrat : un document présent n'est pas un trou.

**Unité comptée : la citation rendue** (décision × instrument), le même dénominateur que la mesure
des citations de #28, qui compte 4 459 citations sur les mêmes cinq corpus. Les 410 citations hors
corpus sont donc 9,2 % de ce total ; les deux mesures restent comparables parce qu'elles comptent la
même chose.

Aucun document n'est déclaré `exclu` : le catalogue `INSTRUMENTS` n'exclut aucun de ses huit
instruments (tous sont au périmètre, #41 et #42). Le statut `exclu` n'est donc prouvé que par la
fonction pure, sous `tests/hors-corpus.test.ts`, et n'apparaît pas dans ce relevé.

## Ce que le relevé prouve et ne prouve pas

Il prouve que le classement se calcule sur le corpus réel, qu'il porte les six documents attendus,
que l'ordre décroissant est celui des citations et que les comptes par autorité somment au total de
chaque document (410 au total). Il prouve aussi que la commande n'écrit rien.

Il ne prouve pas la précision de l'extracteur de #28 : un document que l'extraction manque n'est pas
compté ici, et une citation fausse y serait comptée comme une vraie. Le classement hérite des
limites déclarées dans `aidd_docs/tasks/2026_11/2026_11_13_citations-decisions/mesure.md` (anaphore
au document, subdivisions d'articles non lues, formes anglaises non exercées sur un corpus anglais).

## Limites

- **Le classement ne hiérarchise pas une urgence.** Il compte les citations, pas la valeur juridique
  du texte manquant : l'ordre d'ajout au corpus (#24) reste une décision, pas une conséquence du
  rang.
- **La présence vient des manifestes.** Un corpus dont le manifeste ne porte ni `document` ni
  `text_id` verrait ses instruments comptés absents. Aucun des huit manifestes n'est dans ce cas au
  2026-11-13.
- **Aucune exclusion réelle.** Le catalogue n'exclut rien ; le cas `exclu` n'est couvert que par un
  ensemble d'exclusions synthétique dans les tests. Une exclusion future se déclarera au catalogue,
  elle ne se déduira jamais d'une date ni d'un manifeste.
- **Il ne mesure pas les citations entre décisions** (#30) : seuls les huit instruments du catalogue
  sont comptés, une décision qui en cite une autre n'entre dans aucun rang.
- **La fraîcheur n'est pas ici** (#34) : le bloc ne porte que sa date de calcul (`calcule_le`), pas
  l'âge du corpus.
- **Le bloc est daté par la passe.** Ce relevé est calculé à la date du 2026-11-13 sur le `data/`
  commité ce jour-là ; une passe ultérieure peut changer les comptes sans changer le code.
