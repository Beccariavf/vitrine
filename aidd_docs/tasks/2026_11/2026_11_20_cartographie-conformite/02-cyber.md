# 02 — Cybersécurité

État au 20 novembre 2026. Périmètre : NIS2, CER, CRA, CSA/EUCC, eIDAS 2, Cyber Solidarity Act, RED 2022/30 ; autorités UE (ENISA, Commission) et françaises (ANSSI) ; droit français positif (OIV, OSE, RGS, SecNumCloud, Code pénal). **DORA est exclue** (fiche finance).

**Note de méthode.** Le site `eur-lex.europa.eu` renvoie une page de challenge AWS WAF (JavaScript) : il n'a pas été forcé. Tous les actes de l'Union ont été lus sur l'interface officielle de diffusion du Office des publications (CELLAR/`publications.europa.eu/resource/...`), qui sert le même texte du JO, sans authentification. Le site `cyber.gouv.fr` renvoie un blocage Incapsula (« Request unsuccessful ») : les publications et la licence de l'ANSSI **n'ont pas pu être vérifiées** dans cette session. Légifrance, Assemblée nationale, Sénat et le Bureau des publications législatives (OEIL) sont accessibles.

## 1. Champ

**NIS2 — directive (UE) 2022/2555** (JO L 333, 27.12.2022, p. 80).
- Entités **essentielles** (art. 3 §1) : entités de l'annexe I (« secteurs hautement critiques ») dépassant les plafonds de la **moyenne entreprise** (recommandation 2003/361/CE, art. 2 §1 : ≥ 50 salariés ou CA > 10 M€) ; **quelle que soit leur taille** : prestataires de services de confiance qualifiés, registres de noms de domaine de premier niveau, fournisseurs de services DNS ; fournisseurs de réseaux/services de communications électroniques publics de taille moyenne ; administrations publiques visées à l'art. 2 §2 f) i) ; entités critiques au sens de la **directive (UE) 2022/2557** (CER) ; OSE désignés avant le 16 janvier 2023 si l'État le prévoit.
- Entités **importantes** (art. 3 §2) : toutes les autres entités des annexes I et II.
- Liste nationale des entités : à établir au plus tard le **17 avril 2025**, réexaminée au moins tous les deux ans (art. 3 §3).
- Transposition : dispositions à adopter et publier au plus tard le **17 octobre 2024**, application au **18 octobre 2024** (art. 41). **La France n'a pas transposé** (voir §5-6).

**CRA — règlement (UE) 2024/2847** (JO L, 2024/2847, 20.11.2024). Produits comportant des éléments numériques mis à disposition sur le marché. Calendrier (art. 71 §2) : **11 juin 2026** chapitre IV (art. 35 à 51, notification des organismes d'évaluation de la conformité) ; **11 septembre 2026** art. 14 (signalement des vulnérabilités exploitées et incidents graves) ; **11 décembre 2027** application intégrale. La page Commission ajoute : 27 juillet 2026 premières orientations, T3 2026 premiers livrables de normalisation, T4 2026 acte délégué présomption de conformité EUCC, 11 décembre 2026 notification d'un nombre suffisant d'organismes, 30 octobre 2027 autres livrables.

**CER — directive (UE) 2022/2557** (JO L 333, 27.12.2022, p. 164). Entités critiques désignées par chaque État (art. 6) parmi les secteurs de l'annexe. Transposition au **17 octobre 2024**, application au **18 octobre 2024** (art. 26 §1) ; stratégie nationale au **17 janvier 2026** (art. 4 §1) ; liste non exhaustive des services essentiels par acte délégué (art. 5 §1).

**CSA — règlement (UE) 2019/881** (JO L 151, 7.6.2019, p. 15), modifié par le règlement (UE) **2025/37** (JO L, 2025/37, 15.1.2025) pour les services de sécurité gérés. Certification **volontaire**. EUCC : règlement d'exécution (UE) **2024/482** (JO L, 2024/482, 7.2.2024).

**eIDAS 2 — règlement (UE) 2024/1183** (JO L, 2024/1183, 30.4.2024), entrée en vigueur le **20 mai 2024** (art. 2, vingtième jour après publication) ; portefeuilles européens d'identité numérique (art. 5 bis et suivants) et nouveaux services de confiance.

**Cyber Solidarity Act — règlement (UE) 2025/38** (JO L, 2025/38, 15.1.2025), entrée en vigueur le **4 février 2025** (vingtième jour après publication) ; modifie le règlement (UE) 2021/694 (art. 22).

**RED — règlement délégué (UE) 2022/30** (JO L 7, 12.1.2022, p. 6), art. 3 §3 d), e) et f) de la directive 2014/53/UE ; date d'application reportée au **1er août 2025** par le règlement délégué (UE) **2023/2444** (JO L, 2023/2444, 27.10.2023, art. 1er).

