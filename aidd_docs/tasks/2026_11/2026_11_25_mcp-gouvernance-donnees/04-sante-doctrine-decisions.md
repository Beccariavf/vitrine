# Lot D — Données de santé : doctrine et décisions

État au 25 novembre 2026. Périmètre : **doctrine (droit souple) et décisions seulement**. Les textes, leur état et les désignations d'autorités sont dans `03-sante-textes-autorites.md` (lot C) ; les faits déjà vérifiés par `05-donnees.md` ne sont pas repris.

**Convention de vérification.** « oui » = identifiant lu sur sa source officielle dans cette session ; « partiel » = identifiant lu dans le corpus Vitrine ou un résultat de recherche, pas sur la page officielle ; « non » = non vérifié. Les présences dans Vitrine sont vérifiées par lecture des `manifest.json` et `grep` dans `data/corpus/*/unites.jsonl`, et par l'outil MCP (`decisions_citant`, `search`).

**Ce que le corpus permet déjà de mesurer.** L'outil `decisions_citant` sur le RGPD art. 9 renvoie **156 documents** : CNIL 67, CEPD 40, Conseil d'État 37, CJUE 11, Cour de cassation 1. Sur la LIL art. 66 (autorisations de traitements de santé), **15 décisions** : CNIL 8, Conseil d'État 7. La matière santé est donc déjà très présente, mais **sans facette thématique** : elle est noyée dans le filtre « données personnelles ».

## 1. Synthèse

