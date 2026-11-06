# Phase 3: Mesurer le pilote

## Acceptance

- `mcp/eval/filtres.ts` porte 12 cas, chacun visant une décision et nommant la métadonnée qui doit la discriminer.
- Chaque cas est mesuré deux fois, sans puis avec filtres, au top 5, avec les seuils de mesure permissifs.
- Le résultat est écrit dans `eval-filtres.md` ; le jeu CNIL v2 n'est pas rejoué.

## Evidence

| | Top 5 |
| --- | --- |
| Sans filtre | 7/12 |
| Avec filtre | 11/12 |

Le cas « repas 2020 » échoue dans les deux mesures : le filtre de date laisse 12 décisions de 2020 et la bonne reste au 14ᵉ rang. Les quatre cas réparés sont `27 M€`, `50 M€ en 2024`, `325 M€` et `1,5 M€ en 2025` : le montant ou la date étaient dans la question, mais le vecteur seul ne les utilisait pas.
