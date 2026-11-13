---
date: 2026-11-13
corpus: cnil, ce, cc, cjue, cepd
seuil: borne basse de Wilson à 95 % ≥ 90 %, par famille (fixé par l'utilisateur)
---

# Mesure : les citations entre décisions

Précision de `mcp/corpus/citations-decisions.ts`, relevée par famille sur un échantillon relu.

## Commande

```
node mcp/eval/citations-decisions.ts <famille> --taille 60
```

L'échantillon est déterministe : toutes les citations de la famille, triées par corpus, document et
ordre de rencontre, prises à pas régulier (`floor(rang × n / taille)`). Chaque entrée affiche l'extrait
qui porte la référence et les décisions du corpus résolues. Rien n'est écrit, seul `data/corpus/` est lu.

## Unité et règle

Une citation = (décision citante, référence, cibles). **Juste** si l'extrait cite bien une décision
sous cette référence et si les cibles sont correctes : la décision citée figure parmi les candidats
d'une référence ambiguë ; une référence rendue sans cible est absente du corpus (vérifié par recherche
sur les chemins, les en-têtes et les numéros joints). **Faux** sinon. Aucune entrée indécidable.

Relecteurs : un agent indépendant de l'implémentation par famille et par passe, sans accès en
écriture, chaque cible et chaque absence vérifiées contre `data/corpus/`.

## Résultat (code final)

| Famille | Citations au corpus | Relues | Justes | Fausses | Borne basse Wilson 95 % | Exposée |
| --- | --- | --- | --- | --- | --- | --- |
| `affaire_ue` | 2 865 | 60 | 60 | 0 | 94,0 % | oui |
| `deliberation_cnil` | 2 409 | 60 | 60 | 0 | 94,0 % | oui |
| `requete_ce` | 121 | 60 | 59 | 1 | 91,1 % | oui |
| `pourvoi_cc` | 179 | 60 | 60 | 0 | 94,0 % | oui |
| `ecli` | 55 | 55 | 34 | 21 | 48,6 % | non |

- `requete_ce` : l'erreur vient de la source (« 21 avril 2011, n° 393099 » pour 2021) ; le filtre de
  date écarte alors la bonne décision.
- `ecli` : toutes les fautes sont des cibles manquantes — aucune unité ne porte d'ECLI, la référence
  n'est jamais résolue. Famille non exposée ; la résoudre demande une synchronisation qui écrive les
  ECLI de la CJUE. Mesurée en première passe : son extraction et sa résolution n'ont pas changé depuis.

## Passes

1. Première passe : `affaire_ue` 59/60 (`C-101/2001` mal lu), `deliberation_cnil` 55/60 et
   `requete_ce` 53/60 (date d'un autre acte prise avant la référence, avis administratifs du Conseil
   d'État), `pourvoi_cc` 60/60, `ecli` 34/55. Corrigés : date lue après la référence d'abord (« n° 80-20
   du 24 juin 1980 »), coupures qui ignorent les points d'abréviation, mois abrégés, avis exclus,
   année d'affaire sur quatre chiffres.
2. Deuxième passe sur le code corrigé : `deliberation_cnil` 60/60, `requete_ce` 59/60, `pourvoi_cc`
   60/60, `affaire_ue` 56/60 (affaires jointes de l'en-tête non indexées). Corrigé : l'en-tête CJUE
   « Dans les affaires jointes … » indexe toutes les affaires, plages « à » comprises.
3. Troisième passe `affaire_ue` sur le code final : 60/60. Les échantillons des trois autres familles
   sont identiques sur le code final (vérifié octet par octet).

## Rappel

Non mesuré par un seuil. Observé en relecture : des références manquent (pourvois en liste sans « n° »,
décisions citées par le nom des parties, ECLI).
