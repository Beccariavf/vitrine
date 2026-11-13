---
status: approved
date: 2026-11-13
source: GitHub issue #34
---

# Contrat : Voir le périmètre et la fraîcheur du corpus dans chaque réponse

## Objectif observable

Chaque réponse de `search`, `get_article` et `get_decision` porte un bloc `perimetre` : les corpus interrogés, chacun avec sa fraîcheur — `a_jour_au` de la dernière synchronisation réussie s'il est sous veille, sinon instantané fixe daté par `arrete_le` ou non daté — et un renvoi vers les exclusions déclarées, que `etat_corpus` rend désormais par corpus. Une recherche `aucun_resultat_fiable` ajoute un avertissement qui rappelle ce périmètre et ne conclut jamais que la règle n'existe pas.

## Périmètre

- Nouveau champ `perimetre` sur les trois sorties, calculé au rendu dans `mcp/tools.ts` depuis `data/corpus/sync.json` et les manifestes : aucun réseau, aucun index, aucun réindex.
- `etat_corpus` : chaque entrée de `corpus` porte en plus `couverture`, le bloc déclaré par son manifeste (`null` s'il manque). C'est la cible du renvoi.
- Descriptions des trois outils et consigne serveur mises à jour.
- Hors périmètre : modifier les manifestes ou la synchronisation, normaliser les exclusions entre corpus, une date de fraîcheur par corpus issue de `corpus:sync`, les dates d'application échelonnées (#24).

## Critères d'acceptation

1. `search`, `get_article` (trouvé ou non) et `get_decision` (trouvé ou non) rendent `perimetre: { corpus, document?, exclusions }`.
2. `perimetre.corpus` liste les corpus interrogés, chacun `{ corpus, veille, a_jour_au, arrete_le }` : le corpus demandé ; sinon le corpus dont le manifeste déclare le document demandé ou nommé (`32016R0679` → `rgpd`) ; sinon tous les corpus de l'inventaire. `document` est présent quand l'appel est borné à un document.
3. `veille` est vrai pour les sources que `npm run corpus:sync` revérifie (`ORDRE_SOURCES` : `cnil`, `ce`, `cc`, `cjue`). Leur `a_jour_au` vaut celui du rapport, `null` sans passe réussie ou sans rapport. Un corpus statique (`rgpd`, `aiact`, `lil`, `cepd`) a toujours `a_jour_au: null` et n'est jamais présenté comme à jour ; `arrete_le` vient de son manifeste, `null` s'il n'en porte pas.
4. `perimetre.exclusions` renvoie à `etat_corpus` (`corpus[].couverture`), et `etat_corpus` rend `couverture` pour chaque corpus, tel que son manifeste le déclare.
5. Une recherche `aucun_resultat_fiable` porte `perimetre.avertissement` : il nomme chaque corpus interrogé avec sa fraîcheur (sous veille et à jour au …, sous veille sans passe réussie, instantané fixe arrêté le … ou non daté), et dit que l'absence de résultat ne prouve pas l'absence de la règle. Il n'est jamais présent sur `confiant` ni `incertain`. Le `message` existant reste inchangé.
6. Les descriptions de `search`, `get_article` et `get_decision` nomment `perimetre` et interdisent de conclure à l'inexistence d'une règle ; `npm run typecheck`, `npm test` et `npm run build` passent.

## Décisions

| #   | Décision | Raison |
| --- | -------- | ------ |
| 1   | Un bloc `perimetre` ajouté, pas un texte fondu dans `message`. | Champ lisible par machine ; les messages actuels, assertés à l'égalité, restent stables. |
| 2   | Fraîcheur par corpus : `a_jour_au` seulement pour les corpus sous veille, `arrete_le` pour tous. | Révisée après revue : `corpus:sync` ne revérifie que `cnil`, `ce`, `cc` et `cjue` ; appliquer son `a_jour_au` au RGPD dirait à jour un texte que personne n'a revérifié. |
| 3   | Le renvoi pointe vers `etat_corpus`, qui expose le bloc `couverture` brut. | Les exclusions sont déclarées sous des formes différentes par corpus ; les recopier dans chaque réponse alourdirait la charge (13 Ko pour les huit) et les normaliser sort du ticket. |
| 4   | `couverture` est ajouté à `etat_corpus` seulement, pas à `inventaireCorpus`. | `inventaireCorpus` alimente aussi `sync.json` : y recopier les manifestes le gonflerait sans besoin. |
| 5   | Un document non déclaré par un manifeste (décision `CNILTEXT…`, identifiant inconnu) garde tous les corpus, avec `document` renseigné. | Le retrouver demanderait de relire toutes les unités à chaque réponse ; `document` dit déjà la borne. |
| 6   | L'avertissement vit dans `perimetre`, seulement sur `aucun_resultat_fiable`. | C'est le cas du critère ; sur un résultat trouvé il serait du bruit. |

## Limites assumées

- `a_jour_au` est `null` tant que `npm run corpus:sync` n'a pas réussi une passe : le bloc le dit.
- Les manifestes `rgpd` et `aiact` ne portent aucune date d'extraction : ces deux corpus sont dits « instantané fixe non daté ». Faire écrire `date_extraction` par `npm run corpus:build` relève d'un ticket suivant.
- Le renvoi demande un second appel (`etat_corpus`) pour lire le détail des exclusions.

## Preuve de réussite

- Tests d'outils sur racine temporaire : `perimetre` sur les trois sorties, corpus déduit du paramètre, du document et de l'inventaire, `a_jour_au` lu au rapport et `null` sans rapport.
- Test d'avertissement : présent sur `aucun_resultat_fiable`, absent sur `confiant`, `message` inchangé.
- Test `etat_corpus` : `couverture` rendue par corpus.
- Descriptions assertées par `tests/mcp.test.ts`.
- `npm run typecheck`, `npm test` et `npm run build` verts.
