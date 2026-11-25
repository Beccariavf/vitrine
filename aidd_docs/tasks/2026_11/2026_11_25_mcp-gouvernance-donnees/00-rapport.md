# Rapport — sources d'un MCP de gouvernance de la donnée

État au 25 novembre 2026. Ce rapport réunit quatre recherches confiées à OpenCode (DeepSeek), relues et arbitrées par le coordinateur. Les § 3 et 4 intègrent la décision de l'utilisateur du 25/11/2026 : un seul MCP, viser 80 %, classer par ROI. Les détails, tableaux et URL se trouvent dans les fiches :

| Fiche | Pilier | Lignes du tableau delta | Vérifiées sur la source | Partielles | Non vérifiées |
|---|---|---|---|---|---|
| [01-ia.md](01-ia.md) | IA | 75 | 52 (+1 reprise) | 15 | 7 |
| [02-donnees-non-personnelles.md](02-donnees-non-personnelles.md) | Données non personnelles | 46 | 40 | 4 | 2 |
| [03-sante-textes-autorites.md](03-sante-textes-autorites.md) | Santé : textes, autorités, procédure | 57 | 44 | 6 | 7 |
| [04-sante-doctrine-decisions.md](04-sante-doctrine-decisions.md) | Santé : doctrine et décisions | 42 | 27 | 11 | 4 |
| **Total** | | **220** | **163** | **36** | **20** |

Ces fiches complètent celles du 20/11 (`2026_11_20_cartographie-conformite/01-ia.md` et `05-donnees.md`) et ne les recopient pas. L'étalon, c'est la chaîne des 18 corpus « données personnelles » (cadre de la recherche, § « L'étalon »).

## 1. Ce qui commande l'ingestion

1. **Pour l'IA et les données non personnelles, les textes de fond sont déjà repérés. Ce qui manque, c'est le droit souple et les décisions.** Pour les données personnelles, cette couche est assurée par le CEPD et la CNIL. Chaque pilier a un équivalent, mais pas toujours unique :
   - **IA** : les publications du Bureau de l'IA (4 lignes directrices finales sur les art. 3, 5, 50 et sur les GPAI ; 2 projets sur les art. 6 et 73 ; 2 codes de bonne pratique ; 2 modèles) et celles du CEPD (avis 28/2024, lignes directrices 03/2026 sur le moissonnage, 01/2025 sur la pseudonymisation, 1/2024 sur l'intérêt légitime).
   - **Données non personnelles** : la **CADA**, avec 60 941 avis et conseils publiés en open data sous Licence Ouverte. C'est l'exact pendant des délibérations CNIL, et la source la plus facile de tout ce rapport.
2. **Aucune autorité française n'est désignée** pour l'AI Act, le Data Act (art. 37), la DGA (art. 7 et 23) ni l'EHDS (art. 19 et 55). Le DDADUE est toujours en attente à l'Assemblée nationale (AN n° 2518). La couche « autorité nationale » des piliers IA et données se résume donc à la doctrine (CNIL, ANSSI, INESIA, Arcep, CADA), pas à des décisions.
3. **La frontière entre données personnelles et non personnelles a bougé.** Selon l'arrêt CJUE C-413/23 P CEPD c. SRB du 4 septembre 2025, l'identifiabilité s'apprécie du point de vue du destinataire. Les lignes directrices CEPD 01/2025 et 02/2026 sont en consultation, et l'Omnibus veut définir la notion par actes d'exécution, ce que contestent le CEPD et le CEPS (avis 2/2026). Cette frontière décide du basculement d'un jeu de données d'un pilier à l'autre : c'est la charnière du futur MCP.
4. **Santé : les décisions sont déjà largement là, mais sans étiquette. Le trou se situe dans la doctrine opérationnelle et dans le droit français.**
   - Dans Vitrine, 156 documents citent l'art. 9 RGPD et 15 l'art. 66 LIL. On y trouve aussi les sanctions santé de la CNIL (anonymisées), 127 décisions du CE, les arrêts CJUE clés et les décisions du Conseil constitutionnel sur le passe sanitaire.
   - Manquent : les méthodologies de référence MR-001 à MR-008 et les référentiels CNIL (entrepôts 2021-118, vigilances 2019-057), l'EHDS article par article, les blocs du CSP et l'art. 226-13 du Code pénal (secret professionnel).
