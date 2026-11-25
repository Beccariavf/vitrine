# Lot B — Pilier « données non personnelles »

État au 25 novembre 2026. Delta par rapport à `05-donnees.md` (20/11/2026), dont les faits vérifiés sont repris sans re-vérification. La santé est hors périmètre : l'EHDS n'est cité que comme espace de données.

## 1. Synthèse

1. Il manque surtout **la doctrine et les décisions** du pilier, pas ses textes de fond : c'est le trou que l'étalon comble par le CEPD et la CNIL.
2. **La CADA en est l'équivalent** : 60 941 avis et conseils, CSV de 189 Mo sous Licence Ouverte 2.0 (14/08/2026). L'API annoncée répond 404.
3. **La frontière personnel / non personnel a bougé** : C-413/23 P (4/09/2025) apprécie l'identifiabilité par destinataire ; CEPD 01/2025 et 02/2026 restent en consultation ; l'Omnibus veut des actes d'exécution, que le CEPD et le CEPS contestent.
4. **Le Data Act a son acte de doctrine** : Recommandation (UE) 2026/2394 (JO 6/11/2026), FAQ v1.4 (22/01/2026), guide véhicules (12/09/2025). Aucune autorité française désignée.
5. **Les textes qui décident de l'accès manquent** : 96/9, 2016/943, 2019/790, CRPA livre III, Code du patrimoine, loi 51-711, loi 68-678.
6. **Préparation** : aucun trilogue Omnibus au 25/11/2026 ; CADA-Cloud (COM(2026) 502) en première lecture ; transposition Open Data introuvable.

## 2. Chaîne couche par couche

### 2.1 Texte UE de fond

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Data Act | CELEX `32023R2854` | en vigueur, application 12.9.2025 (voir 05 § 1) | ch. II-V (accès, B2G), ch. VI (cloud), ch. VII (accès international), ch. X art. 43 (exclusion du droit sui generis) | 1 doc | CELLAR XHTML/PDF | réutilisation EUR-Lex (déc. 2011/833/UE) |
| DGA | `32022R0868` | applicable 24.9.2023 | réutilisation, intermédiation, altruisme ; art. 2 définit données personnelles et non personnelles | 1 doc | CELLAR | idem |
| Directive Open Data | `32019L1024` | transposition 17.7.2021 | art. 3-6 (formats, API, redevances), 8 (licences), 13-14 (HVD) | 1 doc | CELLAR | idem |
| Règlement HVD | `32023R0138` | applicable 9.6.2024 | six catégories de données de forte valeur, métadonnées, API | 1 doc + annexe | CELLAR | idem |
| Libre circulation | `32018R1807` | applicable | art. 2 §2 : ensembles mixtes, données inextricablement liées | 1 doc | CELLAR | idem |
| INSPIRE | `32007L0002` | en vigueur | infrastructure d'information géographique ; règles d'exécution nombreuses | 1 doc + règles d'exécution (nombre inconnu) | CELLAR | idem |
| Directive ITS | `32010L0040` modifiée par `32023L2661` | en vigueur | art. 10 : données personnelles traitées seulement si nécessaire ; services STI | 2 docs | CELLAR | idem |
| Interopérabilité compteurs | `32023R1162` | applicable | exigences d'interopérabilité et accès non discriminatoire (électricité) | 1 doc | CELLAR | idem |
| Secret des affaires | `32016L0943` | transposition 9.6.2018 | art. 3-5 : obtention, utilisation, divulgation licites et illicites | 1 doc | CELLAR | idem |
| Bases de données | `31996L0009` | en vigueur | art. 7-11 : droit sui generis ; art. 9 : exceptions | 1 doc | CELLAR | idem |
| Droit d'auteur DSM | `32019L0790` | transposition | art. 3 (fouille à des fins de recherche), art. 4 (fouille générale, opt-out) | 1 doc | CELLAR | idem |
| Statistiques européennes | `32009R0223` | en vigueur | art. 20 : protection des données confidentielles, usage statistique exclusif | 1 doc | CELLAR | idem |
| e-Evidence | `32023R1543` | applicable 18.8.2026 (à confirmer) | injonctions européennes de production et de conservation ; accès des autorités | 1 doc | CELLAR | idem |
| Réutilisation des documents de la Commission | `32011D0833` | en vigueur | régime de réutilisation, base de la licence EUR-Lex | 1 doc | CELLAR | idem |
| CRA (données des produits) | `32024R2847` | application échelonnée | cybersécurité des produits ; pertinent seulement pour les données embarquées, pas pour l'accès | 1 doc | CELLAR | idem |

**Constat de frontière.** Le Data Act et la DGA ne s'appliquent pas « aux données non personnelles » en bloc : la DGA couvre aussi des données personnelles (art. 10) et le Data Act complète le RGPD sans y déroger (considérants sur les ensembles mixtes). La seule règle de partage nette est l'art. 2 §2 du règlement 2018/1807 pour les ensembles mixtes, et l'art. 43 du Data Act pour le droit sui generis.