1. **La chaîne santé est déjà largement ingérée, mais sans étiquette.** 156 documents citent l'art. 9 RGPD et 15 l'art. 66 LIL ; les sanctions santé (Doctissimo, Dedalus, Cegedim, IQVIA, hôpital, hébergeur HDS) sont dans `cnil`, anonymisées ; le CE, la CJUE et le Conseil constitutionnel ont les arrêts et décisions clés.
2. **Le trou P1 est la doctrine opérationnelle CNIL de la recherche en santé** : MR-001 à MR-008 (dont MR-001 et MR-003 révisées le 19 mars 2026), annexes « sécurité » et « contrôle qualité », référentiel entrepôts 2021-118, référentiel vigilances 2019-057. `cnil_doctrine` n'a qu'une douzaine de documents santé sur 74, et les MR n'y sont que citées.
3. **Le CEPD est presque complet** : lignes directrices 03/2020 (santé, COVID), 04/2020 (traçage) et 1/2026 (recherche scientifique) sont présentes ; manquent l'opinion 3/2019 sur les essais cliniques et l'avis conjoint 03/2022 sur l'EHDS.
4. **Les juridictions sont le point fort** : CE (127 décisions santé détectées), CJUE (C-184/20, C-252/21, C-667/21, C-21/23, C-307/22, C-474/24), Conseil constitutionnel (passe sanitaire, secret médical), Cour de cassation (13 décisions). Manquent les décisions ordinales du CNOM, la CEDH (abandonnée, mais l'API HUDOC répond de nouveau) et les textes des sanctions des autres APD.
5. **Les autres autorités sont hors Vitrine** : ANS (qui bloque les robots), HAS, ANSM, HDH, CESREES, CNOM, CCNE, Défenseur des droits. Le CESREES ne publie pas ses avis ; le catalogue HDH est une application sans API identifiée.

## 2. Chaîne couche par couche

### 2.1 Autorité UE — doctrine : CEPD

`cepd` : 328 documents, 20 287 fragments ; 43 lignes directrices, 263 avis art. 64, 12 décisions art. 65, 9 recommandations, 1 document G29 repris. Source : sitemap EDPB, PDF ; licence : notice CEPD, réutilisation commerciale et non commerciale autorisée avec citation et sans dénaturation.

| Document | Identifiant | État | Contenu utile | Volume | Accès | Dans Vitrine ? |
|---|---|---|---|---|---|---|
| Lignes directrices 03/2020 | `guidelines-032020-…` | adoptées | données de santé et recherche scientifique, COVID-19 ; base de la doctrine santé du CEPD | 1 doc | PDF EDPB | **oui**, `cepd` |
| Lignes directrices 04/2020 | `guidelines-042020-…` | adoptées | données de localisation et outils de traçage ; santé publique | 1 doc | PDF EDPB | **oui**, `cepd` |
| Lignes directrices 1/2026 | `guidelines-12026-…` | adoptées le 15/04/2026 ; consultation 16/04-25/06/2026 (clôture non relue sur la page) | recherche scientifique : notion, bases légales, garanties ; texte le plus récent | 1 doc | PDF EDPB | **oui**, `cepd` |
| Opinion 3/2019 | `opinion-32019-…` | adoptée le 23/01/2019 | articulation règlement essais cliniques 536/2014 et RGPD ; base légale, consentement | 1 doc | PDF EDPB | **non** |
| Avis conjoint CEPD-CEPS 03/2022 | `edpb-edps-joint-opinion-032022-…` | adopté le 12/07/2022 | proposition d'EHDS : base légale, droits, gouvernance, usage secondaire | 1 doc | PDF EDPB | **non** |
| Déclaration / recommandations COVID | — | 2020 | traitement des données dans la crise ; complète les lignes directrices 03/2020 et 04/2020 | ~3 docs | PDF EDPB | **non** |
| Décisions art. 65 santé | — | — | aucune décision contraignante dont l'objet est la santé identifiée par titre dans `cepd` ; la décision urgente 01/2021 vise Facebook, pas la santé | 0 | — | **aucune identifiée** |

Volume du delta : **5 à 7 documents**, peu nombreux mais P1 pour les essais cliniques et l'EHDS. Les avis art. 64 du CEPD sur des projets de décisions nationales santé sont nombreux (263 avis au total) mais ne sont pas identifiables par thème dans le manifeste ; ils sont déjà dans `cepd`.

### 2.2 Autorité nationale — doctrine : CNIL

Deux gisements distincts :

- `cnil_doctrine` : 74 documents, 5 070 fragments, guides, référentiels, fiches IA, listes AIPD ; licence CC BY-ND 4.0 ; source cnil.fr.
- `cnil` : 3 246 documents (2 896 avis, 250 sanctions, 100 recommandations), 29 373 fragments ; source DINUM + DILA ; les **avis sur textes santé** y sont, mais pas les pages thématiques ni les référentiels.

**Présent dans `cnil_doctrine` (vérifié par titre et URL).**

| Document | Identifiant / date | Volume | Dans Vitrine ? |
|---|---|---|---|
| Référentiel cabinets médicaux et paramédicaux | PDF CNIL | 1 | **oui** |
| Référentiel officines de pharmacie | PDF CNIL | 1 | **oui** |
| Référentiel durées de conservation — recherche en santé | PDF CNIL | 1 | **oui** |
| Référentiel durées de conservation — santé hors recherche | PDF CNIL | 1 | **oui** |
| Référentiel suivi social et médico-social | délib. 2017-012 | 1 | **oui** |
| Référentiel durées social et médico-social | PDF CNIL | 1 | **oui** |
| Référentiel accès précoce | PDF CNIL | 1 | **oui** |
| Référentiel accès compassionnel | PDF CNIL | 1 | **oui** |
| Check-list entrepôts de données de santé | PDF CNIL | 1 | **oui** (check-list seule) |
| Guide CNOM-CNIL pour les médecins | PDF CNIL | 1 | **oui** |
| Guide circuits NIR pour la recherche en santé | PDF CNIL | 1 | **oui** |
| Référentiel SNIIRAM / EGB | PDF CNIL | 1 | **oui** |
| Référentiel alertes professionnelles | PDF CNIL | 1 | **oui** (général, non santé) |

**Absent ou seulement cité (delta).**

| Document | Identifiant | Date | Pourquoi c'est P1/P2 | Volume | Accès | Dans Vitrine ? |
|---|---|---|---|---|---|---|
| MR-001 révisée | délib. **2026-050** | 19/03/2026 | recherche avec consentement ; met à jour le texte de 2018 ; grille et version annotée | 1 + grille + annotée | Légifrance, PDF CNIL | **non** |
| MR-003 révisée | délib. **2026-051** | 19/03/2026 | recherche sans consentement ; met à jour le texte de 2018 | 1 + grille + annotée | Légifrance, PDF CNIL | **non** |
| Annexe « sécurité » des MR | délib. **2026-049** | 19/03/2026 | exigences de sécurité communes aux MR | 1 | Légifrance | **non** |
| Annexe « contrôle qualité » des MR | délib. **2026-052** | 19/03/2026 | contrôle qualité des données de recherche | 1 | Légifrance | **non** |
| MR-002 | délib. **2015-256** | 16/07/2015 | études de performances des DMDIV | 1 | CNIL | **non** |
| MR-004 | délib. **2018-155** | 03/05/2018 | recherches n'impliquant pas la personne humaine | 1 | CNIL | **non** |
| MR-005 | délib. **2018-256** | 07/06/2018 | accès PMSI/RPU par les établissements | 1 | CNIL | **non** |
| MR-006 | délib. **2018-257** | 07/06/2018 | accès PMSI par les industriels | 1 | CNIL | **non** |
| MR-007 | délib. **2023-082** | 20/07/2023 | base principale du SNDS, mission d'intérêt public | 1 | CNIL | **non** |
| MR-008 | délib. **2023-083** | 20/07/2023 | base principale du SNDS, intérêts légitimes | 1 | CNIL | **non** |
| Référentiel entrepôts de données de santé | délib. **2021-118** | 07/10/2021 | cadre des entrepôts ; la check-list est là, pas le référentiel | 1 | CNIL, PDF | **partiel** |
| Référentiel vigilances sanitaires + FAQ | délib. **2019-057** | 09/05/2019 | pharmacovigilance, matériovigilance, vigilances | 2 | CNIL, PDF | **non** |
| Référentiel ESND (ex-EGB) | délib. **2022-124** | 13/10/2022 | échantillon des données du SNDS | 1 | CNIL, PDF | **non** |
| Pages santé CNIL | — | 2025-2026 | donnée de santé, formalités, applications mobiles, télémédecine, GHT, avis PDS, IA et santé | ~10 pages | HTML cnil.fr | **non** |
| Guide HAS-CNIL IA en contexte de soins | document de travail | 16/02/2026 | usage des systèmes d'IA en soins ; 61 pages | 1 | PDF cnil.fr | **non** |
| Cartographie LINC des entrepôts de données de santé | version 2025 | 20/10/2025 | recensement des EDS ; 26 nouvelles entrées, 11 autorisations, 13 déclarations | 1 application | HTML/JSON ? | **non** |
| FAQ professionnels de santé libéraux | — | — | questions pratiques des médecins | 1 | HTML cnil.fr | **non** |

**Autorisations de l'art. 66 LIL.** La CNIL a traité **539 demandes d'autorisation en santé en 2025**, dont 406 en recherche (rapport annuel 2025). Aucune liste publique ou base ouverte des autorisations individuelles n'a été trouvée : seuls les critères, les référentiels et des chiffres agrégés sont publiés. Le corpus `cnil` ne contient pas de nature « Autorisation ». C'est un manque P2 : pour répondre à une question de conformité, les critères et les référentiels suffisent le plus souvent ; pour savoir si un traitement précis est autorisé, il faut la CNIL, pas Vitrine.

**Avis sur textes santé déjà présents.** 44 avis du corpus `cnil` portent sur le SNDS, la PDS/HDH, Mon espace santé, StopCovid/TousAntiCovid, le passe sanitaire ou les entrepôts ; 40 sont identifiés ici : 2016-316, 2016-317, 2017-022, 2017-067, 2018-261, 2018-284, 2019-008, 2019-143, 2020-024, 2020-044, 2020-046, 2020-051, 2020-056, 2020-061, 2020-083, 2020-106, 2020-126, 2020-135, 2021-004, 2021-006, 2021-051, 2021-054, 2021-062, 2021-067, 2021-068, 2021-077, 2021-097, 2021-103, 2021-139, 2021-143, 2021-144, 2022-044, 2022-059, 2022-112, 2023-006, 2023-081, 2023-147, 2025-074, 2025-107, 2025-118. Les avis sur l'EHDS ne sont pas dans le corpus ; aucun avis CNIL spécifique à l'EHDS n'a été identifié.

### 2.3 Autorité nationale — décisions : sanctions CNIL

`cnil` contient **250 sanctions**. La page officielle « Les sanctions prononcées par la CNIL » contient **412 lignes**, dont **36** dont l'intitulé ou le motif porte un terme de santé ; après retrait des lignes où le terme n'est qu'incident (publicité, traduction), **environ 25 sanctions de secteur santé** depuis 2011. La page donne la catégorie d'organisme, le motif, le montant et le lien vers la délibération, mais **pas le nom** de l'organisme ; les communiqués de presse nominatifs sont séparés.

| Sanction | Identifiant | Date | Objet | Dans Vitrine ? |
|---|---|---|---|---|
| Dedalus Biologie | SAN-2022-009 | 15/04/2022 | fuite de données de santé, 1,5 M€ | **oui**, `cnil` (nom absent du texte) |
| Doctissimo | SAN-2022-022 (30/11/2022) et SAN-2023-006 (11/05/2023) | 2022-2023 | site santé, durée de conservation, consentement, sécurité ; **380 000 € au total** | **oui**, `cnil` (noms absents) |
| Cegedim Santé | SAN-2024-013 | 05/09/2024 | logiciel médical, entrepôt sans autorisation, 800 000 € | **oui**, `cnil` ; recours CE 498628 |
| Hébergeur HDS | SAN-2025-015 | 22/12/2025 | sécurité, hébergeur certifié HDS | **oui**, `cnil` |
| IQVIA Operations France | SAN-2026-008 | 26/05/2026 | entrepôts de données, officines, 5 M€ | **oui**, `cnil` |
| Hôpital privé | SAN-2026-009 | 21/07/2026 | dossier médical, 50 000 patients | **oui**, `cnil` |
| Deux médecins | SAN-2020-014 et SAN-2020-015 | 07/12/2020 | sécurité et notification de violation | **oui**, `cnil` |
| Mutuelle | SAN-2021-010 | 20/07/2021 | données de santé et assurance | **oui**, `cnil` |

**Ce qui manque.** Les **noms** et les **communiqués** ne sont pas dans `cnil` ; les **mises en demeure** non plus (nature distincte, non retenue). La page officielle des sanctions est un bon complément pour les montants et les catégories, mais elle n'est pas non plus nominative. Pour une question « telle société a-t-elle été sanctionnée ? », il faut soit les communiqués CNIL, soit une base nominative tierce : aucun des deux n'est dans Vitrine.

### 2.4 Recours national : Conseil d'État

`ce` : 1 594 documents, 20 774 fragments, archive JADE du 08/11/2026 ; licence Ouverte 2.0. Le filtre « données personnelles » capte déjà **127 décisions** portant au moins deux termes de santé. Les arrêts clés sont présents :

| Décision | Identifiant | Date | Objet | Dans Vitrine ? |
|---|---|---|---|---|
| CE, référé, 440916 | CETATEXT000042040572 | 19/06/2020 | Health Data Hub / Microsoft ; transfert hors UE | **oui**, `ce` (page Légifrance 403 cette session) |
| CE, référé, 444937 | CETATEXT000042444915 | 13/10/2020 | Health Data Hub / Microsoft ; précautions | **oui**, `ce` |
| CE, référé, 450163 | CETATEXT000043261200 | 12/03/2021 | Doctolib et vaccination | **oui**, `ce` |
| CE, référé, 453505 | CETATEXT000043771321 | 06/07/2021 | passe sanitaire / TousAntiCovid | **oui**, `ce` |
| CE, 456162 | CETATEXT000046598400 | 23/11/2022 | SNDS / entrepôt | **oui**, `ce` |
| CE, 498628 | CETATEXT000053483461 | 13/02/2026 | recours Cegedim contre SAN-2024-013 | **oui**, `ce` |
| CE, référé, 517362 | CETATEXT000054398578 | 07/07/2026 | Doctolib, données médicales | **oui**, `ce` |

**Ce qui manque.** Les décisions de santé **sans angle données personnelles** (responsabilité hospitalière, déontologie, assurance maladie) ne passent pas le filtre. La décision de 2023 validant l'hébergement EMC2 par Microsoft, signalée par la presse, n'a pas été identifiée dans `ce` ; à vérifier. Le volume 127 est un ordre de grandeur par grep, pas un comptage validé.

### 2.5 Juge UE : CJUE

`cjue` : 257 documents, 24 292 fragments ; source CELLAR/EUR-Lex ; licence 2011/833/UE. Les arrêts santé ou proches sont présents et vérifiés sur CELLAR :

| Affaire | CELEX | Date | Objet | Dans Vitrine ? |
|---|---|---|---|---|
| C-184/20, OT | `62020CJ0184` | 01/08/2022 | données sensibles, vie privée, transparence | **oui**, `cjue` |
| C-252/21, Meta Platforms | `62021CJ0252` | 04/07/2023 | catégories particulières, données de santé | **oui**, `cjue` |
| C-667/21, Krankenversicherung Nordrhein | `62021CJ0667` | 21/12/2023 | art. 9 §2 h), assurance maladie | **oui**, `cjue` |
| C-21/23, Lindenapotheke | `62023CJ0021` | 04/10/2024 | pharmacie en ligne, données de santé | **oui**, `cjue` |
| C-307/22, FT | `62022CJ0307` | 26/10/2023 | copie du dossier médical, art. 15 | **oui**, `cjue` |
| C-474/24, AR | `62024CJ0474` | 14/07/2026 | notion de « données concernant la santé », art. 9 | **oui**, `cjue` |
| C-526/24, Brillen Rottler | `62024CJ0526` | 19/03/2026 | droit d'accès, refus de donner suite | **oui**, `cjue` |
| C-340/21 | `62021CJ0340` | 14/12/2023 | violation de données, sécurité | **oui**, `cjue` |
| C-77/21 | `62021CJ0077` | 20/10/2022 | limitation de finalité, conservation | **oui**, `cjue` |