5. **Le régime français a changé le 28 mai 2026.** L'art. 54 de la loi n° 2026-403 du 26 mai 2026 (simplification de la vie économique) a réécrit l'art. 66 LIL : on passe de l'autorisation CNIL à des **référentiels CNIL suivis d'une déclaration de conformité**, l'autorisation devenant l'exception. Les fiches du 20/11 n'en parlent pas. Le corpus `lil` contient déjà la nouvelle rédaction (contrôle ci-dessous).

## 2. Chaîne par pilier, au niveau de l'étalon

Légende : ✅ déjà dans Vitrine ; ➕ à ingérer, avec la priorité ; ⛔ source fermée aux robots ou sans publication.

| Couche (étalon) | Données personnelles | Données non personnelles | IA | Santé |
|---|---|---|---|---|
| Texte UE de fond | ✅ RGPD, ePrivacy, police, 2018/1725 | ➕P1 Data Act 2023/2854, DGA 2022/868, Open Data 2019/1024, 2018/1807 ; ➕P1 accès : 96/9 (bases), 2016/943 (secret des affaires), 2019/790 art. 3-4 ; ➕P2 INSPIRE, ITS, statistiques 223/2009, e-evidence 2023/1543 | ✅ AI Act consolidé ; ➕P1 textes de frontière : 2019/1020, 2024/2853, CRA 2024/2847, machines 2023/1230, 2019/790, DSA, 2024/2831, 2023/2225 | ➕P1 EHDS 2025/327 (105 art.) ; ➕P1 DM 2017/745, DIV 2017/746 (+ 2023/607, 2024/1860) ; ➕P2 essais cliniques 536/2014, HTA 2021/2282, 2011/24 |
| Actes d'exécution et délégués | ✅ CCS, adéquation | ➕P2 recommandation 2026/2394 (clauses types Data Act), HVD 2023/138, logos 2023/1622, compteurs 2023/1162, règlements délégués ITS | ➕P1 règlement d'exécution 2026/2487 (bacs à sable), 2025/454, décision 2026/2274 (EN 18286:2026) ; ➕P3 références des normes (texte payant) | ➕P1 EHDS 2026/771, 2026/2083, 2026/2098 ; une vingtaine de bases d'actes encore à adopter (mars 2027) |
| Texte UE de procédure | ✅ 2025/2518 | dans le Data Act (ch. IX) et la DGA | 2019/1020 (dans le corpus des textes de frontière) | dans l'EHDS (art. 19 à 22 et 55 s.) |
| Autorité UE — doctrine | ✅ CEPD | ➕P1 FAQ Data Act v1.4, guide véhicules, avis CEPD-CEPS 2/2022, 03/2021, 2/2026 ; ⛔ EDIB (pas de page) | ➕P1 Bureau de l'IA et Comité IA (lignes directrices, codes, modèles, Q&R) ; ✅ CEPD (en partie) ; ⛔ EDPS (403) | ✅ CEPD 03/2020, 04/2020, 1/2026 ; ➕P1 avis 3/2019 (essais cliniques) et avis conjoint 03/2022 (EHDS) |
| Autorité nationale — décisions | ✅ CNIL | ➕P1 **CADA** (60 941 avis) ; ➕P2 Arcep (labellisation, différends) ; ➕P3 Autorité de la concurrence (avis cloud 23-A-08) | ✅ CNIL (Clearview…) ; aucune autorité IA désignée | ✅ sanctions CNIL santé (anonymisées) ; ⛔ CESREES (avis non publiés) ; ➕P2 chambres disciplinaires du CNOM |
| Autorité nationale — doctrine | ✅ CNIL | ➕P2 Etalab/DINUM (licences) ; ⛔ ANSSI SecNumCloud (Incapsula) | ✅ fiches IA de la CNIL ; ➕P1 autres textes CNIL sur l'IA, ANSSI (guides IA générative), INESIA, Défenseur des droits, CNCDH, CCNE/CNPEN | ➕P1 **MR-001 à MR-008** (révision du 19/03/2026), référentiels entrepôts et vigilances ; ➕P2 HAS, ANSM ; ⛔ ANS (Incapsula) |
| Texte national de fond | ✅ LIL | ➕P1 CRPA livre III, SREN titre III ; ➕P2 Code du patrimoine livre II, loi 51-711, loi 68-678, C. com. L151-1 s., CPI L341-1 s. et L122-5-3 | ➕P2 CRPA L311-3-1 et R311-3-1-1 s., CPI L122-5-3 ; DDADUE non adopté | ✅ LIL art. 64 à 77 (nouvelle rédaction de l'art. 66) ; ➕P1 blocs du CSP (L1110-4 s., L1111-2 à L1111-24, L1121 s., L1131 s., L1460 à L1462, L1470-1 à L1470-6, L6316), CSS, C. ass., **C. pén. 226-13** |
| Textes d'application | ✅ décret 2019-536, codes | ➕P2 D323-2-1 (licences), arrêté du 17/11/2025 (frais de transfert) | — | ➕P1 partie R du CSP (R1110-1 s., R1111-8-8 s. HDS, R1461 s. SNDS, R1470) ; décret 2026-209 ; référentiel HDS |
| Recours national | ✅ CE (filtre « données personnelles ») | ➕P1 élargir le filtre de `ce` au CRPA, au Data Act, à 96/9 et 2016/943 | ✅ CE (Parcoursup, VSA) | ✅ CE (127 décisions santé) |
| Juge UE | ✅ CJUE (filtrée) | ➕P2 élargir à 96/9 (C-762/19…) et 2016/943 | ✅ C-634/21, C-203/22 ; C-245/25 pendante | ✅ C-184/20, C-252/21, C-667/21, C-21/23, C-307/22, C-474/24 |
| Juge constitutionnel | ✅ | — | ✅ 2018-765 DC, 2023-850 DC… | ✅ passe sanitaire, secret médical |
| Juge judiciaire | ✅ Cass. (filtrée) | ➕P2 élargir au secret des affaires et aux bases de données | — | ✅ 13 décisions ; ➕P2 CEDH (HUDOC) |
| Préparation | ✅ | ➕P1 Omnibus volet données (pas de trilogue), Cloud and AI Development Act COM(2026) 502, DDADUE art. 25 | ➕P1 projets de lignes directrices sur les art. 6 et 73, actes attendus | ➕P2 mise en œuvre de l'EHDS en France, paquet pharmaceutique, référentiel HDS v2.1 |

## 3. Décision du 25/11/2026 : un seul MCP, couvrir 80 % de la gouvernance de la donnée

**Décision de l'utilisateur** : on garde Vitrine et son corpus. Pas de MCP séparé par pilier : le même serveur doit couvrir tous les champs de la gouvernance de la donnée (données personnelles, données non personnelles, IA, santé). On ne vise pas l'exhaustivité, mais **les 80 % de valeur**, dans l'ordre du meilleur retour sur investissement.

Conséquences :
1. **Étendre plutôt que créer** quand une chaîne existe déjà :
   - les MR et les référentiels santé vont dans `cnil` / `cnil_doctrine` ;
   - les 2 documents CEPD manquants vont dans `cepd` ;
   - les blocs du CSP, l'art. 226-13 C. pén., le CRPA livre III, etc. vont dans `textes_fr` ;
   - les textes en préparation vont dans `preparation`.
2. **Nouvelles collections dans le même index**, seulement quand aucune n'accueille déjà la source :
   - `cada` (décisions) ;
   - `donnees` (Data Act, DGA, Open Data, 2018/1807 et leurs actes) ;
   - `sante_ue` (EHDS, MDR, IVDR…) ;
   - `frontieres` (textes transversaux sur les produits, la propriété intellectuelle et la responsabilité) ;
   - `doctrine_ue` (doctrine de la Commission).
3. **Pas d'étiquette `pilier` dans le schéma des unités.** Une simple table corpus → champs, exposée par `etat_corpus` et dans la description du serveur, suffit à présenter le MCP comme « gouvernance de la donnée ».

## 4. Ordre par retour sur investissement

**Méthode.** La valeur est une estimation du coordinateur : la part des questions de gouvernance de la donnée auxquelles la source permet de répondre (100 points pour l'ensemble des sources listées ici). L'effort est compté en tickets délégués standard : 1 = un acte CELLAR ou un bloc PISTE par une chaîne existante ; 3 = un nouveau scraper ou un changement d'architecture. ROI = valeur / effort. Les chiffres servent à classer, pas à mesurer.

| Rang | Étape | Champ | Valeur | Effort | ROI | Valeur cumulée |
|---|---|---|---|---|---|---|
| 1 | `donnees` : Data Act, DGA, Open Data, HVD, 2018/1807, recommandation 2026/2394, 2023/1622 | non personnelles | 10 | 1 | 10 | 10 % |
| 2 | `cada` : 60 941 avis et conseils (CSV, Licence Ouverte) | non personnelles | 9 | 1 | 9 | 19 % |
| 3 | `textes_fr` santé : blocs du CSP (L et R), C. pén. 226-13, CSS, C. ass. (droit à l'oubli) | santé | 9 | 1 | 9 | 28 % |
| 4 | `preparation` : Omnibus volet données, COM(2026) 502, projets de lignes directrices IA (art. 6 et 73) | tous | 4 | 0,5 | 8 | 32 % |
| 5 | `cnil`/`cnil_doctrine` + `cepd` : MR-001 à MR-008, référentiels 2021-118 et 2019-057, avis CEPD 3/2019 et 03/2022 | santé | 8 | 1,5 | 5,3 | 40 % |
| 6 | Description du MCP et table corpus → champs dans `etat_corpus` | tous | 3 | 0,5 | 6 | 43 % |
| 7 | `sante_ue` : EHDS et ses 3 actes d'exécution | santé | 6 | 1 | 6 | 49 % |
| 8 | `textes_fr` données : CRPA livre III, SREN titre III, Code du patrimoine livre II, lois 51-711 et 68-678, C. com. L151-1 s., CPI L341-1 s. et L122-5-3 | non personnelles | 6 | 1 | 6 | 55 % |
| 9 | `frontieres` : 2019/1020, 2024/2853, CRA, machines, 96/9, 2016/943, 2019/790, DSA, 2024/2831, 2023/2225 | IA, non personnelles | 8 | 1,5 | 5,3 | 63 % |
| 10 | `aiact` : 2026/2487, 2025/454, 2026/2274 | IA | 2 | 0,5 | 4 | 65 % |
| 11 | `doctrine_ue` : Bureau de l'IA (4 lignes directrices, 2 codes, 2 modèles, Q&R), FAQ Data Act v1.4, guide véhicules | IA, non personnelles | 10 | 2,5 | 4 | 75 % |
| 12 | `cnil_doctrine` IA hors fiches (VSA, IA générative, bac à sable) | IA | 3 | 1 | 3 | 78 % |
| 13 | Élargir les filtres de `ce`, `cc` et `cjue` (CRPA, Data Act, 96/9, 2016/943, AI Act) | tous | 7 | 3 | 2,3 | **85 %** |
| — | *Seuil des 80 % franchi au rang 13, pour 15,5 unités d'effort sur 33 (47 % de l'effort total)* | | | | | |
| 14 | `sante_ue` : MDR, IVDR (+ 2023/607, 2024/1860) | santé, IA | 3 | 1,5 | 2 | 88 % |
| 15 | `sante_ue` : essais cliniques 536/2014, HTA 2021/2282 | santé | 2 | 1 | 2 | 90 % |
| 16 | Doctrine IA hors CNIL : ANSSI (⛔ bloqué), INESIA, Défenseur des droits, CNCDH, CCNE | IA | 3 | 3 | 1 | 93 % |
| 17 | HAS, ANSM ; ANS (⛔ bloqué) | santé | 2 | 3 | 0,7 | 95 % |
| 18 | Décisions des autorités étrangères (Garante, DPC) | IA | 2 | 3 | 0,7 | 97 % |
| 19 | Arcep, Autorité de la concurrence | non personnelles | 1 | 2 | 0,5 | 98 % |
| 20 | CNOM, CEDH (HUDOC) | santé | 1 | 2,5 | 0,4 | 99 % |
| 21 | Références des normes harmonisées et ISO | IA | 1 | 1,5 | 0,7 | 100 % |

Lecture :
- **Les rangs 1 à 9 n'utilisent que des chaînes existantes** : CELLAR, PISTE, scraper CNIL, `preparation`, plus un téléchargement CSV pour la CADA. Ils apportent environ 60 % de la valeur pour 9 tickets, sans aucune décision d'architecture.
- **Le rang 11 (`doctrine_ue`) est le seul gros chantier nouveau qui vaille le coût** : il demande un scraper de la Commission, mais il porte la doctrine IA et Data Act.
- **Le rang 13 (filtres des juridictions) est cher mais incontournable pour passer 80 %** : sans lui, les recours CRPA et les arrêts sur les bases de données ou le secret des affaires ne remontent pas.
- **Au-delà du rang 13, on paie surtout des sources bloquées ou à licence incertaine** : elles restent dans `20-plus-tard.md`.
- **L'ordre ne suit pas le principe « santé d'abord »** : les étapes santé sont aux rangs 3, 5 et 7, intercalées selon leur ROI. Pour privilégier la santé, il suffit de passer les rangs 3, 5 et 7 en tête : le coût total reste le même.

## 5. Contrôle du coordinateur

Six affirmations décisives ont été vérifiées sur la source, et toutes sont confirmées :

| Affirmation | Lot | Contrôle | Résultat |
|---|---|---|---|
| Art. 66 LIL réécrit par la loi 2026-403 (référentiels CNIL) | C | corpus local `lil`, LEGIARTI000054138907, art. 125 « dans sa rédaction résultant de la loi n° 2026-403 », en vigueur au 28/05/2026 | confirmé |
| Recommandation (UE) 2026/2394, clauses types du Data Act | B | CELLAR `32026H2394` : JO L du 6.11.2026, du 29 octobre 2026 | confirmé |
| Règlement d'exécution (UE) 2026/2487, bacs à sable IA | A | CELLAR `32026R2487` : du 10 novembre 2026, JO du 11.11.2026 | confirmé |
| Règlement d'exécution 2023/1622 (logos DGA) | B | CELLAR `32023R1622` | confirmé |
| C-413/23 P, 4 septembre 2025 | B | CELLAR `62023CJ0413` : « Arrêt de la Cour (première chambre) 4 septembre 2025 » | confirmé |
| Open data des avis CADA, Licence Ouverte | B | API data.gouv.fr : « Avis et conseils de la CADA », `fr-lo`, mis à jour le 14/08/2026 | confirmé (volume de 60 941 non recompté) |

Incohérences relevées :
- **Lot D** : les délibérations 2026-049 à 2026-052 (révision des MR) sont marquées « non » vérifiées au § 2.2, mais « oui » au § 4. Elles sont absentes du corpus `cnil` (grep : 0) et à relire sur Légifrance avant l'ingestion. Je les tiens pour **non vérifiées**.
- **Lots A et C** : tous deux veulent accueillir MDR/IVDR (`frontieres` contre `dm`). Arbitré au § 3.3 : les deux vont dans `sante_ue`.

Limites communes aux quatre lots :
- Plusieurs sites bloquent les robots et n'ont pas été contournés : ANS (`esante.gouv.fr`), ANSSI (`cyber.gouv.fr`), TRIS, EDPS, ISO, Conseil de l'Europe, JTC 21, et Légifrance par moments (403). Conséquence : le statut du référentiel HDS v2.1, la doctrine ANS et celle de l'EDPS restent inconnus.
- Les volumes de documents sont des estimations, sauf ceux de la CADA et des corpus locaux.

## 6. Décisions restantes

1. **Ordre** : appliquer le classement par ROI tel quel, ou remonter la santé (rangs 3, 5 et 7) en tête.
2. ~~Élargir les filtres de `ce`, `cc` et `cjue`~~ — **tranché le 25/11/2026** : on garde les corpus `ce`, `cc` et `cjue`, et on ajoute à leurs filtres les textes des nouveaux champs (CRPA, Data Act, DGA, AI Act, 96/9, 2016/943, 2019/790, EHDS). On n'ingère pas toutes les décisions de chaque juridiction.
