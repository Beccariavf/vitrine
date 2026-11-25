# Lot C — Données de santé : textes, autorités, procédure

État au 25 novembre 2026. Périmètre : **textes, autorités et procédure**. Doctrine et décisions (CNIL, CEPD, CE, CJUE sur la santé) : lot D, non traité ici.

Cadre lu : `commun.md` (fait foi) et `05-donnees.md` (cartographie du 20/11, passages santé). Les faits déjà vérifiés le 20/11 sont repris sans être revérifiés et signalés comme tels. Les identifiants de cette fiche ont été lus le 25/11 sur CELLAR (XHTML FR) ou sur l'API Légifrance (PISTE, jeton du dépôt), sauf mention contraire.

## 1. Synthèse

1. **Rien ne bloque l'ingestion du droit dur santé** : les mêmes canaux que le RGPD suffisent (CELLAR par CELEX, PISTE Légifrance). En revanche les sites d'autorités (ANS `esante.gouv.fr`, ANSSI `cyber.gouv.fr`, TRIS) renvoient une page Incapsula ou un 403 aux requêtes automatisées : la couche doctrine santé ne s'ingérera pas sans accord ou sans passe manuelle.
2. **L'EHDS est le seul texte dont la granularité article par article manque** : 105 articles, 2 annexes, 3 actes d'exécution adoptés, une vingtaine de bases d'actes d'exécution et un acte délégué, calendrier à quatre dates (2027, 2029, 2031, 2035). C'est le corpus P1 de ce lot.
3. **Le régime français des données de santé a changé le 28 mai 2026** : la loi n° 2026-403 du 26 mai 2026 (simplification de la vie économique), art. 54, réécrit l'art. 66 de la LIL — passage d'une autorisation CNIL à des **référentiels + déclaration de conformité**, l'autorisation devenant dérogatoire. Aucune fiche antérieure ne le mentionne.
4. **Le logiciel de santé est le carrefour des trois piliers** : MDR/IVDR (règle 11), chapitre III de l'EHDS, annexes I et III de l'AI Act. Il doit vivre dans un corpus `dm` propre, pas être éclaté dans `aiact`.
5. **Le trou n'est pas textuel mais institutionnel** : au 25/11/2026, aucune autorité de santé numérique (EHDS art. 19) ni aucun organisme d'accès (art. 55) n'est désigné en France ; l'échéance de notification est le 26 mars 2027.

## 2. Chaîne couche par couche

### 2.1 Texte UE de fond

| Texte | Identifiant | État | Contenu utile pour la santé | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| RGPD | `32016R0679` | en vigueur, applicable 25/5/2018 | art. 4 §15 (données de santé), 9 §2 h) i) j), 9 §4, 89 | déjà au corpus `rgpd` (272 unités) | CELLAR XHTML | décision 2011/833/UE |
| **EHDS** | `32025R0327`, JO L 2025/327 du 5/3/2025 | en vigueur 26/3/2025 ; application générale **26/3/2027** | ch. II usage primaire (art. 3-24), ch. III systèmes de DME (art. 25-49), ch. IV usage secondaire (art. 50-81), ch. V-VI gouvernance et sanctions (art. 82-100), calendrier art. 105 | **105 articles + annexes I et II** ≈ 130 unités (472 011 caractères FR) | CELLAR XHTML | 2011/833/UE |
| MDR | `32017R0745`, JO L 117/1 du 5/5/2017 | en vigueur ; applicable 26/5/2021 ; reports par 2023/607 et 2024/1860 | art. 2 §1 (dispositif), annexe VIII **règle 11** (logiciels : IIa par défaut, III si mort ou détérioration irréversible, IIb si détérioration grave ou chirurgie ; IIa pour le contrôle de processus physiologiques ; I sinon) | 123 articles, 17 annexes ≈ 160 unités | CELLAR XHTML | 2011/833/UE |
| IVDR | `32017R0746`, JO L 117/176 du 5/5/2017 | en vigueur ; applicable 26/5/2022 ; reports par 2024/1860 | annexe VIII règles 1 à 7 ; pas de « règle 11 » : le logiciel suit la règle 1.4 (même classe que le dispositif commandé ; classé en soi s'il est indépendant) | 113 articles, 15 annexes ≈ 145 unités | CELLAR XHTML | 2011/833/UE |
| Report MDR/IVDR | `32023R0607`, JO L 80/24 du 20/3/2023 | en vigueur | prolongation des certificats : 31/12/2027 (classe III, IIb implantables), 31/12/2028 (autres IIb, IIa, I stériles/mesure) | 3 articles | CELLAR XHTML | 2011/833/UE |
| Report + Eudamed | `32024R1860`, JO L 2024/1860 du 9/7/2024 | en vigueur | déploiement progressif d'Eudamed, interruption d'approvisionnement ; IVDR : 31/12/2027 (classe D), 2028 (C), 2029 (B et A stérile) | 3 articles | CELLAR XHTML | 2011/833/UE |
| Essais cliniques | `32014R0536`, JO L 158/1 du 27/5/2014 | en vigueur, applicable depuis 2022 (notice art. 82) | art. 28 (conditions générales), 29 (consentement), 76 (compensation), 93 (protection des personnes) ; annexes I et VI | 99 articles, 7 annexes ≈ 110 unités | CELLAR XHTML | 2011/833/UE |
| HTA | `32021R2282`, JO L 458/1 du 22/12/2021 | applicable **12/1/2025** | évaluations cliniques conjointes ; sélection pour l'oncologie et les thérapies innovantes dès 2025 | 36 articles, 2 annexes | CELLAR XHTML | 2011/833/UE |
| Soins transfrontaliers | `32011L0024`, JO L 88/45 du 4/4/2011 | en vigueur | art. 14 : réseau « santé en ligne » (eHealth Network), orientations sur le contenu du dossier partageable et sur l'usage des données médicales à des fins de recherche | 23 articles | CELLAR XHTML | 2011/833/UE |
| NIS2 (articulation) | `32022L2555`, JO L 333 du 27/12/2022 | en vigueur ; transposition FR au 17/10/2024 (art. 41) — **non vérifiée** | annexe I, point 5 « Santé » : prestataires de soins au sens de 2011/24, laboratoires de référence UE, entités R&D médicaments, entités fabriquant des DM critiques, etc. | 46 articles, 3 annexes | CELLAR XHTML | 2011/833/UE |
| AI Act (renvoi) | `32024R1689` | en vigueur | annexe I section A (points 11 et 12 : DM et DMIV) ; annexe III point 5 c) : évaluation des risques et tarification en **assurance-vie et assurance maladie** ; point 5 d) : tri des appels d'urgence ; art. 6 §1 | déjà au corpus `aiact` | CELLAR consolidation | 2011/833/UE |

