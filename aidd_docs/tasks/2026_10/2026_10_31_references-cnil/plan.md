---
objective: "Les actualités CNIL dont la page officielle cite des textes portent les références instrument + articles de leur section « Textes de référence », avec snapshot des pages retenues et avertissement sans blocage en cas d'échec."
status: in-progress
---

# Plan: Références juridiques des actualités CNIL

Source: [spec.md](./spec.md)

## Phases

| #   | Phase             | File                         | Depends on |
| --- | ----------------- | ---------------------------- | ---------- |
| 1   | extraction-cnil   | [`phase-1.md`](./phase-1.md) | none       |
| 2   | pipeline-cnil     | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | donnees-cnil      | [`phase-3.md`](./phase-3.md) | 2          |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.cnil.fr/fr/sanction-cookies-app-fnac | La section « Textes de référence » et son bloc `ctn-gen-textes-references` ; le texte utile est `Article 82 de la loi Informatique et Libertés`. |
| https://www.cnil.fr/fr/webinaire-demarchage-telephonique | Plusieurs items, `L.223-1`, `4.11`, un décret non reconnu et une section placée après « Pour approfondir ». |
| https://www.cnil.fr/fr/reconstitution-adresses-professionnelles-quel-cadre | Le titre de section peut être au singulier « Texte de référence ». |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | medium — la passe fait une requête par actualité CNIL (10 aujourd'hui) en plus du flux ; le site reste statique et le build ne fait aucun appel. `fetchImpl` est injectable, le CLI borne chaque requête à 10 s. | phase 2 |
| regression | medium — `run` change, `writeRaw` change et les mocks de `tests/write.test.ts` doivent couvrir les pages ; les entrées CNIL sans section et les arrêts CJUE doivent rester identiques. Filet : les tests de passe existants, plus les tests de page et d'échec. `veille/**` et `tests/**` sont couverts par `tsc`. | phase 2 |
| architecture | le pipeline lit une seconde ressource par entrée CNIL ; `Source` gagne un descripteur `references` optionnel, `RunResult` des avertissements et `SourceRun` les chemins de pages. `Entry` ne change pas. | phase 2 |
| documentation | `architecture.md:35` et `veille/types.ts:18` disent que `references` vient du titre officiel, ce qui devient faux pour la CNIL ; `data.md` dit que les entrées CNIL portent `[]`, `codebase-map.md` ignore le parseur de page et `testing.md` n'a pas ces tests. `design.md` ne change pas : les tags de références existent déjà pour la CJUE. | phase 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Aucune invention | Seul le texte de la section « Textes de référence » est retenu ; le corps de la page n'est pas analysé. |
| Déterministe, sans modèle | Alias d'instruments et regex d'articles, comme pour la CJUE ; aucune réécriture. |
| Page en échec : `[]` + avertissement | L'entrée reste publiée, la passe signale l'URL et ne bloque pas. |
| Snapshot seulement si références | Une page sans référence retenue n'ajoute rien à `data/raw/`. |
| `data/` jamais édité à la main | Les entrées et les snapshots sont régénérés par `npm run veille`. |
| Aucun réseau au build | Le site lit `data/` ; seul le pipeline parle aux sources. |
| Références ≠ tags | Le catalogue et le filtre de tags ne changent pas. |
| UI française, sans JavaScript | Les références s'affichent dans les tags existants, côté serveur. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Descripteur `Source.references` optionnel | La CJUE garde ses références extraites du titre ; la CNIL ajoute une étape page sans coupler `run` à un cas particulier. |
| Extraction par item, regroupée par instrument | Les items CNIL sont autonomes ; le regroupement donne `Règlement (UE) 2016/679 · art. 6, 7, 21` au lieu de tags répétés. |
| Titre de section singulier ou pluriel | Le site écrit « Texte de référence » quand il n'y a qu'un texte et « Textes de référence » sinon ; les deux sont la même section. |
| Snapshot HTML seulement des pages retenues | Le contrat demande la preuve des références, pas une archive de toutes les pages CNIL ; le snapshot est adressé par son contenu. |
| Requêtes de page séquentielles | Dix pages par passe, ordre déterministe et charge douce sur la source ; un échec est isolé par entrée. |