**Ce qui manque.** Aucune **affaire pendante santé** n'a été identifiée dans `preparation` (grep : zéro occurrence de santé/EHDS). Le corpus `preparation` ne couvre donc pas ce besoin ; il faudra le compléter par une veille CURIA si le pilier santé doit suivre les renvois préjudiciels en cours.

### 2.6 Juge constitutionnel : Conseil constitutionnel

`constit` : 108 documents, 5 775 fragments ; archive CONSTIT ; licence Ouverte 2.0. **15 décisions** portent des termes de santé. Les décisions clés sont présentes :

| Décision | Date | Objet | Dans Vitrine ? |
|---|---|---|---|
| 2020-800 DC | 11/05/2020 | loi prorogeant l'état d'urgence sanitaire | **oui**, `constit` |
| 2021-819 DC | 31/05/2021 | loi relative à la gestion de la sortie de crise sanitaire | **oui**, `constit` |
| 2021-824 DC | 05/08/2021 | loi relative à la gestion de la crise sanitaire (passe sanitaire) | **oui**, `constit` |
| 2021-828 DC | 09/11/2021 | loi relative à la gestion de la crise sanitaire | **oui**, `constit` |
| 2021-917 QPC | 11/06/2021 | secret médical | **oui**, `constit` |
| 2024-1101 QPC | 12/09/2024 | secret médical | **oui**, `constit` |