**EHDS — ce que l'article dit, article par article** (lu sur CELLAR, 25/11/2026) :

- **Usage primaire** — art. 3 droit d'accès de la personne à ses données ; 4 services d'accès (dont la procuration, art. 4 §4) ; 5 insertion de données ; 6 rectification ; 7 portabilité ; 8 limitation d'accès ; 9 informations sur les accès ; 10 **opt-out** national, réversible, avec exception des intérêts vitaux (art. 9 §2 c) RGPD) ; 11-12 accès des professionnels ; 13 enregistrement ; 14 **catégories prioritaires** (a résumés, b prescriptions, c dispensations, d imagerie, e résultats d'examens, f comptes rendus de sortie) ; 15 format européen d'échange ; 16 identification ; 17 exigences techniques ; 18 indemnisation.
- **Systèmes de DME** — 25 composants logiciels harmonisés (interopérabilité + journalisation) ; **25 §2 exclut les logiciels à usage général** ; 26 mise sur le marché (y compris DME interne à un établissement, réputé « mis en service ») ; **27 articulation avec MDR/IVDR et AI Act** (un DM ou un SIA à haut risque qui allègue l'interopérabilité doit prouver la conformité aux exigences de l'annexe II section 2, et l'art. 36 s'applique) ; 28 allégations ; 29 remboursement ; 30-35 obligations fabricants, mandataires, importateurs, distributeurs ; 36 spécifications communes (adoption **au plus tard le 26/3/2027**) ; 37 documentation technique ; 38 fiche d'information ; 39 déclaration UE ; 40 environnement d'essai ; 41 marquage CE ; 43 autorités de surveillance du marché ; 44 gestion des risques ; 47-49 applications de bien-être.
- **Usage secondaire** — 51 catégories minimales (a à p ; les points b, f, g, m, p ne s'appliquent qu'au 26/3/2031) ; 53 finalités autorisées ; **54 finalités interdites** (décision préjudiciable, offre d'emploi, publicité, etc.) ; 55 **ORAD** (désignation, coordonnateur, notification art. 55 §6) ; 56 service d'accès de l'Union ; 57 tâches ; 58 obligations envers les personnes ; 60-61 détenteurs et utilisateurs ; **62 redevances** (proportionnelles au coût, réductions possibles) ; 63 exécution ; **64 amendes administratives** (critères ; plafonds renvoyés au droit national) ; 67-69 demande, autorisation, demande de données ; 70 modèles (26/3/2027) ; 71 droit de refus ; **72 procédure simplifiée pour les « détenteurs de données de santé de confiance »** ; 73 environnement de traitement sécurisé ; 75 DonnéesDeSanté@UE ; 76-80 catalogue, label, ensembles à incidence majeure ; 81 réclamation.
- **Non personnel et international** — 88 transfert de données non personnelles, 89 accès international des autorités publiques, 90-91 transferts de données personnelles et demandes de pays tiers.
- **Gouvernance et sanctions** — 92-96 comité de l'EEDS, forum, groupes de pilotage, Commission ; 99 **sanctions nationales**, régime notifié au plus tard le 26/3/2027 ; 100 droit à réparation.
- **Calendrier (art. 105)** — application générale 26/3/2027 ; art. 3-15, 23 §2-6, 25-27, 47-49 au 26/3/2029 (catégories a, b, c) et au 26/3/2031 (d, e, f) ; chapitre III au 26/3/2031 ; chapitre IV au 26/3/2029, avec dès le 26/3/2027 les art. 55 §6, 70, 73 §5, 75 §1 et §12, 77 §4, 78 §6 ; art. 75 §5 au 26/3/2035.

### 2.2 Actes d'exécution et délégués de l'EHDS

Adoptés (repris de `05-donnees` § 2, vérifiés le 20/11, **non relus le 25/11**) : `32026R0771` (comité de l'EEDS), `32026R2083` (MaSanté@UE), `32026R2098` (métadonnées minimales des détenteurs).

Bases encore ouvertes, relevées dans le texte du règlement (lu ce jour) — aucune liste consolidée officielle n'existe :

| Base | Objet | Échéance |
|---|---|---|
| art. 4 §8 | spécifications des services de procuration | — |
| art. 13 §4 | enregistrement des données de santé électroniques | — |
| **art. 14 §2 (acte délégué)** | modification des caractéristiques des catégories prioritaires (annexe I) | — |
| art. 15 §1 | format européen d'échange des DME | **26/3/2027** |
| art. 16 | identification et authentification transfrontières | — |
| art. 17 | exigences de mise en œuvre technique des droits | — |
| art. 23 §4 | MaSanté@UE | — |
| art. 24 | services transfrontières supplémentaires | — |
| **art. 36 §1** | spécifications communes des DME | **26/3/2027** |
| art. 40 | environnement d'essai numérique européen | — |
| art. 47 | label des applications de bien-être | — |
| art. 62, 63 | redevances, exécution par les ORAD | — |
| art. 68 | logo EEDS | — |
| **art. 70** | modèles de demande et d'autorisation | **26/3/2027** |
| art. 73 §5 | environnements de traitement sécurisés | 26/3/2027 (applicable 2029) |
| art. 74 | modèle d'accord responsable/sous-traitant | — |
| art. 75 §12 | DonnéesDeSanté@UE | 26/3/2027 |
| **art. 77 §4** | métadonnées des ensembles de données | **26/3/2027** (fait par 2026/2098) |
| art. 78 §6 | label de qualité et d'utilité | 26/3/2027 |
| art. 80 | ensembles de données à incidence majeure | — |
| art. 88, 91, 92 | transferts, accès de pays tiers, comité | — |

Conséquence d'ingestion : un corpus `ehds` doit prévoir l'**ajout par veille** de tout règlement d'exécution ou délégué dont la base est l'un de ces articles — la veille `eurlex` actuelle ne détecte que les consolidations et les décisions d'adéquation, pas les actes d'exécution d'un règlement sectoriel.

### 2.3 Texte UE de procédure (contrôle, sanctions, recours)

- **EHDS, usage primaire** : autorités de santé numérique (art. 19), notification à la Commission **26/3/2027**, coordonnateur si pluralité ; rapports (20) ; réclamation (21) ; articulation avec les autorités de contrôle RGPD (22) ; surveillance du marché des DME (43-46), avec procédure de sauvegarde de l'Union (46).
- **EHDS, usage secondaire** : ORAD (55), tâches (57), rapports (59), exécution (63), **amendes administratives (64)** — effectives, proportionnées, dissuasives, plafonds laissés au droit national ; relations avec les autorités de contrôle RGPD (65) ; réclamation (81) ; **sanctions nationales (99)**, régime notifié au 26/3/2027 ; réparation (100).
- **Aucun guichet unique** : la compétence est partagée entre autorités de santé numérique, ORAD, autorités de surveillance du marché et autorités de contrôle RGPD. Le considérant et l'art. 22 organisent la coopération, pas la substitution.
- **Recours** : art. 263 et 267 TFUE pour les actes d'exécution ; pour le reste, juge national (art. 21 et 81 imposent une voie de recours effective).
- **NIS2** : art. 41 imposait la transposition au 17/10/2024 ; le régime français n'a pas pu être vérifié (voir § 6).

### 2.4 Autorités UE

| Autorité | Base | Ce qu'elle produit | Où | Licence |
|---|---|---|---|---|
| Commission — DG SANTE | EHDS art. 92-96 | actes d'exécution et délégués, page de mise en œuvre, calendrier officiel (2027 / 2029 / 2031 / 2035) | `health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en` (lue) | 2011/833/UE présumée |
| Comité de l'espace européen des données de santé | art. 92 ; règl. d'exécution 2026/771 | avis, coordination, préparation des actes | pas de page dédiée trouvée | inconnu |
| EMA | règlement 726/2004 et paquet pharma en cours | DARWIN EU (réseau de données en vie réelle), avis, jeux de données | `ema.europa.eu` | conditions EMA |
| CEPD | art. 70 RGPD | lignes directrices et avis santé (art. 9, EHDS) | `edpb.europa.eu` | notice CEPD |

**DARWIN EU** : réseau coordonné par l'EMA, sans base juridique propre vérifiée article par article dans cette session (le règlement 2022/123, lu ce jour, ne le mentionne pas). À traiter comme source de données, non comme norme.

### 2.5 Autorités nationales françaises

| Autorité | Texte qui la désigne (lu) | Pouvoirs utiles en santé | Publie |
|---|---|---|---|
| Ministère / DNS | aucune disposition unique ; politique portée par la doctrine du numérique en santé | pilotage, référentiels, cadre EHDS (consultation, version 5/10/2026, source secondaire) | `sante.gouv.fr`, `esante.gouv.fr` (bloqué aux robots) |
| **ANS** | CSP **L1111-24** : « groupement d'intérêt public chargé du développement des systèmes d'information de santé partagés » (non nommée dans l'article) | élabore les référentiels d'interopérabilité, de sécurité et d'éthique (**L1470-5**), délivre le certificat de conformité (**L1470-6**), administre les répertoires sectoriels (**L1470-4**) | CI-SIS, PGSSI-S, Ségur, fiches G_NIUS |
| **ANSM** | non vérifié | police des DM/DMIV, logiciels-dispositifs ; autorité compétente des RIPH (chapitre CSP L1123, non lu article par article) | décisions, référentiels DM numérique |
| **HAS** | non vérifié | évaluation, avis sur le télésoin (**L6316-2**), certification | recommandations |
| **CNAM** | CSS **L161-28-1** (SNIIRAM), **L161-31** (carte électronique individuelle) | production de données, co-responsable de l'espace numérique de santé (**R1111-26**) | ameli.fr |
| **Plateforme des données de santé (Health Data Hub)** | CSP **L1462-1** (GIP), **L1462-2** | met à disposition le SNDS, secrétariat unique (**LIL art. 76**), secrétariat du CESREES | catalogue, guides |
| **CESREES** | LIL **art. 72 et 76** ; décret 2019-536 **art. 90 à 100** | avis sur les recherches n'impliquant pas la personne humaine et les études | avis, rapport annuel |
| **CPP / CNRIPH** | CSP **L1123-6** (CPP), **L1123-1** et **L1123-7** | avis sur les RIPH ; CNRIPH non vérifiée | avis |
| **Cofrac** | CSP **L1111-8 II** + loi 2008-776 art. 137 | accrédite les organismes certificateurs HDS | listes d'accréditation |
| **CNIL** | LIL art. 8 s. ; RGPD | référentiels santé (**LIL art. 66 II**), déclaration de conformité (III), autorisation dérogatoire (IV), avis conforme sur certains textes, sanctions | délibérations (lot D) |
| **ARS** | CSP **L3113-1** | signalement des maladies à déclaration obligatoire | instructions |
| **CNOM** | CSP **R4127-4** (secret), **R4127-45** (dossier médical) | déontologie, juridiction ordinale | code de déontologie |
| **Autorité de santé numérique (EHDS art. 19)** | **non désignée au 25/11/2026** | notification due le 26/3/2027 | — |
| **ORAD (EHDS art. 55)** | **non désigné** | guichet d'accès à l'usage secondaire | — |

### 2.6 Texte national de fond

**Ce qui est déjà ingéré** (vérifié sur le corpus, sources Légifrance) :

- `lil` — loi 78-17 **entière** (133 articles en vigueur). Le chapitre santé **art. 64 à 77** y est donc présent, y compris art. 65 (champ et exclusions), 66 (régime), 67 (mission de service public), 68 (transmission malgré le secret), 69-71 (information), 72 (CESREES), 73 (méthodologies de référence), 74 (droit d'opposition), 75 (génétique), 76 (avis CPP/CESREES, secrétariat unique, comités locaux), 77 (comité d'audit du SNDS).
- `textes_fr` — **décret 2019-536 entier** (166 articles) : les articles santé sont les **art. 86 à 116** (autorisation, CESREES, comité d'audit, procédures simplifiées, information, génétique). Le corpus contient aussi **CSP L1110-4, L1111-7, L1111-8** (3 articles seulement), C. pén. 226-16 à 226-24, 226-1, 226-8-1, C. trav. L1121-1, L1222-4, L2312-38, C. civ. 9, CPCE L34-5, CRPA L311-3-1.

**Ce qui manque — CSP, article par article** (tous les identifiants ci-dessous ont été lus sur PISTE le 25/11). Les identifiants sont des `LEGIARTI` ; la forme `…` abrège les zéros de tête et se reconstruit en `LEGIARTI` suivi de douze chiffres complétés à gauche (`…42656263` = `LEGIARTI000042656263`).

| Bloc | Articles | Contenu | ID |
|---|---|---|---|
| Secret et partage | L1110-4 | secret, exceptions légales, accès du patient, décès | `LEGIARTI000043895798` |
| Équipe de soins | L1110-12 | définition de l'équipe de soins (établissement, structure de coopération, etc.) | `LEGIARTI000031919050` |
| Partage entre professionnels | R1110-1, R1110-2, R1110-3 | conditions d'échange et de partage, catégories de professionnels | `LEGIARTI000032924972`, `…44635603`, `…32924947` |
| Information et consentement | L1111-2, L1111-4, L1111-5, L1111-6 | information, consentement, mineurs, personne de confiance | `…54137408`, `…54137430`, `…31927576`, `…54137811` |
| Accès au dossier | **L1111-7** (déjà au corpus) + R1111-1, R1111-2 | modalités de demande, délais, consultation sur place | `LEGIARTI000042685313`, `…43588055`, `…48870433` |
| Hébergement HDS | **L1111-8** (déjà au corpus) + R1111-8-8 (activité), R1111-9, **R1111-9-1** (stockage UE/EEE), **R1111-11** (clauses du contrat) | certification, annexe, contrat | `…49577902`, `…36656709`, `…53720790`, `…53720788`, `…53720795` |
| INS | L1111-8-1, R1111-8-1, R1111-8-2 | NIR comme identifiant de santé, NIR provisoire | `…42661590`, `…45283906`, `…39201989` |
| Incidents SI | L1111-8-2 | signalement des incidents graves de sécurité | `…42536620` |
| Espace numérique de santé | L1111-13, **L1111-13-1**, L1111-14, L1111-15, L1111-16, L1111-17, L1111-18, L1111-19, L1111-21, L1111-22 | DMP intégré à l'ENS, ouverture automatique sauf opposition, alimentation, accès en urgence, traces, transfrontalier | `…42656263` (L1111-13), `…54137800` (L1111-13-1), `…41721082` (L1111-14) ; les autres se lisent par numéro |
| Dossier pharmaceutique | L1111-23, L1111-24 | DP automatique ; GIP ANS | `…42656004`, `…51288322` |
| Télésanté | L6316-1, L6316-2 + R6316-1 à R6316-5 | télémédecine, télésoin, conditions de mise en œuvre | `…54336504`, `…38841874`, `…43600549`, `…43600537` (R6316-3 à R6316-5 non lus) |
| Référentiels opposables | **L1470-1 à L1470-6** + R1470-1 à R1470-3 | services numériques en santé, identification, **conformité aux référentiels ANS**, certificat de conformité | `…43497477`, `…43497481`, `…43497483`, `…43497485`, `…46812429`, `…46822530` |
| SNDS | L1460-1, L1461-1 à L1461-7, R1461-1 | périmètre, mise à disposition du public, accès, absence de NIR, gratuité, décret | `…38886892`, `…43894115` s. |
| HDH | L1462-1, L1462-2 | GIP Plateforme des données de santé | `…38886833`, `…38883123` |
| RIPH | L1121-1 (3 catégories), L1121-2, L1121-3, L1121-4, L1122-1, L1123-1, L1123-6, L1123-7, L1123-12, L1124-1 | régime Jardé, CPP, autorité compétente | `…46125746`, `…25457486`, `…54138639` |
| DM/DMIV (renvoi) | L1125-1, L1126-1 | recherches sur DM et DMIV | `…46125658`, `…46125636` |
| Génétique | L1131-1, L1131-1-1, L1131-1-2, L1131-2, L1131-3, L1131-4 + C. civ. **16-10** | consentement exprès écrit, information de la parentèle, conservation | `…43895837`, `…47569317` (C. civ.) |
| Assurance / AERAS | L1141-1 à L1141-6 | interdiction des tests génétiques, convention AERAS, droit à l'oubli | `…45372010` (L1141-5) |
| Déclaration obligatoire | L3113-1 | signalement ARS / Santé publique France | `…42536636` |
| Pharmacovigilance | L5121-22 | objet de la pharmacovigilance | `…25086407` |
| Certificat de décès | **CGCT L2223-42** (pas le CSP) ; causes de décès visées par CSP L1461-1 3° | certificat médical de décès, support des données de causes de décès | `…51284870` |

**Autres codes** (lus le 25/11) :

- **C. pén. 226-13** — révélation d'information à caractère secret : 1 an et 15 000 € (`LEGIARTI000006417945`). **Absent de `textes_fr`** : c'est la pièce pénale du secret médical, elle manque.
- **CSS L161-28-1** — SNIIRAM, contribue au SNDS (`…38886948`) ; **L161-31** — moyen d'identification électronique du bénéficiaire, carte Vitale (`…43498566`) ; **L315-1** — contrôle médical (`…54336551`).
- **C. assurances L133-1** — accès garanti à l'assurance invalidité/décès renvoyant aux art. L1141-1 à -3, -5 et -6 CSP (`…31931905`) ; **L113-2** — déclaration du risque, questionnaire (`…35731302`).
- **C. trav. L4624-8** — dossier médical en santé au travail (`…43908383`) ; **L1226-2** — inaptitude d'origine non professionnelle (`…35653236`).
- **C. mutualité** : aucune disposition propre identifiée ; l'art. L1141-1 CSP visant « les entreprises et organismes » couvre les mutuelles.
- **Décret n° 2021-848 du 29 juin 2021** — traitement « système national des données de santé » (LODA, vérifié par recherche sur le numéro).
- **Arrêté du 6 mai 2024** — référentiel de sécurité applicable au SNDS (`LEGITEXT000049518118`, titre lu, texte non lu).

### 2.7 Texte national de procédure

- **Autorisation / déclaration CNIL** : LIL art. 66 (référentiels, déclaration, autorisation dérogatoire, silence valant acceptation dans deux mois), art. 67-77 ; décret 2019-536 art. 86-116 (dossier, secrétariat unique, CESREES, comités locaux, information, opposition).
- **Changement de régime** : loi **n° 2026-403 du 26 mai 2026**, art. 54, modifie l'art. 66 ; version en vigueur depuis le **28 mai 2026** ; une version ultérieure est déjà programmée (la version courante au corpus porte une date de fin au 26/11/2027). Le décret 2019-536, dans sa version au corpus, mentionne déjà la « déclaration de conformité à l'un des référentiels » (art. 110) : la logique déclarative n'est donc pas nouvelle, c'est son rang et son caractère prioritaire qui changent.
- **Certification HDS** : L1111-8 II, R1111-8-8 (activité), R1111-9, R1111-9-1 (stockage UE/EEE), R1111-11 (contrat) — la sous-section ne compte pas de R1111-8-9 à R1111-8-12 ; référentiel approuvé par arrêté (v2.0 : arrêté du 11/6/2018 modifié le 26/4/2024 ; v2.1 : projet notifié, voir § 2.9).
- **Référentiels ANS opposables** : L1470-5 (élaboration), L1470-6 (certificat), R1470-1 à R1470-3 (dossier, instruction).
- **Sanctions** : CNIL (RGPD art. 83, plafonds 20 M€ / 4 %) ; pénal (226-13, 226-16 s.) ; ordinal (R4127-4 s.) ; EHDS (art. 64 et 99, à transposer) ; NIS2 (régime FR non vérifié).

### 2.8 Recours

| Voie | Objet | Source |
|---|---|---|
| Conseil d'État | recours contre les sanctions CNIL ; excès de pouvoir contre les référentiels et décisions ANS | LIL, RGPD ; `opendata.justice-administrative.fr` |
| Juridiction judiciaire | responsabilité, contrat d'hébergement, secret | non recensé |
| Juridiction ordinale | déontologie (R4127-…) | CNOM |
| CJUE | renvois préjudiciels (interprétation EHDS, MDR, RGPD) | CURIA, corpus `cjue` |
| Conseil constitutionnel | QPC sur les régimes d'accès (SNDS, LIL) | corpus `constit` |

### 2.9 Préparation

- **EHDS, mise en œuvre française** : au 25/11/2026, **aucune désignation** notifiée. Le ministère a soumis à consultation un « Cadre de mise en œuvre du règlement EHDS en France », version du **5 octobre 2026** (source secondaire, `dsih.fr`, 12/10/2026, non vérifiée sur une source officielle). Ce cadre décrit une gouvernance tripartite de l'ORAD : Plateforme des données de santé en guichet unique (instruction, autorisation, mise à disposition, services communs), CNIL pour l'avis conforme sur les données personnelles et la sanction des usages interdits, des extractions hors environnement sécurisé et des réidentifications, et **ministère chargé de la santé comme ORAD coordonnateur** ; le CESREES garde l'évaluation scientifique et éthique, avec dispense possible en cas d'avis favorable d'un comité local. Les droits des personnes, le régime du SNDS et les sanctions relèveraient d'un second véhicule législatif. **À vérifier sur le texte du DDADUE et sur le site du ministère.**
- **Paquet pharmaceutique** : proposition **COM(2023) 0192** (directive, procédure **2023/0132(COD)**) et **COM(2023) 0193** (règlement, **2023/0131(COD)**), du 26/4/2023. État au 25/11/2026 (OEIL, lu) : position du Conseil **07106/2/2026** publiée le 1/10/2026, vote en commission du Parlement en 2e lecture le 10/11/2026, recommandation **A10-0297/2026** déposée le 13/11/2026 ; statut « en attente de la 2e lecture du Parlement ». Non adopté.
- **Référentiel HDS v2.1** : projet notifié le 25/8/2026 (TRIS 2026/0452/FR, fin de statu quo annoncée au 26/11/2026). **Non vérifiable ce jour** : TRIS et `esante.gouv.fr` renvoient 403 ou une page Incapsula. Au 25/11, aucune publication au JO n'a pu être constatée.
- **NIS2 France** : transposition non vérifiée (`cyber.gouv.fr` bloqué). Un point de contrôle : la fiche `02-cyber.md` du 20/11 doit dire si le texte FR est adopté.
- **PLFSS 2027** : dispositions numériques non vérifiées ; aucune source officielle lue.

## 3. Frontières avec les autres piliers

| Sujet | Où le ranger | Pourquoi |
|---|---|---|
| AI Act (annexe I, annexe III 5 c et 5 d, art. 6) | `aiact` (déjà) ; renvoi depuis `dm` | c'est du droit IA général, la santé n'en est qu'une application |
| MDR, IVDR, EHDS ch. III, logiciels DM | **`dm`** (nouveau) | qualification du produit ; détermine si l'AI Act ou le RGPD s'applique |
| Données de santé **non personnelles** (EHDS art. 88-89) | `ehds`, avec renvoi vers le pilier données | même texte, deux régimes |
| NIS2, incidents SI (CSP L1111-8-2) | `cyber` (`02-cyber.md`) | sécurité, pas protection des données |
| Assurance (AERAS, questionnaire de santé, L133-1) | pilier consommation/finance | le texte santé n'y est qu'un renvoi |
| Recherche (CTR, HTA, RIPH, CESREES) | **`essais`** ou `sante_fr` | la procédure est autonome et sert aussi hors santé (médicament) |
| Doctrine et décisions santé (CNIL, CEPD, CE, CJUE) | **lot D** | ne pas dupliquer |

## 4. Tableau besoin / existant (delta seulement)

Ce que `05-donnees` couvre déjà et qui n'est donc pas répété : CELEX de l'EHDS et ses trois actes d'exécution, CSP L1111-8, R1111-8-8, décret 2026-209, CSP L1461-1, L1462-1, référentiel HDS v2.0, projet v2.1, désignations EHDS absentes. Les lignes ci-dessous sont le complément.

| Couche | Source | Identifiant | Nature | Autorité | Accès | Licence | Dans Vitrine ? | Priorité | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|
| texte UE de fond | MDR | CELEX `32017R0745` | fond | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de fond | IVDR | CELEX `32017R0746` | fond | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de fond | report MDR/IVDR | CELEX `32023R0607` | fond | UE | CELLAR XHTML | 2011/833/UE | non | P2 | oui |
| texte UE de fond | report + Eudamed | CELEX `32024R1860` | fond | UE | CELLAR XHTML | 2011/833/UE | non | P2 | oui |
| texte UE de fond | essais cliniques | CELEX `32014R0536` | fond + procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de fond | HTA | CELEX `32021R2282` | fond | UE | CELLAR XHTML | 2011/833/UE | non | P2 | oui |
| texte UE de fond | soins transfrontaliers | CELEX `32011L0024`, art. 14 | fond | UE | CELLAR XHTML | 2011/833/UE | non | P2 | oui |
| texte UE de fond | NIS2 (articulation) | CELEX `32022L2555`, annexe I pt 5 | fond | UE | CELLAR XHTML | 2011/833/UE | non | P3 | oui |
| texte UE de procédure | EHDS, autorités de santé numérique | art. 19 | procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de procédure | EHDS, ORAD | art. 55 à 59 | procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de procédure | EHDS, permis et procédure simplifiée | art. 67 à 72 | procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de procédure | EHDS, amendes et sanctions | art. 63, 64, 99 | procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de procédure | EHDS, calendrier | art. 105 | procédure | UE | CELLAR XHTML | 2011/833/UE | non | P1 | oui |
| texte UE de procédure | EHDS, bases d'actes d'exécution et délégués | art. 4, 13, 14 §2, 15, 16, 17, 23, 24, 36, 40, 47, 62, 63, 68, 70, 73, 74, 75, 77, 78, 80, 88, 91, 92 | procédure | Commission | dérivées du texte | 2011/833/UE | non | P2 | oui |
| texte UE de procédure | EHDS, actes d'exécution adoptés | `32026R0771`, `32026R2083`, `32026R2098` | procédure | Commission | CELLAR XHTML | 2011/833/UE | non | P2 | non (repris de 05-donnees) |
| autorité UE | Commission DG SANTE, page EHDS | calendrier 2027/2029/2031/2035 | doctrine | Commission | HTML | 2011/833/UE présumée | non | P2 | oui |
| autorité UE | EMA / DARWIN EU | réseau de données en vie réelle | doctrine | EMA | HTML | conditions EMA | non | P3 | non |
| autorité nationale | ANS | CSP L1111-24 (GIP), L1470-4 à L1470-6 | procédure + doctrine | ANS | HTML/PDF (bloqué) | inconnue | non | P1 | partiel (GIP de L1111-24, non nommé) |
| autorité nationale | autorité de santé numérique EHDS | art. 19 — **non désignée** | procédure | État | — | — | non | P1 | partiel (absence constatée) |
| autorité nationale | ORAD | art. 55 — **non désigné** | procédure | État | — | — | non | P1 | partiel |
| autorité nationale | CESREES | LIL art. 72 et 76 ; décret 2019-536 art. 90 à 100 | procédure | ministères santé/recherche | Légifrance | LO 2.0 | oui (`lil`, `textes_fr`) | P1 | oui |
| autorité nationale | CPP / CNRIPH | CSP L1123-1, L1123-6, L1123-7, L1123-12 | procédure | ministères | Légifrance | LO 2.0 | non | P2 | oui (identifiants) |
| autorité nationale | Cofrac | CSP L1111-8 II + loi 2008-776 art. 137 | procédure | Cofrac | HTML | inconnue | non | P2 | oui |
| autorité nationale | ARS | CSP L3113-1 | procédure | ARS | Légifrance | LO 2.0 | non | P2 | oui |
| autorité nationale | CNOM | CSP R4127-4, R4127-45 | doctrine + procédure | CNOM | Légifrance | LO 2.0 | non | P2 | oui |
| autorité nationale | ANSM | base légale non vérifiée | procédure | ANSM | HTML | inconnue | non | P2 | non |
| autorité nationale | HAS | base légale non vérifiée ; avis télésoin L6316-2 | doctrine | HAS | HTML | inconnue | non | P2 | partiel |
| texte national de fond | CSP, secret et partage | L1110-4, L1110-12, R1110-1 à R1110-3 | fond | législateur | PISTE | LO 2.0 | partiel (L1110-4) | P1 | oui |
| texte national de fond | CSP, accès au dossier | L1111-7 (au corpus), R1111-1, R1111-2 | fond | législateur | PISTE | LO 2.0 | partiel | P1 | oui |
| texte national de fond | CSP, INS | L1111-8-1, R1111-8-1, R1111-8-2 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, incidents de sécurité SI | L1111-8-2 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, espace numérique de santé | L1111-13 à L1111-19, L1111-21, L1111-22, R1111-26, R1111-27 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, dossier pharmaceutique | L1111-23 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | CSP, messagerie sécurisée | L1111-15 (envoi par messagerie sécurisée) | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, référentiels opposables | L1470-1 à L1470-6, R1470-1 à R1470-3 | fond + procédure | ANS | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, télésanté | L6316-1, L6316-2, R6316-1 à R6316-5 | fond | législateur | PISTE | LO 2.0 | non | P1 | partiel (R6316-3 à R6316-5 non lus) |
| texte national de fond | CSP, SNDS (compléments) | L1460-1, L1461-2 à L1461-7, R1461-1 | fond | législateur | PISTE | LO 2.0 | partiel (L1461-1) | P1 | oui |
| texte national de fond | décret SNDS | décret n° 2021-848 du 29/6/2021 | fond | gouvernement | Légifrance (LODA) | LO 2.0 | non | P1 | oui |
| texte national de fond | référentiel de sécurité SNDS | arrêté du 6/5/2024, `LEGITEXT000049518118` | fond (technique) | ministère | Légifrance | LO 2.0 | non | P2 | partiel (titre) |
| texte national de fond | CSP, RIPH | L1121-1 à L1121-4, L1122-1, L1123-1 à L1123-12, L1124-1 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui (identifiants) |
| texte national de fond | CSP, RIPH sur DM/DMIV | L1125-1, L1126-1 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui (identifiants) |
| texte national de fond | CSP, génétique | L1131-1 à L1131-4 ; C. civ. 16-10 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CSP, assurance et AERAS | L1141-1 à L1141-6 ; C. assur. L133-1, L113-2 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | CSS, SNIIRAM et carte Vitale | L161-28-1, L161-31, L315-1 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | C. trav., santé au travail | L4624-8, L1226-2 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | C. pén., secret professionnel | 226-13 | fond | législateur | PISTE | LO 2.0 | **non** | P1 | oui |
| texte national de fond | CGCT, certificat de décès | L2223-42 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | CSP, déclaration obligatoire | L3113-1 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | CSP, pharmacovigilance | L5121-22 | fond | législateur | PISTE | LO 2.0 | non | P3 | oui |
| texte national de procédure | LIL, régime santé modifié | loi 2026-403 du 26/5/2026, art. 54 → LIL art. 66 | procédure | législateur | Légifrance | LO 2.0 | oui (`lil`, version à jour) | P1 | oui |
| texte national de procédure | décret 2019-536, blocs santé | art. 86 à 116 | procédure | gouvernement | Légifrance | LO 2.0 | oui (`textes_fr`) | P1 | oui |
| recours national | CE, contentieux des sanctions et des référentiels | LIL, RGPD ; JADE | décision | Conseil d'État | `opendata.justice-administrative.fr` | LO 2.0 | partiel (`ce` filtré données personnelles) | P2 | oui (fondement) |
| juge UE | CJUE, renvois santé | art. 267 TFUE | décision | CJUE | CURIA/CELLAR | réutilisation libre | partiel (`cjue` filtré données personnelles) | P2 | non (aucune affaire relevée) |
| préparation | paquet pharmaceutique | COM(2023) 192 et 193 ; 2023/0132(COD), 2023/0131(COD) ; Conseil 07106/2/2026 et 07105/2/2026 | fond (projet) | Commission/Conseil/Parlement | OEIL HTML | réutilisation libre | non | P2 | oui |
| préparation | mise en œuvre FR de l'EHDS | cadre de consultation du 5/10/2026 ; DDADUE | procédure (projet) | ministère | inconnu | inconnue | non | P1 | non |
| préparation | transposition NIS2 | art. 41, échéance 17/10/2024 | fond (projet) | gouvernement | bloqué | — | non | P3 | non |
| préparation | PLFSS 2027, volet numérique | — | fond (projet) | gouvernement | inconnu | — | non | P3 | non |

Lignes : 57. Vérifiées sur la source officielle dans cette session : 44 (dont 4 avec une réserve de portée indiquée entre parenthèses). Partielles : 6. Non : 7.

## 5. Proposition de corpus

| Ordre | Corpus | Contenu | Canal | Facilité | Utilité |
|---|---|---|---|---|---|
| 1 | **`ehds`** | règlement 2025/327 (105 art. + annexes I et II), actes d'exécution et délégués, par ajout | CELLAR par CELEX, même parseur que `rgpd` ; veille à étendre aux actes d'exécution | 1 | P1 |
| 2 | **extension `textes_fr`** | blocs CSP : L1110-4 à L1110-12 + R1110, L1111-2 à L1111-24 + R1111, L1470-1 à L1470-6 + R1470, L1460-1 et L1461-1 à L1461-7 + R1461, L1121 à L1126, L1131, L1141, L6316 + R6316, L3113-1, L5121-22 ; CSS L161-28-1, L161-31, L315-1 ; C. pén. 226-13 ; CGCT 2223-42 ; C. assur. L133-1, L113-2 ; C. trav. L4624-8, L1226-2 | PISTE `/consult/code` par section (1 appel par bloc, pas un par article) | 2 | P1 |
| 3 | **`dm`** | MDR, IVDR, 2023/607, 2024/1860 ; renvois vers `aiact` | CELLAR par CELEX | 1 | P1 |
| 4 | **`essais`** | CTR 536/2014, HTA 2021/2282 ; renvois LIL 72-77 et CSP L1121 | CELLAR par CELEX | 1 | P2 |
| 5 | **extension `preparation`** | paquet pharma (OEIL), mise en œuvre FR de l'EHDS, NIS2 FR | HTML OEIL, AN/Sénat | 2 | P2 |
| 6 | **`sante_autorites`** | ANS (CI-SIS, PGSSI-S, Ségur), ANSM, HAS, CNIL santé (renvoi lot D) | scraping HTML/PDF, **sites bloqués** | 3 | P2 |

Deux règles d'ingestion à conserver : ne jamais mélanger texte et doctrine dans le même corpus (la licence change), et ne pas dupliquer les articles déjà dans `textes_fr` — les blocs CSP s'ajoutent au descripteur existant, qui sait déjà faire « N articles d'un code ».

## 6. Points à vérifier

1. **Mise en œuvre française de l'EHDS** : le « cadre » du 5 octobre 2026 et la gouvernance tripartite de l'ORAD (PDS guichet unique, CNIL, ministère coordonnateur, CESREES pour l'éthique) sont connus par une source secondaire (`dsih.fr`). Rien n'est vérifié sur une source officielle ; le véhicule législatif (DDADUE ou texte dédié) n'est pas identifié.
2. **Désignations EHDS** : absence constatée par l'absence de texte, pas par une source qui la publie. La Commission doit publier la liste des autorités (art. 19 §1, dernier alinéa) : elle n'a pas été trouvée.
3. **Référentiel HDS v2.1** : statut au 25/11/2026 inconnu (TRIS et ANS bloquent). Le statu quo TRIS annoncé au 26/11/2026 rend la publication imminente ou faite : à relire le 27/11.
4. **NIS2 en France** : transposition non vérifiée ; la fiche `02-cyber.md` doit trancher.
5. **LIL art. 66, seconde étape** : la version lue s'applique du 28/5/2026 au 26/11/2027 ; la version suivante, déjà adoptée, n'est pas décrite ici.
6. **ANS, ANSM, HAS** : aucune base légale lue pour l'ANSM et la HAS ; les licences de leurs publications ne sont pas vérifiées.
7. **Référentiels ANS** (CI-SIS, PGSSI-S, Ségur) : ni la liste, ni le statut d'opposabilité, ni le volume ne sont établis — seul le support légal (L1470-5) est vérifié.
8. **Certificat de décès électronique** : la base est le CGCT L2223-42 pour le certificat ; le texte qui organise sa transmission électronique n'a pas été identifié.
9. **PMI et santé scolaire** : identifiants relevés (L2111-1, L2112-1, L2112-2), textes non lus.
10. **DARWIN EU** : base juridique non identifiée ; le règlement 2022/123 ne le mentionne pas.
11. **CJUE santé** : aucune affaire relevant de l'EHDS ou des DM logiciels n'a été cherchée dans le corpus ; le lot D ou une requête CURIA dédiée doit le faire.
12. **Accès** : `eur-lex.europa.eu` non utilisé (202 vide) ; `esante.gouv.fr`, `cyber.gouv.fr` et TRIS renvoient Incapsula ou 403 aux requêtes automatisées — aucun contournement tenté, la couche doctrine ANS/ANSM/HAS reste hors d'atteinte en l'état.

## 7. Sources lues

CELLAR (`publications.europa.eu/resource/celex/…`, XHTML FR, 25/11/2026) : `32025R0327`, `32017R0745`, `32017R0746`, `32023R0607`, `32024R1860`, `32014R0536`, `32021R2282`, `32011L0024`, `32022L2555`, `32024R1689`, `32022R0123`.

Légifrance, API PISTE (`/consult/getArticleWithIdAndNum`, `/consult/getArticle`, `/consult/code`, `/search` fond `LODA_DATE`) : CSP L1110-4, L1110-4-1, L1110-12, L1111-2, L1111-4 à L1111-8-2, L1111-13, L1111-13-1, L1111-14 à L1111-24, L1470-1 à L1470-6, L1460-1, L1461-1 à L1461-7, L1462-1, L1462-2, L1121-1 à L1121-3, L1123-6, L1131-1, L1131-4, L1141-1, L1141-2, L1141-5, L1141-6, L3113-1, L6316-1, L6316-2, L5121-22, R1110-1, R1110-2, R1111-1, R1111-2, R1111-8-1, R1111-8-8, R1111-9, R1111-9-1, R1111-11, R1111-26, R1111-27, R1470-1, R1470-2, R6316-1, R6316-2, R4127-4, R4127-45 ; arborescence du code (partie législative et réglementaire, 27,8 Mo) ; CSS L161-28-1, L161-31, L315-1 ; C. assurances L133-1, L113-2 ; C. travail L4624-8, L1226-2 ; C. civ. 16-10 ; C. pén. 226-13 ; CGCT L2223-42 ; identifiants `LEGIARTI` de la LIL (art. 66, version du 28/5/2026) ; décret 2021-848 ; arrêté du 6 mai 2024.

Corpus locaux : `data/corpus/lil/unites.jsonl` (art. 62 à 78), `data/corpus/textes_fr/unites.jsonl` (décret 2019-536, blocs santé).

Pages institutionnelles : `health.ec.europa.eu/…/european-health-data-space-regulation-ehds_en` (lue) ; `oeil.secure.europarl.europa.eu` fiches 2023/0132(COD) et 2023/0131(COD) (lues).

Non lues : `esante.gouv.fr`, `cyber.gouv.fr`, TRIS (403 / Incapsula) ; `dsih.fr` (source secondaire, lue et signalée comme telle).