### 2.2 Actes d'exécution et de niveau 2

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Recommandation clauses types et SCC cloud | `32026H2394`, 29.10.2026, JO 6.11.2026 | adoptée, non contraignante | quatre jeux de clauses types (accès/utilisation) et six jeux de SCC cloud (annexes II à XI) ; succède au brouillon C(2025) 7750 | 1 doc + 12 annexes | CELLAR XHTML/PDF | réutilisation EUR-Lex |
| Logos intermédiation | `32023R1622` | applicable | modèle de logo commun pour les prestataires notifiés | 1 doc | CELLAR | idem |
| Formulaire de consentement altruisme | aucun acte identifié | **non identifié** | prévu par l'art. 25 DGA | — | — | — |
| Interopérabilité compteurs | `32023R1162` | applicable | voir 2.1 | 1 doc | CELLAR | idem |
| HVD | `32023R0138` | applicable | voir 2.1 | 1 doc | CELLAR | idem |
| Règlements délégués ITS | pris sur le fondement des art. 6-7 de la directive 2010/40 | en vigueur | spécifications techniques par service (information trafic, multimodal, etc.) | nombre inconnu | CELLAR | idem |
| Demande de normalisation M/614 | C(2025) 4135 (référence non lue) | adoptée | normalisation des clauses cloud | 1 doc | Commission | — |
| Lignes directrices « compensation raisonnable » | projet, consultation 2026 | **projet** | art. 13 du Data Act | 1 doc | Commission | — |

**Delta.** `05-donnees § 2` disait « aucun acte délégué ou d'exécution adopté ». C'est faux depuis le 29 octobre 2026 : la recommandation 2026/2394 existe et est lue. Le formulaire d'altruisme, en revanche, reste introuvable.

### 2.3 Texte UE de procédure

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Data Act ch. IX | art. 37-42 de `32023R2854` | en vigueur | autorités nationales, coordinateur, registre, sanctions, EDIB | 6 art. | CELLAR | EUR-Lex |
| DGA ch. VI-VII | art. 26-30 de `32022R0868` | en vigueur | autorités compétentes, réclamation, recours, EDIB | 5 art. | CELLAR | idem |
| Open Data / HVD | pas d'autorité UE | — | pas de régime de sanction propre | — | — | — |
| e-Evidence | ch. III-VI de `32023R1543` | applicable | autorités d'émission, destinataires, recours | 1 doc | CELLAR | idem |

### 2.4 Autorité UE — doctrine

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Commission — FAQ Data Act | version 1.4, 22.1.2026 | publiée, non contraignante | lecture administrative du règlement, document évolutif | 1 PDF | HTML/PDF `digital-strategy` | déc. 2011/833/UE |
| Commission — guide véhicules | publication 12.9.2025 (réf. C(2025) 6119 non lue) | publié | application du ch. II aux données véhicules | 1 PDF | HTML/PDF | idem |
| Commission — helpdesk juridique | page en ligne | en service | orientation des parties prenantes | 1 page | HTML | idem |
| EDIB | groupe d'experts E03903, décision du 20.2.2023 | actif (mise à jour 11.11.2026) | avis, assistance, coopération ; pas de pouvoir de décision | réunions et documents non inventoriés | registre des groupes d'experts ; API non documentée | inconnue |
| CEPD/CEPS — avis 2/2022 (Data Act) | 4.5.2022 | rendu | articulation Data Act / RGPD | 1 PDF | `edpb.europa.eu` | conditions CEPD |
| CEPD/CEPS — avis 03/2021 (DGA) | 11.3.2021 | rendu | garanties sur intermédiation et altruisme | 1 PDF | idem | idem |
| CEPD/CEPS — avis 2/2026 (Omnibus) | 10-11.2.2026 | rendu | refuse la redéfinition de la donnée personnelle par acte d'exécution | 1 PDF | idem | idem |
| DSSC | consortium de 23 partenaires, subvention 101296969 | actif | Blueprint, Rulebook, Toolbox, Cookbook ; **pas une autorité** | 4 corpus documentaires | HTML/PDF `dssc.eu` | inconnue |

**Point de méthode.** L'EDIB n'a pas de page publique de documents ; le registre des groupes d'experts est une application monopage dont l'API (`/core/api/front/expertGroups/3903`) rend la fiche mais pas les ordres du jour. Le DSSC produit de la doctrine de fait, sans statut juridique : ses documents ne sont pas opposables et leur licence n'est pas affichée.