## 2. Droit UE de fond

| Acte | Identifiant | État |
|---|---|---|
| NIS2 | dir. (UE) 2022/2555, CELEX 32022L2555 | en vigueur ; transposition FR manquante ; modification proposée COM(2026) 13 |
| Mesures de gestion des risques NIS2 | règl. d'exécution (UE) 2024/2690, JO L, 2024/2690, 18.10.2024 | applicable ; annexe = exigences techniques et méthodologiques ; art. 3 et 10 = critères d'incident important |
| CER | dir. (UE) 2022/2557, CELEX 32022L2557 | en vigueur ; transposition FR manquante |
| CRA | règl. (UE) 2024/2847, CELEX 32024R2847 | en vigueur ; application échelonnée (art. 71) |
| Catégories de produits CRA | règl. d'exécution (UE) 2025/2392, JO L, 2025/2392, 1.12.2025 | en vigueur le 21.12.2025 (art. 3) ; annexes I et II |
| Rétention des notifications CRA | règl. délégué (UE) 2026/881, JO L, 2026/881, 20.4.2026 | adopté le 11.12.2025 ; en vigueur |
| CSA / ENISA | règl. (UE) 2019/881, CELEX 32019R0881 ; mod. règl. (UE) 2025/37 | en vigueur ; refonte proposée COM(2026) 11 |
| EUCC | règl. d'exécution (UE) 2024/482, JO L, 2024/482, 7.2.2024 | en vigueur ; art. 3 (critères communs), art. 4 (niveaux d'assurance) |
| eIDAS 2 | règl. (UE) 2024/1183, CELEX 32024R1183 | en vigueur ; actes d'exécution portefeuille (2024/2977 à 2024/2982, 2026/1731) **non vérifiés** cette session |
| Cyber Solidarity | règl. (UE) 2025/38, CELEX 32025R0038 | en vigueur ; mécanisme d'urgence (art. 10), tests coordonnés (art. 12), réserve de cybersécurité de l'Union |
| RED cybersécurité | règl. délégué (UE) 2022/30 ; mod. 2023/2444 | applicable depuis le 1er août 2025 |

Détail CRA : obligations des fabricants art. 13 ; signalement art. 14 (alerte précoce sous 24 h via la plateforme unique, art. 16) ; importateurs art. 19, distributeurs art. 20 ; logiciels libres art. 24 ; présomption de conformité art. 27 ; évaluation de la conformité art. 32 et suivants.

## 3. Droit UE de procédure

**Supervision NIS2 (art. 31 à 37).**
- Art. 31 : supervision et exécution par les autorités compétentes, approche fondée sur les risques ; coopération avec les autorités de contrôle RGPD en cas d'incident touchant des données personnelles (art. 31 §3).
- Art. 32 : entités **essentielles** — inspections sur place et à distance, audits réguliers et ad hoc, demandes d'information, accès aux documents ; mesures correctives (art. 32 §4 a) à h) ; injonctions, cessation d'activité, désignation d'un organe de suivi ; sanctions pécuniaires.
- Art. 33 : entités **importantes** — supervision **ex post**, sur preuves d'un manquement ; mêmes catégories de mesures, sans inspection générale préalable.
- Art. 34 : conditions générales des amendes ; **10 000 000 € ou 2 %** du CA mondial (entités essentielles, violation des art. 21 ou 23) ; **7 000 000 € ou 1,4 %** (entités importantes) ; le montant le plus élevé est retenu ; cumul possible avec les mesures des art. 32 et 33.
- Art. 35 : incidents donnant lieu à violation de données à caractère personnel (articulation RGPD).
- Art. 37 : **assistance mutuelle** entre autorités compétentes lorsqu'une entité fournit des services dans plusieurs États membres (information et consultation via le point de contact unique, demandes d'assistance, actions conjointes).