La loi Jardé n'a pas été identifiée dans `constit` ; elle relève plutôt du lot C (texte) et du CE.

### 2.7 Juge judiciaire : Cour de cassation

`cc` : 405 documents, 8 225 fragments ; source Judilibre/PISTE ; licence Ouverte 2.0. Le filtre « données personnelles » capte **13 décisions** avec au moins deux termes de santé, principalement sur le licenciement, l'assurance et le dossier médical (par exemple Cass., 21/01/2016, dossier médical et assurance, présente dans le corpus). C'est **partiel** : la santé y est un sous-produit du contentieux des données personnelles, pas une facette. Les arrêts de droit de la santé sans angle données personnelles manquent.

### 2.8 Juridictions ordinales : CNOM

Absent de Vitrine. La base `jurisprudence.ordre.medecin.fr/RechercheSimple.do` est accessible en HTML et permet une recherche par mots-clés (décisions anonymisées). Le rapport annuel 2025 du CNOM donne les volumes : **421 affaires jugées** par la chambre disciplinaire nationale, **289 décisions collégiales**, **318 décisions anonymisées**, **138 fiches de jurisprudence**, 69 pourvois devant le CE, 24 annulations. Le CNOM publie aussi le **Code de déontologie commenté** et un guide **« Le secret médical »** (2024).

Accès : HTML, pas d'API identifiée, pas de licence ouverte identifiée (conditions du CNOM). Volume estimé : quelques milliers de décisions en ligne ; 289 décisions collégiales par an. Priorité P2 : utile pour les questions de secret médical et de déontologie, moins central pour la conformité RGPD.

Les autres ordres (infirmiers, sages-femmes, pharmaciens, kinésithérapeutes) ont leurs propres bases ; non explorées ici. À traiter si le pilier santé doit couvrir toute la déontologie.

### 2.9 Juge européen : CEDH

Absent de Vitrine : `metadonnees` a **abandonné la CEDH le 15/11/2026** (403 intermittents côté Node) et ne garde que le registre du guichet unique. Or l'API HUDOC répond **200** en JSON depuis cette session ; l'abandon est donc à réexaminer.

| Arrêt | Requête | Date | Objet | Vérification |
|---|---|---|---|---|
| Z c. Finlande | 22009/93 | 25/02/1997 | dossier médical, vie privée | **oui**, métadonnées HUDOC |
| I c. Finlande | 20511/03 | 17/07/2008 | données de santé, sécurité | **oui**, métadonnées HUDOC |
| L.H. c. Lettonie | 52019/07 | 29/04/2014 | données de santé, contrôle | **oui**, métadonnées HUDOC |

La requête HUDOC `"medical data" OR "health data"` renvoie **217 résultats** (indicatif, non dédoublonné). Accès : API JSON `hudoc.echr.coe.int/app/query/results`, texte HTML/PDF ; licence HUDOC, réutilisation avec mention de la source. Priorité P2 : la CEDH est utile pour la santé au travail et le secret, mais redondante avec la CJUE pour le RGPD.

### 2.10 Coopération européenne : guichet unique

`metadonnees` : 1 597 unités, **7 entrées santé** du registre des décisions définitives (art. 60 RGPD), sans texte :

| Identifiant | Autorité chef de file | Date | Sujets |
|---|---|---|---|
| EDPBI:CY:OSS:D:2021:175 | Chypre | 12/01/2021 | bases juridiques ; santé et recherche |
| EDPBI:DE:OSS:D:2025:3466 | Allemagne (Bade-Wurtemberg) | 14/05/2025 | santé et recherche ; bases juridiques |
| EDPBI:ES:OSS:D:2024:1422 | Espagne | 03/09/2024 | violations ; santé et recherche |
| EDPBI:FI:OSS:D:2022:604 | Finlande | 09/12/2022 | santé et recherche ; principes ; droits |
| EDPBI:FI:OSS:D:2022:627 | Finlande | 27/12/2022 | droits ; santé et recherche |
| EDPBI:FR:OSS:D:2023:762 | France | 11/05/2023 | cybersécurité ; responsable ; santé et recherche |
| EDPBI:IS:OSS:D:2022:486 | Islande | 08/09/2022 | responsable ; santé et recherche ; droits |

Les **textes** de ces décisions ne sont pas dans Vitrine, seulement les métadonnées. Pour les sanctions santé des autres APD, il faudra les sources nationales (pas de registre européen unique). Priorité P3.

### 2.11 Autres autorités françaises

| Autorité | Ce qu'elle publie | Volume | Accès | Licence | Dans Vitrine ? |
|---|---|---|---|---|---|
| **ANS** | PGSSI-S (référentiels et guides), liste des hébergeurs certifiés HDS, doctrine du numérique en santé, CI-SIS | PGSSI-S : dizaines de PDF ; HDS : **411 hébergeurs certifiés et 10 organismes certificateurs** (chiffres d'un résultat de recherche, non lus sur la page) | HTML/PDF `esante.gouv.fr` ; **bloqué aux robots (Incapsula)** cette session | Licence Ouverte 2.0 présumée | **non** |
| **HAS** | certification des logiciels (LAP, LAD, LAP hospitaliers), guide IA en santé, recommandations | ~6 référentiels de certification + listes de logiciels certifiés ; guide HAS-CNIL 61 p. | HTML/PDF `has-sante.fr` | licence non identifiée | **non** |
| **ANSM** | qualification des logiciels DM/DMDIV, décisions, FAQ | ~4 pages de doctrine | HTML `ansm.sante.fr` | licence non identifiée | **non** |
| **HDH / PDS** | catalogue national de métadonnées (HealthDCAT-AP), répertoire public des projets, procédures, rapport d'activité | catalogue : volume non mesuré ; projets : plusieurs centaines | HTML/SPA `catalogue-metadonnees.health-data-hub.fr` ; pas d'API identifiée | réutilisation libre avec mention, usage commercial autorisé | **non** |
| **CESREES** | calendrier, composition, avis rendus | **avis non publiés** : les pages projet affichent « Sens avis CESREES : Réservé » ; le nombre de 713 avis vient d'un forum, non vérifié | HTML `health-data-hub.fr/cesrees` | non identifiée | **non** |
| **CNOM** | jurisprudence disciplinaire, code de déontologie commenté, guide secret médical | 421 affaires jugées en 2025 ; 289 décisions collégiales ; 318 anonymisées ; 138 fiches | HTML `jurisprudence.ordre.medecin.fr` ; PDF | non identifiée | **non** |
| **Cour des comptes** | rapports SNDS, souveraineté des SI | 2 rapports utiles : `Sécurité sociale 2024` ch. XI (SNDS) ; `Les enjeux de souveraineté des SI civils de l'État` (31/10/2025) | HTML/PDF `ccomptes.fr` | réutilisation avec mention, sauf iconographie | **non** |
| **CCNE** | avis éthique | 4 avis : 130 (données massives, 2021), 141/CNPEN 4 (diagnostic médical et IA, 2022), 143 (plateformes de données de santé, 2023), 151 (origines des patients, 16/04/2026) | HTML/PDF `ccne-ethique.fr` | non identifiée | **non** |
| **Défenseur des droits** | décisions, recommandations, rappels à la loi | base en ligne ; exemple 2023-212 (accès au dossier médical) ; volume non mesuré | HTML `juridique.defenseurdesdroits.fr` | non identifiée | **non** |

**Point dur : l'ANS.** `esante.gouv.fr` renvoie une page Incapsula de 956 octets aux requêtes automatisées ; les PDF sont également servis en HTML de blocage. La liste HDS, la PGSSI-S et la doctrine du numérique en santé ne sont donc **pas ingérables en l'état**. Le lot C a fait le même constat. Contournement interdit : ne pas tenter.

**Point dur : le CESREES.** Les avis sont rendus avant l'autorisation CNIL et ne sont pas publics. Le calendrier et la composition le sont. On peut donc ingérer des **métadonnées de projet** (répertoire public des projets, dates d'avis), pas les avis eux-mêmes. La valeur pour un MCP de conformité est faible : l'avis est une étape de procédure, pas une doctrine opposable.

