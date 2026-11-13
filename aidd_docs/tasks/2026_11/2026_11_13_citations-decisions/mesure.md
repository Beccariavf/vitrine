---
date: 2026-11-13
corpus: cnil, ce, cc, cjue, cepd
---

# Mesure : les citations des décisions

Précision de l'extracteur de `mcp/corpus/citations.ts`, relevée sur 25 documents relus un par un.
Aucun seuil n'est publié : #30 fixe le seuil des citations entre décisions, cette mesure ne fait que
constater.

## Commande

```
node mcp/eval/citations.ts <corpus> --taille 5
```

L'échantillonneur est déterministe : identifiants de documents triés, puis pris à pas régulier
(`floor(rang × n / taille)`). Aucun choix manuel, aucune graine. Deux exécutions rendent la même
sortie — vérifié sur les cinq corpus le 2026-11-13. La commande n'écrit aucun fichier : elle lit
`data/corpus/<corpus>/unites.jsonl` et rend, pour chaque document, ses citations et le passage qui
les porte.

## Résultat

| Corpus | Documents relus | Documents avec ≥ 1 citation | Citations d'instrument relues | Entrées d'articles portées (non notées) | Justes (instrument) | Fausses (instrument) | Indécidables (instrument) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cnil` | 5 | 5 | 5 | 10 | 5 | 0 | 0 |
| `ce` | 5 | 3 | 3 | 5 | 3 | 0 | 0 |
| `cc` | 5 | 2 | 2 | 5 | 2 | 0 | 0 |
| `cjue` | 5 | 5 | 7 | 42 | 7 | 0 | 0 |
| `cepd` | 5 | 5 | 8 | 39 | 8 | 0 | 0 |
| **Total** | **25** | **20** | **25** | **101** | **25** | **0** | **0** |

**Deux unités sont comptées, une seule est notée.**

**Unité de mesure : la citation d'instrument.** C'est un couple document × instrument, l'unité que la
réponse rend et que #28 demande de prouver : le lien extrait pointe-t-il vers le bon texte officiel ?
**25 citations justes sur 25 relues, soit 100 %, 0 fausse, 0 indécidable** ; le dénominateur est 25.

**Seconde unité, comptée mais non notée : l'entrée d'article.** Les 25 citations portent 101 entrées
d'articles, une plage comptant pour une entrée (`12–22`). Chaque entrée apparaît dans au moins une
attribution affichée avec son extrait par `node mcp/eval/citations.ts`, et ces extraits ont été relus :
cette relecture n'a trouvé aucune entrée fausse et aucune entrée invérifiable (0). Ce n'est pourtant
pas un taux : aucun verdict n'est consigné entrée par entrée, et le rapport ne publie pas de précision
à l'article, parce que la preuve demandée par #28 est celle du lien instrument → document. Le
dénominateur publié reste 25.

« Juste », à l'échelle de l'instrument, veut dire : l'instrument est celui que la décision cite, ses
articles viennent de la proposition qui le nomme, et l'extrait affiché le montre. « Indécidable » n'a
pas été employé : aucun extrait n'était assez tronqué pour empêcher de trancher l'instrument.

## Échantillon relu

| Corpus | Documents | Citations rendues |
| --- | --- | --- |
| `cnil` | `CNILTEXT000017651766`, `CNILTEXT000017653035`, `CNILTEXT000017653987`, `CNILTEXT000017654732`, `CNILTEXT000036670511` | `loi 78-17 · art. 39, 40, 32` ; `31` ; `15, 34` ; `15, 20` ; `32, 38` |
| `ce` | `CETATEXT000028589098`, `CETATEXT000036800311`, `CETATEXT000042713076`, `CETATEXT000047316486`, `CETATEXT000051987274` | `loi 78-17 · art. 45, 46` ; `41, 26` ; `31` ; `[]` ; `[]` |
| `cc` | `5fca262d4504b03b8a33c16e`, `5fca9bb0b9d3cc911a142f72`, `60d17ca9525c8a1b57cb78b9`, `64085c8866b1bafb02f12088`, `67c7f7a8d80e40890638ebb7` | `loi 78-17 · art. 2, 22` ; `[]` ; `[]` ; `loi 78-17 · art. 6, 22, 2` ; `[]` |
| `cjue` | `62012CJ0131`, `62017CJ0040`, `62021CJ0129`, `62022CJ0033`, `62023CJ0200` | `directive 95/46/CE · art. 2, 4, 12, 14, 6, 7, 28, 13, 9` ; `RGPD · art. 80` + `directive 95/46/CE · art. 2, 7, 10, 22–24, 28` ; `RGPD · art. 17, 24, 95, 5, 6, 7, 16, 19, 94` + `ePrivacy · art. 12` ; `RGPD · art. 2, 51, 55, 4, 23, 54, 77, 5, 12–22, 34` ; `RGPD · art. 4, 6, 17, 58, 82, 5, 94` |
| `cepd` | `article-29-working-party-guidelines-on-transparency-under-regulation-2016679`, `guidelines-032020-…`, `guidelines-052021-…`, `guidelines-102020-…`, `guidelines-32018-…` | `RGPD · art. 12–14, 8, 11` + `directive 95/46/CE · art. 29, 30, 12` + `ePrivacy · art. 15` + `2016/680 · art. 4` ; `RGPD · art. 4, 5, 9, 7, 89, 35, 12–22, 44, 49, 46` ; `RGPD · art. 44, 46, 3, 28, 49, 32` ; `RGPD · art. 23, 12–22, 34, 85, 89, 77, 5, 25, 30, 83` ; `RGPD · art. 3, 56, 27, 83, 50` |

Les cinq documents à liste vide sont exacts : `CETATEXT000047316486` ne cite que la Déclaration de
1789, `CETATEXT000051987274` que le code de procédure pénale, les trois arrêts de cassation que les
codes de procédure civile et pénale, du travail, civil et des douanes. Aucun n'emploie un instrument
du périmètre.

## Faux positifs trouvés et corrigés

Aucun faux positif ne subsiste dans les 25 documents. Trois défauts ont été trouvés pendant la
relecture et corrigés avant la mesure finale ; chacun est couvert par un test dans
`tests/citations.test.ts`.

| Défaut | Document | Ce qui était rendu | Correction |
| --- | --- | --- | --- |
| Visa enchâssé | `CNILTEXT000017652394` | `loi 78-17 · art. 1er`, à partir de « le décret n° 78-774 du 17 juillet 1978 pris pour l'application de la loi du 6 janvier 1978 **et notamment son article 1er** » : l'article 1er est celui du décret | Une mention précédée, dans la même proposition, d'un `décret`, `arrêté` ou `ordonnance`, ou d'une formule de renvoi (« application de », « modifiant », « conformément à »), ne porte plus de liste : le document rend `[]`. |
| Point d'énumération pris pour un sous-numéro | `CNILTEXT000043792338`, `CNILTEXT000042398005` | `loi 78-17 · art. 4-2` et `4-5`, articles qui n'existent pas, à partir de « l'article 4-2° de la loi du 6 janvier 1978 » — l'article 4, point 2°, soit « collectées pour des finalités déterminées » | Un groupe de chiffres suivi de `°` n'est plus un sous-numéro : la phrase ne rend plus rien (l'article n'est plus immédiatement suivi du connecteur). Mieux vaut une citation manquante qu'un article inventé. |
| Mesure plus large que la réponse | tout le corpus | `extraireAttributions` rendait `code pénal · art. 378` alors que la citation rendue filtre déjà les articles antérieurs à 226-16 | Le filtre du code pénal s'applique aussi à la vue de mesure : la relecture porte sur ce qui est rendu, pas sur un brouillon. |

## Contrôle étendu (hors échantillon)

Un échantillon de 25 documents ne classe pas 5 111 documents ; il a servi à corriger les règles, pas
à les certifier. Le contrôle étendu suivant ne mesure rien, il cherche des faux positifs.

- 4 454 citations sur 5 111 documents, dont 3 788 documents avec au moins une citation :
  `cnil` 2 846 (2 481 / 3 245), `ce` 1 214 (990 / 1 312), `cc` 164 (135 / 352),
  `cjue` 180 (147 / 166), `cepd` 50 (35 / 36).
- Comptes par instrument : `loi 78-17` 3 392, `RGPD` 657, `CPCE` 130, `directive 95/46/CE` 96,
  `ePrivacy` 69, `code pénal` 63, `2016/680` 34, `2018/1725` 13.
- Les formes rares ont été relues par leurs extraits : code pénal (20 attributions), CPCE (30),
  ePrivacy et 2016/680 (40). Les articles du code pénal rendus sont tous de la série 226 à partir de
  226-16 ; ceux d'avant sont filtrés, y compris dans une liste mixte — « articles 226-13, 226-14 et
  226-31 du code pénal » rend `226-31` seul.
- 1 442 attributions dont l'extrait porte la formule « notamment son article » ou « notamment ses
  articles » ont été balayées : c'est là que le visa enchâssé a été trouvé.

## Limites

- **Anaphore.** « du même règlement » n'est résolu que si un seul instrument de cette nature est
  nommé dans le document. Deux règlements nommés, même hors périmètre (`règlement (UE) 603/2013`),
  laissent l'anaphore béante : la citation est manquante, jamais inventée. Le rapprochement se fait au
  niveau du document, pas de la proposition.
- **Ce qui sépare l'article de son instrument.** La règle exige que l'instrument suive immédiatement
  le connecteur et que l'article précède immédiatement le connecteur. Les formes « l'article 6,
  paragraphe 1, du RGPD », « à l'article 13 ou à l'article 14 du RGPD » et « l'article 48 du RGPD,
  intitulé … » ne rendent donc rien pour l'article concerné : c'est la première cause de citation
  manquante sur `cepd` et `cjue`, et c'est délibéré.
- **Instruments hors périmètre.** La Charte, la CEDH, les traités, les décrets, les codes de
  procédure, de la santé publique, du travail, civil, des douanes et de justice administrative restent
  dehors, même correctement attribués. Un article de la Charte n'est jamais reversé au RGPD.
- **Articles non normalisés au-delà du numéro.** `21-4°` rend `21`, `27-II-2°` rend `27`, `L. 34-5`
  reste `L. 34-5` : le numéro d'article est retenu, la subdivision (paragraphe, point, alinéa) est
  perdue. Une plage au milieu d'une liste garde ses bornes (`5, 12 à 22 et 34` rend `5, 12–22, 34`),
  et un article simple déjà couvert par une plage n'est pas répété.
- **Décisions anglaises.** Les formes anglaises (`Article 6 GDPR`, `Article 6 of Regulation (EU)
  2016/679`, `Directive 95/46/EC — Articles 2, 4`) sont couvertes par les tests unitaires, mais
  aucune décision anglaise n'est encore dans le corpus : `cjue` porte 0 document `(texte anglais)` au
  2026-11-13, la mesure ne dit donc rien de ces décisions.
- **Documents sans citation.** 764 documents `cnil`, 322 `ce`, 217 `cc`, 19 `cjue` et 1 `cepd` ne
  portent aucune citation reconnue. Aucun des documents relus ne cachait une citation du périmètre
  qu'une règle aurait laissée passer ; le corpus entier n'a pas été relu.
- **Décisions entre elles.** Une décision qui cite une autre décision n'est pas traitée (#30) ;
  seuls les huit instruments du périmètre le sont.