### 2.5 Autorité nationale — décisions

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| CADA | avis et conseils, CRPA art. L. 342-1 | en activité | avis sur refus de communication, de publication, de consultation d'archives, de réutilisation | **60 941** (57 385 avis, 3 553 conseils, 3 « sanctions ») | CSV consolidé 189 Mo ; API annoncée **morte** (404) | Licence Ouverte 2.0 (`fr-lo`) |
| Arcep — labels intermédiation | décision 2026-0782 du 13.5.2026 | en vigueur | label « prestataire reconnu dans l'Union » (Health DataTrust) | plusieurs décisions (dont 2026-0782) | PDF/HTML `arcep.fr` | à vérifier |
| Arcep — cloud | lignes directrices du 2.7.2026 (changement et multi-cloud) | publiées | coûts facturables, plafond 0 € pour les transferts standards | 2 PDF + communiqué | PDF | à vérifier |
| Autorité de la concurrence | avis 23-A-08 du 29.6.2023 | rendu | fonctionnement concurrentiel du cloud | 1 avis | HTML/PDF | à vérifier |
| CNIL | page Data Act du 22.12.2025 (voir 05 § 5) | publiée | frontière avec les données personnelles | 1 page | HTML `cnil.fr` | CC BY-ND 4.0 |
| CNIL — anonymisation | page « L'anonymisation de données personnelles » | en ligne | renvoie à l'avis 05/2014 du G29 | 1 page | HTML | CC BY-ND 4.0 |

**Chiffres CADA (analyse du CSV consolidé).** 60 941 lignes ; 57 385 avis, 3 553 conseils, 3 « sanctions » ; 147 avis dont l'objet, le thème ou les mots-clés mentionnent « code source » ; 340 « réutilisation » ; 77 « licence ». La présence de trois « sanctions » est une anomalie de typage à signaler : la CADA est consultative.

### 2.6 Autorité nationale — doctrine

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| CADA | même corpus | en activité | doctrine administrative sur l'accès et la réutilisation, y compris codes sources | 60 941 | CSV | LO 2.0 |
| Etalab / DINUM | Licence Ouverte 2.0 | en vigueur | licence de réutilisation par défaut | 1 page | HTML `etalab.gouv.fr` | LO 2.0 |
| Arcep | page « Prestataires de services d'intermédiation » | en ligne | procédure de notification et de labellisation | 1 page | HTML | à vérifier |
| ANSSI — SecNumCloud | référentiel v3.2 | **inaccessible** | qualification cloud | — | `cyber.gouv.fr` bloqué (Incapsula) | inconnue |
| Premier ministre — « cloud au centre » | circulaire 6282-SG du 5.7.2021, actualisée en 2023 | en vigueur | doctrine d'hébergement de l'État | 2 textes | Légifrance | LO 2.0 |

### 2.7 Texte national de fond

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| CRPA livre III | `LEGITEXT000031366350` | en vigueur | L. 300-1, L. 311-1, L. 312-1-2 (anonymisation avant publication), L. 321-1, L. 322-1, L. 323-1, L. 324-1, L. 341-1, L. 342-1 | 1 code | PISTE `legiPart` | LO 2.0 |
| Code du patrimoine livre II | `LEGITEXT000006074236` | en vigueur | L. 211-1, L. 211-4, L. 213-1 à L. 213-3 (communicabilité, délais) | 1 code | PISTE | LO 2.0 |
| Loi 51-711 (statistiques) | `LEGITEXT000006068104` | en vigueur | art. 6 (renseignements individuels), 6 bis (comité du secret statistique) | 1 loi | PISTE | LO 2.0 |
| Loi 2016-1321 (République numérique) | `LEGITEXT000033205014` | en vigueur | art. 1-12 ; données d'intérêt général (art. 17-19) | 1 loi | PISTE | LO 2.0 |
| Loi 2024-449 (SREN), titre III | `JORFTEXT000049563368` | en vigueur | art. 26-39 : frais cloud, interopérabilité, souveraineté, Arcep intermédiation | 1 loi | PISTE | LO 2.0 |
| Secret des affaires | C. com. `LEGITEXT000005634379`, art. L. 151-1 à L. 151-7 | en vigueur | définition, obtention licite/illicite, inopposabilité | 7 art. | PISTE | LO 2.0 |
| Producteur de base de données | CPI `LEGITEXT000006069414`, art. L. 341-1, L. 342-1 | en vigueur | droit sui generis, extraction/réutilisation | 2 art. | PISTE | LO 2.0 |
| Fouille de textes | CPI art. L. 122-5-3 | en vigueur | exception TDM, art. 3 et 4 de la directive 2019/790 | 1 art. | PISTE | LO 2.0 |
| Blocage | Loi 68-678, `LEGITEXT000006068321` | en vigueur | art. 1-3 : interdiction de communiquer à des autorités étrangères | 1 loi | PISTE | LO 2.0 |

**Transposition Open Data.** Aucun instrument français de transposition de la directive 2019/1024 n'a été trouvé : les recherches LODA/JORF sur « 2019/1024 » et « données de forte valeur » ne rendent aucun texte pertinent au 25/11/2026. Le point 1 de `05-donnees § 10` est donc confirmé, pas résolu.

