# Revue indépendante

Trois passes du vérificateur `aidd-dev-checker`, sans modification du travail par le vérificateur.

## Passe 1 — refus

- **Bloquant** : une recherche Judilibre interrompue (429, budget, plafond de pages) écrivait un corpus `cc` tronqué.
- Suggestions : `PDON` incomplet (La Quadrature du Net, Prokuratuur), comptage avant borne incluant les conclusions d'avocat général, 46 décisions retenues sur le seul sigle « CNIL », périodes et longueurs annoncées inexactes, niveaux d'éval confondus avec la table produit, `--limite` et invariant du manifeste, idempotence le lendemain, date et type des entrées CJUE de la veille, `get_decision` annonçant `cc`/`cjue`.

## Passe 2 — refus

- **Bloquant** : budget épuisé pendant la lecture des décisions ; le corpus existant était encore tronqué.
- Correctifs vérifiés : recherche interrompue, avant-borne à 43, retrait du sigle CNIL, périodes observées, `get_decision`, niveaux produit.
- Nouveaux constats : date CJUE fausse sur 5 captures (`1 er octobre`), chiffre « 46 » non reproductible, `403` résiduel dans `eval.md`, 429 CJUE classé en échec.

## Passe 3 — prêt à livrer

- Budget épuisé pendant les décisions : le corpus existant reste intact (test avec cache froid et corpus préexistant).
- Date CJUE : 125/125 conformes aux en-têtes.
- 429 CJUE : lève ; un échec de téléchargement ne remplace plus un corpus.
- Chiffres et portée de `--limite` alignés.
- `npm test` 670 tests / 669 pass / 0 fail / 1 skip ; typecheck et build verts.

## Constats résiduels non bloquants

- Un échec permanent CELLAR non-429 bloque une passe tant que le corpus existe : c'est le prix de la préservation ; un marquage par CELEX serait une amélioration ultérieure.
- Les tests de budget reposent sur les 22 requêtes du descripteur réel.

## Passe 4 — élargissement CJUE

- **Bloquant** : le CELEX `62019CJ0511` avait été présenté comme Prokuratuur ; c'est en réalité *Olympiako Athlitiko Kentro Athinon* (discrimination par l'âge). Il est retiré de la liste complémentaire. Le seul Prokuratuur est C-746/18.
- Correctifs : comptes 151 / 14 700, index 74 891 ; la notion `4.11.01` est déclarée large (six décisions ne traitent les données personnelles que partiellement) ; l'invariant des complémentaires écartés est couvert ; un test vérifie l'empreinte de liste.
- Vérifié : La Quadrature du Net (C-511/18) et Prokuratuur (C-746/18) présents ; requête union sans doublon ; 44 décisions avant borne ; éval CJUE 8/10 (MRR 0,750) inchangée.

## Décision

Candidate livrée en brouillon : PR #21.
