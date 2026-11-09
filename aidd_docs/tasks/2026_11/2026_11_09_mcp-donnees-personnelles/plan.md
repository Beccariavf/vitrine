---
objective: "Le MCP répond sur le RGPD, la LIL, les délibérations CNIL (sanctions, avis, recommandations), les décisions du Conseil d'État depuis 2014 et les lignes directrices du CEPD, chaque corpus déclarant sa couverture."
status: pending
---

# Plan: Compléter le corpus données personnelles du MCP

Source: aidd_docs/tasks/2026_11/2026_11_09_mcp-donnees-personnelles/brainstorm.md

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | cnil-multi-natures | [`phase-1.md`](./phase-1.md) | none |
| 2   | lil | [`phase-2.md`](./phase-2.md) | none |
| 3   | conseil-etat-jade | [`phase-3.md`](./phase-3.md) | none |
| 4   | cepd-lignes-directrices | [`phase-4.md`](./phase-4.md) | none |
| 5   | index-eval-memoire | [`phase-5.md`](./phase-5.md) | 1, 2, 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://echanges.dila.gouv.fr/OPENDATA/JADE/ | Une archive globale `Freemium_jade_global_<horodatage>.tar.gz` (1,32 Go, 8 novembre 2026) porte les décisions JADE ; structure `TEXTE_JURI_ADMIN` avec `DATE_DEC`, `JURIDICTION`, `NUMERO` et `CONTENU`. |
| https://www.data.gouv.fr/datasets/jade | Licence ouverte 2.0, contenu JADE (Conseil d'État, cours administratives d'appel, tribunal des conflits), pseudonymisation. |
| https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/legiPart | Un POST `{ textId, date }` rend la version consolidée de la LIL (`LEGITEXT000006068624`) ; `{ textId }` seul répond 500. |
| https://www.legifrance.gouv.fr/contenu/pied-de-page/foire-aux-questions-api | Authentification Bearer, environnements sandbox et production, quotas consultables dans PISTE et 429 en cas de dépassement. |
| https://www.edpb.europa.eu/documents_en | Les lignes directrices sont listées par type de publication et servies en PDF ; le site a répondu 503 pendant la reconnaissance. |
| https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624 | Identité et version en vigueur de la loi n° 78-17 du 6 janvier 1978. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | La LIL dépend de PISTE (quota non public, 429 possible) ; le Conseil d'État dépend du téléchargement de 1,2 Go sur `echanges.dila.gouv.fr` ; le CEPD dépend d'un site observé en 503 et de PDF. | 2, 3, 4 |
| regression | Le schéma de l'index gagne une colonne `nature` et les filtres `search` changent ; les tests `tests/index.test.ts` et `tests/mcp.test.ts` couvrent déjà `corpus`, `document` et les filtres CNIL. Risque moyen, filet existant : oui. | 1, 5 |
| architecture | Trois corpus passent à six ; `mcp/corpus/` gagne trois dossiers autonomes et `veille/piste.ts` gagne une route `legiPart` ; JADE devient la source du corpus Conseil d'État, la veille gardant PISTE. | 1, 2, 3, 4 |
| documentation | README, `data.md`, `architecture.md`, `testing.md` et `codebase-map.md` doivent nommer les nouveaux corpus, leurs commandes et leur couverture. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `data/` n'est jamais édité à la main. | Les corpus LIL, CE et CEPD sont produits par leur synchronisation. |
| `data/corpus/index/` est un dérivé ignoré par git. | La réindexation reste un artefact local, jamais commité. |
| Chaque source a sa fixture et son test ; un adaptateur sans test n'est pas terminé. | Trois nouveaux adaptateurs (LIL, CE, CEPD) et un adaptateur CNIL étendu. |
| Versions épinglées. | L'extraction PDF ajoute une dépendance. |
| Aucun secret versionné. | La synchronisation LIL lit `.env` via `readPisteConfig`. |
| `npm run typecheck`, `npm test` et `npm run build` passent avant tout push. | La CI les rejoue. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le Conseil d'État vient de l'archive JADE de la DILA, pas de PISTE. | 1 296 décisions pour une seule requête PISTE et un appel par texte intégral, contre une archive sans quota ; le périmètre JADE (décisions publiées ou sélectionnées) et les mots-clés sont déclarés dans le manifeste. |
| Le corpus Conseil d'État est un sous-ensemble déclaré de JADE. | JADE ne porte pas toutes les décisions inédites ; le filtre de date, de juridiction et de mots-clés est une réduction assumée, comptée dans le manifeste. |
| Un seul corpus `cnil`, la nature devient une métadonnée filtrante. | Évite trois corpus CNIL et garde `search` lisible ; `get_decision` continue de rendre une délibération entière. |
| La LIL est datée à la synchronisation et n'entre que si le texte est en vigueur. | Une version consolidée change avec le temps ; le manifeste porte la date et le `textId` exact. |
| Les lignes directrices CEPD sont extraites de leurs PDF. | Le site ne publie pas le texte intégral en HTML ; le PDF est la source officielle. |