### 2.8 Textes nationaux d'application

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Licences homologuées | CRPA art. D. 323-2-1 (`LEGIARTI000044403448`) | en vigueur | Licence Ouverte, ODbL ; licences logicielles permissives ou réciproques | 1 art. | PISTE | LO 2.0 |
| Frais de transfert cloud | arrêté du 17.11.2025, `JORFTEXT000052952683` | en vigueur, JO 30.11.2025 | montant maximal de tarification des frais de transfert | 1 arrêté | Légifrance | LO 2.0 |
| Décision Arcep 2025-0340 | 20.2.2025 | rendue | proposition de plafond à 0 € | 1 décision | Arcep | à vérifier |
| HDS / souveraineté santé | décret 2026-209 | **hors périmètre** | traité par le lot santé | — | — | — |

### 2.9 Recours national

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Conseil d'État — redevance d'archives | CE, 8.2.2017, n° 389806, `CETATEXT000034017890` | rendu | les art. 15-16 de la loi 1978 régissent complètement la réutilisation et les redevances | 1 décision | PISTE/JADE | LO 2.0 |
| Conseil d'État — codes sources | CE, 15.7.2020, n° 433296, `CETATEXT000042120829` | rendu | communication des codes sources Parcoursup au titre du CRPA | 1 décision | PISTE/JADE | LO 2.0 |
| Tribunal administratif / CAA | contentieux CRPA (communication, réutilisation) | courant | à filtrer par visa L. 300-1 s., L. 321-1 s. | inconnu | `opendata.justice-administrative.fr` | LO 2.0 |

### 2.10 Juge UE

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| CJUE — pseudonymisation | C-413/23 P, 4.9.2025, ECLI:EU:C:2025:645 | rendu | la pseudonymisation n'est pas personnelle « en toute hypothèse et pour toute personne » ; appréciation par destinataire | 1 arrêt | CELLAR/CURIA | réutilisation EUR-Lex |
| CJUE — bases de données | C-762/19, 3.6.2021 | rendu | notion d'extraction/réutilisation d'une partie substantielle | 1 arrêt | CELLAR | idem |
| CJUE — bases de données | C-203/02 (BHB) | rendu | arrêt de référence sur le droit sui generis ; **non lu dans cette session** | 1 arrêt | non lu | — |
| CJUE — données de véhicules | C-319/22, 9.11.2023 | rendu | des données impersonnelles peuvent devenir personnelles chez le destinataire | 1 arrêt | cité par C-413/23 P | idem |

### 2.11 Juge judiciaire

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Cass. com. — secret des affaires | 5.2.2025, n° 23-10.953, `JURITEXT000051151441` | rendu, publié | production de pièces couvertes par le secret en cours d'instance | 1 arrêt | PISTE/Judilibre | LO 2.0 |
| Cass. 1re civ. — base de données | 5.10.2022, n° 21-16.307, `JURITEXT000046389113` | rendu, publié | renouvellement de l'investissement substantiel, titularité du droit sui generis | 1 arrêt | PISTE/Judilibre | LO 2.0 |

### 2.12 Préparation

| Source | Identifiant | État | Contenu utile | Volume | Accès | Licence |
|---|---|---|---|---|---|---|
| Digital Omnibus — volet données | COM(2025) 837 ; 2025/0360(COD) | **en préparation**, stade « Awaiting committee decision » ; rapport de commission PE786.818 du 22.6.2026 ; amendements du 27.7.2026 ; aucun trilogue | abroge 2018/1807, 2019/1024, 2019/1150 et 2022/868 ; modifie le Data Act ; encadre la pseudonymisation par actes d'exécution | 1 proposition + documents | OEIL, Conseil ST 14756/26 | réutilisation libre |
| Mandat du Conseil | ST 14756/26, 22.10.2026 | agréé par le Coreper le 21.10.2026 | position du Conseil | 1 doc | `data.consilium.europa.eu` | réutilisation libre |
| Data Union Strategy | COM(2025) 835, 19.11.2025 | communication | accès aux données pour l'IA, simplification, flux internationaux | 1 doc | Commission / EUR-Lex | réutilisation libre |
| Cloud and AI Development Act | COM(2026) 502 ; 2026/0138(COD) | **en préparation**, déposé le 3.6.2026, « Awaiting committee decision » ; rapport PE797.430 du 17.11.2026 | cadre de souveraineté cloud, mise en commun de données pour l'IA | 1 proposition | OEIL | réutilisation libre |
| FIDA | 2023/0205(COD) | en préparation, « Awaiting Parliament's position in 1st reading » | accès aux données financières | 1 proposition | OEIL | réutilisation libre |
| DDADUE — volet données | Sénat n° 118, AN n° 2518 | adopté Sénat, transmis à l'AN le 20.2.2026, **aucune lecture à l'AN** | art. 25 : Arcep autorité Data Act (sauf ch. VII) | 1 texte | AN/Sénat | LO 2.0 |
| Transposition Open Data | aucun véhicule identifié | **manque** | opposabilité du livre III du CRPA | — | — | — |

## 3. Frontières avec les autres piliers

