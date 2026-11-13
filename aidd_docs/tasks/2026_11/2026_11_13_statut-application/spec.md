---
status: approved
date: 2026-11-13
source: GitHub issue #33
---

# Contrat : Connaître le statut de chaque texte rendu

## Objectif observable

Chaque passage de `search`, chaque article de `get_article` et chaque décision de `get_decision` porte un `statut_application` uniforme — `en_vigueur`, `abroge`, `propose`, `pendant`, `rendue`, `adoptee` ou `inconnu` — distinct du statut source, qui reste affiché tel quel ; un article abrogé ou un texte proposé est rendu avec son statut et ses dates, jamais présenté comme applicable.

## Périmètre

- Un champ `statut_application` sur les trois sorties du serveur, calculé au rendu par une table par corpus.
- Nouveau module `mcp/corpus/statut.ts` : fonction pure de `(corpus, statut source, nature?)` vers le vocabulaire uniforme.
- Sont concernés les huit corpus présents : RGPD, AI Act, LIL, CNIL, Conseil d'État, CEPD, Cour de cassation, CJUE.
- Hors périmètre : ajout des textes proposés et des affaires pendantes (#24, #56), fraîcheur et périmètre dans chaque réponse (#34), classement des documents absents (#32), statut d'un document hors corpus, veille.

## Critères d'acceptation

1. Chaque passage de `search`, chaque `get_article` trouvé et chaque décision de `get_decision` porte `statut_application`, avec l'une des sept valeurs.
2. Le champ `statut` existant garde sa valeur source, sans réécriture : un statut de publication (`Publié au Bulletin · Cassation`), un type d'acte (`Arrêt de la Cour`) ou un statut Légifrance (`VIGUEUR`) restent lisibles à côté.
3. La table rend : `rgpd` et `aiact` `en_vigueur` → `en_vigueur` ; `lil` `VIGUEUR` → `en_vigueur` et `ABROGE` → `abroge` ; `ce`, `cc` et `cjue` → `rendue` quel que soit le statut source ; `cnil` sanction → `rendue`, avis et recommandation → `adoptee` ; `cepd` → `adoptee`. Une abrogation déclarée par la source (`ABROGE`) prime sur la nature : une recommandation CNIL abrogée rend `abroge`.
4. Une valeur source non reconnue rend `inconnu`, jamais `en_vigueur` ni une valeur par défaut qui affirmerait l'applicabilité.
5. `propose` et `pendant` existent dans le type et la table, et sont testés sur la fonction pure ; aucun corpus ne les porte aujourd'hui, ils arrivent avec #24.
6. Un article abrogé est rendu avec `statut_application: "abroge"`, son `date_fin` et son `date_debut`, jamais comme applicable ; prouvé sur une unité de test portant `ABROGE`.
7. Un article de la loi 78-17 porte le statut et la date de la version consolidée rendue (`date_debut` de l'article), pas d'une version antérieure.
8. Les descriptions de `search`, `get_article` et `get_decision` nomment `statut_application` et disent qu'un texte abrogé ou proposé n'est jamais applicable ; `npm run typecheck`, `npm test` et `npm run build` passent.

## Décisions

| #   | Décision                                                                                             | Raison                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Une table de correspondance par corpus dans le code, pas un champ écrit dans `data/`.                  | Choix de l'utilisateur : les unités portent déjà un statut source, aucune synchronisation réseau à relancer, aucun réindex, et la table se teste hors ligne.                |
| 2   | `statut_application` est un champ ajouté, `statut` reste la valeur source.                            | L'acceptation exige que le statut de publication des décisions reste distinct ; réécrire `statut` ferait perdre le type d'acte et la publication.                         |
| 3   | Les lignes directrices du CEPD et les avis ou recommandations CNIL reçoivent `adoptee`, sauf abrogation déclarée. | Choix de l'utilisateur : une ligne directrice n'a pas force de loi ; l'appeler « en vigueur » laisserait croire l'inverse. Une abrogation déclarée par la source prime, sans quoi 471 unités CNIL (`ABROGE`) seraient présentées comme adoptées, donc applicables. |
| 4   | Les décisions juridictionnelles et les sanctions CNIL reçoivent `rendue`.                             | C'est le mot du récit ; leur statut source (publication, type d'acte) reste affiché à côté.                                                                                |
| 5   | Une valeur inconnue rend `inconnu`, jamais `en_vigueur`.                                              | Même principe que #31 : le serveur n'affirme pas ce qu'il n'a pas vérifié.                                                                                                  |
| 6   | Le calcul se fait au rendu, dans `tools.ts`, jamais dans l'index.                                      | Aucun réindex, aucun changement de `data/` ; la table ne dépend que de champs déjà portés par chaque unité.                                                                 |
| 7   | `propose` et `pendant` sont déclarés dès maintenant.                                                   | #24 et #56 les alimenteront sans rouvrir le contrat ; les nommer évite une seconde migration du vocabulaire.                                                               |
| 8   | Le statut d'un document hors corpus reste hors périmètre.                                              | Le classement de #32 ne porte aucun texte ; déclarer « abrogé » un document absent demanderait une déclaration, pas une déduction.                                          |

## Preuve de réussite

- Tests unitaires de la table : les six vocabulaires sources, `propose`/`pendant`, la valeur inconnue, et les deux natures CNIL.
- Tests d'outils : `statut_application` présent et exact sur `get_article` (RGPD, LIL), `get_decision` (CNIL) et `search` (CJUE, CEPD).
- Test d'un article abrogé sur une racine temporaire : `abroge`, `date_fin` rendue, aucune réécriture du `statut` source.
- Descriptions d'outils assertées par `tests/mcp.test.ts`.
- `npm run typecheck`, `npm test` et `npm run build` verts.