### 2.12 Préparation

- **CNIL — MR-001 et MR-003** : révision adoptée le 19/03/2026 (délib. 2026-049 à 2026-052), formulaire interactif et webinaire de juillet 2026. Ce n'est plus de la préparation, mais ce n'est pas encore dans Vitrine.
- **HAS-CNIL — guide IA en contexte de soins** : document de travail du 16/02/2026, 61 pages ; version finale non vérifiée. À suivre avant ingestion.
- **EHDS** : actes d'exécution à adopter au plus tard en mars 2027 ; le lot C les traite. Côté doctrine, l'avis conjoint CEPD-CEPS 03/2022 est le seul texte de niveau UE identifié.
- **Contentieux** : aucune affaire pendante santé identifiée dans `preparation` ; aucune décision ordinale ou CEDH santé en préparation.

## 3. Frontières avec les autres piliers

**Avec les données personnelles.** La santé est un sous-ensemble des données personnelles : RGPD art. 9, LIL art. 44 et 66, CSP L. 1110-4 et L. 1111-8. Les textes et les autorités sont dans le lot C ; la doctrine et les décisions sont ici. Il ne faut pas dupliquer `rgpd`, `lil`, `textes_fr` : ajouter une **facette `sante`** aux unités existantes, ou créer des corpus qui ne contiennent que le delta.

**Avec les données non personnelles.** Les entrepôts agrégés, le SNDS sous forme agrégée, le catalogue HDH, l'usage secondaire de l'EHDS et l'open data de santé relèvent aussi du pilier « données non personnelles ». Les documents de gouvernance (catalogue HealthDCAT-AP, répertoire des bases, procédures HDH) sont communs aux deux piliers : les ranger dans `sante_recherche` plutôt que dans `sante_doctrine` évite de les éclater. Voir `02-donnees-non-personnelles.md`.

**Avec l'IA.** Le guide HAS-CNIL sur l'IA en soins, la qualification ANSM des logiciels DM, l'annexe III de l'AI Act (assurance maladie, tri des urgences) et les systèmes de DME de l'EHDS sont à cheval sur `aiact`, `cnil_doctrine` (fiches IA) et le pilier santé. Recommandation : garder les fiches IA de la CNIL dans `cnil_doctrine`, et n'ingérer dans `sante_doctrine` que les documents **spécifiquement santé** (guide HAS-CNIL, ANSM, DME).

**Règle de rangement proposée.** Un document est dans le pilier santé si sa **finalité principale** est la santé ou le soin ; sinon il reste dans son corpus transversal. Les avis CNIL sur le SNDS sont santé ; les fiches IA générales ne le sont pas.

## 4. Tableau besoin / existant (delta seulement)

Colonnes de `00-grille.md`. « Dans Vitrine ? » indique le corpus et le mode de vérification.