| Sujet | Où le ranger | Pourquoi |
|---|---|---|
| Pseudonymisation, anonymisation, ensembles mixtes | `cepd` + `cnil_doctrine` (existant), avec renvoi depuis `donnees` | la doctrine est déjà personnelle ; le pilier données n'a pas à la dupliquer |
| C-413/23 P | `cjue` (élargir le filtre au-delà des « données personnelles »), sinon `donnees_decisions` | arrêt de frontière, pas de droit des données non personnelles |
| Data Act, DGA, Open Data, HVD, 2018/1807, INSPIRE, ITS, compteurs | `donnees` | socle du pilier |
| Directive 96/9, 2016/943, 2019/790 | `donnees` | ce sont les règles de propriété et d'accès qui commandent la réutilisation |
| CRPA, Code du patrimoine, loi 51-711, loi 68-678, SREN | `donnees_fr` | droit national du pilier |
| CADA | `cada` | volume et valeur propres ; ne pas noyer dans `ce` |
| Arcep | `arcep` | autorité de régulation du pilier, décisions et doctrine |
| ADLC 23-A-08 | `adlc` ou `concurrence` | avis sectoriel cloud, non un contentieux de données |
| CRA, EUCS, SecNumCloud | `cyber` / `cyber_fr` | sécurité des produits et certification, pas accès aux données |
| EHDS | `ehds` (autre lot) | santé |
| FIDA | `finance` (autre lot) | données financières |
| IA : entraînement, TDM, Data Union Strategy | `aiact` + `donnees_doctrine` | le volet « données pour l'IA » est à cheval |
| P2B | `plateformes` | abrogation proposée par l'Omnibus |

## 4. Tableau besoin / existant (delta seulement)

