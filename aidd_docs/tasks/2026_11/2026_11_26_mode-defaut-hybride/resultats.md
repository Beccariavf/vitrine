# Mode par défaut et recherche hybride — #170

Mesure du 2026-11-26, jeu de #164 (`mcp/eval/questions-sources-publiees.csv`, 60 questions), index réel de 178 359 unités, `leoipulsar/harrier-0.6b` sur Ollama, lecture seule. Rappel@5 : la référence attendue est dans les 5 passages rendus.

| configuration | données personnelles | non personnelles | IA | santé | textes seuls | autres | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dense, avec filtre (#164) | 19/20 | 10/15 | 11/15 | 10/10 | 37/42 | 13/18 | 50/60 |
| dense, **mode par défaut** | 6/20 | 7/15 | 7/15 | 7/10 | 19/42 | 8/18 | 27/60 |
| dense, sans filtre ni détection (#164) | 7/20 | 7/15 | 7/15 | 8/10 | 19/42 | 10/18 | 29/60 |
| hybride, avec filtre | 16/20 | 10/15 | 11/15 | 10/10 | 33/42 | 14/18 | 47/60 |
| hybride, mode par défaut | 6/20 | 6/15 | 7/15 | 9/10 | 19/42 | 9/18 | 28/60 |
| hybride, sans filtre ni détection | 7/20 | 6/15 | 7/15 | 10/10 | 17/42 | 13/18 | 30/60 |

« Mode par défaut » : aucun paramètre `corpus`, détection du document ou du corpus nommé active (`--sans-filtre --detection`) ; c'est ce que reçoit un client qui ne filtre pas. « Textes seuls » : questions dont la référence attendue est dans un corpus de type `texte`.

## Lecture

- **Le déficit est celui du produit.** Le mode par défaut rend 19/42 sur les textes, comme la passe sans détection : les questions, reformulées sans nommer d'instrument, ne déclenchent presque jamais la détection. La réserve de #164 (« passe plus sévère que le produit ») ne change pas la conclusion.
- **L'hybride ne répare rien.** Il perd 3 questions avec filtre (47 contre 50, toutes sur les textes de données personnelles) et reste à 19/42 sur les textes en mode par défaut. L'avis du 5/11 (hybride non retenu) tient sur 24 corpus.
- La parade retenue est le quota de textes (#171). Écarts de 1 à 3 questions sur 60 : non significatifs, seuls les écarts de l'ordre de 18 questions (avec/sans filtre) le sont.

## Commandes

```sh
q(){ node mcp/eval/run.ts --questions mcp/eval/questions-sources-publiees.csv --corpus "$1" --json "${@:2}"; }
for c in $(awk -F, 'NR>1{print $5}' mcp/eval/questions-sources-publiees.csv | sort -u); do
  q $c --sans-filtre --detection > mesures/defaut-$c.json
  q $c --sans-filtre --detection --recherche hybride > mesures/defaut-hybride-$c.json
  q $c --sans-filtre --recherche hybride > mesures/sans-hybride-$c.json
  q $c --recherche hybride > mesures/avec-hybride-$c.json
done
```