| Couche | Source | Identifiant | Nature | Autorité | Accès | Licence | Dans Vitrine ? | Priorité | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|
| autorité UE — doctrine | CEPD, lignes directrices 03/2020 | `guidelines-032020-…` | doctrine | CEPD | PDF | notice CEPD | **oui**, `cepd` (lu) | P1 | oui |
| autorité UE — doctrine | CEPD, lignes directrices 04/2020 | `guidelines-042020-…` | doctrine | CEPD | PDF | notice CEPD | **oui**, `cepd` (grep) | P2 | partiel |
| autorité UE — doctrine | CEPD, lignes directrices 1/2026 | `guidelines-12026-…` | doctrine | CEPD | PDF | notice CEPD | **oui**, `cepd` (lu) | P1 | oui |
| autorité UE — doctrine | CEPD, opinion 3/2019 essais cliniques | `opinion-32019-…` | doctrine | CEPD | PDF | notice CEPD | **non** | P1 | oui |
| autorité UE — doctrine | CEPD-CEPS, avis conjoint 03/2022 EHDS | `edpb-edps-joint-opinion-032022-…` | doctrine | CEPD/CEPS | PDF | notice CEPD | **non** | P2 | oui |
| autorité UE — doctrine | CEPD, déclaration/recommandations COVID | — | doctrine | CEPD | PDF | notice CEPD | **non** | P2 | non |
| autorité UE — décisions | CEPD, décisions art. 65 santé | — | décision | CEPD | PDF | notice CEPD | **aucune identifiée** | P3 | partiel |
| autorité nationale — doctrine | CNIL, MR-001 révisée | délib. 2026-050 | doctrine | CNIL | Légifrance, PDF | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, MR-003 révisée | délib. 2026-051 | doctrine | CNIL | Légifrance, PDF | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, annexe sécurité des MR | délib. 2026-049 | doctrine | CNIL | Légifrance | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, annexe contrôle qualité | délib. 2026-052 | doctrine | CNIL | Légifrance | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, MR-002 | délib. 2015-256 | doctrine | CNIL | HTML/PDF | CC BY-ND 4.0 | **non** | P2 | oui |
| autorité nationale — doctrine | CNIL, MR-004 | délib. 2018-155 | doctrine | CNIL | HTML/PDF | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, MR-005 et MR-006 | délib. 2018-256, 2018-257 | doctrine | CNIL | HTML/PDF | CC BY-ND 4.0 | **non** | P2 | oui |
| autorité nationale — doctrine | CNIL, MR-007 et MR-008 | délib. 2023-082, 2023-083 | doctrine | CNIL | HTML/PDF | CC BY-ND 4.0 | **non** | P1 | oui |
| autorité nationale — doctrine | CNIL, référentiel entrepôts | délib. 2021-118 | doctrine | CNIL | PDF | CC BY-ND 4.0 | **partiel** : check-list seule dans `cnil_doctrine` | P1 | oui |
| autorité nationale — doctrine | CNIL, référentiel vigilances + FAQ | délib. 2019-057 | doctrine | CNIL | PDF | CC BY-ND 4.0 | **non** | P2 | oui |
| autorité nationale — doctrine | CNIL, référentiel ESND | délib. 2022-124 | doctrine | CNIL | PDF | CC BY-ND 4.0 | **non** | P2 | oui |
| autorité nationale — doctrine | CNIL, pages santé | — | doctrine | CNIL | HTML | CC BY-ND 4.0 | **non** | P1/P2 | oui |
| autorité nationale — doctrine | CNIL/HAS, guide IA en soins | document de travail 16/02/2026 | doctrine | CNIL/HAS | PDF | CC BY-ND 4.0 (CNIL) | **non** | P2 | oui |
| autorité nationale — doctrine | CNIL, cartographie LINC des EDS | version 2025, 20/10/2025 | doctrine | CNIL | HTML/JSON ? | CC BY-ND 4.0 | **non** | P3 | oui |
| autorité nationale — doctrine | CNIL, autorisations art. 66 | 539 demandes en 2025 | décision (agrégée) | CNIL | rapport annuel | CC BY-ND 4.0 | **non** : pas de liste publiée | P2 | oui |
| autorité nationale — décisions | CNIL, sanctions santé | SAN-2022-009, SAN-2022-022, SAN-2024-013, SAN-2025-015, SAN-2026-008/009 | décision | CNIL | Légifrance | Licence Ouverte 2.0 | **oui**, `cnil` (grep ; textes anonymisés) | P1 | oui |
| autorité nationale — décisions | CNIL, communiqués nominatifs et mises en demeure | — | décision | CNIL | HTML | CC BY-ND 4.0 | **non** | P2 | partiel |
| recours national | CE, HDH/Microsoft, Doctolib, SNDS, Cegedim | 440916, 444937, 450163, 456162, 498628 | décision | Conseil d'État | JADE | Licence Ouverte 2.0 | **oui**, `ce` (grep) | P1 | partiel |
| recours national | CE, santé hors filtre données personnelles | — | décision | Conseil d'État | JADE | Licence Ouverte 2.0 | **non** | P2 | non |
| juge UE | CJUE, arrêts santé | `62020CJ0184`, `62021CJ0252`, `62021CJ0667`, `62023CJ0021`, `62022CJ0307`, `62024CJ0474` | décision | CJUE | CELLAR | 2011/833/UE | **oui**, `cjue` (lu) | P1 | oui |
| juge UE | CJUE, affaires pendantes santé | — | décision (à venir) | CJUE | CURIA | 2011/833/UE | **aucune identifiée** | P3 | non |
| juge constitutionnel | Conseil constitutionnel, passe sanitaire | 2020-800 DC, 2021-819 DC, 2021-824 DC, 2021-828 DC | décision | Conseil constitutionnel | HTML | Licence Ouverte 2.0 | **oui**, `constit` (lu) | P1 | oui |
| juge constitutionnel | Conseil constitutionnel, secret médical | 2021-917 QPC, 2024-1101 QPC | décision | Conseil constitutionnel | HTML | Licence Ouverte 2.0 | **oui**, `constit` (grep) | P2 | partiel |
| juge judiciaire | Cour de cassation, santé | 13 décisions (licenciement, assurance, dossier médical) | décision | Cour de cassation | Judilibre | Licence Ouverte 2.0 | **partiel**, `cc` (grep) | P2 | partiel |
| juridiction ordinale | CNOM, jurisprudence disciplinaire | base `jurisprudence.ordre.medecin.fr` | décision | CNOM | HTML | non identifiée | **non** | P2 | oui |
| juge européen | CEDH, Z / I / L.H. | 22009/93, 20511/03, 52019/07 | décision | CEDH | HUDOC JSON | HUDOC | **non** (abandonnée) ; API accessible | P2 | oui |
| coopération européenne | Guichet unique, décisions santé | 7 entrées EDPBI | décision (métadonnées) | CEPD | registre | notice CEPD | **partiel**, `metadonnees` (grep) | P3 | partiel |
| autre autorité | ANS, PGSSI-S et liste HDS | — | doctrine | ANS | HTML/PDF | Licence Ouverte 2.0 présumée | **non** ; site bloqué | P2 | non |
| autre autorité | HAS, certification logiciels et guide IA | — | doctrine | HAS | HTML/PDF | non identifiée | **non** | P2 | partiel |
| autre autorité | ANSM, logiciels DM/DMDIV | — | doctrine | ANSM | HTML | non identifiée | **non** | P2 | oui |
| autre autorité | HDH, catalogue et répertoire | HealthDCAT-AP | doctrine | HDH | HTML/SPA | réutilisation libre | **non** | P2 | oui |
| autre autorité | CESREES, avis | — | doctrine | CESREES | HTML | non identifiée | **non** : avis non publics | P3 | oui |
| autre autorité | Cour des comptes, SNDS et souveraineté | — | doctrine | Cour des comptes | HTML/PDF | réutilisation avec mention | **non** | P3 | partiel |
| autre autorité | CCNE, avis 130/141/143/151 | — | doctrine | CCNE | HTML/PDF | non identifiée | **non** | P3 | partiel |
| autre autorité | Défenseur des droits, santé | 2023-212 et base | décision | DDD | HTML | non identifiée | **non** | P3 | partiel |

Lignes : 42. Vérifiées sur la source officielle dans cette session : 27. Partiellement vérifiées : 11. Non vérifiées : 4.

## 5. Proposition de corpus

Trois corpus suffisent ; un quatrième est un confort. Les noms sont en minuscules, courts, dans la convention de `rgpd`, `cnil_doctrine`.

