# Recherche — EUR-Lex, jurisprudence CJUE

Date : 31 octobre 2026. Objet : vérifier si la jurisprudence de la CJUE peut alimenter la veille sans PISTE, et identifier les filtres RGPD / droits des données.

## Verdict court

**Oui, via le flux RSS de la jurisprudence CJUE.** C'est public, gratuit, en français, sans PISTE. En revanche, le flux est **large** : la jurisprudence RGPD y est rare. Le filtre doit être précis, et la veille restera sélective.

Flux retenu : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163` — « 2 - Toute la jurisprudence de la Cour de justice de l'Union européenne ».

## Pourquoi 163 et pas 164

| Flux | Contenu | Cas RGPD trouvé |
| --- | --- | --- |
| **163** | Toute la jurisprudence CJUE (Cour, Tribunal, ordonnances, conclusions) | **Jautiva, C-798/24** |
| 164 | Jurisprudence de la Cour de justice | 0 sur les 100 derniers items |

Le cas Jautiva est un arrêt RGPD (publicité des données personnelles des actionnaires, règlement 2016/679). Il n'apparaît que dans le flux 163. Le flux 163 est donc le bon point d'entrée.

## Ce que contient le flux

100 items. La date de décision est dans le titre ; un `pubDate` de publication existe pour une partie des items (72/100 au 31/10/2026), mais il ne donne pas la date de décision : Jautiva porte `pubDate` 26/10 pour une décision du 03/09. La date de décision reste la source. Les titres contiennent des espaces insécables (`3 septembre 2026`, `Article 5`) : normaliser `\u00a0` et `\s` avant toute regex. Deux formats principaux :

```text
Arrêt de la Cour (première chambre) du 12 mars 2026.#Minister for Justice contre I.T.#Renvoi préjudiciel – Citoyenneté...#Affaire C-477/24.
```

```text
Affaire C-798/24, Jautiva: Arrêt de la Cour (première chambre) du 3 septembre 2026 (...) – A e. a. [Renvoi préjudiciel – Protection des personnes physiques à l'égard du traitement des données à caractère personnel – Règlement (UE) 2016/679 – ...]
```

Le second format contient le sujet entre crochets : c'est un **résumé prêt à l'emploi**. Le premier contient le sujet après le deuxième `#`.

## Filtres RGPD / droits des données

Règle à deux niveaux pour éviter les faux positifs :

1. Une **expression forte** sur les données, ou
2. le mot **« données »** accompagné d'une action ou d'une notion des données.

Expressions fortes de départ :

- protection des données, données à caractère personnel, données personnelles
- règlement (UE) 2016/679, RGPD, directive 95/46/CE
- vie privée, ePrivacy, communications électroniques
- CNIL, comité européen de la protection des données, contrôleur européen de la protection des données, autorité de protection des données
- cookies, traceurs, consentement
- transfert de données, décision d'adéquation, clauses contractuelles types, Privacy Shield, Safe Harbor
- droits : accès, effacement, oubli, portabilité
- données de santé, données biométriques, reconnaissance faciale, vidéosurveillance, géolocalisation
- profilage, décision automatisée, violation de données, analyse d'impact
- personne concernée, responsable du traitement, sous-traitant
- conservation des données, secret des communications, métadonnées
- dossiers passagers, PNR
- espace européen des données, gouvernance des données, libre circulation des données, données ouvertes, réutilisation des données

À exclure seuls, car trop larges :

- « droit d'accès » : faux positif sur l'accès à un avocat ou à un dossier social ;
- « protection » : faux positif sur la protection juridictionnelle ;
- « traitement » : faux positif sur le traitement procédural ;
- « personnel » : faux positif sur le personnel ;
- « informatique » : faux positif sur les prestataires IT.

Test sur les 100 items du flux 163 : **1 seul cas retenu**, Jautiva. C'est le bon résultat pour un filtre RGPD strict. Le réglage ultérieur pourra ajouter l'IA, la gouvernance des données, la cybersécurité et les données ouvertes pour élargir.

## Mapping vers le contrat `Entry`

| Champ | Règle |
| --- | --- |
| `id` | `sha256` de l'URL FR complète, CELEX en query, 16 hex ; ne pas passer par `canonicalUrl`, qui supprime la query et donnerait le même id à tous les arrêts |
| `title` | Nom de l'affaire + numéro + type/date : « Jautiva (C-798/24) — Arrêt de la Cour du 3 septembre 2026 » |
| `url` | `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62024CA0798` |
| `publishedAt` | Date de la décision, à **12:00 UTC** (pas de date de publication dans le flux) |
| `summary` | Sujet officiel : partie après le dernier `#` ou contenu entre `[...]`, nettoyé et tronqué à 200 caractères |
| `source` | `cjeu` |

Le `title` et le `summary` proviennent tous deux du titre officiel : rien n'est inventé. Le résumé est le vrai sujet juridique de l'arrêt, pas une reformulation.

## Parsing à prévoir

- Retirer le préfixe `CELEX:...:`.
- Format `#` : `part0` type/court/date, `part1` parties, `part2` sujet, `part3` numéro d'affaire.
- Format `Affaire C-...: ... [sujet]` : nom, numéro, type/date, parties, sujet entre crochets.
- Date : `(\d{1,2}) (janvier|…|décembre) (\d{4})`, après « du » ou « présentées le ».
- Doublons : le même arrêt peut apparaître en `_SUM` et `_RES` ; dédupliquer sur la base du CELEX, préférer le texte intégral, ignorer `_INF` (information procédurale).
- Fallback : titre complet, résumé `null`, jamais d'échec silencieux.

## Volume réel

Sur 100 items de jurisprudence, **1 cas RGPD**. Le flux couvre plusieurs semaines. La veille CJUE sera donc **rare**, mais très pertinente. Le réglage ultérieur (IA, données ouvertes, cybersécurité) élargira le spectre. Pour une veille RGPD quotidienne, le flux CNIL reste la source principale ; la CJUE apporte la jurisprudence.

## Impacts UI et licences

- `SOURCE_LABELS` : ajouter `cjeu: "CJUE"`.
- Accueil : « CNIL · 10 actualités » devient dynamique ; la carte produit et la description mentionnent la CJUE.
- Veille : « Corpus public · CNIL » devient « Corpus public · CNIL + CJUE ».
- Pied de page : « Sources : CNIL, CJUE » et mention **EUR-Lex / CC BY 4.0**.
- Statistiques : « Sources » passe à 2.
- Les cartes CJUE auront un vrai résumé (le sujet), donc pas de carte vide.
- Le titre CJUE est plus court que les titres de législation : pas besoin de clamper agressivement.

## Risques

- **Volume faible** : 1 cas RGPD par centaine d'items ; c'est la réalité du flux CJUE, pas un bug.
- **Formats de titres** : `#`, crochets, « Affaire C-... » ; le parseur doit être testé sur les deux fixtures.
- **Date de décision dans le titre, `pubDate` partiel** : le `pubDate` est une date de publication, pas la date de l'arrêt ; il sert seulement de secours.
- **Espaces insécables** : les titres réels en contiennent ; une regex à espace ordinaire échoue.
- **Identifiant** : l'URL EUR-Lex porte le CELEX en query ; `canonicalUrl` la réduirait à `/legal-content/FR/TXT`, donc un id identique pour tous.
- **Doublons `_SUM`/`_RES`** : dédupliquer sur la base CELEX.
- **Langue** : le flux est en français ; vérifier les rares items non traduits.
- **Attribution** : CC BY 4.0 ; mention dans le pied de page ou une page « Sources et licences ».

## Recommandation

Construire l'adaptateur **jurisprudence CJUE via EUR-Lex (rssId=163)** comme deuxième source :

1. snapshot brut du flux ;
2. filtre RGPD à deux niveaux, appliqué au **titre officiel** (le titre d'affichage ne garde pas le sujet) ;
3. titre = affaire + numéro + type/date ;
4. résumé = sujet officiel, tronqué à 200 ;
5. références extraites du sujet officiel, avec normalisation des espaces insécables ;
6. date de décision extraite du titre, à midi UTC ; `pubDate` en secours ;
7. identifiant sur l'URL complète ou le CELEX, jamais sur `canonicalUrl` ;
8. `source: "cjeu"` ;
9. déduplication `_SUM`/`_RES` ;
10. mise à jour des libellés CNIL et de l'attribution ;
11. la passe applique les tags actifs et retire de `data/entries` les arrêts CJUE devenus inactifs ; le snapshot brut reste la preuve.

Le réglage du filtre (IA, données ouvertes, cybersécurité) viendra après la première passe, avec les cas réels sous les yeux.

## Sources

- Flux jurisprudence : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163`
- Avis juridique : `https://eur-lex.europa.eu/content/legal-notice/legal-notice.html`
- Réutilisation : `https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html`
