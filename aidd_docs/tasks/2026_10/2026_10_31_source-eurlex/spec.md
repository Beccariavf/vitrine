# Jurisprudence CJUE via EUR-Lex

## Target

La veille intègre la jurisprudence CJUE via EUR-Lex, filtrée par les tags RGPD et droits des données que le propriétaire active, et chaque arrêt expose les références juridiques citées par son titre officiel.

## Hard constraints

- Source : le flux public de jurisprudence CJUE d'EUR-Lex ; aucun compte, aucune clé, aucun PISTE.
- Périmètre : jurisprudence uniquement ; la législation EUR-Lex et les actes du Journal officiel sont exclus.
- Catalogue de tags : quatre tags — `RGPD`, `droits des données`, `IA`, `cybersécurité`. Les deux premiers sont actifs, les deux derniers inactifs. Les motifs de chaque tag sont versionnés ; activer un tag ne demande aucun changement de code.
- Motifs actifs : protection des données, données à caractère personnel, RGPD, règlement 2016/679, directive 95/46, vie privée, ePrivacy, CNIL, CEPD, cookies, traceurs, consentement, transfert de données, décision d'adéquation, clauses types, Privacy Shield, portabilité, effacement, oubli, données de santé, biométrie, reconnaissance faciale, vidéosurveillance, géolocalisation, profilage, décision automatisée, violation de données, personne concernée, responsable du traitement, sous-traitant, conservation des données, PNR, espace européen des données, données ouvertes.
- Filtre : pas de faux positifs du type « droit d'accès à un avocat », « protection juridictionnelle », « traitement » procédural, « personnel » ou « informatique ».
- Références juridiques : chaque arrêt expose les références principales de son titre officiel, sous la forme instrument + articles. Rien n'est inventé. Le contrat `Entry` porte `references: string[]` ; les entrées CNIL portent `[]`. Les références sont affichées sur la carte et sur la ligne.
- Paramètres : espace réservé au propriétaire, local, non déployé. La sélection est persistée et versionnée ; les pages publiques affichent les tags actifs en lecture seule. Aucun serveur, aucune base, aucun service payant.
- Pages publiques : statiques, sans JavaScript, sans requête réseau au build, 0 €.
- Contenu : titre et résumé issus du titre officiel ; date de décision ; source `cjeu` ; doublons `_SUM`/`_RES` dédupliqués ; `_INF` ignoré.
- Les deux sources coexistent ; une panne du flux CJUE ne fait pas perdre les entrées CNIL et la passe signale l'échec.
- Attribution EUR-Lex / CC BY 4.0 visible.
- Le snapshot brut du flux est conservé.

## Non-goals

- Législation, Journal officiel L, actes et propositions.
- Jurisprudence française (Judilibre, Légifrance) tant que PISTE est bloqué.
- Comptes, recherche plein texte, serveur, base de données, déploiement.
- Réécriture ou résumé par un modèle.
- Paramètres ouverts aux visiteurs ; filtrage public par tags.
- Analyse exhaustive des arrêts : on extrait les références du titre officiel, pas les considérants ni la jurisprudence citée dans le corps.
- Pages de détail, pagination.

## Done-when

- L'arrêt Jautiva, C-798/24, apparaît avec son titre, son résumé, sa date, son URL, sa source et ses références (règlement 2016/679, articles 5 et 6 ; directive 2017/1132, article 14).
- Un arrêt hors périmètre, par exemple sur la citoyenneté ou l'aide juridictionnelle, est rejeté.
- L'espace de paramètres liste les quatre tags et leur état ; désactiver RGPD puis relancer la passe retire les arrêts RGPD ; activer IA fait entrer les arrêts IA s'il y en a.
- Les tags actifs sont visibles sur la page de veille.
- Les références juridiques sont visibles sur chaque carte et chaque ligne CJUE.
- Les entrées CNIL restent affichées avec `references: []`.
- Les doublons `_SUM`/`_RES` ne produisent qu'une entrée ; `_INF` est ignoré.
- Typecheck, tests, build et CI passent ; les pages publiques restent sans JavaScript ; l'attribution est visible.
- Un échec du flux CJUE laisse les entrées CNIL en place et signale clairement l'erreur.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la veille ; le propriétaire pour les paramètres

## Context

- Recherche et tests de flux : [`research.md`](./research.md).
- Flux retenu : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163`.
- Cas de référence : Jautiva, C-798/24, arrêt RGPD du 3 septembre 2026.
- PISTE/Judilibre est bloqué pour l'instant ; la CJUE via EUR-Lex est la source de jurisprudence disponible.
- Décisions : paramètres réservés au propriétaire ; quatre tags dont deux actifs ; références juridiques par arrêt, pas de tag générique.