| Couche | Source | Identifiant | Nature | Autorité | Accès | Licence | Dans Vitrine ? | Priorité | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|
| texte UE de fond | recommandation clauses types / SCC cloud | `32026H2394`, 29.10.2026 | doctrine (acte non contraignant) | Commission | CELLAR XHTML/PDF | réutilisation EUR-Lex | non | P1 | oui |
| texte UE de fond | logos intermédiation | `32023R1622` | acte d'exécution | Commission | CELLAR | idem | non | P3 | oui |
| texte UE de fond | interopérabilité compteurs | `32023R1162` | acte d'exécution | Commission | CELLAR | idem | non | P2 | oui |
| texte UE de fond | INSPIRE | `32007L0002` | fond | UE | CELLAR | idem | non | P2 | oui |
| texte UE de fond | directive ITS + modification | `32010L0040`, `32023L2661` | fond sectoriel | UE | CELLAR | idem | non | P2 | oui |
| texte UE de fond | secret des affaires | `32016L0943` | fond | UE | CELLAR | idem | non | P1 | oui |
| texte UE de fond | bases de données | `31996L0009` | fond | UE | CELLAR | idem | non | P1 | oui |
| texte UE de fond | droit d'auteur DSM | `32019L0790` | fond | UE | CELLAR | idem | non | P2 | oui |
| texte UE de fond | statistiques européennes | `32009R0223` | fond | UE | CELLAR | idem | non | P2 | oui |
| texte UE de fond | e-Evidence | `32023R1543` | fond + procédure | UE | CELLAR | idem | non | P2 | oui |
| texte UE de fond | réutilisation des documents Commission | `32011D0833` | fond (licence) | Commission | CELLAR | idem | non | P2 | oui |
| texte UE de fond | CRA | `32024R2847` | fond (adjacent) | UE | CELLAR | idem | non | P3 | partiel |
| autorité UE | FAQ Data Act v1.4 | 22.1.2026 | doctrine | Commission | HTML/PDF | 2011/833/UE | non | P1 | oui |
| autorité UE | guide véhicules | 12.9.2025 | doctrine | Commission | HTML/PDF | idem | non | P2 | partiel |
| autorité UE | helpdesk juridique | page 2026 | doctrine | Commission | HTML | idem | non | P3 | oui |
| autorité UE | EDIB | E03903 ; décision 20.2.2023 | doctrine | Commission + États | registre, API non documentée | inconnue | non | P2 | partiel |
| autorité UE | avis CEPD/CEPS 2/2022 (Data Act) | 4.5.2022 | doctrine | CEPD/CEPS | PDF | conditions CEPD | non | P2 | oui |
| autorité UE | avis CEPD/CEPS 03/2021 (DGA) | 11.3.2021 | doctrine | CEPD/CEPS | PDF | idem | non | P2 | oui |
| autorité UE | avis CEPD/CEPS 2/2026 (Omnibus) | 10-11.2.2026 | doctrine | CEPD/CEPS | PDF | idem | non | P1 | oui |
| autorité UE | DSSC (Blueprint, Rulebook…) | subvention 101296969 | doctrine de fait | consortium | HTML/PDF | inconnue | non | P3 | partiel |
| autorité nationale | CADA — avis et conseils | jeu data.gouv `53698f37a3a729239d2036a0` | décision | CADA | CSV 189 Mo ; API 404 | LO 2.0 (`fr-lo`) | non | P1 | oui |
| autorité nationale | Arcep — label intermédiation | décision 2026-0782, 13.5.2026 | décision | Arcep | PDF/HTML | à vérifier | non | P2 | oui |
| autorité nationale | Arcep — lignes directrices cloud | 2.7.2026 | doctrine | Arcep | PDF | à vérifier | non | P2 | oui |
| autorité nationale | ADLC — avis cloud | 23-A-08, 29.6.2023 | doctrine | ADLC | HTML/PDF | à vérifier | non | P2 | oui |
| autorité nationale | CNIL — page anonymisation | page 2026 | doctrine | CNIL | HTML | CC BY-ND 4.0 | partiel (`cnil_doctrine`) | P2 | oui |
| texte national de fond | CRPA livre III | `LEGITEXT000031366350` ; L. 312-1-2, L. 321-1, L. 323-1, L. 324-1, L. 342-1 | fond + procédure | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | Code du patrimoine livre II | `LEGITEXT000006074236` ; L. 213-1 à L. 213-3 | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | loi 51-711 | `LEGITEXT000006068104` ; art. 6, 6 bis | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | loi 68-678 | `LEGITEXT000006068321` ; art. 1-3 | fond | législateur | PISTE | LO 2.0 | non | P2 | oui |
| texte national de fond | C. com. L. 151-1 s. | `LEGITEXT000005634379` | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national de fond | CPI L. 341-1 s., L. 122-5-3 | `LEGITEXT000006069414` | fond | législateur | PISTE | LO 2.0 | non | P1 | oui |
| texte national d'application | D. 323-2-1 (licences homologuées) | `LEGIARTI000044403448` | fond | Premier ministre | PISTE | LO 2.0 | non | P2 | oui |
| texte national d'application | arrêté frais de transfert | `JORFTEXT000052952683`, 17.11.2025 | fond (technique) | ministère | Légifrance | LO 2.0 | non | P2 | oui |
| texte national d'application | transposition directive 2019/1024 | **aucun instrument identifié** | fond | — | — | — | non | P1 | non |
| recours national | CE 389806 (redevance archives) | `CETATEXT000034017890` | décision | Conseil d'État | PISTE/JADE | LO 2.0 | non — `ce` filtré | P2 | oui |
| recours national | CE 433296 (codes sources Parcoursup) | `CETATEXT000042120829` | décision | Conseil d'État | PISTE/JADE | LO 2.0 | non — `ce` filtré | P2 | oui |
| juge UE | C-413/23 P | ECLI:EU:C:2025:645 | décision | CJUE | CELLAR/CURIA | réutilisation EUR-Lex | non — `cjue` filtré | P1 | oui |
| juge UE | C-762/19 | 62019CJ0762 | décision | CJUE | CELLAR | idem | non | P2 | oui |
| juge UE | C-203/02 (BHB) | C-203/02 (CELEX non résolu) | décision | CJUE | non lue | — | non | P3 | non |
| juge judiciaire | Cass. com. 23-10.953 | `JURITEXT000051151441` | décision | Cour de cassation | PISTE/Judilibre | LO 2.0 | non — `cc` filtré | P2 | oui |
| juge judiciaire | Cass. 1re civ. 21-16.307 | `JURITEXT000046389113` | décision | Cour de cassation | PISTE/Judilibre | LO 2.0 | non — `cc` filtré | P2 | oui |
| préparation | Digital Omnibus données | COM(2025) 837 ; 2025/0360(COD) | préparation | Commission/Conseil/Parlement | OEIL, ST 14756/26 | réutilisation libre | partiel (`preparation` ne le contient pas) | P1 | oui |
| préparation | Data Union Strategy | COM(2025) 835, 19.11.2025 | préparation | Commission | HTML/EUR-Lex | réutilisation libre | non | P2 | oui |
| préparation | Cloud and AI Development Act | COM(2026) 502 ; 2026/0138(COD) | préparation | Commission | OEIL | réutilisation libre | non | P2 | oui |
| préparation | FIDA | 2023/0205(COD) | préparation | Commission | OEIL | réutilisation libre | non | P3 | oui |
| préparation | DDADUE volet données | Sénat 118 ; AN 2518 | préparation | Parlement | AN/Sénat | LO 2.0 | partiel | P1 | oui |

Lignes : 46. Vérifiées sur la source officielle dans cette session : 40. Partielles : 4. Non : 2.

## 5. Proposition de corpus

Ordre = facilité (1 = un seul canal, 2 = canal déjà outillé, 3 = scraping ou licence à trancher) × utilité (P1-P3).

