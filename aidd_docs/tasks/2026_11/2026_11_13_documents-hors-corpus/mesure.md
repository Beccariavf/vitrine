---
date: 2026-11-13
corpus: cnil, ce, cc, cjue, cepd
---

# Relevé : les documents cités absents du corpus

Marquage `hors_corpus` des citations rendues par l'extracteur de `mcp/corpus/citations.ts`, relevé
sur tous les documents des cinq corpus de décisions. Ce relevé prouve que la mention apparaît partout
où un instrument absent est cité ; ce n'est pas une mesure de précision, et aucun seuil n'est publié.

## Commande

```
node mcp/eval/citations.ts <corpus> --taille 1
```

`<corpus>` vaut `cnil`, `ce`, `cc`, `cjue` ou `cepd` ; `rgpd`, `aiact` et `lil` sont refusés, leurs
documents n'étant pas des décisions. L'échantillonneur est déterministe : identifiants de documents
triés, puis pris à pas régulier. La ligne finale du bilan porte sur **tous** les documents du corpus,
pas seulement sur l'échantillon. Aucun fichier n'est écrit : la commande lit
`data/corpus/<corpus>/unites.jsonl` et les manifestes `data/corpus/<corpus>/manifest.json`, sans
réseau ni index. Deux exécutions rendent la même sortie — vérifié sur `cnil` le 2026-11-13
(`diff` vide) — et `git status --short data/` reste vide après le relevé.

## Dénominateur

L'unité est la **citation rendue** : un couple décision × instrument, tel que `search` et
`get_decision` le rendent. La présence est lue dans les manifestes du corpus réel : le RGPD
(`document: 32016R0679`) et la LIL (`text_id: LEGITEXT000006068624`) y sont, les six autres
instruments du périmètre n'y sont pas.

| Corpus | Documents lus | Citations rendues | Citations hors corpus |
| --- | --- | --- | --- |
| `cnil` | 3 245 | 2 853 | 160 |
| `ce` | 1 312 | 1 212 | 85 |
| `cc` | 352 | 164 | 71 |
| `cjue` | 166 | 180 | 79 |
| `cepd` | 36 | 50 | 15 |
| **Total** | **5 111** | **4 459** | **410** |

## Citations hors corpus par instrument

| Instrument | Document | `cnil` | `ce` | `cc` | `cjue` | `cepd` | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CPCE | `LEGITEXT000006070987` | 82 | 25 | 21 | 2 | 0 | **130** |
| code pénal | `LEGITEXT000006070719` | 39 | 7 | 16 | 1 | 0 | **63** |
| directive 95/46/CE | `31995L0046` | 22 | 22 | 5 | 38 | 10 | **97** |
| ePrivacy | `32002L0058` | 15 | 14 | 26 | 17 | 1 | **73** |
| 2016/680 | `32016L0680` | 2 | 17 | 3 | 10 | 2 | **34** |
| 2018/1725 | `32018R1725` | 0 | 0 | 0 | 11 | 2 | **13** |
| **Total** | | **160** | **85** | **71** | **79** | **15** | **410** |

Le RGPD et la LIL ne figurent pas dans ce tableau : leurs manifestes sont présents, aucune de leurs
citations n'est marquée hors corpus. Les six instruments absents du corpus apparaissent tous, sur au
moins deux corpus — 2018/1725 seulement en CJUE et au CEPD —, et chaque citation concernée porte son
identifiant de document, sa `url` officielle et aucune autre charge.

## Ce que le relevé prouve, et ce qu'il ne prouve pas

- Il prouve que le marquage couvre les 4 459 citations rendues par les cinq corpus de décisions :
  chaque citation d'un instrument absent est marquée, et le compte final n'est pas limité à
  l'échantillon relu.
- Il ne mesure pas la précision de l'extracteur : les 410 citations hors corpus sont des citations
  reconnues par #28, dont la justesse a été relevée sur 25 documents dans
  `aidd_docs/tasks/2026_11/2026_11_13_citations-decisions/mesure.md`. Une citation non reconnue
  n'apparaît ni dans les 4 459, ni dans les 410.
- Il ne dit rien des citations entre décisions : elles restent réservées à `#30`, qui doit fixer un
  seuil de précision avant de les exposer.
