# 03 — Résilience opérationnelle, LCB-FT et gel des avoirs (secteur financier)

État au 20 novembre 2026. Périmètre : DORA et ses actes de niveau 2, supervision des prestataires TIC critiques, paquet LCB-FT 2024, droit français LCB-FT et gel des avoirs, chaîne de contrôle et de sanction (ACPR, AMF, TRACFIN, DG Trésor, Conseil d'État).

Méthode et limites d'accès, valables pour toute la fiche :
- EUR-Lex (`eur-lex.europa.eu`) répond 202 sans contenu (protection anti-robot) : **aucune page EUR-Lex n'a été ouverte**. Les textes UE ont été lus sur le canal officiel de l'Office des publications, `publications.europa.eu/resource/celex/{CELEX}` (XHTML, `Accept-Language: fra`), qui sert le même Journal officiel. Le contenu y est intégral (considérants, articles, annexes).
- Légifrance (`legifrance.gouv.fr`) répond 403 : le Code monétaire et financier a été lu **par l'API officielle PISTE** (`consult/legiPart`, texte `LEGITEXT000006072026`, date 2026-11-20) et le Journal officiel par `search` (fond JORF).
- `acpr.banque-france.fr` et `economie.gouv.fr` répondent 403 : la doctrine ACPR, la page TRACFIN et les décisions de la commission des sanctions de l'ACPR **n'ont pas pu être lues**. Elles sont signalées « non vérifié » et non contournées.
- `assemblee-nationale.fr`, `senat.fr`, `amf-france.org`, `esma.europa.eu`, `eba.europa.eu`, `data.gouv.fr`, `gels-avoirs.dgtresor.gouv.fr` sont accessibles et ont été lus.

## 1. Champ

**DORA — règlement (UE) 2022/2554.** Entités visées à l'art. 2 § 1, points a) à t) : établissements de crédit ; établissements de paiement (y compris exemptés) ; prestataires de services d'information sur les comptes ; établissements de monnaie électronique ; entreprises d'investissement ; prestataires de services sur crypto-actifs agréés au titre du règlement 2023/1114 et émetteurs de jetons se référant à un ou des actifs ; dépositaires centraux de titres ; contreparties centrales ; plates-formes de négociation ; référentiels centraux ; gestionnaires de FIA ; sociétés de gestion ; prestataires de services de communication de données ; entreprises d'assurance et de réassurance ; intermédiaires d'assurance et de réassurance ; institutions de retraite professionnelle ; agences de notation de crédit ; administrateurs d'indices de référence d'importance critique ; prestataires de services de financement participatif ; référentiels des titrisations ; prestataires tiers de services TIC (pour le chapitre V, section II). Exclusions de plein droit (art. 2 § 3) : gestionnaires de FIA visés à l'art. 3 § 2 de la directive 2011/61/UE ; assureurs visés à l'art. 4 de la directive 2009/138/CE ; IRP gérant des régimes totalisant au plus quinze affiliés ; personnes exemptées au titre des art. 2 et 3 de la directive 2014/65/UE ; intermédiaires d'assurance micro, petites et moyennes entreprises ; offices des chèques postaux. Option nationale d'exclusion (art. 2 § 4) pour les entités visées à l'art. 2 § 5, points 4) à 23), de la directive 2013/36/UE. Cadre simplifié de gestion du risque TIC : art. 16.

**Dates.** DORA s'applique depuis le **17 janvier 2025** (art. 64). Aucune modification en vigueur identifiée (réserve du § 2 sur l'absence de consolidation) ; la seule évolution en cours est la proposition « Digital Omnibus » qui réécrirait l'art. 19 (voir § 8). Premier cycle opérationnel : première liste des prestataires TIC critiques publiée le **18 novembre 2025**. Réexamen du règlement par la Commission au plus tard le **17 janvier 2028** (art. 58).

**Directive (UE) 2022/2556.** Transposition au plus tard le **17 janvier 2025**, application à la même date (art. 9). Non transposée en France au 20/11/2026 (voir § 6 et § 8).

**LCB-FT — règlement (UE) 2024/1624 (AMLR).** Entités assujetties : art. 3, avec les professionnels visés au § 3 (auditeurs et conseillers fiscaux, avocats et notaires dans les transactions visées, prestataires de services aux sociétés et trusts, agents immobiliers, prestataires de jeux, prestataires de services sur crypto-actifs, agents de football au point n), clubs de football professionnel au point o) pour quatre types de transactions). Exemptions possibles pour les jeux d'argent à faible risque (art. 4). Application : **10 juillet 2027**, sauf agents de football et clubs professionnels (**10 juillet 2029**) (art. 90).

**Directive (UE) 2024/1640 (AMLD6).** Transposition : **10 juillet 2027** en principe ; **10 juillet 2025** pour l'art. 74 ; **10 juillet 2026** pour les art. 11, 12, 13 et 15 ; **10 juillet 2029** pour l'art. 18 (art. 78). La directive 2015/849 est abrogée au 10 juillet 2027 (art. 77).

**Règlement (UE) 2024/1620 (AMLA).** Applicable depuis le **1er juillet 2025** ; certains articles (1er, 4, 49, 53 à 55, 57 à 66, 68 à 71, 100, 101, 107) depuis le **26 juin 2024** ; art. 103 depuis le **31 décembre 2025** (dispositions finales).

