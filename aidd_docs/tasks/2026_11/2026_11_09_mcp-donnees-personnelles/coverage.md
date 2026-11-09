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
- `cnil` : trois natures retenues — Sanction 249 documents / 6 342 fragments, Avis 2 896 / 21 914, Recommandation/Lignes directrices 100 / 1 043 ; `natures_demandees` vaut les trois et `natures_exclues` est vide pour la synchronisation complète `--tout`. Les incréments DILA ne portent aucun fragment dans cette synchronisation (`dinum: 29 299`, `dila: 0`). Exclusions DINUM : **35 167 lignes sur 11 valeurs distinctes**, dont `(vide)` 298 ; les 10 autres valeurs sont Autre autorisation 23 517, Référentiel/Règlement type/Norme 3 738, Autorisation de recherche 2 565, Autorisation de transfert 2 020, Mise en demeure 1 145, Disposition interne CNIL 951, Certification/Label 651, Autorisation d'évaluation 138, Clôture 118 et Autre décision 26. Vérification : **29 299 retenues + 35 167 exclues = 64 466 lignes parquet lues** (`couverture.lignes_lues`). Le parquet porte 15 valeurs distinctes : les 11 exclues, les 3 natures retenues et `AVIS` majuscule, rattaché à `Avis`.
- `lil` : 133 articles en vigueur ; 54 articles abrogés écartés ; 50 sections parcourues.
- `ce` : exclusions déclarées — autre juridiction 399 198, antérieure à 2014 138 074, sans mot-clé 34 878, texte vide 1, date invalide 0 ; 62 doublons entre les deux fonds. Fonds `publie` : 181 documents / 3 080 fragments ; fonds `inedit` : 1 131 / 14 623. `statut` porte la publication au recueil (« Publié au recueil » ou « Inédit au recueil »), suivi de la solution quand elle existe.
- `cepd` : 42 URL `_fr` dans le sitemap, 5 pages lues, 36 lignes directrices retenues (`types_retenus: ["guideline"]`), 0 version écartée, 36 PDF français. `couverture.documents_ecartes` nomme les 6 URL sans PDF : `automated-decision-making-and-profiling`, `data-protection-impact-assessments-high-risk-processing`, `data-protection-officer`, `guidelines-on-personal-data-breach-notification-under-regulation-2016679-wp250`, `right-to-data-portability` et `transparency` (doublon court ; la même ligne est retenue sous `article-29-working-party-guidelines-on-transparency-under-regulation-2016679_fr`). Les recommandations sont hors de ce corpus : elles seront un incrément ultérieur.

## Évaluations `dev`

Mesures du 2026-11-09, hors split `test`. Le harnais mesure un corpus ; il n'exerce pas le filtre `nature`.

| Jeu | Résultat |
|---|---|
| RGPD v2, 30 questions | 6/6 références au rang 1 ; sémantique 18/19 au top 5, MRR 0,860, top 1 78,9 % ; pièges cités 0/4 |
| AI Act, 12 questions | 7/7 références au rang 1 ; sémantique 2/3, MRR 0,278, top 1 0 % ; pièges cités 0/1 |
| CNIL v2, 25 questions | 14/25 au top 5, MRR 0,406, top 1 32,0 % |
| CNIL doctrine, 10 questions | **3/10 au top 5, MRR 0,225, top 1 20,0 %**, 8 `confiant` et 2 `incertain`, au moins 6 confiants faux |
| LIL, 10 questions | **10/10 au top 5, MRR 0,750, top 1 60,0 %** |
| Conseil d'État, 12 questions | 8/12 au top 5, MRR 0,486, top 1 33,3 % |
| CEPD, 10 questions | 10/10 au top 5, MRR 1,000, top 1 100,0 % |

Le chiffre CNIL doctrine est **corpus-level** : il ne mesure pas `search.nature`, que le harnais n'active pas. Il est rapporté tel quel, sans le masquer.

Le `test` CNIL v2 à 16/25 a été mesuré le 2026-11-06 sur le corpus de sanctions seules, avant l'extension du 2026-11-09. Son marqueur est consommé : il n'est pas rejouable et ne décrit pas le corpus actuel. L'évidence courante est le `dev` 14/25.

## Index

- Modèle : `qwen3-embedding:0.6b`
- Dimension : 1 024
- Unités : 53 143
- Répartition : `rgpd` 272, `aiact` 293, `cnil` 29 299, `lil` 133, `ce` 17 703, `cepd` 5 443.
- Second passage de `npm run corpus:index` : 0 ajoutée, 0 modifiée, 0 supprimée, 53 143 inchangées.