**Coopération et crise.** Groupe de coopération NIS (art. 14, présidé par la Commission, secrétariat ENISA) ; réseau des CSIRT (art. 15) ; **EU-CyCLONe** (art. 16), réseau des autorités de gestion de crise, secrétariat assuré par l'ENISA ; évaluations par les pairs (art. 19).

**CRA.** Surveillance du marché : chapitre V (art. 52 à 60) ; le règlement (UE) 2019/1020 s'applique (art. 52 §1), chaque État désigne une ou plusieurs autorités de surveillance (art. 52 §2) ; accès aux données et à la documentation (art. 53) ; procédure de sauvegarde de l'Union (art. 55) ; activités conjointes (art. 59) et « coups de balai » (art. 60). Sanctions : art. 64 — **15 M€ ou 2,5 %** (annexe I, art. 13 et 14), **10 M€ ou 2 %** (autres obligations), **5 M€ ou 1 %** (informations inexactes). Organismes d'évaluation de la conformité : chapitre IV, art. 35 à 51 (autorités notifiantes, exigences, procédure de notification, contestation).

**Recours UE.** Tribunal de l'Union et Cour de justice (art. 263 et 267 TFUE) ; pas de contentieux cyber identifié à ce jour.

## 4. Autorités UE

**ENISA** — Agence de l'Union européenne pour la cybersécurité.
- Base : règl. (UE) 2019/881, art. 3 (mandat), art. 4 et suivants (tâches) ; règl. (UE) 2025/37 (services de sécurité gérés) ; NIS2 art. 14 (secrétariat du groupe de coopération), art. 16 (secrétariat d'EU-CyCLONe) ; CRA art. 14 et 16 (reçoit les notifications, **met en place et administre la plateforme unique de signalement**) ; art. 49 (prépare les schémas candidats de certification).
- Publie : schémas candidats de certification (EUCS, EU5G), guides techniques NIS2, rapports Threat Landscape, avis.
- Où : `enisa.europa.eu`. Licence : **reproduction autorisée avec mention de la source**, sauf mention contraire ; pas de licence ouverte (mention légale lue le 20.11.2026).

**Commission européenne** — pouvoir d'exécution et de délégation.
- Base : NIS2 art. 38 (délégation) et 39 (comité) ; CRA art. 61 (délégation), 62 (comité), 26 (orientations) ; CSA art. 48 (demandes de schémas à l'ENISA) ; CER art. 5 et 23.
- Publie : actes délégués et d'exécution (2024/2690, 2025/2392, 2026/881), orientations CRA (première série le 27 juillet 2026), rapports.
- Où : `digital-strategy.ec.europa.eu` ; actes au JO via EUR-Lex/CELLAR. Licence : décision 2011/833/UE (réutilisation libre, **non revérifiée** cette session).

**Organes sans personnalité juridique** : groupe de coopération NIS (art. 14), réseau des CSIRT (art. 15), EU-CyCLONe (art. 16). Ils ne publient pas de doctrine propre.

## 5. Autorités nationales françaises

**ANSSI — Autorité nationale de sécurité des systèmes d'information.**
- **Texte de désignation actuel** : code de la défense, art. **L. 2321-1** (LEGIARTI000028342544, créé par la loi n° 2013-1168 du 18 décembre 2013, art. 21) — « le Premier ministre … dispose à cette fin de l'autorité nationale de sécurité des systèmes d'information qui assure la fonction d'autorité nationale de défense des systèmes d'information ». Aucun décret de création propre n'a été lu ; le décret n° 2009-834 cité par les notes antérieures **n'a pas été vérifié**.
- **Texte de désignation futur** : projet de loi résilience, **art. 5** du T.A. n° 366 (AN, 17 novembre 2026) : l'ANSSI « est chargée de la mise en œuvre de la politique du Gouvernement en matière de sécurité des systèmes d'information régie par le présent titre et de son contrôle » ; le Premier ministre peut désigner un autre organisme pour certaines entités du domaine de la défense ; les missions sont précisées par décret en Conseil d'État ; un comité de suivi parlementaire est créé.
- **Pouvoirs actuels** : OIV — contrôle et sanctions administratives (code de la défense, L. 1332-12 à L. 1332-19) ; détection sur les réseaux des opérateurs et des autorités publiques (L. 2321-2-1, LEGIARTI000047922728, modifié par la loi n° 2023-703 du 1er août 2023, art. 67) ; OSE — loi n° 2018-133, art. 5 et décret n° 2018-384.
- **Procédure de sanction actuelle (OIV)** : commission des sanctions instituée par **L. 1332-15** ; composition redéfinie par le T.A. n° 366 à **L. 1332-16** (conseiller d'État président, membre de la Cour de cassation, membre de la Cour des comptes, trois personnalités qualifiées nommées par le Premier ministre ; procédure contradictoire, décision motivée, droit de se taire) ; publication de la sanction et produit versé au Trésor (**L. 1332-18**) ; **recours de pleine juridiction** contre les décisions (L. 1332-18, dernier alinéa) — la juridiction compétente (Conseil d'État) n'est pas nommée dans le texte et **n'a pas été vérifiée**.
- **Procédure NIS2 prévue** : T.A. n° 366, art. 25 (injonctions de l'ANSSI en cas de menace), art. 26 et 26 A (agents assermentés, recherche des manquements), art. 35 (manquements), **art. 36** (formation de la commission des sanctions saisie par l'ANSSI : membres du 1° de L. 1332-16, représentant du ministère sectoriel, trois qualifiés nommés par le Premier ministre, le président de l'AN et le président du Sénat), **art. 37** (amendes : **10 M€ ou 2 %** pour les entités essentielles, **7 M€ ou 1,4 %** pour les entités importantes et les bureaux d'enregistrement ; exclusion des administrations, collectivités et de leurs établissements publics administratifs).
- Publie : guides d'hygiène, référentiels (PSSI, EBIOS RM, SecNumCloud), listes de produits qualifiés. **Non vérifié** : site `cyber.gouv.fr` bloqué (Incapsula).

**Autres autorités sectorielles.** Le T.A. n° 366 renvoie à des décrets sectoriels et prévoit, pour les communications électroniques, les pouvoirs du ministre chargé des communications électroniques (sanctions pécuniaires, recours de pleine juridiction, art. 43 du texte). Aucun tableau complet des autorités sectorielles n'a été lu.

## 6. Droit national de fond et de procédure

**En vigueur.**
- Code de la défense, **L. 1332-1** (LEGIARTI000028345191) : OIV désignés par l'autorité administrative, obligation de coopérer à la protection. Section « Protection des installations d'importance vitale » (L. 1332-1 à L. 1332-11), contrôles et sanctions (L. 1332-12 à L. 1332-19).
- Code de la défense, **L. 2321-1** (ANSSI) et L. 2321-2-1 (détection), L. 2321-3 ; art. L. 2321-4-1 (notification de vulnérabilités par les éditeurs) **non vérifié**.
- **Loi n° 2018-133 du 26 février 2018** (JORFTEXT000036644772) portant diverses dispositions d'adaptation au droit de l'Union dans le domaine de la sécurité : transpose NIS1, crée les OSE et les fournisseurs de service numérique ; art. 5 = périmètre OSE (cité par L. 2321-2-1).
- **Décret n° 2018-384 du 23 mai 2018** (JORFTEXT000036939971) : sécurité des réseaux et systèmes d'information des OSE et des fournisseurs de service numérique ; liste des services essentiels et modalités de désignation. Arrêté du 14 septembre 2018 (règles de sécurité et délais de notification) : identifiant **non vérifié**.
- **Décret n° 2015-351 du 27 mars 2015** (JORFTEXT000030405967) : sécurité des systèmes d'information des OIV (SIIV).
- **Décret n° 2015-350 du 27 mars 2015** : qualification des produits de sécurité et des prestataires de services de confiance (base de la qualification SecNumCloud) — lu indirectement via Légifrance (article citant le décret), texte **non ouvert**.
- **Code pénal, art. 323-1 à 323-8** : chapitre III « Des atteintes aux systèmes de traitement automatisé de données ». Art. 323-1 (LEGIARTI000047052655, modifié par la loi n° 2023-22 du 24 janvier 2023) : accès ou maintien frauduleux, 3 ans et 100 000 € ; 5 ans et 150 000 € en cas de suppression, modification ou altération ; 7 ans et 300 000 € contre un STAD de l'État.
- **RGS** : ordonnance n° 2005-1516 du 8 décembre 2005, **art. 9** (LEGIARTI000006317203) ; décret n° 2010-112 du 2 février 2010 (application des art. 9, 10 et 12). Version du référentiel (RGS v2) et arrêté d'approbation **non vérifiés** (le site DINUM n'a pas livré le texte utile).

**En cours — projet de loi « résilience des infrastructures critiques et renforcement de la cybersécurité ».**
- Dossier AN `DLR5L17N50731` ; dépôt Sénat le 15 octobre 2024 (n° 33) ; adoption Sénat le 12 mars 2025 (**T.A. n° 78**) ; adoption AN en première lecture le **17 novembre 2026** (**T.A. n° 366**), procédure accélérée. Le PDF du T.A. 366 porte « MODIFIÉ PAR L'ASSEMBLÉE NATIONALE EN PREMIÈRE LECTURE ».
- Structure : titre I (résilience des activités d'importance vitale, transpose CER — réécriture du chapitre II du titre III du livre III de la première partie du code de la défense, art. 1er) ; titre II (cybersécurité, transpose NIS2 — art. 5 à 37 ter) ; titre III (art. 34 et suivants, modifications sectorielles, dont DORA).
- Aucun décret d'application n'est encore pris ; le texte renvoie à de nombreux décrets en Conseil d'État (référentiel d'exigences techniques NIS2, art. 14 du texte ; missions de l'ANSSI, art. 5).
- Le numéro de la future loi est laissé en blanc dans le texte (« loi n° du »).

**Non vérifié** : loi n° 2024-449 du 21 mai 2024 (SREN), art. 31 sur l'hébergement de données sensibles de l'État (cloud de confiance) ; référentiel SecNumCloud v3.2 et sa date ; doctrine ANSSI (guide d'hygiène, PSSI-E, EBIOS RM).

## 7. Jurisprudence et décisions

- **Aucune décision de sanction cyber publiée en France** : la commission des sanctions OIV (L. 1332-15) n'a pas de recueil public identifié ; l'ANSSI ne publie pas de décisions.
- **Conseil d'État** : juge de cassation et, pour les sanctions administratives, juge de pleine juridiction (L. 1332-18). Aucune décision cyber identifiée ni recherchée.
- **CJUE** : contentieux des actes d'exécution et des décisions de certification ; aucune affaire cyber identifiée. Le corpus `cjue` de Vitrine est limité aux données personnelles.
- **Juge pénal** : Cour de cassation, chambre criminelle, sur les art. 323-1 et suivants du code pénal ; source Judilibre (API PISTE), filtrable par visa. Non exploité à ce jour.
- **Juge administratif** : recours contre les décisions de l'ANSSI (qualification, agrément, injonction) — contentieux rare, non documenté ici.

## 8. Textes en préparation

| Texte | Identifiant | Stade |
|---|---|---|
| Cybersecurity Act 2 (refonte du CSA, remplace 2019/881) | COM(2026) 11, procédure **2026/0011(COD)**, 20 janvier 2026 | déposé ; examen en cours (stade exact **non vérifié**) |
| Modification de NIS2 | COM(2026) 13, procédure **2026/0012(COD)**, 20 janvier 2026 | déposé ; stade **non vérifié** |
| Digital Omnibus (guichet unique de notification, art. 23 bis NIS2) | COM(2025) 837, procédure **2025/0360(COD)**, 19 novembre 2025 | en procédure ordinaire ; avis CESE 18 mars 2026 (source secondaire) |
| Projet de loi résilience (FR) | AN, T.A. n° 366, 17 novembre 2026 | 1re lecture AN achevée ; transmission au Sénat ; convocation d'une CMP **non vérifiée** |
| Acte délégué CRA « présomption de conformité EUCC » | sans numéro | prévu T4 2026 (page Commission) |
| Actes d'exécution eIDAS (portefeuille, services de confiance) | 2024/2977 à 2024/2982 ; 2026/1731 | adoptés selon les notes antérieures ; **non vérifiés** cette session |

## 9. Tableau besoin / existant

| Couche | Source | Identifiant | Nature | Autorité | Accès | Licence | Dans Vitrine ? | Priorité | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|
| Texte UE de fond | Directive NIS2 | CELEX 32022L2555 ; JO L 333, 27.12.2022, p. 80 | fond + procédure | Parlement/Conseil | CELLAR (xhtml, pdf) ; EUR-Lex HTML bloqué (WAF) | réutilisation libre (déc. 2011/833/UE, non revérifiée) | non | P1 | oui |
| Texte UE de fond | Règlement d'exécution 2024/2690 (exigences NIS2, incidents importants) | JO L, 2024/2690, 18.10.2024 ; CELEX 32024R2690 non résolu | fond | Commission | CELLAR | idem | non | P1 | oui |
| Texte UE de procédure | NIS2 art. 31-37 (supervision, sanctions, assistance mutuelle) | incluse dans 32022L2555 | procédure | États membres | CELLAR | idem | non | P1 | oui |
| Autorité UE | ENISA | règl. 2019/881, art. 3 ; règl. 2025/37 ; CRA art. 16 | doctrine + organe | ENISA | `enisa.europa.eu` (HTML/PDF) | reproduction autorisée avec mention (pas d'open licence) | non | P2 | oui (base) / non (inventaire) |
| Autorité UE | Commission (actes délégués, orientations CRA) | CRA art. 26, 61, 62 ; NIS2 art. 38-39 | doctrine + procédure | Commission | `digital-strategy.ec.europa.eu` ; JO | déc. 2011/833/UE (non revérifiée) | non | P2 | partiel |
| Texte UE de fond | Directive CER | CELEX 32022L2557 ; JO L 333, 27.12.2022, p. 164 | fond | Parlement/Conseil | CELLAR | idem | non | P1 | oui |
| Texte UE de fond | Règlement CRA | CELEX 32024R2847 ; JO L, 2024/2847, 20.11.2024 | fond | Parlement/Conseil | CELLAR | idem | non | P1 | oui |
| Texte UE de fond | Règlement d'exécution 2025/2392 (produits importants/critiques) | JO L, 2025/2392, 1.12.2025 | fond | Commission | CELLAR | idem | non | P1 | oui |
| Texte UE de fond | Règlement délégué 2026/881 (rétention des notifications par les CSIRT) | JO L, 2026/881, 20.4.2026 | fond | Commission | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Règlement CSA (ENISA, certification) | CELEX 32019R0881 ; JO L 151, 7.6.2019, p. 15 | fond | Parlement/Conseil | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Règlement 2025/37 (services de sécurité gérés) | JO L, 2025/37, 15.1.2025 | fond | Parlement/Conseil | CELLAR | idem | non | P3 | oui |
| Texte UE de fond | Règlement d'exécution 2024/482 (EUCC) | JO L, 2024/482, 7.2.2024 | fond | Commission | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Règlement eIDAS 2 | CELEX 32024R1183 ; JO L, 2024/1183, 30.4.2024 | fond | Parlement/Conseil | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Actes d'exécution eIDAS (portefeuille) | 2024/2977 à 2024/2982 ; 2026/1731 | fond | Commission | EUR-Lex/CELLAR | idem | non | P2 | non |
| Texte UE de fond | Règlement Cyber Solidarity Act | CELEX 32025R0038 ; JO L, 2025/38, 15.1.2025 | fond | Parlement/Conseil | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Règlement délégué RED 2022/30 | JO L 7, 12.1.2022, p. 6 | fond | Commission | CELLAR | idem | non | P2 | oui |
| Texte UE de fond | Règlement délégué 2023/2444 (report au 1er août 2025) | JO L, 2023/2444, 27.10.2023 | fond | Commission | CELLAR | idem | non | P2 | oui |
| Texte national de fond | Code de la défense, OIV | L. 1332-1 (LEGIARTI000028345191) et s. | fond | Législateur | Légifrance (HTML, LEGI) | Licence Ouverte 2.0 (non revérifiée) | non | P1 | oui |
| Texte national de fond | Code de la défense, ANSSI | L. 2321-1 (LEGIARTI000028342544), L. 2321-2-1 (LEGIARTI000047922728) | fond | Législateur | Légifrance | idem | non | P1 | oui |
| Texte national de fond | Loi 2018-133 (NIS1, OSE) | JORFTEXT000036644772 | fond | Législateur | Légifrance | idem | non | P1 | oui |
| Texte national de procédure | Décret 2018-384 (OSE) | JORFTEXT000036939971 | procédure | Gouvernement | Légifrance | idem | non | P1 | oui |
| Texte national de fond | Décret 2015-351 (SIIV/OIV) | JORFTEXT000030405967 | fond | Gouvernement | Légifrance | idem | non | P2 | oui |
| Texte national de fond | Décret 2015-350 (qualification produits/services) | n° 2015-350 du 27.03.2015 | fond | Gouvernement | Légifrance | idem | non | P3 | partiel |
| Texte national de fond | Code pénal, atteintes aux STAD | art. 323-1 (LEGIARTI000047052655) à 323-8 | fond | Législateur | Légifrance ; Judilibre (décisions) | idem | non (le corpus `textes_fr` s'arrête à 226-16 s.) | P1 | oui |
| Texte national de fond | RGS | ord. 2005-1516, art. 9 (LEGIARTI000006317203) ; décret 2010-112 | fond | Premier ministre / DINUM | Légifrance | idem | non | P2 | oui (art. 9) |
| Texte national de fond | SecNumCloud | référentiel ANSSI v3.2 (non lu) | doctrine | ANSSI | `cyber.gouv.fr` — **bloqué** | inconnue | non | P2 | non |
| Texte national de procédure | Projet de loi résilience (T.A. 366), art. 5 (ANSSI), 25-37 (supervision, commission, sanctions) | AN, T.A. n° 366, 17.11.2026 | procédure + fond | Parlement | assemblee-nationale.fr (PDF/HTML) | Licence Ouverte (non revérifiée) | non (le corpus `preparation` ne contient pas ce texte) | P1 | oui |
| Recours national | Conseil d'État (pleine juridiction, L. 1332-18) | — | décision | Conseil d'État | opendata.justice-administrative.fr ; ArianeWeb | Licence Ouverte (non revérifiée) | non (`ce` = données personnelles seulement) | P3 | non |
| Juge UE | CJUE / Tribunal | — | décision | CJUE | CURIA ; CELLAR | réutilisation libre | non (`cjue` = données personnelles seulement) | P3 | non |
| Préparation | Cybersecurity Act 2 | COM(2026) 11 ; 2026/0011(COD) | préparation | Commission | OEIL ; `digital-strategy` | déc. 2011/833/UE | non | P2 | oui (numéro) / non (stade) |
| Préparation | Modification NIS2 | COM(2026) 13 ; 2026/0012(COD) | préparation | Commission | OEIL | idem | non | P3 | partiel |
| Préparation | Digital Omnibus (notification unique) | COM(2025) 837 ; 2025/0360(COD) | préparation | Commission | OEIL ; Parlement | idem | non | P3 | partiel |
| Doctrine | Guides ANSSI (hygiène, PSSI-E, EBIOS RM) | versions non identifiées | doctrine | ANSSI | `cyber.gouv.fr` — **bloqué** | inconnue | non | P3 | non |
| Doctrine | Guides ENISA (NIS2, Threat Landscape) | non inventoriés | doctrine | ENISA | `enisa.europa.eu` | reproduction avec mention | non | P3 | non |

## 10. Points à vérifier

1. **Stade exact** de COM(2026) 11 (CSA 2), COM(2026) 13 (NIS2) et COM(2025) 837 (Omnibus) au 20 novembre 2026 : la page OEIL consultée n'affiche pas la rubrique « stage reached ».
2. **CELEX 32024R2690** ne se résout pas sur CELLAR (`Resource … not found`) : le texte a été lu par l'identifiant OJ `L_202402690`. À confirmer avant ingestion.
3. **Actes d'exécution eIDAS** : liste, numéros et dates non vérifiés (seul 2024/1183 l'a été).
4. **Juridiction de recours** contre les décisions de la commission des sanctions : le T.A. n° 366 prévoit un recours de pleine juridiction sans nommer la juridiction ; le Conseil d'État est probable mais non établi ici.
5. **ANSSI** : site bloqué par Incapsula (aucun contournement tenté). Licence de réutilisation, versions des référentiels, liste des produits qualifiés et rôle de MonEspaceNIS2 restent non vérifiés ; l'affirmation d'une « autorisation préalable pour l'exploitation commerciale » (notes antérieures) n'a pas été confirmée.
6. **SecNumCloud** : version en vigueur, date et valeur normative (renvoi par décret ou par marché) non vérifiées.
7. **Loi SREN 2024-449, art. 31** (cloud de confiance) : non vérifiée.
8. **Décret n° 2009-834** (création de l'ANSSI), cité par les notes antérieures : non vérifié et probablement inutile, la base légale étant L. 2321-1.
9. **Actes délégués CRA** autres que 2025/2392 et 2026/881 : l'acte « présomption de conformité EUCC » (T4 2026) n'a pas de numéro.
10. **Jurisprudence cyber** : aucune recherche systématique (CJUE, CE, cass. crim.) ; les corpus `ce`, `cc`, `cjue` de Vitrine sont filtrés sur les données personnelles et ne couvrent pas ce contentieux.
