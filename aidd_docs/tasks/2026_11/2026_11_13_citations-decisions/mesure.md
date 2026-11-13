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

Les correctifs du 2026-11-13 (anaphore, listes distribuées, formes anglaises) ne changent aucune
citation de ces 25 documents : la table ci-dessus est celle de la relecture finale.

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

Trois des cinq listes vides ne sont pas des décisions sans texte de référence : `CETATEXT000047316486`
nomme le règlement (UE) 2016/679 (le « RGPD ») sans lui rattacher d'article, et `CETATEXT000051987274`
comme `5fca9bb0b9d3cc911a142f72` nomment la loi n° 78-17 dans les mêmes conditions ; leurs autres
références sont hors périmètre (Déclaration de 1789, code de procédure pénale, codes du travail et
civil). La décision 4 du contrat refuse une citation sans article — « Vu le règlement (UE) 2016/679 »
n'établit pas une base article par article —, et leur liste est donc vide sans être fausse. Les deux
autres, `60d17ca9525c8a1b57cb78b9` et `67c7f7a8d80e40890638ebb7`, ne nomment aucun instrument du
périmètre : leurs seules références sont les codes de procédure pénale et civile et le code des
douanes.

Ce qu'un lecteur doit en conclure : une liste vide dit qu'aucune citation article par article n'a été
reconnue, jamais que la décision est hors sujet ou sans base juridique. Pour trois de ces cinq
décisions, le texte nomme bel et bien un instrument du périmètre ; c'est l'article qui manque, et le
contrat préfère alors une liste vide à une citation d'instrument.

## Faux positifs trouvés et corrigés

Aucun faux positif ne subsiste dans les 25 documents. Quatre défauts ont été corrigés avant la mesure
finale — trois trouvés pendant la relecture, un par le contrôle indépendant ; chacun est couvert par
un test dans `tests/citations.test.ts`.

| Défaut | Document | Ce qui était rendu | Correction |
| --- | --- | --- | --- |
| Visa enchâssé | `CNILTEXT000017652394` | `loi 78-17 · art. 1er`, à partir de « le décret n° 78-774 du 17 juillet 1978 pris pour l'application de la loi du 6 janvier 1978 **et notamment son article 1er** » : l'article 1er est celui du décret | Une mention précédée, dans la même proposition, d'un `décret`, `arrêté` ou `ordonnance`, ou d'une formule de renvoi (« application de », « modifiant », « conformément à »), ne porte plus de liste : le document rend `[]`. |
| Point d'énumération pris pour un sous-numéro | `CNILTEXT000043792338`, `CNILTEXT000042398005` | `loi 78-17 · art. 4-2` et `4-5`, articles qui n'existent pas, à partir de « l'article 4-2° de la loi du 6 janvier 1978 » — l'article 4, point 2°, soit « collectées pour des finalités déterminées » | Un groupe de chiffres suivi de `°` n'est plus un sous-numéro : la phrase ne rend plus rien (l'article n'est plus immédiatement suivi du connecteur). Mieux vaut une citation manquante qu'un article inventé. |
| Anaphore résolue vers la mauvaise loi | `CETATEXT000030236203`, `CETATEXT000053163247`, `CNILTEXT000017654300`, `CETATEXT000037461547` | des articles de la LIL (`art. 96, 140` ; `art. 142, 90` ; `art. 4` ; `art. 4`) là où « la même loi (organique) » désigne la loi organique n° 2004-192, la loi du 22 décembre 1984 ou la loi du 6 fructidor an II | Toute loi nommée compte comme concurrente, par numéro, par date ou par qualificatif ; « de la même loi organique » et « de la même loi du pays » ne se résolvent jamais. Les quatre documents rendent `[]` ou leurs seules citations réelles. |
| Mesure plus large que la réponse | tout le corpus | `extraireAttributions` rendait `code pénal · art. 378` alors que la citation rendue filtre déjà les articles antérieurs à 226-16 | Le filtre du code pénal s'applique aussi à la vue de mesure : la relecture porte sur ce qui est rendu, pas sur un brouillon. |

## Contrôle étendu (hors échantillon)

Un échantillon de 25 documents ne classe pas 5 111 documents ; il a servi à corriger les règles, pas
à les certifier. Le contrôle étendu ne mesure rien : il donne des populations exactes, puis dit combien
d'extraits ont été relus. Une population comptée n'est pas une population relue.

- **Citations rendues** : 4 459 sur 5 111 documents, dont 3 786 documents avec au moins une citation
  et 1 325 sans (`cnil` 2 853, 2 481 / 3 245 ; `ce` 1 212, 988 / 1 312 ; `cc` 164, 135 / 352 ;
  `cjue` 180, 147 / 166 ; `cepd` 50, 35 / 36).
- **Par instrument**, en citations (un couple document × instrument) : `loi 78-17` 3 392, `RGPD` 657,
  `CPCE` 130, `directive 95/46/CE` 97, `ePrivacy` 73, `code pénal` 63, `2016/680` 34, `2018/1725` 13.
- **Attributions** — une par liste d'articles reconnue, plusieurs par citation : 16 600.
- **Relecture** : les 25 documents de l'échantillon, 247 attributions, relues intégralement. Hors
  échantillon, par leurs extraits : 20 attributions au code pénal sur 131, 40 au CPCE sur 605,
  25 à ePrivacy sur 228, 20 à 2016/680 sur 211, 2 à 2018/1725 sur 47.
