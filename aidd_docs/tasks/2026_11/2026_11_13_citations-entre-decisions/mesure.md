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

Chaque échantillon a été régénéré sur le code final et comparé octet par octet au fichier relu.

| Famille | Citations au corpus | Résolues au corpus | Relues | Justes | Borne basse Wilson 95 % | Exposée |
| --- | --- | --- | --- | --- | --- | --- |
| `affaire_ue` | 2 841 | 1 138 | 60 (échantillon) | 60 | 94,0 % | oui |
| `deliberation_cnil` | 2 408 | 1 861 | 60 (échantillon) | 60 | 94,0 % | oui |
| `requete_ce` | 119 | 98 | 119 (exhaustif) | 119 | 96,9 % | oui |
| `pourvoi_cc` | 179 | 75 | 60 (échantillon) | 60 | 94,0 % | oui |
| `ecli` | 55 | 0 | 55 (exhaustif) | 34 | 48,6 % | non |

### Strate « date divergente », relue en entier

Quand le texte date la décision citée et qu'aucune décision du corpus de ce numéro ne porte cette date,
toutes sont rendues avec `date_divergente: true` plutôt qu'une absence fausse.

| Famille | Citations à date divergente | Justes | Précision |
| --- | --- | --- | --- |
| `deliberation_cnil` | 51 (2,1 % de la famille) | 38 | 74,5 % |
| `requete_ce` | 5 | 5 | 100 % |
| `affaire_ue` | 1 | 1 | 100 % |

- `deliberation_cnil` : les 13 fautes sont des délibérations différentes sous le même numéro (anciennes
  séries des années 1980), un organe autre que la CNIL ou un numéro erroné dans la source. Les 38 justes
  sont des coquilles de date, des écarts séance/acte ou des dates d'un autre acte. Cette strate est
  sous le seuil prise seule : le marqueur `date_divergente` dit « à vérifier », et la description des
  outils publie ce chiffre. Pondérée par strate (97,9 % à 60/60, 2,1 % à 74,5 %), la famille reste au-dessus
  du seuil.
- Candidats en trop, comptés justes par la règle (la bonne décision y figure) : quelques requêtes et
  pourvois jugés deux fois (fond et renvoi) quand la date n'est pas donnée ou n'est pas lue.
- `ecli` : toutes les fautes sont des cibles manquantes — aucune unité ne porte d'ECLI. Non exposée ;
  la résoudre demande une synchronisation qui écrive les ECLI de la CJUE.

## Passes

1. Passe 1 : `affaire_ue` 59/60, `deliberation_cnil` 55/60, `requete_ce` 53/60, `pourvoi_cc` 60/60,
   `ecli` 34/55. Corrigés : date lue après la référence, points d'abréviation, mois abrégés, avis du
   Conseil d'État exclus, année d'affaire sur quatre chiffres.
2. Passe 2 : `affaire_ue` 56/60 (affaires jointes de l'en-tête). Corrigé : en-tête CJUE indexé.
3. Revue indépendante : auto-citations revenues par le filtre de date, fenêtre qui coupait un jour,
   date de la citation suivante prise, fausses absences sur date différente (71 au corpus). Corrigés :
   auto-citation décidée avant la date, fenêtre à frontière de mot, date après séparée par une seule
   virgule ou le nom des parties, `date_divergente`, conclusions et ordonnances distinguées de l'arrêt,
   résolution partagée par les deux outils.
4. Passe finale sur le code final : chiffres ci-dessus.

## Rappel

Non mesuré par un seuil. Observé en relecture : références manquantes (pourvois en liste sans « n° »,
décisions citées par le nom des parties, ECLI).