| Ordre | Corpus proposé | Contenu | Canal technique | Facilité (1-3) | Utilité | Pourquoi |
|---|---|---|---|---|---|---|
| 1 | `sante_decisions` | sanctions CNIL santé ; arrêts CE/CJUE/Constit/Cass santé ; CEDH ; CNOM ; DDD | extractions des corpus existants + API HUDOC + scrape CNOM | 2 | **P1** | le plus rentable : les décisions sont déjà là à 80 %, il manque la facette et les textes nominatifs |
| 2 | `sante_doctrine` | MR-001 à MR-008, annexes, référentiels entrepôts/vigilances/ESND, pages santé CNIL, guide HAS-CNIL, CEPD santé | scrape cnil.fr + PDF + sitemap EDPB | 2 | **P1** | c'est le trou opérationnel : sans les MR, le MCP ne répond pas à « comment faire une recherche en santé » |
| 3 | `sante_recherche` | catalogue HDH, métadonnées CESREES, cartographie LINC, répertoire national des bases, SNDS/ESND | scrape HDH + JSON LINC + PDF CNIL | 3 | **P1/P2** | les documents sont hétérogènes, le catalogue HDH est une SPA, les avis CESREES manquent |
| 4 | `sante_autorites` | ANS (si déblocage), HAS, ANSM, Cour des comptes, CCNE | PDF/HTML, veille annuelle | 3 | **P2** | utile pour la sécurité et les logiciels, moins pour le RGPD pur |

**Ordre retenu.** 1) `sante_decisions` (facile, fort effet), 2) `sante_doctrine`, 3) `sante_recherche`, 4) `sante_autorites`. Si l'architecture permet un **champ `sante`** sur les unités existantes, préférer cette solution : elle évite de dupliquer `cnil`, `ce`, `cjue`, `constit`, `cc`, et elle rend la facette disponible dans `search` sans nouveau corpus.

**Ce qu'il ne faut pas faire.** Ne pas créer un corpus par autorité (ANS, HAS, ANSM, HDH, CNOM) : trop de petits corpus, peu de contenu, maintenance lourde. Ne pas ingérer les 250 sanctions CNIL dans un nouveau corpus : elles sont déjà dans `cnil`. Ne pas ingérer les avis CESREES : ils ne sont pas publics.

## 6. Points à vérifier

1. **ANS bloquée** : `esante.gouv.fr` renvoie Incapsula (956 octets) aux requêtes automatisées ; la liste HDS (411 hébergeurs, 10 certificateurs) et la PGSSI-S n'ont pas été lues sur la page. Chiffres issus d'un résultat de recherche, non vérifiés.
2. **CESREES** : vérifier si les avis sont communicables sur demande (LIL art. 72 et 76, secret) ; en l'état, ils ne sont pas publiés.
3. **Autorisations art. 66** : vérifier s'il existe une liste ouverte (data.gouv, open data CNIL) ; aucune trouvée. Le chiffre de 539 demandes vient du rapport annuel 2025.
4. **Doctissimo / Dedalus** : la correspondance nom-numéro vient de la presse et des bases secondaires ; la page Légifrance ne porte que le numéro. À confirmer sur le communiqué CNIL nominatif.
5. **CE 440916** : la page Légifrance a répondu 403 cette session ; l'arrêt est dans `ce` (JADE), mais l'identifiant n'a pas été relu sur la page officielle.
6. **CEDH** : l'API HUDOC répond 200 en JSON cette session, alors que `metadonnees` l'a abandonnée le 15/11/2026 pour des 403 côté Node. Réessayer l'ingestion avec la pile du projet ; ne pas contourner si le 403 revient.
7. **HAS** : licence de réutilisation non identifiée ; les mentions légales n'ont pas livré de licence explicite.
8. **CNOM** : licence non identifiée ; vérifier les conditions de réutilisation de la base de jurisprudence.
9. **Guide HAS-CNIL** : le PDF est un « document de travail » du 16/02/2026 ; vérifier la version finale avant ingestion.
10. **Catalogue HDH** : application SPA, pas d'API identifiée ; vérifier l'existence d'un endpoint HealthDCAT-AP ou d'un dump RDF.
11. **Référentiel « établissements de santé »** : non trouvé dans la liste CNIL ; vérifier s'il existe ou s'il a été absorbé par le référentiel entrepôts.
12. **Décision CE 2023 HDH/Microsoft** : signalée par la presse, non identifiée dans `ce` ; vérifier le numéro et la date.
13. **Autres APD** : les textes des sanctions santé ne sont pas dans le registre du guichet unique ; identifier les autorités nationales qui publient (DE, ES, FI, IS, CY) si le besoin transfrontalier devient P1.
14. **Volume exact des sanctions santé** : 36 lignes de la page CNIL matchent des termes santé, mais certaines sont des faux positifs ; un comptage manuel est nécessaire avant de publier un chiffre.

## 7. Sources lues

