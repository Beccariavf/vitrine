# Jurisprudence CJUE via EUR-Lex

## Target

La veille intègre la jurisprudence CJUE via EUR-Lex, limitée aux tags RGPD et droits des données qu'un espace de paramètres permet d'activer, et la sélection s'applique à la passe suivante.

## Hard constraints

- Source : le flux public de jurisprudence CJUE d'EUR-Lex ; aucun compte, aucune clé, aucun PISTE.
- Périmètre : jurisprudence uniquement ; la législation EUR-Lex et les actes du Journal officiel sont exclus.
- Tags : un catalogue nommé ; chaque tag porte un jeu de motifs ; un arrêt est retenu s'il correspond à au moins un tag actif.
- Filtre : aucun faux positif du type « droit d'accès à un avocat » ou « protection juridictionnelle » ; les tests couvrent les cas positifs et négatifs.
- Paramètres : la sélection est persistée et versionnée ; elle survit à un redémarrage ; l'espace de paramètres ne dépend ni d'un serveur, ni d'une base, ni d'un service payant.
- Pages publiques : statiques, sans JavaScript, sans requête réseau au build, 0 €.
- Contenu : titre et résumé issus du titre officiel, rien d'inventé ; date de décision ; source `cjeu` ; doublons `_SUM`/`_RES` dédupliqués ; `_INF` ignoré.
- Les deux sources coexistent ; une panne du flux CJUE ne fait pas perdre les entrées CNIL et la passe signale l'échec.
- Attribution EUR-Lex / CC BY 4.0 visible.
- Le snapshot brut du flux est conservé.

## Non-goals

- Législation, Journal officiel L, actes et propositions.
- Jurisprudence française (Judilibre, Légifrance) tant que PISTE est bloqué.
- Comptes, recherche plein texte, serveur, base de données, déploiement.
- Réécriture ou résumé par un modèle.
- Filtrage par les visiteurs, sauf réponse contraire à la première question ouverte.
- Pages de détail, pagination.

## Done-when

- Un arrêt RGPD réel, Jautiva C-798/24, apparaît avec titre, résumé, date, URL et source.
- Un arrêt hors périmètre, par exemple sur la citoyenneté ou l'aide juridictionnelle, est rejeté.
- L'espace de paramètres liste les tags et leur état ; désactiver RGPD puis relancer la passe retire les arrêts RGPD.
- Les tags actifs sont visibles sur la page de veille.
- Les entrées CNIL restent affichées ; les doublons `_SUM`/`_RES` ne produisent qu'une entrée.
- Typecheck, tests, build et CI passent ; les pages publiques restent sans JavaScript ; l'attribution est visible.
- Un échec du flux CJUE laisse les entrées CNIL en place et signale clairement l'erreur.

## Open Questions

- L'espace de paramètres est-il réservé au propriétaire (local, non déployé) ou accessible aux visiteurs ? Cette réponse décide de l'architecture : configuration locale d'un côté, pages de tags statiques de l'autre.
- Le catalogue initial doit-il contenir seulement RGPD et droits des données, ou inclure aussi IA et cybersécurité comme tags inactifs ?
- Les arrêts doivent-ils afficher leurs tags sur la carte, ou seulement les tags actifs en tête de page ?

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la veille ; le propriétaire pour les paramètres

## Context

- Recherche et tests de flux : [`research.md`](./research.md).
- Flux retenu : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163`.
- Cas de référence : Jautiva, C-798/24, arrêt RGPD du 3 septembre 2026.
- PISTE/Judilibre est bloqué pour l'instant ; la CJUE via EUR-Lex est la source de jurisprudence disponible.
- La veille actuelle vient de la CNIL ; l'architecture à un adaptateur par source est déjà en place.
