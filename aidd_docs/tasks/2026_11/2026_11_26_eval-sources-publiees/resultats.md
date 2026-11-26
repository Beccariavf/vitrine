# Résultats — #164, questions tirées de sources publiées

**Chiffres provisoires.** Ils ne sont pas retenus avant le contrôle, par l'utilisateur, des 10 questions de
[`echantillon-a-controler.md`](echantillon-a-controler.md) (critère d'acceptation 2). Un « non » retire la question et
les chiffres sont recalculés.

Mesure du 2026-11-26 sur l'index réel `data/corpus/index/index.db` (178 359 unités, 24 corpus, 1 024 dimensions,
modèle `leoipulsar/harrier-0.6b` servi par Ollama). Les deux passes sont en lecture seule : aucun `corpus:index`,
aucune écriture sous `data/`.

## Jeu et sources

- 60 questions : 20 données personnelles, 15 données non personnelles, 15 IA, 10 santé. Toutes de type
  `conceptuelle` : la question ne nomme pas le numéro d'article, la référence attendue est celle que l'auteur cite.
- La question est une reformulation originale ; aucun texte de l'auteur n'est recopié. Le fichier
  `mcp/eval/sources-publiees.json` porte, par question, l'URL, l'auteur ou le cabinet, la date de publication
  (`null` si la page n'en affiche pas), la date de lecture (2026-11-26), le champ, le corpus attendu et la référence
  citée.
- Cinq questions dont la référence n'existe pas au corpus sont gardées à part dans
  `mcp/eval/sources-publiees-hors-corpus.json` et ne sont pas notées (Code civil art. 16-10, AI Act art. 111 § 4
  ajouté par 2026/1744, SAN-2026-003, loi SREN art. 27, arrêté du 17 novembre 2025).
- Toutes les références du jeu ont été vérifiées présentes au corpus (article, décision entière, délibération ou
  document de doctrine), et toutes les URL ont été ouvertes le 2026-11-26. Deux URL de `avocats.xxi.legal` ont
  répondu 403 : les deux questions correspondantes ont été écartées, pas contournées.
- Sources lues : 66 questions candidates, dont 60 retenues, portées par 58 URL distinctes sur 35 domaines
  (Village de la Justice, blogs de cabinets, HAL, CNIL, CADA, Conseil d'État, Conseil constitutionnel, ARCEP,
  ARCOM, Commission européenne). Les 6 écartées : 2 pour un 403 anti-robot, 4 pour recoupement ou cadrage hors
  sujet. 13 domaines abandonnés : paywall (Dalloz, Revue Banque), anti-robot, 403 ou mur JavaScript (Actu-Juridique,
  XXI Avocats, Cour de cassation), contenu non chargé ou non fiable (Shift Avocats, un blog), page sans référence
  d'article (RSF, INSEE, data.gouv), PDF illisible (Unipub), hors champ (mdc-avocat), source exclue par la consigne
  (`donneespersonnelles.fr`).
- Limites : 1 à 13 questions par corpus, donc les taux par corpus sont des ordres de grandeur. Les seuils de
  confiance sont les constantes figées du produit (0,69 / 0,74 / 0,01), identiques dans les deux passes.

## Commandes exactes

```sh
# une passe avec filtre et une sans filtre, par groupe de corpus
for c in $(awk -F, 'NR>1{print $5}' mcp/eval/questions-sources-publiees.csv | sort -u); do
  node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" --json \
    > aidd_docs/tasks/2026_11/2026_11_26_eval-sources-publiees/mesures/avec-$c.json
  node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$c" --sans-filtre --json \
    > aidd_docs/tasks/2026_11/2026_11_26_eval-sources-publiees/mesures/sans-$c.json
done

# agrégats par champ et par corpus
node mcp/eval/agreger.ts --sources mcp/eval/sources-publiees.json \
  --avec  aidd_docs/tasks/2026_11/2026_11_26_eval-sources-publiees/mesures/avec-*.json \
  --sans  aidd_docs/tasks/2026_11/2026_11_26_eval-sources-publiees/mesures/sans-*.json
```

`--corpus` choisit le groupe du jeu ; `--sans-filtre` retire la borne de collection de l'appel `search` (la
recherche voit alors les 24 corpus, et les alias de corpus nommés dans la question restent actifs). Les sorties
brutes sont dans [`mesures/`](mesures/) et les tableaux reproductibles dans [`agregats.md`](agregats.md).

## Résultats par champ

Rappel@5 sur les 60 questions ; rang moyen de la première bonne référence **parmi les questions où elle est trouvée**
(les absences comptent dans le rappel@5 et le MRR, pas dans le rang moyen) ; `confiant` = niveau du produit sur le
premier passage.

