# Plan — #137 EHDS et ses actes d'exécution (corpus `sante_ue`)

Exécute avec le skill **aidd-orchestrator:01-sdlc**, en mode autonome. **Le cadrage et le plan ci-dessous sont déjà faits et validés : ne replanifie pas, ne change pas la conception ; passe directement à l'implémentation, puis à la revue indépendante et à la vérification.**

Lis d'abord : `AGENTS.md`, `aidd_docs/memory/data.md` (sections Corpus, « Corpus économie des données » ajouté par #131, veille `eurlex`), `aidd_docs/memory/codebase-map.md`, `gh issue view 137 -R Beccariavf/vitrine`, `aidd_docs/tasks/2026_11/2026_11_25_mcp-gouvernance-donnees/03-sante-textes-autorites.md` § 2.1-2.2.
Code à réutiliser : **le corpus `donnees` de #131 est le modèle exact** — descripteurs `mcp/corpus/donnees-*.json`, `mcp/corpus/donnees/parse.ts` (`parseDonnees`, annexes, points), `writeCorpusMulti`, `INSTRUMENTS` de `mcp/corpus/citations.ts`, `veille/sources/eurlex.ts` (consolidations `VALUES` ; requête « décisions prises sur le fondement du RGPD » pour les actes d'exécution), et la façon dont `donnees` puis `cada` ont été ajoutés aux listes (`mcp/server.ts`, `mcp/tools.ts`, `mcp/index/search.ts`, `mcp/corpus/statut.ts`, `src/lib/corpus.ts`, `src/lib/familles.ts`, `mcp/corpus/sync*.ts`, `mcp/corpus/veille.ts`). Réutilise `parseDonnees` (généralise-le si besoin plutôt que de le copier).

## Critères d'acceptation (font foi)
1. Chaque acte est au nouveau corpus `sante_ue`, article par article (considérants, annexes), lu sur CELLAR : règlement (UE) 2025/327 EHDS `32025R0327` ; règlements d'exécution `32026R0771`, `32026R2083`, `32026R2098`.
2. Le manifeste liste les CELEX ; la veille détecte les actes d'exécution à venir de l'EHDS (actes pris sur le fondement de `32025R0327`, échéance mars 2027) et les vise au corpus `sante_ue` (au minimum « manquant » détecté, sur le modèle des décisions d'adéquation ; ajout automatique au descripteur si le mécanisme existant le permet sans nouvelle architecture).
3. Les citations de l'EHDS (« règlement (UE) 2025/327 », « EHDS », « espace européen des données de santé ») ne sont plus « hors corpus ».
4. Aucun autre corpus ne change.

## Conception imposée
- Relis chaque CELEX sur CELLAR (titre, dates, consolidation) avant le descripteur ; comptes lus sur la capture. Un acte non découpable proprement est écarté et déclaré, sans bricolage. CELLAR seulement, jamais eur-lex.europa.eu, aucun contournement.
- Dates : EHDS entré en vigueur le 2025-03-26 ; application échelonnée (2027, 2029, 2031) : `date_debut` = date d'application générale lue à l'article final ; décris l'échelonnement dans le manifeste, pas par article.
- Ajoute `32025R0327` aux actes suivis de `preparation` si ce n'est pas déjà le cas (vérifie : #134 l'a probablement fait).
- Mets à jour les comptes et listes de corpus (« vingt et un » → « vingt-deux ») sobrement ; la présentation d'ensemble est #136.
- `data/` écrit seulement par `npm run corpus:build -- --document sante_ue`.
- Index : `data/corpus/index/index.db` est déjà là (copie). `npm run corpus:index` en **incrémental uniquement**.
- Ne touche pas à `mcp/corpus/textes-fr/` ni `data/corpus/textes_fr/` (ticket #138 en parallèle).

## Validation
- `npm run typecheck` et `npm test` verts ; tests hors ligne : manifeste à 4 `documents[]`, citation « article 53 du règlement (UE) 2025/327 » attribuée et présente, détection d'un acte d'exécution fondé sur l'EHDS par la veille (réponse SPARQL simulée).
- Preuve réelle : build (comptes par acte), `corpus:index`, `search` `corpus: "sante_ue"` « finalités interdites de l'utilisation secondaire » → art. 54 EHDS, `get_article` EHDS art. 53.
- Mets à jour `data.md` et `coverage.md` sobrement.

## Livraison
- Branche courante `feat/sante-ue`. Commits `feat(#137): …`.
- PR en **brouillon** (`gh pr create --draft`), `Closes #137`. Ne fusionne jamais.
- Compte rendu de 12 lignes max : comptes par acte, preuve, tests exacts, URL de la PR, non faits.