- **Visa « … notamment son/ses article(s) »** : la formule apparaît 3 217 fois dans les cinq
  `unites.jsonl` —

  ```
  grep -o "notamment son article \|notamment ses articles " \
    data/corpus/{cnil,ce,cc,cjue,cepd}/unites.jsonl | wc -l
  ```

  — soit 1 278 attributions dont l'extrait la porte. 40 ont été relues, dont toutes celles des 25
  documents de l'échantillon. C'est là que le visa enchâssé a été trouvé.
- Le filtre du code pénal tient sur les attributions relues : « articles 226-13, 226-14 et 226-31 du
  code pénal » rend `226-31` seul, et aucune attribution relue ne sort de la série 226 à partir de
  226-16.

Ce contrôle ne mesure pas la précision : il ne dit pas combien de citations fausses subsistent hors
échantillon. Seule la table des 25 documents porte un verdict.

## Limites

- **Anaphore, au document.** « du même règlement », « de la même loi », « de la même directive » et
  « du même code » ne se résolvent que si un seul instrument de cette nature est nommé dans **tout le
  document** ; deux instruments nommés, même hors périmètre (`règlement (UE) 603/2013`), laissent
  l'anaphore béante. Depuis le 2026-11-13, toute loi nommée compte comme concurrente, par son numéro
  (`loi n° 2004-192`), par sa date (`loi du 22 décembre 1984`) ou par un qualificatif (`loi organique
  n° 2004-192`, `loi du pays n° 2018-1`, `loi du 6 fructidor an II`) ; « de la même loi organique » et
  « de la même loi du pays » ne se résolvent jamais, aucun instrument du périmètre n'étant l'une ou
  l'autre. Le coût est mesuré, pas seulement supposé : entre `4957f0c` et `c32da19`, 19 couples
  instrument × article ont disparu, dont les 6 citations fausses retirées et 13 citations justes
  perdues dans 12 documents (`CNILTEXT000017652449`, `…653155`, `…653248`, `…653525`, `…25829613`,
  `CETATEXT000041785967`, `…042499856`, `…044316288`, `…044316289`, `…044462348`, `…046082443`,
  `…054394408`), contre 49 couples gagnés par la lecture des listes distribuées et des formes
  anglaises. Une fenêtre de proximité a été
  essayée puis écartée : elle attribuait « l'article 12 de la même directive » à la directive 95/46/CE
  dans `62021CJ0129`, alors que l'antécédent est la directive 2002/58 — mesurée sur l'échantillon,
  elle y ajoutait cette fausse citation.
- **Ce qui sépare l'article de son instrument.** La règle exige que l'instrument suive immédiatement
  le connecteur et que l'article précède immédiatement le connecteur. Les formes « l'article 6,
  paragraphe 1, du RGPD », « à l'article 13 ou à l'article 14 du RGPD » et « l'article 48 du RGPD,
  intitulé … » ne rendent donc rien pour l'article concerné : c'est la première cause de citation
  manquante sur `cepd` et `cjue`, et c'est délibéré.
- **Instruments hors périmètre.** La Charte, la CEDH, les traités, les décrets, les codes de
  procédure, de la santé publique, du travail, civil, des douanes et de justice administrative restent
  dehors, même correctement attribués. Un article de la Charte n'est jamais reversé au RGPD.
- **Subdivisions d'article non lues (#8).** Le numéro est retenu, la subdivision est perdue : `21-4°`
  rend `21`, `27-II-2°` rend `27`, `L. 34-5` reste `L. 34-5`. Quand la subdivision sépare l'article de
  son instrument, la citation disparaît : `l'article 5-1-c du RGPD`, `l'article 14-5-b du RGPD`,
  `l'article 5 (1-b) du RGPD` et `l'article 9, paragraphe 2, sous e) du RGPD` rendent tous `[]`.
  Le corpus `cnil` porte 504 occurrences de la forme `N-M-x` (`5-1-c`, 163 documents), 5 de la
  forme `N (M-x)` (`5 (1-b)`, 1 document) et 763 de la forme `N, paragraphe 2` (95 documents),
  comptées par `\b\d+[-.]\d+[-.][a-z]\b`, `\b\d+ \(\d+-[a-z]\)` et `\b\d+, paragraphe \d+`.
  Ces formes ne sont pas lues dans cette passe : la limite est déclarée, pas corrigée. Une plage au milieu d'une liste garde ses bornes
  (`5, 12 à 22 et 34` rend `5, 12–22, 34`), et un article simple déjà couvert par une plage n'est pas
  répété.
- **Décisions anglaises.** Les formes anglaises sont lues et testées : `Article 6 GDPR`,
  `Article 6 of the GDPR`, `Article 6 of Regulation (EU) 2016/679`, `Article 4 of Directive (EU)
  2016/680`, `Article 5(3) of Directive 2002/58/EC`, `Article 6(1)(a) GDPR`, `Articles 12 to 14 GDPR`,
  `Directive 95/46/EC — Articles 2, 4`. Aucune décision anglaise n'est encore dans le corpus : `cjue`
  porte 0 document `(texte anglais)` au 2026-11-13, la mesure ne dit donc rien de leur précision.
- **Documents sans citation.** 764 documents `cnil`, 324 `ce`, 217 `cc`, 19 `cjue` et 1 `cepd` ne
  portent aucune citation reconnue. Aucun des documents relus ne cachait une citation du périmètre
  qu'une règle aurait laissée passer ; le corpus entier n'a pas été relu.
- **Décisions entre elles.** Une décision qui cite une autre décision n'est pas traitée (#30) ;
  seuls les huit instruments du périmètre le sont.