Avec le corpus attendu :

| champ | questions | rappel@5 | rang moyen | MRR | confiant juste / faux |
| --- | ---: | ---: | ---: | ---: | ---: |
| données personnelles | 20 | 19/20 (95,0 %) | 1,47 | 0,792 | 3 / 1 |
| données non personnelles | 15 | 10/15 (66,7 %) | 1,70 | 0,483 | 2 / 0 |
| IA | 15 | 11/15 (73,3 %) | 1,82 | 0,586 | 5 / 2 |
| santé | 10 | 10/10 (100,0 %) | 2,20 | 0,670 | 4 / 0 |

Sans filtre `corpus` :

| champ | questions | rappel@5 | rang moyen | MRR | confiant juste / faux |
| --- | ---: | ---: | ---: | ---: | ---: |
| données personnelles | 20 | 6/20 (30,0 %) | 1,33 | 0,250 | 1 / 3 |
| données non personnelles | 15 | 7/15 (46,7 %) | 2,14 | 0,272 | 3 / 0 |
| IA | 15 | 7/15 (46,7 %) | 1,00 | 0,467 | 4 / 1 |
| santé | 10 | 7/10 (70,0 %) | 2,00 | 0,470 | 2 / 0 |

Toutes passes confondues : 17 réponses `confiant` avec filtre, 14 justes et 3 fausses (82,4 %) ; 14 sans filtre,
10 justes et 4 fausses (71,4 %). « Juste » = une référence attendue figure dans le top 5 des passages rendus.

## Résultats par corpus

Voir [`agregats.md`](agregats.md) pour les quatre tableaux. Points saillants :

- `rgpd` : 13/13 avec filtre, 3/13 sans filtre (−76,9 points) ; `lil` 2/2 → 0/2 ; `textes_fr` 4/4 → 3/4.
- `aiact` : 8/9 avec filtre, 7/9 sans filtre ; `sante_ue` 2/2 → 1/2 ; `donnees` 5/8 → 3/8.
- `cnil_doctrine` : 3/4 avec filtre, 1/4 sans filtre ; `doctrine_ue` : 0/2 dans les deux passes (les fragments
  attendus ne sont pas dans le top 5, même bornés au corpus).
- `cada` : 0/1 avec filtre. `cc`, `ce`, `cjue`, `cnil`, `frontieres` : entre 66,7 % et 100 % avec filtre.

## Effet du volume et parade

En regroupant les questions :

| famille | questions | avec filtre | sans filtre | écart |
| --- | ---: | ---: | ---: | ---: |
| textes législatifs (`rgpd`, `aiact`, `donnees`, `sante_ue`, `textes_fr`, `lil`, `frontieres`) | 42 | 37/42 (88,1 %) | 19/42 (45,2 %) | −42,9 pts |
| doctrine (`doctrine_ue`, `cnil_doctrine`) | 6 | 3/6 (50,0 %) | 1/6 (16,7 %) | −33,3 pts |
| décisions (`cnil`, `ce`, `cc`, `cjue`, `cada`) | 12 | 10/12 (83,3 %) | 7/12 (58,3 %) | −25,0 pts |

L'écart des textes dépasse 15 points : la parade est requise. Deux pistes, **non implémentées** :

1. **Quota de textes dans le top 5.** Réserver, dans la fusion des candidats (dense + lexical), au moins deux places
   aux unités de corpus textuels quand la question n'est pas bornée à un corpus de décisions. Effet attendu :
   ramener le rappel@5 des textes sans filtre vers celui du filtre, au prix d'un rang 1 moins souvent occupé par une
   décision. Risque : dégrader les questions de décisions, à mesurer par une passe appariée sur ce même jeu avant
   adoption.
2. **Orientation vers les textes quand la question cite un article.** Détecter dans la question une citation
   d'article (le court-circuit `referenceExacte` le fait déjà) et, quand aucun corpus n'est demandé, chercher
   d'abord dans les corpus textuels qui portent des articles, puis compléter avec les décisions. Effet attendu :
   les questions de textes retrouvent leur article, sans quota fixe ; les questions de décisions qui citent un
   article de loi restent à vérifier séparément.

## Validation

- `npm run typecheck`, `npm test`, `npm run build` : voir le compte rendu de la PR.
- Test hors ligne ajouté : `tests/eval.test.ts` lit le CSV par `lireJeu`, vérifie les 60 questions, l'annexe des
  sources, l'absence de numéro d'article dans les questions, la présence de **chaque référence** dans le
  `unites.jsonl` de son corpus (le test échoue sinon), et que les questions `hors_corpus` restent à part.
- Le CSV est aussi lu par `run.ts` lui-même : `validerReferences` passe sur les 60 questions avant toute mesure.
