# Recherche — matières, sources et PISTE

Date : 31 octobre 2026. Objet : vérifier les sources officielles, les accès PISTE et les volumes avant de brancher la veille par matière.

## Verdict court

Quatre matières, huit sources. Les flux RSS répondent sans compte. Légifrance et Judilibre passent par PISTE ; les secrets sont locaux. Le JORF est exclu : les transpositions sont couvertes par les actualités des autorités, qui renvoient au texte.

## Sources vérifiées

| Source | URL | Constat |
| --- | --- | --- |
| CNIL | `https://www.cnil.fr/fr/rss.xml` | 200, 10 actualités. |
| CJUE | `https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163` | 200, jurisprudence CJUE. |
| ANSSI / CERT-FR | `https://www.cert.ssi.gouv.fr/actualite/feed/` | 200, 40 items, liens sur `cert.cyber.gouv.fr`, flux chronologique. |
| CEPD | `https://www.edpb.europa.eu/feed/news_fr` | 200, 10 items, descriptions HTML. |
| ARCEP | `https://www.arcep.fr/actualites/suivre-actualite-regulation-arcep/avis-et-decisions/rss.xml` | 200, 100 items, identité portée par la query. |
| Commission | `https://digital-strategy.ec.europa.eu/fr/rss.xml` | 200, 10 items, events et consultations à exclure. |
| Légifrance CETAT | `https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search` | 200 après OAuth, fonds `CETAT`, `resumePrincipal`, date dans le titre. |
| Judilibre | `https://api.piste.gouv.fr/cassation/judilibre/v1.0/search` | 200 avec `KeyId`, 1 547 décisions en octobre. |

## PISTE

- OAuth Légifrance validé : `POST https://oauth.piste.gouv.fr/api/oauth/token`, scope `openid`, jeton d'une heure.
- Judilibre validé avec l'en-tête `KeyId` ; sandbox non utilisé.
- Quotas non publics : le journal `data/usage/<date>.json` compte les appels et un plafond de 16 par passe arrête la collecte.
- Aucun secret versionné : `.env` local, `.env.example` documente les trois variables.

## Volumes et fenêtres

- Judilibre publie avec du retard : dernière décision disponible le 22 octobre pour une passe le 31. Fenêtre de 30 jours et dédoublonnage par `id`.
- CETAT renvoie des décisions anciennes quand une matière est rare : fenêtre de 90 jours, tri par date, 20 résultats par matière.
- ARCEP « avis et décisions » ne contient pas de texte sur les données dans la fenêtre courante : zéro entrée est un résultat honnête, pas une panne.
- Commission : le flux mélange actualités, événements et consultations ; seules les actualités sont retenues.

## Décisions

- Pas de JORF : la veille est une veille d'actualités et de jurisprudence, pas de textes législatifs.
- Pas de JURI : Judilibre couvre la Cour de cassation sans doublon.
- Pas de LLM : les titres, descriptions et sommaires officiels suffisent.
- Le rattachement est stocké sur l'entrée ; le site filtre au build, aucune purge.
