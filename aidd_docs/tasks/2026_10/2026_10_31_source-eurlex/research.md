# Recherche — EUR-Lex comme deuxième source

Date : 31 octobre 2026. Objet : vérifier si EUR-Lex peut alimenter la veille sans compte PISTE, avant de rédiger le contrat.

## Verdict court

**Oui, via le flux RSS des actes du Journal officiel L.** C'est public, gratuit, en français, daté par acte, et cela couvre les actes numériques européens. Pas besoin de PISTE, de SPARQL ni de scraping du site.

Le flux à retenir : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=165` — « 7 - Actes du Journal officiel L ».

## Ce qui a été testé

| Piste | Résultat | Verdict |
| --- | --- | --- |
| Flux RSS `rssId=165` | 200, 100 actes, 18 actes le 30 octobre, dates du 22 au 30 octobre | **Retenu** |
| Flux RSS `rssId=162` | « Toute la législation du Parlement et du Conseil », 6 actes le 30 octobre | Sous-ensemble, moins complet |
| Flux RSS `rssId=163/164` | Jurisprudence CJUE, 100 items, pas de `pubDate` par acte | Alternative, plus tard |
| Flux RSS `rssId=166` | Actes du JO C, 100 items, dates par acte | Notices, pas la priorité |
| Flux RSS `rssId=168/169` | Éditions complètes du JO, 100 éditions, pas d'acte | Inadapté |
| Site JO L quotidien | 202 vide pour un client HTTP (challenge) | Inadapté au pipeline |
| Cellar / SPARQL | Métadonnées dans des graphes nommés ; RDF GDPR = 62 Mo | Trop lourd |
| Cellar REST par CELEX | RDF énorme ; HTML/PDF refusés sur l'URI de travail | Inadapté |
| Licence | Contenu EUR-Lex réutilisable sous CC BY 4.0 avec attribution | Compatible |

Le flux accepte l'agent du projet (`vitrine-veille/0.1 (+https://github.com/Beccariavf/vitrine)`), pas seulement un navigateur.

## Ce que contient le flux 165

Exemple d'item :

```text
<title>CELEX:32026R2408: Règlement délégué (UE) 2026/2408 de la Commission du 20 juillet 2026 modifiant le règlement délégué (UE) 2019/20...</title>
<pubDate>Fri, 30 Oct 2026 00:00:00 +0100</pubDate>
<link>https://eur-lex.europa.eu/./legal-content/AUTO/?uri=CELEX:32026R2408</link>
```

- `pubDate` est la date de publication au JO, pas la date de l'acte. Les 18 actes du 30 octobre partagent cette date.
- Le titre officiel est long ; le préfixe `CELEX:...:` est technique.
- Aucune description : le flux ne fournit pas de résumé.
- Certains items ne sont pas en français. Exemple : `CELEX:32022R2065R(11)`, corrigendum allemand du DSA, avec `description` = « Le rectificatif ne concerne pas la version française. » À ignorer.
- Le flux couvre environ 7 jours de publication (100 actes). Une passe quotidienne suffit ; une panne de plus d'une semaine peut perdre des actes.

## Mapping vers le contrat `Entry`

| Champ | Règle |
| --- | --- |
| `id` | `sha256` de l'URL FR canonique, 16 hex, comme aujourd'hui |
| `title` | Titre de l'item, préfixe `CELEX:...:` retiré, entités décodées, espaces normalisés ; texte officiel conservé |
| `url` | `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:<celex>` |
| `publishedAt` | Date du `pubDate`, ramenée à **12:00 UTC** pour éviter le décalage de fuseau |
| `summary` | `null` : le flux n'en fournit pas ; le texte officiel reste accessible par le lien |
| `source` | `eurlex` |

Le titre reste long. La grille devra **clamper le titre à 3 lignes** ; la vue liste garde le titre complet. Le corps de carte sans résumé est déjà géré (cas FNAC).

## Filtre « droit du numérique »

Le flux contient toute la législation. Un filtre par mots-clés sur le titre est nécessaire. Les termes trop larges produisent des faux positifs : « données » seul, « produits » seul, « plateformes » seul.

Liste de départ, à valider :

- protection des données, données à caractère personnel, vie privée
- intelligence artificielle, IA (mot entier)
- cybersécurité, cyberrésilience
- services numériques, marchés numériques, plateformes en ligne, contenus illicites
- identité numérique, espace européen des données, communications électroniques
- crypto-actifs, MiCA, ePrivacy
- RGPD, DSA, DMA, NIS2, DORA, CRA, AI Act, Data Act
- droit d'auteur, société de l'information
- données des dossiers passagers (PNR)

Règles :

- ignorer un item dont la `description` indique qu'il ne concerne pas la version française ;
- ignorer un titre manifestement non francophone ;
- garder le snapshot brut complet, même si le filtre ne retient que quelques actes.

## Impacts UI et licences

- `SOURCE_LABELS` : ajouter `eurlex: "EUR-Lex"`.
- Accueil : « CNIL · 10 actualités » devient dynamique (`2 sources` ou `CNIL + EUR-Lex`) ; la carte produit et la description ne doivent plus dire « CNIL » seul.
- Veille : « Corpus public · CNIL » devient « Corpus public · 2 sources ».
- Pied de page : « Sources : CNIL, EUR-Lex » et mention **CC BY 4.0** avec lien vers l'avis juridique EUR-Lex.
- Statistiques : « Sources » passe à 2 ; le bloc `pipeline.log` aussi.
- Les cartes EUR-Lex n'auront pas de résumé ; la liste est la vue de lecture complète.

## Risques

- **Identifiant de flux** : `rssId=165` peut changer ; vérifier le titre du canal et échouer clairement.
- **Fenêtre de 100 actes** : environ 7 jours ; le cron quotidien devra être fiable, ou la passe devra signaler un trou.
- **Filtre** : faux négatifs possibles ; commencer conservateur, revoir la première passe avec un avocat.
- **Titres longs** : lisibilité de la grille ; clamper, garder la liste complète.
- **Langue** : quelques items non francophones ; les ignorer.
- **Attribution** : CC BY 4.0 ; le lien source par entrée ne suffit pas à lui seul, ajouter la mention dans le pied de page ou une page « Sources et licences ».

## Recommandation

Construire l'adaptateur **EUR-Lex JO L (rssId=165)** comme deuxième source, avec :

1. snapshot brut du flux ;
2. filtre mots-clés conservateur ;
3. titres officiels, sans réécriture ;
4. `summary: null` ;
5. date JO à midi UTC ;
6. `source: "eurlex"` ;
7. mise à jour des libellés CNIL et de l'attribution.

La jurisprudence CJUE (`rssId=163/164`) est une piste pour une troisième source : elle est plus riche juridiquement, mais sans date par item et avec des titres à découper sur `#`.

## Sources

- Flux : `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=165`
- Avis juridique : `https://eur-lex.europa.eu/content/legal-notice/legal-notice.html`
- Réutilisation : `https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html`
- JO L quotidien : `https://eur-lex.europa.eu/oj/daily-view/L-series/default.html`
- Cellar : `https://op.europa.eu/en/web/cellar`