| Ordre | Corpus proposé | Contenu | Canal | Facilité | Utilité |
|---|---|---|---|---|---|
| 1 | `cada` | 60 941 avis et conseils, CSV consolidé + incréments mensuels | `static.data.gouv.fr`, un fichier | 1 | P1 |
| 2 | `donnees` (extension de `05-donnees`) | Data Act, DGA, Open Data, HVD, 2018/1807, INSPIRE, ITS, compteurs, 96/9, 2016/943, 2019/790, 223/2009, 2023/1543, 2011/833 | CELLAR XHTML | 1 | P1 |
| 3 | `donnees_actes` | 2026/2394, 2023/138, 2023/1622, 2023/1162, règlements délégués ITS | CELLAR | 1 | P2 |
| 4 | `donnees_fr` (extension) | CRPA livre III, Code du patrimoine livre II, loi 51-711, loi 68-678, SREN titre III, C. com. L. 151-1 s., CPI L. 341-1 s. et L. 122-5-3, D. 323-2-1, arrêté 17.11.2025 | PISTE `legiPart` | 2 | P1 |
| 5 | `donnees_doctrine` | FAQ v1.4, guide véhicules, helpdesk, avis CEPD/CEPS 2/2022, 03/2021 et 2/2026, DSSC, EDIB | HTML/PDF Commission et CEPD | 2 | P1 |
| 6 | `arcep` | décisions de labellisation, lignes directrices cloud, communiqués | PDF/HTML `arcep.fr` | 2 | P2 |
| 7 | `adlc` (ou `concurrence`) | avis 23-A-08 et avis cloud antérieurs (23-A-05) | HTML/PDF | 2 | P3 |
| 8 | filtres `ce`, `cc`, `cjue` | élargir le filtre aux visas CRPA, 96/9, 2016/943, 2019/790, 2023/2854, 2018/1807 | PISTE, Judilibre, CELLAR | 3 | P1 |

**Ne pas créer** de corpus `donnees_perso_frontiere` : la frontière se lit dans `cepd`, `cnil_doctrine` et `cjue`, et un corpus dédié dupliquerait des documents déjà ingérés.

## 6. Points à vérifier

1. **C(2025) 6119** (guide véhicules) : numéro non lu ; seule la page de publication du 12.9.2025 est vérifiée.
2. **EUCS** : schéma candidat, non adopté ; aucune certification EUCS n'existe. La page ENISA est lue, pas l'acte d'exécution.
3. **M/614 et C(2025) 4135** : référence de la demande de normalisation non lue.
4. **Formulaire européen de consentement à l'altruisme** (art. 25 DGA) : aucun acte d'exécution identifié ; vérifier s'il a été adopté sous un autre CELEX.
5. **EDIB** : réunions et documents non inventoriés ; aucun ordre du jour ni document de séance n'a pu être lu, l'API n'étant pas documentée.
6. **DSSC** : licence des livrables inconnue ; ne pas ingérer avant arbitrage.
7. **API CADA** : l'URL `cada.data.gouv.fr/api/` annoncée dans la fiche data.gouv répond 404 ; le dump CSV est le seul canal vérifié.
8. **Transposition de la directive 2019/1024** : aucun texte trouvé ; point P1 non résolu depuis le 20/11.
9. **C-203/02 (BHB)** : arrêt non lu dans cette session ; ne pas citer son contenu sans vérification.
10. **Date d'adoption du T.A. n° 63** : 18 février (dossier AN) contre 19 février (`vie-publique.fr`) ; écart non tranché.
11. **Autorité française du Data Act** : toujours aucune au 25/11/2026 ; le DDADUE n'a pas été examiné à l'Assemblée nationale.
12. **Licences Arcep, ADLC, ANSSI, DSSC** : non affichées ou non lues ; ne pas ingérer intégralement avant arbitrage.
13. **« Sanctions » dans le CSV CADA** : trois lignes typées « Sanction » alors que la CADA est consultative ; anomalie à documenter avant indexation.
14. **Digital Omnibus** : le stade OEIL est « Awaiting committee decision » ; vérifier l'existence d'un vote en commission après le 27.7.2026 avant d'écrire « trilogues ouverts ».
15. **INSPIRE** : les règlements d'exécution ne sont pas énumérés ; une collecte par relation « based on » reste à faire.

## 7. Sources lues

Textes et actes UE (CELLAR, XHTML FR sauf mention) :
- `https://publications.europa.eu/resource/celex/32023R2854`
- `https://publications.europa.eu/resource/celex/32022R0868`
- `https://publications.europa.eu/resource/celex/32019L1024`
- `https://publications.europa.eu/resource/celex/32023R0138`
- `https://publications.europa.eu/resource/celex/32018R1807`
- `https://publications.europa.eu/resource/celex/32007L0002`
- `https://publications.europa.eu/resource/celex/32010L0040`
- `https://publications.europa.eu/resource/celex/32023L2661`
- `https://publications.europa.eu/resource/celex/32023R1162`
- `https://publications.europa.eu/resource/celex/32016L0943`
- `https://publications.europa.eu/resource/celex/31996L0009`
- `https://publications.europa.eu/resource/celex/32019L0790`
- `https://publications.europa.eu/resource/celex/32009R0223`
- `https://publications.europa.eu/resource/celex/32023R1543`
- `https://publications.europa.eu/resource/celex/32023R1622`
- `https://publications.europa.eu/resource/celex/32026H2394`
- `https://publications.europa.eu/resource/celex/32024R2847`
- `https://publications.europa.eu/resource/celex/32011D0833`
- `https://publications.europa.eu/resource/celex/62023CJ0413`
- `https://publications.europa.eu/resource/celex/62019CJ0762`