**CNIL.**
- `https://www.cnil.fr/fr/sante`
- `https://www.cnil.fr/fr/sante-formalites-prealables`
- `https://www.cnil.fr/fr/specificites-pour-la-recherche-en-sante`
- `https://www.cnil.fr/fr/recherches-sante-quelles-formalites`
- `https://www.cnil.fr/fr/traitements-de-donnees-dans-le-domaine-de-la-sante-les-referentiels-pour-simplifier-vos-demarches`
- `https://www.cnil.fr/fr/methodologie-de-reference-mr-001-recherches-sante-avec-recueil-du-consentement`
- `https://www.cnil.fr/fr/declaration/mr-002-etudes-non-interventionnelles-de-performances-concernant-les-dispositifs-medicaux`
- `https://www.cnil.fr/fr/methodologie-de-reference-mr-003-recherches-dans-le-domaine-de-la-sante-sans-recueil-du-consentement`
- `https://www.cnil.fr/fr/declaration/methodologie-de-reference-04-recherches-nimpliquant-pas-la-personne-humaine-etudes-et-evaluations-dans-le-domaine-de-la-sante`
- `https://www.cnil.fr/fr/declaration/mr-005-etudes-necessitant-lacces-aux-donnees-du-pmsi-etou-des-rpu-par-les-etablissements`
- `https://www.cnil.fr/fr/declaration/mr-006-etudes-necessitant-lacces-aux-donnees-du-pmsi-par-les-industriels-de-sante`
- `https://www.cnil.fr/fr/declaration/methodologie-de-reference-07-recherches-etudes-ou-evaluations-necessitant-lacces-aux-donnees-de-la-base-principale-du-snds-par`
- `https://www.cnil.fr/fr/declaration/methodologie-de-reference-08-recherches-etudes-ou-evaluations-necessitant-lacces-aux-donnees-de-la-base-principale-du-snds-par`
- `https://www.cnil.fr/fr/la-cnil-adopte-un-referentiel-sur-les-entrepots-de-donnees-de-sante`
- `https://www.cnil.fr/fr/gestion-des-vigilances-sanitaires-publication-du-referentiel-pour-les-traitements-de-donnees`
- `https://www.cnil.fr/fr/mise-disposition-de-lechantillon-des-donnees-du-snds-la-cnil-met-jour-le-referentiel-ex-egb`
- `https://www.cnil.fr/fr/recherche-en-sante-la-cnil-met-jour-et-elargit-le-champ-des-methodologies-de-reference-001-et-003`
- `https://www.cnil.fr/fr/demandes-dautorisation-en-sante-la-cnil-publie-les-criteres-respecter`
- `https://www.cnil.fr/fr/les-principaux-avis-et-recommandations-de-la-cnil-sur-la-plateforme-des-donnees-de-sante`
- `https://www.cnil.fr/fr/applications-mobiles-en-sante-et-protection-des-donnees-personnelles-les-questions-se-poser`
- `https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante`
- `https://www.cnil.fr/fr/quelles-formalites-pour-les-traitements-de-donnees-de-sante`
- `https://cnil.fr/fr/rapport-annuel-2025`
- `https://cnil.fr/fr/les-sanctions-prononcees-par-la-cnil`
- `https://cnil.fr/fr/explorez-la-cartographie-des-entrepots-de-donnees-de-sante-en-france`
- `https://linc.cnil.fr/maj-la-cartographie-des-entrepots-des-donnees-de-sante-version-2025`
- `https://cnil.fr/sites/default/files/2026-03/guide_has_cnil_recommandations_ia.pdf` (PDF, 61 p., document de travail 16/02/2026)

**Légifrance.**
- `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054125917` (délib. 2026-049)
- `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054125924` (délib. 2026-050)
- `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054125946` (délib. 2026-051)
- `https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054125963` (délib. 2026-052)
- `https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000046693390` (SAN-2022-022)
- `https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000045614368` (SAN-2022-009)
- `https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000050202759` (SAN-2024-013)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000043261200` (CE 450163)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000042444915` (CE 444937)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000053483461` (CE 498628)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000046598400` (CE 456162)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000043771321` (CE 453505)
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000054398578` (CE 517362)

**CEPD.**
- `https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032020-processing-data-concerning-health-purpose_en`
- `https://www.edpb.europa.eu/documents/guideline/guidelines-12026-on-processing-of-personal-data-for-scientific-research_en`
- `https://www.edpb.europa.eu/documents/legislative-opinion/edpb-edps-joint-opinion-032022-on-the-proposal-for-a-regulation-on_en`
- `https://www.edpb.europa.eu/documents/legislative-opinion/opinion-32019-concerning-the-questions-and-answers-on-the-interplay_en`

**CJUE (CELLAR).**
- `https://publications.europa.eu/resource/celex/62020CJ0184`
- `https://publications.europa.eu/resource/celex/62021CJ0252`
- `https://publications.europa.eu/resource/celex/62021CJ0667`
- `https://publications.europa.eu/resource/celex/62023CJ0021`
- `https://publications.europa.eu/resource/celex/62022CJ0307`
- `https://publications.europa.eu/resource/celex/62024CJ0474`
- `https://publications.europa.eu/resource/celex/62024CJ0526`
- `https://publications.europa.eu/resource/celex/62021CJ0340`
- `https://publications.europa.eu/resource/celex/62021CJ0077`

**Conseil constitutionnel.**
- `https://www.conseil-constitutionnel.fr/decision/2021/2021819DC.htm`
- `https://www.conseil-constitutionnel.fr/decision/2021/2021824DC.htm`
- `https://www.conseil-constitutionnel.fr/decision/2020/2020800DC.htm`
- `https://www.conseil-constitutionnel.fr/decision/2021/2021828DC.htm`

**CEDH.**
- `https://hudoc.echr.coe.int/app/query/results` (API JSON ; requêtes Z c. Finlande, I c. Finlande, L.H. c. Lettonie, `"medical data" OR "health data"`)

**Autres autorités.**
- `https://has-sante.fr/jcms/p_3599637/fr/numerique-et-intelligence-artificielle-a-la-has`
- `https://has-sante.fr/jcms/c_989142/fr/certification-des-logiciels-des-professionnels-de-sante`
- `https://has-sante.fr/jcms/c_28604/fr/mentions-legales`
- `https://ansm.sante.fr/documents/reference/reglementation-relative-aux-dispositifs-medicaux-dm-et-aux-dispositifs-medicaux-de-diagnostic-in-vitro-dmdiv/logiciels-et-applications-mobiles-en-sante`
- `https://health-data-hub.fr/cesrees`
- `https://health-data-hub.fr/page/notre-catalogue-de-metadonnees`
- `https://catalogue-metadonnees.health-data-hub.fr/`
- `https://health-data-hub.fr/projets`
- `https://health-data-hub.fr/mentions-legales`
- `https://jurisprudence.ordre.medecin.fr/RechercheSimple.do`
- `https://conseil-national.medecin.fr/sites/default/files/CNOM-RAPPORT-ACTIVITE-2025.pdf`
- `https://ccomptes.fr/en/documents/69957` (Sécurité sociale 2024, ch. XI SNDS)
- `https://www.ccne-ethique.fr/avis`
- `https://ccne-ethique.fr/sites/default/files/2026-06/Avis%20151%20-%20Tenir%20compte%20des%20origines%20des%20patients%20dans%20les%20donn%C3%A9es%20de%20sant%C3%A9.pdf`
- `https://juridique.defenseurdesdroits.fr/`
- `https://www.data.gouv.fr/api/1/datasets/?q=HDS` (aucun jeu de données)

**Sources tentées et non lues.**
- `https://www.cnil.fr/fr/methodologies-de-reference-mr` (404 : la page a changé d'URL ; utiliser les pages MR et le tableau des référentiels).
- `https://www.legifrance.gouv.fr/ceta/id/CETATEXT000042040572` (403).
- `https://esante.gouv.fr/...` (Incapsula).
- `https://ccomptes.fr/sites/default/files/2025-10/20251031-S2025-1479-Enjeux-souverainete-des-SI-civils-de-l-Etat.pdf` (identifié par recherche, non ouvert).