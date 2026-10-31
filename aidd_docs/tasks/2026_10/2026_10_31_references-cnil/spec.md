# Références juridiques des sanctions CNIL

## Target

Chaque sanction de la CNIL publiée expose les références juridiques (instruments et articles) citées par sa page officielle, avec la même extraction déterministe que les arrêts CJUE.

## Hard constraints

- La source des références est la **page CNIL liée par l'entrée**, dans sa section « Textes de référence » ; le résumé RSS est trop court et ne porte pas les articles.
- L'extraction est la même que pour les arrêts CJUE : instruments et articles, déterministe, sans modèle, sans réécriture ; `[]` si aucune référence.
- Instruments reconnus : RGPD et règlement (UE) 2016/679, loi Informatique et Libertés et loi n° 78-17, Code des postes et des communications électroniques, directives citées ; articles numérotés, y compris les articles `L. 34-5` et suivants.
- Le format est instrument + articles, par exemple `Loi Informatique et Libertés · art. 82`.
- Chaque page dont les références sont retenues est conservée comme snapshot brut, pour l'audit.
- Une page inaccessible ne supprime pas l'entrée : elle reste publiée avec `references: []` et la passe signale la page.
- Les références s'affichent sur les cartes et les lignes CNIL, comme pour la CJUE ; aucune nouvelle vue.
- Le filtre de tags et le catalogue ne changent pas ; les références ne sont pas des tags.
- Les pages publiques restent statiques, sans JavaScript ; le pipeline est seul à faire les requêtes.
- Aucune analyse du corps de la décision : seules les références de la section officielle sont retenues.
- Les tests couvrent la page FNAC, une page sans référence, un échec de page et la donnée committée.

## Non-goals

- PISTE, Judilibre, la jurisprudence française : traités plus tard.
- Résumé ou extraction par un modèle ; analyse juridique du corps de la décision.
- Modification des tags, du filtre ou de l'espace de paramètres.
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

- Une page inaccessible doit-elle faire échouer la passe (exit 1) ou seulement avertir (exit 0) en publiant l'entrée avec `[]` ? Recommandation : avertir et publier, l'enrichissement ne doit pas bloquer la veille.
- Faut-il aussi conserver les pages sans référence ? Recommandation : non, le snapshot du flux et les pages référencées suffisent.
- Au-delà du RGPD, de la loi Informatique et Libertés et du CPCE, faut-il reconnaître la directive ePrivacy, la directive 95/46 ou le Code de la consommation ?
- Le périmètre est-il toutes les actualités CNIL dont la page cite des textes, ou uniquement les sanctions ? Recommandation : toutes les entrées, la section décide.

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