Doctrine et autorités UE :
- `https://digital-strategy.ec.europa.eu/en/library/commission-publishes-frequently-asked-questions-about-data-act`
- `https://digital-strategy.ec.europa.eu/en/library/guidance-vehicle-data-accompanying-data-act`
- `https://digital-strategy.ec.europa.eu/en/policies/data-act-legal-helpdesk`
- `https://digital-strategy.ec.europa.eu/en/policies/data-union`
- `https://digital-strategy.ec.europa.eu/en/library/data-union-strategy-unlocking-data-ai`
- `https://ec.europa.eu/transparency/expert-groups-register/screen/expert-groups/consult?lang=en&groupID=3903`
- `https://ec.europa.eu/transparency/expert-groups-register/core/api/front/expertGroups/3903`
- `https://www.edpb.europa.eu/public-consultations/guidelines-012025-on-pseudonymisation_en`
- `https://www.edpb.europa.eu/public-consultations/guidelines-022026-on-anonymisation_en`
- `https://www.edpb.europa.eu/system/files/2025-01/edpb_guidelines_202501_pseudonymisation_en.pdf`
- `https://www.edpb.europa.eu/system/files/2026-09/edpb_guidelines_202602_anonymisation_v1_en_0.pdf`
- `https://www.edpb.europa.eu/documents/legislative-opinion/edpb-edps-joint-opinion-22022-on-the-proposal-of-the-european_en`
- `https://www.edpb.europa.eu/documents/legislative-opinion/edpb-edps-joint-opinion-032021-on-the-proposal-for-a-regulation-of_en`
- `https://www.edpb.europa.eu/system/files/2026-02/edpb_edps_jointopinion_202602_digitalomnibus_en.pdf`
- `https://dssc.eu/`
- `https://dssc.eu/about`
- `https://oeil.secure.europarl.europa.eu/oeil/popups/ficheprocedure.do?lang=en&reference=2025/0360(COD)`
- `https://oeil.secure.europarl.europa.eu/oeil/popups/ficheprocedure.do?lang=en&reference=2026/0138(COD)`
- `https://oeil.secure.europarl.europa.eu/oeil/popups/ficheprocedure.do?lang=en&reference=2023/0205(COD)`
- `https://www.enisa.europa.eu/publications/eucs-cloud-service-scheme`

France :
- `https://www.data.gouv.fr/api/1/datasets/53698f37a3a729239d2036a0/`
- `https://static.data.gouv.fr/resources/avis-et-conseils-de-la-cada/20260814-172417/cada-2026-08-14.csv`
- `https://www.cnil.fr/fr/technologies/lanonymisation-de-donnees-personnelles`
- `https://etalab.gouv.fr/licence-ouverte-open-licence`
- `https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/prestataires-services-intermediation-donnees.html`
- `https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/cloud-020726.html`
- `https://www.autoritedelaconcurrence.fr/fr/avis/portant-sur-le-fonctionnement-concurrentiel-de-linformatique-en-nuage-cloud`
- `https://www.legifrance.gouv.fr/circulaire/id/45205`
- `https://www.assemblee-nationale.fr/dyn/17/dossiers/DLR5L17N53140`
- `https://www.senat.fr/dossier-legislatif/pjl25-118.html`
- `https://www.insee.fr/fr/information/1300624`
- `https://www.comite-du-secret.fr/` (403)

Légifrance via l'API PISTE (`/consult/legiPart`, `/consult/juri`, `/search`) : CRPA `LEGITEXT000031366350` ; Code du patrimoine `LEGITEXT000006074236` ; loi 51-711 `LEGITEXT000006068104` ; loi 68-678 `LEGITEXT000006068321` ; C. com. `LEGITEXT000005634379` ; CPI `LEGITEXT000006069414` ; loi SREN `JORFTEXT000049563368` ; loi 2016-1321 `LEGITEXT000033205014`. Décisions : `CETATEXT000034017890`, `CETATEXT000042120829`, `JURITEXT000051151441`, `JURITEXT000046389113`.

Canaux bloqués ou inutilisables (aucun contournement tenté) : `eur-lex.europa.eu` renvoie 202 sans corps ; Légifrance en HTML renvoie 403 (Cloudflare), d'où PISTE ; `cyber.gouv.fr` renvoie une page Incapsula ; `comite-du-secret.fr` renvoie 403 ; l'API `cada.data.gouv.fr/api/` renvoie 404.
