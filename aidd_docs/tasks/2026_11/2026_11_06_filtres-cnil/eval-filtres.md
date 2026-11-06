# Évaluation du filtrage CNIL par métadonnées

Mesure du 6 novembre 2026 sur `data/corpus/cnil/` : 249 décisions, 6 342 fragments, index `qwen3-embedding:0.6b` (1024 dimensions), 6 907 unités. Ce rapport est séparé de `eval-cnil-v2.md` : le jeu CNIL v2 n'est ni rejoué ni modifié.

## Ce qui a été extrait

`mcp/corpus/cnil/meta.ts` lit le dispositif après le dernier « PAR CES MOTIFS ». Il ne résume pas : il relève le type de sanction, le total des amendes et la présence d'une injonction.

| Type | Documents |
| --- | --- |
| Amende | 134 (133 avec montant, 1 masquée) |
| Avertissement | 95 |
| Liquidation d'astreinte | 12 |
| Rappel à l'ordre | 6 |
| Interruption de traitement | 2 |

Le montant est en euros, `null` quand le dispositif le masque (`[…]`) ou ne le porte pas. Les astreintes « par jour de retard » ne sont pas comptées comme des amendes ; un total suivi de sa décomposition n'est pas additionné à ses composantes ; un montant répété entre parenthèses n'est compté qu'une fois.

Contrôles manuels sur les décisions connues : FNAC 7 M€ (6 + 1), Google 2025 325 M€ (200 + 125), Google 2021 150 M€ (90 + 60), Free Mobile 27 M€, Free 15 M€, Orange 50 M€, hôpital 500 k€, EXTIA 300 k€, IQVIA 5 M€, liquidation 5,2 M€, 1 € symbolique. Le seul montant absent est `CNILTEXT000046907077` (dispositif masqué).

## Ce que `search` accepte

| Filtre | Effet |
| --- | --- |
| `date_min`, `date_max` | Bornes ISO `AAAA-MM-JJ` sur la date de la décision |
| `type_sanction` | `amende`, `avertissement`, `rappel`, `injonction`, `liquidation`, `interruption`, `autre` |
| `montant_min`, `montant_max` | Bornes en euros ; les montants inconnus sont exclus |
| `numero` | Numéro de délibération, par exemple `SAN-2026-015` |

Les filtres sont poussés dans la requête `vec0`, pas appliqués après le KNN. Chaque passage rendu porte `type_sanction`, `montant` et `injonction`. `get_decision` les rend aussi.

## Résultat du pilote

Douze cas, chacun visant une décision et nommant la métadonnée qui doit la discriminer. Mesure au top 5, sans puis avec filtres, avec les seuils de mesure permissifs (`bas = -1`) pour ne pas confondre un refus de confiance avec un échec de rappel.

| Cas | Sans filtre | Avec filtre |
| --- | --- | --- |
| Cookies 2025 | rang 1 | rang 1 |
| Amende 27 M€ | absent | rang 2 |
| Hôpital 2026 | rang 1 | rang 1 |
| Avertissement | rang 1 | rang 1 |
| 50 M€ en 2024 | absent | rang 1 |
| Syndicat 2013 | rang 1 | rang 1 |
| Amende 325 M€ | absent | rang 1 |
| Liquidation 2023 | rang 1 | rang 1 |
| Repas 2020 | absent | absent |
| Rappel 2023 | rang 2 | rang 2 |
| 1,5 M€ en 2025 | absent | rang 1 |
| Association 2014 | rang 1 | rang 1 |

**Top 5 : 7/12 sans filtre, 11/12 avec.** Les quatre cas réparés sont ceux où la question nommait déjà le montant ou la date : le vecteur seul ne les utilisait pas. Le filtre ne crée pas l'information ; il empêche la similarité de noyer un attribut explicite.

Le cas « repas 2020 » échoue dans les deux mesures. Le filtre de date réduit à une vingtaine de décisions de 2020, mais la bonne reste au 14ᵉ rang : la question décrit une activité, pas une date, et il manque un `secteur` pour la distinguer. C'est la limite du niveau 1.

## Limites

- **Douze cas ne classent pas le filtrage.** C'est un pilote, pas un jeu tenu à l'écart ; il vérifie que le filtre apporte ce qu'il promet, il ne mesure pas un système.
- **Les filtres ne servent que si la question nomme l'attribut.** Une question qui décrit des faits sans date, type, montant ou numéro ne gagne rien.
- **Pas de partie ni de secteur.** C'est le niveau 2, non implémenté. Les décisions anonymisées (`X`, `Y`, `[…]`) rendraient un filtre « partie » incomplet.
- **Montants masqués.** Une amende sur 134 n'a pas de montant ; un filtre de montant l'exclut, et le dit par le résultat vide plutôt que par une estimation.
- **Extraction par règles.** Les cas connus sont vérifiés, mais un dispositif inédit peut employer une formulation non prévue. Le test de `meta.ts` couvre les formes rencontrées, pas toutes les formes possibles.
- **Le chemin « article N » ignore les filtres.** Une question qui cite un article passe par le court-circuit exact, pas par la recherche filtrée. Les questions CNIL du jeu v2 n'en contiennent aucun.

## Provenance

- Corpus : `data/corpus/cnil/unites.jsonl`, 6 342 fragments, 249 documents, régénéré par `npm run cnil:sync -- --historique`.
- Index : migration sans ré-embarquement, `meta_sha`, 6 907 unités, second passage à 0 unité.
- Commandes : `npm run corpus:index`, `npm run mcp:eval:filtres`.
- Reproduction : le `dev` CNIL v2 reste à 14/25 et le `dev` RGPD v2 à 18/19 après migration.