**Règlement (UE) 2023/1113 (transferts de fonds et de crypto-actifs).** Applicable depuis le **30 décembre 2024** ; il modifie la directive 2015/849 et se substitue au règlement 2015/847.

**MiCA — règlement (UE) 2023/1114, volet LCB-FT seulement.** Application générale depuis le **30 décembre 2024** (dispositions sur les jetons de monnaie électronique depuis le 30 juin 2024). Le volet utile ici : art. 60 (les établissements de crédit, dépositaires centraux, entreprises d'investissement, opérateurs de marché, établissements de monnaie électronique, sociétés de gestion d'OPCVM et gestionnaires de FIA agréés pour des services sur crypto-actifs restent soumis à la directive LCB-FT), art. 62 à 64 (instruction de l'agrément et retrait pour manquements LCB-FT), art. 68 (honorabilité des dirigeants).

**Gel des avoirs.** Obligation erga omnes d'application immédiate : art. L562-4 CMF (toute personne physique présente sur le territoire national ; toute personne morale y établie ou y opérant) et art. L562-4-1 (organisation et procédures internes pour les assujettis LCB-FT). Mesures UE : règlements pris sur le fondement de l'art. 29 TUE (mesures restrictives PESC) ou de l'art. 215 TFUE (mesures économiques). Mesures nationales : art. L562-2 (gel conjoint économie-intérieur, terrorisme, six mois renouvelables), L562-2-1, L562-2-2, L562-3 (gel économie, résolutions du chapitre VII de la Charte des Nations unies et actes UE), L562-3-1.

## 2. Droit UE de fond

### DORA, directive 2022/2556 et 11 actes de niveau 2 (vérifiés un à un au JO)

| Acte | Objet | JO | Vérifié |
|---|---|---|---|
| Règlement (UE) 2022/2554 | DORA, acte de base ; modifie les règlements 1060/2009, 648/2012, 600/2014, 909/2014, 2016/1011 | JO L 333 du 27.12.2022, p. 1 | oui |
| Directive (UE) 2022/2556 | modifications sectorielles (OPCVM, Solvabilité II, AIFM, CRD, BRRD, MiFID II, DSP2, IRP) | JO L 333 du 27.12.2022, p. 153 | oui |
| Règlement délégué (UE) 2024/1774 | outils, méthodes, processus et politiques de gestion du risque TIC ; cadre simplifié | JO L, 2024/1774, 25.6.2024 | oui |
| Règlement délégué (UE) 2024/1772 | classification des incidents et cybermenaces, seuils d'importance significative | JO L, 2024/1772, 25.6.2024 | oui |
| Règlement délégué (UE) 2024/1773 | contenu de la politique d'accords contractuels TIC (fonctions critiques ou importantes) | JO L, 2024/1773, 25.6.2024 | oui |
| Règlement d'exécution (UE) 2024/2956 | modèles types du registre d'information | JO L, 2024/2956, 2.12.2024 | oui |
| Règlement délégué (UE) 2024/1502 | critères de désignation des prestataires TIC critiques | JO L, 2024/1502, 30.5.2024 | oui |
| Règlement délégué (UE) 2024/1505 | montant et modalités des redevances de supervision | JO L, 2024/1505, 30.5.2024 | oui |
| Règlement délégué (UE) 2025/295 | harmonisation des conditions d'exercice des activités de supervision | JO L, 2025/295, 13.2.2025 | oui |
| Règlement délégué (UE) 2025/301 | contenu et délais de notification des incidents majeurs | JO L, 2025/301, 20.2.2025 | oui |
| Règlement d'exécution (UE) 2025/302 | formulaires, modèles et procédures de notification | JO L, 2025/302, 20.2.2025 | oui |
| Règlement délégué (UE) 2025/532 | sous-traitance de services TIC soutenant des fonctions critiques ou importantes | JO L, 2025/532, 2.7.2025 | oui |
| Règlement délégué (UE) 2025/1190 | tests d'intrusion fondés sur la menace (TLPT) et coopération entre autorités | JO L, 2025/1190, 18.6.2025 | oui |

Délais de notification (2025/301, art. 2) : rapport initial dans les **quatre heures** de la classification comme majeur et au plus tard **24 heures** après la connaissance de l'incident ; rapport intermédiaire sous **72 heures** ; rapport final sous **un mois** après le rapport intermédiaire.

Aucune version consolidée de DORA n'a été trouvée sur CELLAR (identifiant `02022R2554-…` inexistant) ; l'absence de consolidation n'est pas une preuve d'absence de modification, à recontrôler avant ingestion.

### LCB-FT

- Règlement (UE) 2024/1624 (AMLR), JO L, 2024/1624, 19.6.2024. Champ : art. 3 ; exigences de groupe : art. 16 et 17 ; vigilance : art. 19 à 26 ; vigilance simplifiée : art. 33 ; vigilance renforcée : art. 34 à 40 (dont interdiction des relations de correspondant avec des établissements écrans, art. 39, et adresses auto-hébergées, art. 40) ; RTS sur la vigilance : art. 28 § 1 ; régime de sanctions laissé aux États membres : art. 68 (avec actes délégués de la Commission au plus tard le 10 juillet 2026) ; déclaration de soupçons : art. 69 et 70 ; abstention d'exécuter : art. 71 ; interdiction de divulgation : art. 73 ; conservation : art. 77 ; comité : art. 86 ; réexamen : art. 87.
- Directive (UE) 2024/1640 (AMLD6), JO L, 2024/1640, 19.6.2024. Registres centraux des bénéficiaires effectifs : art. 10 à 13 ; registres des comptes bancaires : art. 16 ; CRF : art. 19 à 35 ; pouvoirs des superviseurs : art. 37 ; surveillance fondée sur les risques : art. 40 ; collèges de surveillance : art. 49 et 50 ; sanctions : art. 53 à 62 ; abrogation de la directive 2015/849 : art. 77.
- Règlement (UE) 2024/1620 (AMLA), JO L, 2024/1620, 19.6.2024.
- Règlement (UE) 2023/1113, JO L 150 du 9.6.2023, p. 1 (refonte ; modifie la directive 2015/849).
- Directive (UE) 2015/849 (AMLD4, modifiée par 2018/843 et 2018/1673), JO L 141 du 5.6.2015, p. 73 : droit applicable jusqu'au 9 juillet 2027.
- MiCA, règlement (UE) 2023/1114, JO L 150 du 9.6.2023, p. 40.

### Gel des avoirs

- Règlement (UE) n° 833/2014 du 31 juillet 2014 (mesures restrictives Russie, art. 215 TFUE), JO L 229 du 31.7.2014, p. 1 : acte de base, très nombreux amendements ; n'ingérer que des versions consolidées.
- Règlement (UE) n° 269/2014 du 17 mars 2014 (gel des avoirs liés à l'Ukraine), JO L 78 du 17.3.2014, p. 6.
- Directive (UE) 2024/1226 du 24 avril 2024 (infractions pénales et sanctions en cas de violation des mesures restrictives ; modifie la directive 2018/1673), transposition au plus tard le **20 mai 2025**.
- Régime national : voir § 6 (art. L562-1 et suivants CMF).

## 3. Droit UE de procédure

**Supervision des prestataires TIC critiques (DORA, chapitre V, section II, art. 31 à 44).** Les AES, agissant par l'intermédiaire du comité mixte et sur recommandation du forum de supervision (art. 32), désignent les prestataires critiques (art. 31 § 1) et désignent comme superviseur principal l'AES responsable des entités financières totalisant la plus grande part d'actifs. Critères de désignation : art. 31 § 2. Tâches du superviseur principal : art. 33. Coordination entre superviseurs principaux : art. 34. Pouvoirs : art. 35 (demandes d'information, enquêtes générales, inspections, supervision continue). Exercice hors Union : art. 36. Demande d'information : art. 37 ; enquêtes : art. 38 ; inspections : art. 39 ; supervision continue : art. 40. Suivi par les autorités compétentes nationales dans les soixante jours : art. 42. Redevances : art. 43 et règlement délégué 2024/1505. Coopération internationale : art. 44.

**Autorités compétentes (DORA art. 46).** Le respect du règlement est assuré par les autorités déjà désignées par les directives sectorielles : autorité de l'art. 4 de la directive 2013/36/UE et, pour les établissements importants au sens de l'art. 6 § 4 du règlement 1024/2013, la BCE ; autorité de l'art. 22 de la directive 2015/2366 (paiement) ; autorité de l'art. 4 de la directive 2019/2034 (entreprises d'investissement) ; autorité MiCA pour les prestataires de services sur crypto-actifs ; etc. Coopération avec les structures NIS2 : art. 47 ; coopération entre autorités : art. 48 ; exercices et coopération intersectorielle : art. 49.

**Sanctions DORA.** Pas de plafond harmonisé : les États membres doivent prévoir des sanctions administratives et des mesures correctives (art. 50), peuvent opter pour le pénal (art. 52), notifient leurs dispositions (art. 53) et les autorités publient les sanctions (art. 54). Le niveau de peine dépend donc du droit national — en France, du plafond de l'art. L612-40 CMF (voir § 5), par inférence et sous réserve de l'entrée en vigueur du titre III du projet de loi Résilience.

**LCB-FT.** L'AMLR ne fixe pas lui-même l'échelle des sanctions : son art. 68 laisse aux États membres le régime applicable aux violations du chapitre de la vigilance, avec des actes délégués de la Commission (au plus tard le 10 juillet 2026) définissant les catégories d'infractions et les indicateurs de gravité ; l'AMLD6 fixe le cadre commun de sanctions administratives (art. 53 à 62 : dispositions générales, sanctions pécuniaires, mesures administratives) et les pouvoirs des superviseurs (art. 37, surveillance fondée sur les risques art. 40, collèges art. 49 et 50). L'AMLA dispose, sur les entités sélectionnées, d'une procédure d'enquête et de sanction autonome : art. 27 (équipe d'enquête indépendante, violations énumérées à l'annexe II), recours de pleine juridiction devant la CJUE contre les amendes et astreintes : art. 28.

**Surveillance directe de l'AMLA.** Sélection des entités (art. 12 : entités ou groupes présents dans au moins six États membres, profil de risque résiduel élevé) et liste (art. 13 : plafond indicatif de 40 entités, révisable à la hausse) ; redevances (art. 77). La date de **2028** pour le démarrage de la surveillance directe figure au considérant 86, non dans un article opérationnel : la sélection est prévue en 2027, la surveillance en 2028 selon l'AMLA.

**Gel des avoirs.** Pas de procédure de sanction UE : les règlements créent l'obligation, les États membres sanctionnent sa violation (directive 2024/1226 pour le volet pénal). Les recours contre les mesures restrictives UE (inscription sur une annexe) se portent devant le Tribunal de l'UE (art. 263 et 275 TFUE), puis la CJUE.

**Recours UE.** Tribunal de l'UE et CJUE : recours en annulation contre les actes des AES (décisions de désignation, redevances) et contre les règlements de mesures restrictives ; renvois préjudiciels sur l'interprétation de DORA, de l'AMLR et des règlements de gel.

## 4. Autorités UE

| Autorité | Base de compétence | Ce qu'elle publie | Accès | Licence |
|---|---|---|---|---|
| ABE (EBA) | règlement (UE) n° 1093/2010, JO L 331 du 15.12.2010, p. 12 | projets de RTS et ITS, lignes directrices, Q&R DORA (une page par question), Interactive Single Rulebook (outil documentaire sans effet juridique) | HTML, PDF, Q&R par `publicId` ; pas d'API | à vérifier par document |
| AEMF (ESMA) | règlement (UE) n° 1095/2010, JO L 331 du 15.12.2010, p. 84 | idem, plus la liste des prestataires TIC critiques (18.11.2025) et les Q&R MiCA | HTML, PDF | à vérifier |
| AEAPP (EIOPA) | règlement (UE) n° 1094/2010, JO L 331 du 15.12.2010, p. 48 | idem, page « DORA oversight » | HTML, PDF | à vérifier |
| Comité mixte des AES | art. 54 de chacun des trois règlements ; DORA art. 32 | décisions de désignation des prestataires critiques, actes communs, Q&R conjointes | HTML, PDF | à vérifier |
| BCE / MSU | règlement (UE) n° 1024/2013, JO L 287 du 29.10.2013, p. 63 ; DORA art. 46 a) | supervision des établissements importants, y compris DORA ; décisions et communiqués | HTML, PDF ; pas d'API publique | à vérifier |
| ALBC (AMLA) | règlement (UE) 2024/1620 | projets de RTS et d'ITS, lignes directrices, avis, décisions de sélection, rapports | HTML, PDF ; site en partie rendu en JavaScript | à vérifier ; réutilisation à confirmer |

Actes produits par les AES au 20/11/2026 (vérifiés) : trois rapports finaux de RTS transmis à la Commission le **30 septembre 2026** (annonce du 1er octobre) — vigilance à l'égard de la clientèle (art. 28 § 1 AMLR), relations d'affaires et seuils (art. 19 § 9), exigences de groupe (art. 16 § 4 et 17 § 3). Ce sont des **projets**, non des actes adoptés : rien au JO.

## 5. Autorités nationales françaises

| Autorité | Texte de désignation | Pouvoirs | Sanction | Recours | Publications |
|---|---|---|---|---|---|
| ACPR | art. L612-1 et L612-2 CMF (compétence) ; L561-36, 1° et L561-36-1 (LCB-FT) | contrôle sur pièces et sur place, mises en garde, mises en demeure, mesures conservatoires (L612-33), administrateur provisoire (L612-34) | commission des sanctions : L612-38 (procédure), L612-39 (sanctions disciplinaires), L612-40 (pécuniaire : jusqu'à 10 % du chiffre d'affaires annuel net, 5 M€ ou double de l'avantage pour les personnes physiques dirigeantes) | Conseil d'État, recours de pleine juridiction, deux mois — règle non lue sur un texte (voir § 10) | recueil des sanctions, lignes directrices et principes d'application sectoriels LCB-FT, rapports annuels |
| AMF | art. L621-1 et L621-2 CMF (institution, collège, commission des sanctions) ; L561-36, 2° (LCB-FT) | contrôles et enquêtes (L621-9), injonctions, transactions | commission des sanctions : L621-15 (procédure), sanctions pécuniaires jusqu'à 15 M€ ou décuple de l'avantage, et 100 M€ ou décuple pour les manquements c) à j) du II | Conseil d'État pour les sanctions (L621-30, dernier alinéa, renvoie au recours sans désigner la juridiction) ; juge judiciaire pour les autres décisions individuelles | décisions SAN-AAAA-NN, recueil de jurisprudence, doctrine DOC-2019-14 à DOC-2019-18, DOC-2023-01, DOC-2023-07, DOC-2024-02, DOC-2024-08, DOC-2025-02 |
| TRACFIN | art. L561-23 CMF (cellule de renseignement financier nationale) | réception des déclarations (L561-15), droit de communication, opposition à opération, transmission au parquet | pas de pouvoir de sanction ; poursuites pénales (L574-1 et s.) | juge judiciaire | rapport annuel « Tendances et analyse des risques », lignes directrices |
| DG Trésor | art. L562-4 et L562-9 CMF ; registre national des gels | gel national (L562-2, L562-3), autorisations de déblocage (L562-11), publication au JO (L562-9) | sanctions pénales pour violation (L574-3, renvoi au code des douanes) | juge judiciaire et juge administratif selon l'acte | registre national des gels (API), FAQ, page « tout savoir sur les personnes et entités sanctionnées » |
| Commission nationale des sanctions (CNS) | art. L561-38 à L561-44 CMF (saisine par les ministres, l'Autorité nationale des jeux ou les organismes du sport pour les personnes des 8°, 9°, 9° bis, 10°, 11°, 11° bis, 14°, 15° et 16° de l'art. L561-2) | instruction des manquements constatés par les autorités de contrôle | avertissement, blâme, interdiction temporaire cinq ans, retrait d'agrément, sanction pécuniaire jusqu'à 5 M€ ou double de l'avantage (L561-40) | recours de pleine juridiction (L561-43) | décisions publiées, anonymisées dans les cas de L561-40 III |

