---
objective: "La veille couvre une cinquième matière, Plateformes, alimentée par le DSA, le DMA et l'ARCOM, sans JavaScript public ni coût variable."
status: in-progress
---

# Plan: Matière Plateformes

Source: aidd_docs/tasks/2026_10/2026_10_31_veille-plateformes/spec.md

## Phases

| #   | Phase                     | File                         | Depends on |
| --- | ------------------------- | ---------------------------- | ---------- |
| 1   | catalogue-cinq-matieres   | [`phase-1.md`](./phase-1.md) | none       |
| 2   | source-commission-dma     | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | source-arcom              | [`phase-3.md`](./phase-3.md) | 1          |
| 4   | filtres-jurisprudence     | [`phase-4.md`](./phase-4.md) | 1          |
| 5   | preuve-pages              | [`phase-5.md`](./phase-5.md) | 2, 3, 4    |
| 6   | memoire                   | [`phase-6.md`](./phase-6.md) | 5          |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.arcom.fr/flux-rss | Liste les flux disponibles ; le flux « presse » est distinct des « décisions ». |
| https://www.arcom.fr/rss/presse | Dix items, cinq FR et cinq EN, descriptions vides ; le texte DSA de Mym est dans la page article. |
| https://digital-markets-act.ec.europa.eu/news_fr | Page d'actualités DMA et lien vers son flux RSS. |
| https://digital-markets-act.ec.europa.eu/node/2/rss_en?prefLang=fr | Trente items d'avril 2025 à octobre 2026, titres anglais, dates exploitables. |
| https://www.vie-publique.fr/eclairage/285115-dsa-le-reglement-sur-les-services-numeriques-ou-digital-services-act | L'ARCOM est coordinateur des services numériques ; la CNIL et la DGCCRF sont co-compétentes. |
| https://www.entreprises.gouv.fr/la-dge/actualites/adoption-de-la-legislation-sur-les-marches-numeriques-dma | La Commission est seule à appliquer le DMA ; les autorités nationales l'assistent. |
| https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search | CETAT : six décisions citent 2022/2065, aucune sur 90 jours ; zéro pour 2022/1925. |
| https://api.piste.gouv.fr/cassation/judilibre/v1.0/search | Judilibre : zéro décision pour 2022/2065 et 2022/1925 sur trois mois. |

## Impact

| Category       | Verdict and evidence | Handled in |
| -------------- | -------------------- | ---------- |
| runtime        | Les flux ARCOM et DMA ont répondu 200 le 31/10/2026 (10 et 30 items), la page Mym aussi ; les requêtes PISTE ont répondu ; le site ne fait aucune requête réseau. Validé. | 2, 3, 4 |
| regression     | Le nombre de matières est codé en dur dans `veille/themes.ts`, `tools/parametres.html` et `tests/themes.test.ts` ; `tests/entries.test.ts` liste les hôtes ; `tests/write.test.ts` couvre la passe. Risque moyen ; la phase 1 est le filet de sécurité. | 1 |
| architecture   | Deux adaptateurs s'ajoutent, la Commission passe à deux flux, le catalogue gagne `queries`, la recherche PISTE boucle sur les requêtes d'une matière. | 1, 2, 3, 4 |
| documentation  | `README.md`, `tools/README.md`, `aidd_docs/memory/data.md`, `architecture.md`, `design.md`, `testing.md`, `codebase-map.md`, `project-brief.md`, `ecosystem.md`. | 6 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Chaque source a sa fixture et son test | Deux adaptateurs s'ajoutent ; un adaptateur sans test n'est pas terminé. |
| `data/` n'est jamais édité à la main | Les matières des entrées existantes passent par `npm run backfill`. |
| Pages publiques sans JavaScript | La cinquième pastille reste du HTML et du CSS ; l'outil local est hors build. |
| Un adaptateur par source | ARCOM et DMA restent isolés ; une panne n'emporte pas les autres. |
| Aucun secret versionné | Aucun nouveau secret ; PISTE reste dans `.env`. |
| CI comme porte | Typecheck, tests et build rejoués à chaque push. |
| Rattachement déterministe | Instruments puis termes ; aucune inférence, aucun modèle. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Cinquième matière, pas une page dédiée | La sélection reste une seule unité ; le sélecteur et le filtrage existants suffisent. |
| `commission-dma` comme adaptateur distinct | Le flux DMA a un autre hôte et d'autres règles que le flux numérique ; un seul parseur ne couvre pas les deux. |
| ARCOM : flux presse et page article, pas le flux décisions | Le flux décisions est audiovisuel ; le flux presse n'a pas de description, la page article porte le texte DSA qui filtre et résume. |
| `queries` par matière, repli sur le premier terme | Plateformes porte deux instruments ; une seule requête par matière ne couvrirait que le DSA. |
| Titres officiels non traduits | La source fait foi ; aucune réécriture, aucun modèle. |
