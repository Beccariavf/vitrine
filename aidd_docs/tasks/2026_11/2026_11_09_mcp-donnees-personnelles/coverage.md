# Couverture des six corpus

Comptes lus dans les `manifest.json` du 9 novembre 2026, jamais recopiés à la main depuis un autre rapport. L'index `data/corpus/index/index.db` porte **53 143 unités** (`qwen3-embedding:0.6b`, 1 024 dimensions).

| Corpus | Documents | Fragments | Période | Source | Licence |
|---|---:|---:|---|---|---|
| `rgpd` | 1 acte | 272 (99 articles + 173 considérants) | publication 2016-05-04 ; applicable depuis 2018-05-25 | CELLAR / EUR-Lex, CELEX `32016R0679` | Réutilisation autorisée par la décision 2011/833/UE (CC BY 4.0) |
| `aiact` | 1 acte | 293 (113 articles + 180 considérants) | publication 2024-07-12 ; en vigueur depuis 2024-08-01 | CELLAR / EUR-Lex, CELEX `32024R1689` | Réutilisation autorisée par la décision 2011/833/UE (CC BY 4.0) |
| `cnil` | 3 245 | 29 299 | arrêté au 2026-10-30 | DINUM (historique) + DILA (incréments) | DINUM : `etalab-2.0` (Hugging Face) et `lov2` (data.gouv), écart déclaré ; DILA : Licence Ouverte 2.0 |
| `lil` | 1 | 133 articles en vigueur | version consolidée au 2026-10-01 ; consultée le 2026-11-09 | PISTE — Légifrance `/consult/legiPart`, `LEGITEXT000006068624` | Licence Ouverte 2.0 (Etalab) |
| `ce` | 1 312 | 17 703 | 2014-01-01 → 2026-10-27 | DILA — JADE, fonds `publie` et `inedit` | Licence Ouverte 2.0 (Etalab) |
| `cepd` | 36 | 5 443 | 2018-04-11 → 2025-06-05 | CEPD, sitemap des pages `_fr` et PDF | À vérifier : aucune licence explicite déclarée par le site CEPD |

## Détail des couvertures

- `rgpd` : acte complet, aucun exclusion ; types `article` et `considérant`.
- `aiact` : acte complet, aucune exclusion ; types `article` et `considérant`.
- `cnil` : trois natures retenues — Sanction 249 documents / 6 342 fragments, Avis 2 896 / 21 914, Recommandation/Lignes directrices 100 / 1 043. Les incréments DILA ne portent aucun fragment dans cette synchronisation (`dinum: 29 299`, `dila: 0`).
- `lil` : 133 articles en vigueur ; 54 articles abrogés écartés ; 50 sections parcourues.
- `ce` : exclusions déclarées — autre juridiction 399 198, antérieure à 2014 138 074, sans mot-clé 34 878, texte vide 1, date invalide 0 ; 62 doublons entre les deux fonds. Fonds `publie` : 181 documents / 3 080 fragments ; fonds `inedit` : 1 131 / 14 623.
- `cepd` : 42 URL `_fr` dans le sitemap, 5 pages lues, 36 documents retenus, 6 URL sans PDF écartées (5 pages WP29 sans PDF et le doublon court `transparency_fr`, la même ligne étant retenue sous son URL longue), 0 version écartée, 36 PDF français.

## Index

- Modèle : `qwen3-embedding:0.6b`
- Dimension : 1 024
- Unités : 53 143
- Répartition : `rgpd` 272, `aiact` 293, `cnil` 29 299, `lil` 133, `ce` 17 703, `cepd` 5 443.
- Second passage de `npm run corpus:index` : 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées.
