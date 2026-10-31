# Références juridiques des actualités CNIL

## Target

Chaque actualité CNIL dont la page officielle cite des textes expose les références juridiques (instruments et articles), avec la même extraction déterministe que les arrêts CJUE.

## Hard constraints

- La source des références est la **page CNIL liée par l'entrée**, dans sa section « Textes de référence » ; le résumé RSS est trop court et ne porte pas les articles.
- L'extraction est la même que pour les arrêts CJUE : instruments et articles, déterministe, sans modèle, sans réécriture ; `[]` si aucune référence.
- Instruments reconnus : RGPD et règlement (UE) 2016/679, loi Informatique et Libertés et loi n° 78-17, Code des postes et des communications électroniques, directive 2002/58/CE (ePrivacy), directive 95/46/CE, Code de la consommation, directives citées ; articles numérotés, y compris les articles `L. 34-5` et suivants.
- Le périmètre couvre toutes les actualités CNIL dont la page cite des textes ; la section « Textes de référence » décide.
- Le format est instrument + articles, par exemple `Loi Informatique et Libertés · art. 82`.
- Chaque page dont les références sont retenues est conservée comme snapshot brut, pour l'audit.
- Une page inaccessible ne supprime pas l'entrée : elle reste publiée avec `references: []`, la passe signale la page sans bloquer.
- Les références s'affichent sur les cartes et les lignes CNIL, comme pour la CJUE ; aucune nouvelle vue.
- Le filtre de tags et le catalogue ne changent pas ; les références ne sont pas des tags.
- Les pages publiques restent statiques, sans JavaScript ; le pipeline est seul à faire les requêtes.
- Aucune analyse du corps de la décision : seules les références de la section officielle sont retenues.
- Les tests couvrent la page FNAC, une page sans référence, un échec de page et la donnée committée.

## Non-goals

- PISTE, Judilibre, la jurisprudence française : traités plus tard.
- Résumé ou extraction par un modèle ; analyse juridique du corps de la décision.
- Modification des tags, du filtre ou de l'espace de paramètres.
- Pagination et affichage progressif : contrat séparé.
- Nouvelles pages, recherche, déploiement.
- Réécriture des textes CNIL ou des titres.

## Done-when

- L'entrée FNAC porte au moins `Loi Informatique et Libertés · art. 82`, extrait de sa page.
- Une entrée CNIL dont la page n'a pas de « Textes de référence » porte `references: []`.
- La page de veille affiche les références sur la carte et la ligne FNAC.
- Une page inaccessible laisse l'entrée publiée avec `references: []` et la passe signale la page.
- Typecheck, tests, build et CI passent ; les pages publiques restent sans JavaScript.
- Les snapshots bruts des pages qui portent des références sont présents dans `data/raw/`.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la veille

## Context

- La description RSS de la FNAC fait 228 caractères et s'arrête à « traceurs (cookies) » ; elle ne cite aucun article.
- La page liée `https://www.cnil.fr/fr/sanction-cookies-app-fnac` répond 200 et contient « Textes de référence → Article 82 de la loi Informatique et Libertés ».
- L'extraction actuelle des arrêts CJUE vit dans `veille/references.ts` ; les entrées CNIL portent aujourd'hui `references: []`.
- L'interface affiche déjà les références sur les cartes et les lignes de veille pour la CJUE.
- Le catalogue de tags et le filtre de publication ne sont pas concernés.
- La pagination de la veille est un contrat séparé (`pagination-veille`) ; elle ne change pas ce périmètre.