Constat : **la France a deux chaînes de sanction LCB-FT distinctes** — ACPR et AMF pour le secteur financier (L561-36-1 et L561-36, 2°), CNS pour les professions relevant de l'autorité administrative de l'art. L561-36-2 (L561-38 et s.) — et une troisième, pénale, pour le gel des avoirs.

Doctrine ACPR non lue (site 403). Titres connus par des sources secondaires, à vérifier : lignes directrices LCB-FT, principes d'application sectoriels par secteur (banque, assurance, prestataires de services sur actifs numériques, décembre 2022).

## 6. Droit national de fond et de procédure

**LCB-FT — fond.** Code monétaire et financier, livre V, titre VI : art. L561-1 (obligation de déclaration au procureur pour les professions non assujetties), L561-2 (liste des assujettis), L561-2-1 (relation d'affaires), L561-2-2 (bénéficiaire effectif), L561-4-1 (approche par les risques et proportionnalité de la vigilance), L561-5 (identification du client et du bénéficiaire effectif), L561-15 (déclaration de soupçon), L561-18 (confidentialité de la déclaration), L561-22 (exonération de responsabilité), L561-23 (TRACFIN), L561-32 (organisation et procédures internes), L561-33 (groupe), L561-36 et L561-36-1 (autorités de contrôle), L561-36-2 (autorité administrative compétente pour les professions non financières), L561-38 à L561-44 (CNS), L574-1 à L574-4 (pénal). Partie réglementaire : R561-1 et suivants (bénéficiaire effectif à 25 %), R561-… (vigilance, déclarations), R562-1 et suivants (gel).

**Gel des avoirs — fond.** Art. L562-1 (définitions, y compris « acte d'ingérence » et « trafic de stupéfiants »), L562-2 et L562-2-1, L562-2-2 (gel conjoint pour terrorisme), L562-3 et L562-3-1 (gel sur résolutions ONU et actes UE), L562-4 (personnes tenues), L562-4-1 (organisation et procédures internes, y compris pour les succursales étrangères et au niveau du groupe), L562-5 (interdiction de mise à disposition), L562-6 (interdiction de contournement), L562-7 (crédit sur compte gelé), L562-8 (publication au fichier immobilier), L562-9 (publication au JO et registre national), L562-11 (déblocages), L562-12 (partage d'information), L562-13 (responsabilité de l'État).

**Arrêtés.** Arrêté du 6 janvier 2021 relatif au dispositif et au contrôle interne en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme et de gel des avoirs et d'interdiction de mise à disposition ou d'utilisation des fonds ou ressources économiques (JORFTEXT000042992976) ; modifié par l'arrêté du 25 février 2021 (JORFTEXT000043219985) ; arrêté du 21 décembre 2018 relatif au rapport sur l'organisation des dispositifs de contrôle interne LCB-FT (JORFTEXT000037856385) ; arrêté du 26 décembre 2025 supprimant l'exigence de signature électronique des rapports (JORFTEXT000053228243).

**Procédure de contrôle et de sanction (ACPR).** Art. L612-1 (missions), L612-2 (périmètre), L612-33 (mesures conservatoires), L612-34 (administrateur provisoire), L612-35 à L612-37 (procédure contradictoire), L612-38 (ouverture, notification des griefs, rapporteur, audience, délibéré), L612-39 (sanctions disciplinaires), L612-40 (sanctions pécuniaires), L612-42 (majoration de 10 % pour l'aide aux victimes). Renvoi explicite de L612-38 à la saisine par la BCE (art. 18 § 5 du règlement 1024/2013) et par le Conseil de résolution unique (art. 38 § 8 du règlement 806/2014).

**Procédure de sanction (AMF).** Art. L621-15 : rapport d'enquête ou de contrôle, demande éventuelle du président de l'ACPR, notification des griefs par le collège, rapporteur désigné par la commission des sanctions, prescription de six ans (douze ans si le manquement est occulte).

**Transposition DORA en cours.** Projet de loi relatif à la résilience des infrastructures critiques et au renforcement de la cybersécurité, titre III (art. 43 A à 63 du texte adopté) : création de l'art. L612-24-1 CMF (déclaration des incidents majeurs TIC à l'ACPR, transmission simultanée à l'ANSSI par document unique lorsque l'entité est aussi entité essentielle ou importante NIS2), création de l'art. L621-9-4 CMF (même mécanisme pour l'AMF), modifications de L420-3, L511-41-1-B, L533-10, L533-10-4, L613-38, L631-1, L712-7 CMF et des codes des assurances, de la mutualité et de la sécurité sociale. Entrée en vigueur : lendemain de la promulgation, avec report au **17 juillet 2027** des art. 46, 47 et 54 pour les sociétés de financement visées au point 145 de l'art. 4 § 1 du règlement 575/2013 (art. 62 du texte).

## 7. Jurisprudence et décisions

- **Commission des sanctions de l'ACPR** : décisions nominatives ou anonymisées, publiées en PDF par année (recueil des sanctions). Volume utile pour la LCB-FT ; aucune décision DORA identifiée à ce jour.
- **Commission des sanctions de l'AMF** : décisions numérotées SAN-AAAA-NN (par exemple SAN-2026-06, SAN-2026-07, SAN-2026-08 en ligne), avec communiqués, recueil de jurisprudence et rubrique « décision du Conseil d'État ». Volume LCB-FT réel mais faible.
- **Commission nationale des sanctions** : décisions administratives rendues publiques (L561-40 III), recours de pleine juridiction (L561-43).
- **Conseil d'État** : juge des recours contre les sanctions ACPR, AMF et CNS, et des recours contre les mesures de gel nationales. Sources : base JADE (DILA) et `opendata.justice-administrative.fr` (archives XML mensuelles, sans API).
- **CJUE et Tribunal de l'UE** : recours contre les actes des AES et contre les règlements de mesures restrictives, renvois préjudiciels sur DORA, AMLR et gel. Source : CURIA et EUR-Lex (CELEX `6…`).
- **Cour de cassation** : contentieux pénal de la LCB-FT et du gel (L574-1 à L574-4, renvoi au code des douanes), via Judilibre.

## 8. Textes en préparation

**France.**
- Projet de loi Résilience (n° 33, déposé au Sénat le 15 octobre 2024 ; T.A. n° 78 du 12 mars 2025 ; n° 1779-A0 du 10 septembre 2025 ; **T.A. n° 366 adopté par l'Assemblée nationale le 17 novembre 2026**), procédure accélérée ; aucune convocation de commission mixte paritaire n'est affichée au dossier au 20/11/2026. Il transpose NIS2 (titre II), la directive CER (titre I) et la directive 2022/2556 (titre III). C'est le seul véhicule identifié pour la transposition DORA en droit français.
- Transposition de l'AMLD6 (échéance 10 juillet 2027) et de la directive 2024/1226 (échéance dépassée depuis le 20 mai 2025) : **aucun texte déposé identifié** au 20/11/2026 (recherche non exhaustive).

**Union.**
- Proposition « Digital Omnibus », COM(2025) 837, présentée le 19 novembre 2025 : son article 8 réécrit l'art. 19 de DORA pour faire passer les notifications d'incidents majeurs et les notifications volontaires de cybermenaces par le point d'entrée unique créé par l'art. 23a de la directive 2022/2555. Procédure législative ordinaire, en cours. Identifiant CELEX 52025PC0837, texte non ouvert.
- Réexamen de DORA : rapport de la Commission au plus tard le 17 janvier 2028 (art. 58).
- Réexamen de MiCA : consultation de la Commission en 2026, réponse de l'AEMF publiée le 30 septembre 2026 (volet LCB-FT inclus, sans texte identifié).
- RTS de l'AMLA : trois projets finals du 30 septembre 2026 en attente d'adoption par la Commission (procédure de l'art. 13 des règlements 1093/2010, 1094/2010 et 1095/2010, applicable par renvoi de l'art. 43 AMLR).

## 9. Tableau besoin / existant

| Couche | Source | Identifiant | Nature | Autorité | Accès | Licence | Dans Vitrine ? | Priorité | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|
| Texte UE de fond | Règlement (UE) 2022/2554 (DORA) | 32022R2554 | fond | PE et Conseil | CELLAR XHTML/PDF | réutilisation libre (déc. 2011/833/UE) | non | P1 | oui |
| Texte UE de fond | Directive (UE) 2022/2556 | 32022L2556 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement délégué (UE) 2024/1774 | 32024R1774 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement délégué (UE) 2024/1772 | 32024R1772 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement délégué (UE) 2024/1773 | 32024R1773 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement d'exécution (UE) 2024/2956 | 32024R2956 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement délégué (UE) 2024/1502 | 32024R1502 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P2 | oui |
| Texte UE de fond | Règlement délégué (UE) 2024/1505 | 32024R1505 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P3 | oui |
| Texte UE de fond | Règlement délégué (UE) 2025/295 | 32025R0295 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P3 | oui |
| Texte UE de fond | Règlement délégué (UE) 2025/301 | 32025R0301 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement d'exécution (UE) 2025/302 | 32025R0302 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P2 | oui |
| Texte UE de fond | Règlement délégué (UE) 2025/532 | 32025R0532 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement délégué (UE) 2025/1190 | 32025R1190 | fond | Commission | CELLAR XHTML | réutilisation libre | non | P2 | oui |
| Texte UE de fond | Règlement (UE) 2024/1624 (AMLR) | 32024R1624 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Directive (UE) 2024/1640 (AMLD6) | 32024L1640 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement (UE) 2024/1620 (AMLA) | 32024R1620 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement (UE) 2023/1113 (transferts) | 32023R1113 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Directive (UE) 2015/849 (AMLD4) | 32015L0849 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement (UE) 2023/1114 (MiCA), volet LCB-FT | 32023R1114 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P2 | oui |
| Texte UE de fond | Règlement (UE) n° 833/2014 (Russie) | 32014R0833 | fond | Conseil | CELLAR XHTML, consolidations séparées | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Règlement (UE) n° 269/2014 (gel Ukraine) | 32014R0269 | fond | Conseil | CELLAR XHTML, consolidations séparées | réutilisation libre | non | P1 | oui |
| Texte UE de fond | Directive (UE) 2024/1226 (infractions mesures restrictives) | 32024L1226 | fond | PE et Conseil | CELLAR XHTML | réutilisation libre | non | P2 | oui |
| Texte UE de procédure | DORA, chapitre V section II (art. 31 à 44) | 32022R2554 | procédure | AES et comité mixte | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Texte UE de procédure | Règlement (UE) 2024/1620, art. 12, 13, 77 (surveillance directe, redevances) | 32024R1620 | procédure | ALBC | CELLAR XHTML | réutilisation libre | non | P1 | oui |
| Autorité UE | ABE (EBA) | 32010R1093 | doctrine | ABE | HTML, PDF, Q&R par page | à vérifier | non | P1 | oui |
| Autorité UE | AEMF (ESMA) | 32010R1095 | doctrine | AEMF | HTML, PDF | à vérifier | non | P1 | oui |
| Autorité UE | AEAPP (EIOPA) | 32010R1094 | doctrine | AEAPP | HTML, PDF | à vérifier | non | P2 | oui |
| Autorité UE | Comité mixte des AES, liste des prestataires TIC critiques du 18.11.2025 | sans CELEX (décision AES) | décision | AES | PDF sur esma.europa.eu | à vérifier | non | P2 | oui |
| Autorité UE | BCE / MSU | 32013R1024 | doctrine | BCE | HTML, PDF | à vérifier | non | P2 | oui |
| Autorité UE | ALBC (AMLA), trois projets de RTS du 30.09.2026 | sans CELEX (projets) | doctrine | ALBC | PDF sur amla.europa.eu | à vérifier | non | P2 | oui |
| Autorité nationale | ACPR, désignation et pouvoirs | LEGIARTI000053783100 (L612-1) | procédure | ACPR | Légifrance HTML ; API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Autorité nationale | ACPR, contrôle LCB-FT | LEGIARTI000050371437 (L561-36-1) | procédure | ACPR | Légifrance ; API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Autorité nationale | ACPR, lignes directrices et principes d'application sectoriels LCB-FT | inconnu | doctrine | ACPR | HTML, PDF ; site 403 aux robots | à vérifier | non | P1 | non |
| Autorité nationale | AMF, institution et commission des sanctions | LEGIARTI000038611428 (L621-1), LEGIARTI000044193296 (L621-2) | procédure | AMF | Légifrance ; API PISTE | Licence Ouverte 2.0 | non | P2 | oui |
| Autorité nationale | AMF, doctrine LCB-FT DOC-2019-14 à 18, DOC-2023-01, 2023-07, 2024-02, 2024-08, 2025-02 | DOC-2019-15, DOC-2019-16 | doctrine | AMF | HTML, PDF | à vérifier | non | P2 | oui |
| Autorité nationale | TRACFIN, désignation | LEGIARTI000051752361 (L561-23) | procédure | TRACFIN | Légifrance ; API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Autorité nationale | TRACFIN, rapport annuel et lignes directrices | inconnu | doctrine | TRACFIN | PDF ; site 403 aux robots | à vérifier | non | P2 | non |
| Autorité nationale | DG Trésor, registre national des gels | API `ApiPublic/api/v1/publication` | décision | DG Trésor | API JSON, XML, XSD | Licence Ouverte 2.0 (data.gouv.fr) | non | P2 | oui |
| Autorité nationale | DG Trésor, base légale du registre | LEGIARTI000051740699 (L562-9) | fond | DG Trésor | Légifrance ; API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Autorité nationale | Commission nationale des sanctions | LEGIARTI000054616645 (L561-38) | procédure | CNS | Légifrance ; API PISTE | Licence Ouverte 2.0 | non | P2 | oui |
| Autorité nationale | Commission des sanctions ACPR, décisions | sans identifiant (PDF par année) | décision | ACPR | PDF ; site 403 aux robots | à vérifier | non | P1 | non |
| Texte national de fond | CMF, LCB-FT (L561-1 à L561-50) | LEGITEXT000006072026 | fond | Légifrance | API PISTE (legiPart), dumps DILA | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de fond | CMF, partie réglementaire LCB-FT (R561-1 et s.) | LEGIARTI000036824564 (R561-1) | fond | Légifrance | API PISTE, dumps DILA | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de fond | CMF, gel des avoirs (L562-1 à L562-13) | LEGIARTI000051740660 (L562-1) | fond | Légifrance | API PISTE, dumps DILA | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de fond | CMF, gel des avoirs (R562-1 et s.) | LEGIARTI000050826169 (R562-1) | fond | Légifrance | API PISTE, dumps DILA | Licence Ouverte 2.0 | non | P2 | oui |
| Texte national de fond | Arrêté du 6 janvier 2021 (dispositif et contrôle interne LCB-FT et gel) | JORFTEXT000042992976 | fond | ministère de l'Économie | API JORF, dumps DILA | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de fond | Arrêté du 25 février 2021 (modification du précédent) | JORFTEXT000043219985 | fond | ministère de l'Économie | API JORF | Licence Ouverte 2.0 | non | P2 | oui |
| Texte national de fond | Arrêté du 21 décembre 2018 (rapport annuel du contrôle interne LCB-FT) | JORFTEXT000037856385 | fond | ministère de l'Économie | API JORF | Licence Ouverte 2.0 | non | P2 | oui |
| Texte national de fond | Arrêté du 26 décembre 2025 (signature électronique des rapports) | JORFTEXT000053228243 | fond | ministère de l'Économie | API JORF | Licence Ouverte 2.0 | non | P3 | oui |
| Texte national de fond | CMF, sanctions pénales LCB-FT et gel (L574-1 à L574-4) | LEGIARTI000054795760 (L574-3) | fond | Légifrance | API PISTE | Licence Ouverte 2.0 | non | P2 | oui |
| Texte national de fond | Code des douanes, art. L542-1 (peines applicables par renvoi de L574-3) | inconnu | fond | Légifrance | API PISTE | Licence Ouverte 2.0 | non | P3 | non |
| Texte national de procédure | CMF, contrôle ACPR (L612-1, L612-2, L612-33 à L612-37) | LEGIARTI000051556833 (L612-2) | procédure | ACPR | API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de procédure | CMF, commission des sanctions ACPR (L612-38 à L612-42) | LEGIARTI000053782430 (L612-38) | procédure | ACPR | API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Texte national de procédure | CMF, commission des sanctions AMF (L621-15) | LEGIARTI000054335055 | procédure | AMF | API PISTE | Licence Ouverte 2.0 | non | P1 | oui |
| Préparation | Projet de loi Résilience, titre III (art. 43 A à 63 du T.A. n° 366), transposition de 2022/2556 et canaux de déclaration DORA | T.A. n° 366 | préparation | Assemblée nationale | HTML, PDF | Licence Ouverte (à vérifier) | non (`preparation` non alimenté sur ce texte) | P1 | oui |
| Recours national | Conseil d'État, recours contre les sanctions ACPR, AMF et CNS | JADE ; opendata.justice-administrative.fr | décision | Conseil d'État | XML mensuels, JADE, pas d'API | Licence Ouverte 2.0 (à vérifier) | non (`ce` limité aux données personnelles) | P2 | oui |
| Recours national | CMF, recours contre la CNS (pleine juridiction) | LEGIARTI000020196384 (L561-43) | procédure | Légifrance | API PISTE | Licence Ouverte 2.0 | non | P2 | oui |
| Juge UE | CJUE et Tribunal, renvois et recours (DORA, AMLR, gel) | 6… (CURIA) | décision | CJUE | CURIA, EUR-Lex | réutilisation libre | non (`cjue` limité aux données personnelles) | P2 | oui |
| Préparation | Proposition Digital Omnibus, art. 8 (modifie l'art. 19 DORA) | 52025PC0837 | préparation | Commission | EUR-Lex HTML ; pas de contenu CELLAR en XHTML | réutilisation libre | non | P2 | non |
| Préparation | Projets de RTS de l'ALBC du 30.09.2026 (art. 28 § 1, 19 § 9, 16 § 4 et 17 § 3 AMLR) | sans CELEX | préparation | ALBC | PDF | à vérifier | non | P2 | oui |

## 10. Points à vérifier

1. **Recours contre les sanctions ACPR, AMF et CNS** : aucune disposition du CMF lue ne désigne la juridiction de recours (L561-43 se borne à qualifier le recours de « pleine juridiction »). Pour l'ACPR, la règle « recours de pleine juridiction devant le Conseil d'État, deux mois » n'a été vue que dans un extrait de la page « Procédure disciplinaire » de l'ACPR (site inaccessible en direct). À confirmer sur un arrêt du Conseil d'État ou sur le décret d'application.
2. **Recours contre les sanctions AMF** : l'art. L621-30, dernier alinéa, organise le recours sans nommer la juridiction. La compétence du Conseil d'État pour les sanctions est une pratique constante, non un texte lu ici.
3. **Doctrine ACPR (lignes directrices LCB-FT, principes d'application sectoriels)** : identifiants, dates et versions non lus (403). Ne pas citer avant vérification.
4. **TRACFIN** : aucun identifiant (rapport annuel, lignes directrices) vérifié.
5. **Décisions de la commission des sanctions de l'ACPR** : format, numérotation et volume non vérifiés (403).
6. **Digital Omnibus (COM(2025) 837)** : identifiant CELEX lu dans un résultat EUR-Lex, texte non ouvert ; le contenu de l'art. 8 est repris d'un extrait, non du document.
7. **Consolidations** : aucune version consolidée de DORA trouvée sur CELLAR ; les règlements 833/2014 et 269/2014 n'ont été lus qu'en version d'origine, alors qu'ils sont modifiés en continu. Ingérer par consolidation datée, jamais par l'acte d'origine.
8. **Date de 2028 pour la surveillance directe de l'AMLA** : considérant 86 du règlement 2024/1620, pas un article ; la date opposable dépendra de la première décision de sélection.
9. **Délai de transposition de la directive 2024/1226 (20 mai 2025)** : expiré ; l'état de la transposition française n'a pas été vérifié.
10. **Sanctions DORA en France** : l'application des plafonds de l'art. L612-40 CMF aux manquements DORA est une inférence (l'art. L612-1 vise les « dispositions européennes directement applicables »), non une disposition lue.
11. **Licences** : celles de l'ABE, de l'AEMF, de l'AEAPP, de l'AMLA, de l'AMF, de l'ACPR et du Conseil d'État n'ont pas été vérifiées ; seules celles d'EUR-Lex/CELLAR, de Légifrance et du registre des gels (Licence Ouverte 2.0) sont établies.
