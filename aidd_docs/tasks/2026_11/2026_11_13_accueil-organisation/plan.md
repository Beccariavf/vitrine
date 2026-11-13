---
objective: "Un juriste comprend en 5 secondes l'accueil de Vitrine, qui met en avant le connecteur, renvoie vers une page Connecteur sans impasse et prouve chaque promesse par une donnée réelle."
status: pending
---

# Plan: Réorganiser l'accueil et les pages autour du connecteur

Source: brainstorm du 13 novembre 2026 (conversation) : vitrine aujourd'hui, vente du connecteur plus tard ; style inchangé (Le Corbusier, ai-driven-dev.fr) ; accueil centré sur le connecteur ; page Connecteur créée maintenant ; plugin retiré ; signature « Valentin Fouich · Juriste en droit du numérique » ; démo réelle capturée (option A), ajoutable plus tard.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Accueil restructuré et pied de page signé | [`phase-1.md`](./phase-1.md) | none |
| 2   | Démo avant/après capturée | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Page Connecteur | [`phase-3.md`](./phase-3.md) | 1, 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | Aucune API externe : Astro statique et fichiers versionnés. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Aucun : site statique, aucun réseau au build (`src/lib/entries.ts`, manifestes lus sur disque). Le lien GitHub du pied de page renvoie 404 aux visiteurs tant que le dépôt reste privé (unverified : visibilité non contrôlée). | 1 |
| regression | Moyen : `src/pages/index.astro` est réécrit, `src/layouts/Base.astro` (nav, pied de page) touche aussi `/veille`. Couverture : `tests/entries.test.ts` sur le lecteur ; aucune vérification du HTML rendu. Les liens vers `/connecteur` ne sont ajoutés qu'en phase 3, avec la page : aucun lien mort entre les phases. Pas de phase filet : `npm run build` et la recherche de chaînes dans `dist/` font foi. | 1, 3 |
| architecture | Le site lit pour la première fois `data/corpus/*/manifest.json`, via `inventaireCorpus` de `mcp/corpus/sync-rapport.ts` (fs pur, aucune dépendance au serveur). Aujourd'hui `src/` ne lit que `data/entries/`. | 1 |
| documentation | `design.md` (modules Accueil, Connecteur, pied de page, démo), `codebase-map.md` (trois routes, `src/lib/corpus.ts`, `src/demo/`), `project-brief.md` (vitrine aujourd'hui, connecteur vendu plus tard), `testing.md` (nouveaux tests). | 1, 2, 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Aucune web font, aucun JavaScript côté client (`design.md`) | Toute la démo et le bandeau se rendent en HTML et CSS. |
| Rayon 0, bordures 2 px encre, ombres dures, règle 80/20 (`design.md`) | Le style est conservé, seule l'organisation change. |
| Texte long jamais sur aplat coloré ; rouge réservé aux grands textes (`design.md`) | La réponse de démo et les rangées de publications restent sur papier. |
| `data/` n'est jamais édité à la main (`coding-assertions.md`) | La capture de démo vit dans `src/demo/`, pas dans `data/`. |
| `typecheck`, `npm test`, `npm run build` passent (`coding-assertions.md`) | Critère de fin de chaque phase. |
| Vocabulaire interdit de la stratégie : « zéro hallucination », « conseil », « conforme RGPD garanti », chiffres non mesurés | Toutes les nouvelles copies ; vouvoiement. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le site réutilise `inventaireCorpus` de `mcp/corpus/sync-rapport.ts` plutôt que de relire les manifestes | Une seule règle de date et de compte, déjà partagée avec `etat_corpus` ; les manifestes sont hétérogènes (`arrete_le`, `date_extraction`, `couverture.date`, `couverture.date_liste`). |
| La démo vit dans un fichier versionné `src/demo/demo.json`, rendu seulement s'il existe | Aucune démo fictive n'est publiée ; l'accueil et la page Connecteur restent complets sans elle. |
| Pas de page plugin ni de carte plugin | La stratégie interdit toute communication avant un livrable. |
| Mentions légales et confidentialité hors périmètre | Aucun hébergeur ni formulaire tant que le site n'est pas déployé (`deployment.md`). |
