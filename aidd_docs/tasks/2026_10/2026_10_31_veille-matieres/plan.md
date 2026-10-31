---
objective: "La veille se sélectionne par matière et publie les autorités, la CJUE et les juridictions françaises, sans LLM ni veille législative."
status: completed
---

# Plan: Veille par matière

Source: aidd_docs/tasks/2026_10/2026_10_31_veille-matieres/spec.md

## Phases

| #   | Phase                    | File                         | Depends on |
| --- | ------------------------ | ---------------------------- | ---------- |
| 1   | matieres-et-contrat      | [`phase-1.md`](./phase-1.md) | none       |
| 2   | sources-institutionnelles | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | sources-sectorielles     | [`phase-3.md`](./phase-3.md) | 1          |
| 4   | piste-jurisprudence      | [`phase-4.md`](./phase-4.md) | 1          |
| 5   | finalisation             | [`phase-5.md`](./phase-5.md) | 2, 3, 4    |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.cnil.fr/fr/rss.xml | Flux CNIL existant, 10 actualités, références de page déjà branchées. |
| https://eur-lex.europa.eu/FR/display-feed.rss?rssId=163 | Jurisprudence CJUE existante, filtrage par instruments du titre officiel. |
| https://www.cert.ssi.gouv.fr/actualite/feed/ | Flux actualité CERT-FR, 40 items, liens sur cert.cyber.gouv.fr. |
| https://www.edpb.europa.eu/feed/news_fr | Flux CEPD, 10 items, descriptions HTML. |
| https://www.arcep.fr/actualites/suivre-actualite-regulation-arcep/avis-et-decisions/rss.xml | Flux ARCEP, 100 items, identité portée par le guid et la query. |
| https://digital-strategy.ec.europa.eu/fr/rss.xml | Flux Commission, 10 items, events et consultations à exclure. |
| https://www.data.gouv.fr/dataservices/legifrance | Légifrance gratuit après inscription, OAuth2, quotas par jeton, fonds CETAT. |
| https://github.com/Cour-de-cassation/judilibre-search | Judilibre, en-tête `KeyId`, `date_start`/`date_end`, `page_size` 50 maximum. |
| https://oauth.piste.gouv.fr/api/oauth/token | Jeton OAuth validé le 31/10/2026, scope `openid resource.READ`, 1 h. |

## Impact

| Category       | Verdict and evidence | Handled in |
| -------------- | -------------------- | ---------- |
| runtime        | CNIL, CJUE, CERT-FR, CEPD, ARCEP, Commission, Légifrance et Judilibre ont répondu 200 le 31/10/2026 ; le site ne fait aucune requête réseau, les tests utilisent des fixtures. | 1, 2, 3, 4 |
| regression     | `Entry` gagne `themes`, `tags.json`/`tags.ts` disparaissent, les 11 entrées committées sont migrées ; risque moyen ; la phase 1 est le filet de sécurité. | 1 |
| architecture   | Le registre de sources accepte RSS et API, le filtre passe de tags à matières, le site filtre au build, l'outil local écrit `themes.json`. | 1, 2, 3, 4 |
| documentation  | `architecture.md`, `data.md`, `codebase-map.md`, `testing.md`, `design.md`, `deployment.md`, `tools/README.md`. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `data/` n'est jamais édité à la main | La migration des 11 entrées passe par un script de backfill. |
| Snapshot brut conservé | Il prouve ce qui a été lu, même quand aucune entrée ne correspond. |
| Pages publiques sans JavaScript | L'outil de sélection reste local, hors build public. |
| Un adaptateur par source | Une panne n'emporte pas les autres ; les nouvelles sources restent isolées. |
| Aucun secret versionné | Les accès PISTE vivent dans `.env`, ignoré par git. |
| CI comme porte | Typecheck, tests et build rejoués à chaque push. |
| Rien d'inventé | Les résumés viennent de la source ; le rattachement est déterministe. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Matières comme seule unité de sélection | Quatre choix lisibles, pas une liste de règlements. |
| `themes` porté par chaque entrée | Le site filtre sans recalculer le rattachement. |
| Filtrage au build, pas de purge | Désactiver une matière masque sans détruire les données ; réactiver ne demande pas de collecte. |
| Pas de JORF | Les transpositions sont couvertes par les actualités des autorités, qui renvoient au texte. |
| PISTE limité à la jurisprudence | Conseil d'État et Cour de cassation ; la CJUE reste sur EUR-Lex. |
| Aucun LLM | Les sources fournissent titre, description ou sommaire officiel. |
| Rattachement par instruments, puis termes | Précis et auditable ; les termes rattrapent les contenus sans référence. |
