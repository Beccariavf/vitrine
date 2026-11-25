# Synthèse — cartographie des matières de conformité

État au 20 novembre 2026.

## 1. Objet et méthode

Huit fiches (IA, cybersécurité, finance, plateformes, données/santé, probité, durabilité, consommation) suivent la grille `00-grille.md` : champ, droit UE de fond et de procédure, autorités, droit national, jurisprudence, préparation, tableau besoin/existant, points à vérifier. Ce document les agrège : matrice, chaînes, sources à ingérer, constats, lots, vérifications.

Statut de vérification : trois fiches comptent leurs lignes (01 : 44 lignes, 24 vérifiées ; 05 : 41, 28 ; 06 : 40, 23) ; les cinq autres ne comptent pas. La colonne « Vérifié ? » fait foi ligne par ligne, et une source non lue sur sa source officielle reste marquée « non » ou « partiel » ici comme dans les fiches.

Ce document **remplace la feuille de route** de `reports/Sources corpus conformité générale.md`, dont la « Phase 0 » reposait sur une erreur : le corpus `aiact` est déjà consolidé (`02024R1689-20260727`, 1 document, 299 unités, à jour du règlement 2026/1744). Aucune phase de consolidation de l'AI Act n'est donc à planifier.

Deux limites de lecture, constantes dans les huit fiches : EUR-Lex bloque les robots (tous les textes UE passent par CELLAR) ; les sites de plusieurs autorités nationales sont inaccessibles (voir § 5.3).

## 2. Matrice matières × couches

`✅` dans Vitrine · `❌` existe, absent de Vitrine · `⏳` n'existe pas encore en droit · `🔒` existe mais inaccessible · `—` sans objet (aucune case ne l'est à ce niveau de granularité : chaque matière a un juge et une préparation, même vides).

| Matière | Texte UE de fond | Texte UE de procédure | Autorité UE (doctrine/décisions) | Autorité nationale (désignation) | Doctrine/décisions nationales | Texte national de fond | Texte national de procédure | Recours national | Juge UE | Préparation |
|---|---|---|---|---|---|---|---|---|---|---|
| **Données personnelles** (référence) | ✅ RGPD 2016/679 | ✅ 2025/2518 | ✅ CEPD | ✅ CNIL (LIL) | ✅ CNIL (`cnil`, `cnil_doctrine`) | ✅ LIL | ✅ décret 2019-536 | ✅ CE | ✅ CJUE | ✅ `preparation` |
| **IA** | ✅ 2024/1689 (consolidé) | ✅ ch. IX art. 74-84 · ❌ 2019/1020 | ❌ Bureau de l'IA, LD, codes | ⏳ DDADUE (T.A. 63) | ❌ CNIL, fiches IA | ⏳ aucune (renvoi LCEN) | ⏳ LIL 124-10 s. | ⏳ non fixé par le T.A. 63 | ❌ `cjue` filtré, aucune affaire | ❌ LD art. 6, 27, 72 ; 2024/2853 |
| **Cybersécurité** | ❌ NIS2, CER, CRA, CSA, eIDAS 2 | ❌ NIS2 art. 31-37 ; CRA ch. V | ❌ ENISA | ❌ ANSSI (C. défense L. 2321-1) | 🔒 ANSSI (`cyber.gouv.fr`) · ❌ aucune décision | ❌ C. défense L. 1332-1 s. ; loi 2018-133 | ❌ décret 2018-384 ; L. 1332-15 | ❌ CE, pleine juridiction (L. 1332-18) | ❌ aucune affaire | ❌ T.A. 366 ; COM(2026) 11 |
| **Finance** (DORA, LCB-FT, gel) | ❌ DORA ; AMLR, AMLD6, AMLA ; 833/2014 | ❌ DORA ch. V sect. II ; AMLA art. 27-28 | ❌ AES, AMLA | ❌ ACPR (L. 612-1), AMF (L. 621-1), TRACFIN | 🔒 ACPR (403) · ❌ AMF (SAN-) | ❌ CMF L. 561-1 s., L. 562-1 s. | ❌ CMF L. 612-38 s. ; L. 621-15 | ❌ CE | ❌ Tribunal/CJUE | ❌ T.A. 366 titre III ; COM(2025) 837 |
| **Plateformes** | ❌ DSA, DMA, P2B, TTPA, EMFA | ❌ DSA art. 49-83 ; DMA art. 20-34 | ❌ Commission (DG CNECT, DG COMP), comité DSA | ❌ Arcom (LCEN art. 7) | ❌ Arcom, Commission (IP/) | ❌ LCEN, loi SREN, loi 1986 | ❌ décret 2013-1196 ; délib. 2024-20 | ❌ CE (loi 1986 art. 42-11) | ❌ C-492/23 ; Tribunal | ❌ COM(2025) 837 ; DDADUE art. 35 |
| **Données/santé** | ❌ Data Act, DGA, Open Data, EHDS | ❌ Data Act ch. IX ; EHDS art. 19, 55 | ❌ Commission (registre art. 37 §7 introuvable) | ❌ Arcep (DGA) · ⏳ Data Act, EHDS | ❌ Arcep, CNIL (partiel) | ❌ CRPA livre III ; CSP L. 1111-8 | ❌ CPCE L. 36-11 ; DDADUE art. 25 | ❌ CE (CPCE L. 36-11 VI) | ❌ aucune affaire | ❌ COM(2025) 837 ; HDS v2.1 |
| **Probité** | ❌ 2026/1021 ; 2019/1937 | ❌ 2026/1021 art. 18-34 ; 2019/1937 art. 7-11 | ❌ Commission (aucune agence) | ❌ AFA (2016-1691 art. 1), HATVP | ❌ AFA (5 déc.) ; CJIP | ❌ Sapin II ; C. pénal 432-11 s. | ❌ CPP 41-1-2 ; décret 2022-1284 | ❌ CE (pleine juridiction, non nommée) | ❌ aucune affaire | ❌ transposition 2026/1021 |
| **Durabilité** | ❌ CSRD, ESRS, CSDDD, EUDR, SFDR, taxonomie | ❌ CSDDD art. 24-28 ; EUDR art. 14-26 | ❌ Commission, ESMA | ❌ H2A (C. com. L. 820-1) · ⏳ EUDR | ❌ CA Paris 5-12 ; TJ Paris | ❌ loi 2017-399 ; C. com. L. 225-102-1 | ❌ C. com. L. 238-1 ; L. 821-70 s. | ❌ CE (H2A) ; CA Paris | ❌ Tribunal (taxonomie) | ❌ Omnibus I, CSDDD ; COM(2025) 841 |
| **Consommation** | ❌ PCD, DRD, 93/13, GPSR, EAA, RFP | ❌ CPC 2017/2394 | ❌ Commission (DG JUST, Safety Gate) | ❌ DGCCRF (C. conso L. 522-1) | 🔒 DGCCRF (site bloqué) | ❌ C. conso L. 121-1, L. 212-1 | ❌ C. conso L. 521-1, L. 522-1 | ❌ TA, CAA, CE (droit commun) | ❌ C-301/25 ; C-395/25 | ❌ DFA, CPC COM(2026) 1120 |

Trois colonnes cumulent des situations différentes qu'un code unique ne rend pas : IA et données/santé ont une procédure UE dans le texte de fond mais pas d'autorité nationale en vigueur ; durabilité et consommation ont des règlements d'application directe mais des désignations et sanctions nationales. Le code porte sur la couche, pas sur l'effectivité.

## 3. Chaîne par matière

Format : couche → source et fait établi. Les marques « non vérifié » et « à confirmer » sont conservées.

### 3.1 IA

- **Fond UE** → règlement 2024/1689, consolidé `02024R1689-20260727` (119 art., 180 considérants), modifié par 2026/1744 en vigueur le 27.7.2026 (Digital Omnibus on AI) ; calendrier art. 113 tel que modifié : 2.8.2026 application générale, 2.12.2026 nouvelles interdictions, 2027-2028 haut risque.
- **Procédure UE** → art. 74-84 (surveillance du marché, règlement 2019/1020 par renvoi) ; art. 75 à 75 quinquies (compétence exclusive du Bureau pour les GPAI et les systèmes VLOP/VLOSE) ; sanctions art. 99 (35 M€ ou 7 %), art. 101 (GPAI, 15 M€ ou 3 %).
- **Autorité UE** → Bureau de l'IA (art. 64 ; décision C(2024) 390 non vérifiée), Comité IA (art. 65-66), groupe scientifique (art. 68 ; règl. 2025/454), CEPD pour les institutions de l'Union (art. 74 §9).
- **Autorité FR** → **non désignée** au 20.11.2026 (échéance art. 70 §2 du 2.8.2025 non tenue). Véhicule : DDADUE, Sénat n° 118, T.A. 63, AN n° 2518, première lecture inachevée depuis le 20.2.2026. Répartition prévue : CNIL (LIL 124-10 à 124-12), DGCCRF (C. conso L. 511-7, 35°), Arcom (loi 1986 art. 20-12 et 20-13), ANSM et ACPR sectorielles ; autorités de protection des droits fondamentaux (art. 77) renvoyées à une ordonnance (art. 24 bis).
- **Procédure FR** → aucune en vigueur ; les articles précités sont adoptés par le Sénat seulement ; aucun décret publié, un décret en Conseil d'État est prévu (C. défense L. 1340-2).
- **Recours FR** → non fixé par le T.A. 63 ; le contentieux des sanctions CNIL reste régi par la LIL (CE) — point à vérifier dans le texte.
- **Juge UE** → art. 263 et 261 TFUE contre les décisions du Bureau et de la Commission ; aucune affaire IA trouvée (`decisions_citant` 32024R1689 art. 5 : 0).

### 3.2 Cybersécurité

- **Fond UE** → NIS2 2022/2555 ; CER 2022/2557 ; CRA 2024/2847 (application échelonnée : 11.6.2026, 11.9.2026, 11.12.2027) ; CSA 2019/881 ; eIDAS 2 2024/1183 ; Cyber Solidarity 2025/38 ; RED délégué 2022/30 (applicable 1.8.2025).
- **Procédure UE** → NIS2 art. 31-37 (supervision ex ante des entités essentielles, ex post des importantes ; 10 M€ ou 2 %, 7 M€ ou 1,4 %) ; CRA ch. V (2019/1020 ; 15 M€ ou 2,5 %, 10 M€ ou 2 %, 5 M€ ou 1 %) ; pas de contentieux cyber identifié.
- **Autorité UE** → ENISA (CSA art. 3 ; NIS2 art. 14 et 16 ; CRA art. 16, plateforme unique de signalement) ; Commission (actes délégués et d'exécution 2024/2690, 2025/2392, 2026/881).
- **Autorité FR** → ANSSI, désignée par le code de la défense **L. 2321-1** (en vigueur) ; désignation future à l'art. 5 du T.A. n° 366 (AN, 17.11.2026). Pouvoirs OIV : L. 1332-12 à L. 1332-19.
- **Procédure FR** → OIV : commission des sanctions L. 1332-15, composition redéfinie à L. 1332-16, publication et produit L. 1332-18. NIS2 : prévue aux art. 25-37 du T.A. 366 (injonctions, agents assermentés, commission art. 36, amendes art. 37) ; aucun décret d'application pris.
- **Recours FR** → **pleine juridiction** contre les décisions de sanction (L. 1332-18, dernier alinéa) ; la juridiction n'est pas nommée par le texte, le Conseil d'État est probable mais non établi (non vérifié).
- **Juge UE** → Tribunal et CJUE (art. 263, 267 TFUE) ; aucune affaire identifiée ; `cjue` filtré sur les données personnelles.
- **Juge pénal** → Cour de cassation, chambre criminelle, sur les art. 323-1 à 323-8 du code pénal, via Judilibre ; non exploité.

### 3.3 Finance (DORA, LCB-FT, gel)

- **Fond UE** → DORA 2022/2554 (applicable 17.1.2025), la directive 2022/2556 et 11 actes de niveau 2 vérifiés au JO ; AMLR 2024/1624 (application 10.7.2027) ; AMLD6 2024/1640 ; AMLA 2024/1620 ; 2023/1113 ; AMLD4 2015/849 jusqu'au 9.7.2027 ; gel : 833/2014 et 269/2014.
- **Procédure UE** → DORA ch. V sect. II art. 31-44 (désignation des prestataires TIC critiques par les AES, superviseur principal, pouvoirs art. 35, redevances art. 43) ; sanctions laissées aux États (art. 50-54, pas de plafond UE) ; AMLA art. 27-28 (enquête, amendes, pleine juridiction CJUE).
- **Autorité UE** → ABE, AEMF, AEAPP et comité mixte (DORA art. 32 ; liste des prestataires critiques du 18.11.2025) ; AMLA (surveillance directe annoncée 2027-2028, considérant 86) ; BCE/MSU (DORA art. 46 a)).
- **Autorité FR** → ACPR (CMF L. 612-1 et L. 612-2 ; LCB-FT L. 561-36-1) ; AMF (L. 621-1, L. 621-2, L. 561-36, 2°) ; TRACFIN (L. 561-23) ; DG Trésor (L. 562-4, L. 562-9) ; Commission nationale des sanctions (L. 561-38 à L. 561-44).
- **Procédure FR** → ACPR : L. 612-33 à L. 612-37, commission L. 612-38, sanctions L. 612-39 et L. 612-40 (10 % du CA, 5 M€) ; AMF : L. 621-15 (15 M€ ou décuple, 100 M€ pour certains manquements) ; CNS : L. 561-40 (5 M€ ou double de l'avantage) ; DORA/2022/2556 : titre III du T.A. 366, art. 43 A à 63, avec report au 17.7.2027 pour certaines sociétés de financement (art. 62).
- **Recours FR** → Conseil d'État, pleine juridiction, pour les sanctions ACPR (**CMF L. 612-16**, à confirmer sur Légifrance) et pour les sanctions AMF des personnes et entités régulées (**CMF L. 621-30**), cour d'appel de Paris pour les autres (à confirmer sur Légifrance) ; L. 561-43 pour la CNS, sans juridiction nommée.
- **Juge UE** → Tribunal et CJUE : recours contre les décisions des AES et les règlements de mesures restrictives, renvois préjudiciels.

### 3.4 Plateformes

- **Fond UE** → DSA 2022/2065 (applicable 17.2.2024) ; DMA 2022/1925 (2.5.2023) ; P2B 2019/1150 (abrogation proposée par l'Omnibus) ; TTPA 2024/900 (application annoncée 10.10.2025, à confirmer) ; EMFA 2024/1083 ; 2021/784 ; directive 2000/31/CE.
- **Procédure UE** → DSA art. 49-83 : coordinateur national, comité (art. 61-63), compétence exclusive de la Commission sur les VLOP/VLOSE (art. 56), amendes 6 % (art. 74) ; DMA art. 20-34, amendes 10 % (art. 30) ; pas d'autorité UE pour P2B, TTPA et EMFA.
- **Autorité UE** → Commission, DG CNECT (DSA) et DG COMP (DMA) ; comité européen des services numériques (art. 61-63) ; comité des médias (EMFA art. 13, non vérifié).
- **Autorité FR** → Arcom, **coordinateur pour les services numériques** (LCEN art. 7, créé par la loi SREN art. 51) ; CNIL et DGCCRF également autorités compétentes (LCEN art. 7 et 7, 2°). TTPA : désignation Arcom et CNIL par le DDADUE art. 35, non achevée — le règlement est applicable mais la désignation ne l'est pas.
- **Procédure FR** → LCEN art. 8-1 (contrôle), 9-1 (enquête), 9-2 (coopération) ; sanction par la formation du collège de l'Arcom (loi 1986 art. 42-7, décret 2013-1196), plafonds LCEN art. 10-1 (250 000 € ou 4 %, 500 000 € ou 6 % en récidive) ; pas de commission des sanctions distincte.
- **Recours FR** → Conseil d'État, pleine juridiction (loi 1986 art. 42-11) ; portée exacte pour les sanctions LCEN à confirmer.
- **Juge UE** → Tribunal (annulation, pleine juridiction pour les amendes) ; CJUE C-492/23 *Russmedia* (2.12.2025), pont DSA/RGPD.

### 3.5 Données et santé

- **Fond UE** → Data Act 2023/2854 (application 12.9.2025) ; DGA 2022/868 (24.9.2023) ; directive Open Data 2019/1024 ; HVD 2023/138 ; 2018/1807 ; EHDS 2025/327 (application 26.3.2027, dérogations 2029-2031).
- **Procédure UE** → Data Act ch. IX art. 37-42 : autorités nationales, coordinateur de données, registre public (introuvable), sanctions art. 40 (plafond RGPD 20 M€ ou 4 % pour les chapitres II, III et V) ; DGA art. 13, 26-28, 34 ; EHDS art. 19 (autorités de santé numérique), 22, 55 (HDAB), 64, 99.
- **Autorité UE** → aucune agence compétente ; Commission (FAQ, recommandation clauses types du 19.11.2025) ; EDIB sans pouvoir de décision.
- **Autorité FR** → Arcep pour la DGA (**loi 2024-449 art. 36**, en vigueur depuis le 23.5.2024) ; Arcep pour le Data Act (**art. 35-1** issu du T.A. 63, non en vigueur, chapitre VII exclu sans successeur) ; **aucune** pour l'EHDS (échéance 26.3.2027) ; CADA (CRPA L. 341-1, L. 342-1).
- **Procédure FR** → CPCE L. 36-11 (saisine, mise en demeure, formation restreinte L. 130, publicité) ; le DDADUE art. 25 y renvoie avec des plafonds de 3 % du CA (5 % en récidive) ou 150 000 € (375 000 €).
- **Recours FR** → Conseil d'État, pleine juridiction et référé suspension (CPCE L. 36-11 VI) ; tribunal administratif pour les refus de communication ou de réutilisation (CRPA).
- **Juge UE** → aucune affaire ; `cjue` filtré sur les données personnelles.

### 3.6 Probité

- **Fond UE** → directive 2026/1021 (en vigueur 31.5.2026, transposition 1.6.2028) ; directive 2019/1937 (transposition 17.12.2021) ; directive 2017/1371 modifiée (art. 36 de 2026/1021).
- **Procédure UE** → 2026/1021 : organismes nationaux de prévention et de répression (art. 22), enquête (art. 26), gel et confiscation (art. 27), sanctions pénales nationales, prescription 8 ans (art. 19) ; 2019/1937 : canaux internes et externes (art. 7-11), interdiction des représailles (art. 19), sanctions (art. 23).
- **Autorité UE** → aucune agence pour la corruption ; Commission (art. 33, 34, 38) ; OLAF et EPPO pour les intérêts financiers de l'Union (P3).
- **Autorité FR** → AFA, service à compétence nationale (loi 2016-1691 art. 1 à 3 ; décret 2017-329) ; HATVP (loi 2013-907 art. 19) ; Défenseur des droits pour les lanceurs d'alerte (LEO 2011-333 art. 4, 5°).
- **Procédure FR** → commission des sanctions de l'AFA (art. 17 IV à VII : rapporteur, observations sous deux mois, audience publique, plafonds 200 000 € et 1 000 000 €, prescription 3 ans) ; CJIP (CPP 41-1-2, 30 % du CA moyen) ; décret 2022-1284 pour les signalements.
- **Recours FR** → **pleine juridiction** (art. 17 VII), sans juridiction nommée ; aucune décision du Conseil d'État trouvée dans CETAT au 20.11.2026.
- **Juge UE** → aucune affaire (directive non transposée, pas de contentieux d'interprétation possible).
- **Juge judiciaire** → Cour de cassation, chambre criminelle, via Judilibre ; `cc` non élargi.

### 3.7 Durabilité

- **Fond UE** → CSRD 2022/2464 (modifiée par 2025/794 et 2026/470) ; Omnibus I 2026/470 (en vigueur 18.3.2026) ; ESRS 2023/2772 et 2026/1563 ; CSDDD 2024/1760 (seuils relevés à 5 000 salariés et 1 500 M€, art. 22 supprimé) ; EUDR 2023/1115 (application 30.12.2026 et 30.6.2027) ; SFDR ; taxonomie.
- **Procédure UE** → CSDDD art. 24-28 (autorités de supervision, réseau, sanctions plafonnées à 3 % du CA, art. 27) ; EUDR art. 14-26 (autorités, contrôles 3 %, 9 %, 1 %, sanctions 4 % minimum, art. 25) ; CSRD : sanctions nationales (art. 51 de 2013/34), pas de plafond UE.
- **Autorité UE** → Commission (ESRS, taxonomie, lignes directrices travail forcé C/2026/4637) ; ESMA (priorités de supervision 2026, reprises par l'AMF) ; réseaux CSDDD et travail forcé, sans personnalité juridique.
- **Autorité FR** → H2A (C. com. **L. 820-1**, succède au H3C) pour la certification ; AMF (CMF L. 621-1) pour l'information réglementée ; EUDR : **aucun instrument juridique** — désignation annoncée CGDD/DGPE seulement ; travail forcé, batteries, minerais : non identifiées.
- **Procédure FR** → H2A : commission des sanctions L. 821-70 à L. 821-85 (CAC) et L. 822-30 à L. 822-39 (OTI) ; injonction de communication C. com. L. 238-1 (référé, astreinte) ; vigilance L. 225-102-1 (mise en demeure 3 mois, injonction sous astreinte).
- **Recours FR** → Conseil d'État, pleine juridiction (L. 821-85) pour la H2A ; cour d'appel de Paris, pôle 5 ch. 12, pour la vigilance (COJ L. 211-21, compétence exclusive du TJ de Paris en première instance).
- **Juge UE** → Tribunal, taxonomie (T-625/22, T-575/22, T-579/22, T-583/22) ; aucun contentieux CSRD ou CSDDD identifié.

### 3.8 Consommation

- **Fond UE** → PCD 2005/29 (consolidée 02005L0029-20260927) ; DRD 2011/83 ; 93/13 ; 2019/2161 ; 2024/825 (transposition 27.3.2026, application 27.9.2026) ; 2020/1828 ; GPSR 2023/988 ; EAA 2019/882 ; RFP 2024/2853 ; 2024/1799.
- **Procédure UE** → règlement CPC 2017/2394 (désignation art. 5, pouvoirs art. 9, coopération art. 11-23, comité art. 38) ; pas d'autorité UE de sanction ; planchers d'amendes de 4 % du CA ou 2 M€ (2019/2161).
- **Autorité UE** → Commission, DG JUST ; réseau CPC ; Safety Gate (GPSR art. 25-27, 30, 34) ; aucune agence.
- **Autorité FR** → DGCCRF, autorité administrative chargée de la concurrence et de la consommation (C. conso **L. 522-1**, agents L. 511-3) ; bureau de liaison unique CPC très probable mais non confirmé (liste Commission non chargée, HTTP 429).
- **Procédure FR** → injonction L. 521-1 ; amendes administratives L. 522-1 à L. 522-10 (procédure contradictoire L. 522-5, publication L. 522-6, prescription L. 522-2 et L. 522-3) ; pénal L. 132-2 (2 ans, 300 000 €, porté à 10 % du CA) ; accessibilité L. 412-13 et décret 2023-931.
- **Recours FR** → aucun texte spécifique : recours de droit commun devant le juge administratif (TA, CAA, CE) ; qualification (excès de pouvoir ou plein contentieux) non tranchée.
- **Juge UE** → CJUE C-301/25 *Lidl Italia* (30.4.2026), C-395/25 *Orkla Care* (5.11.2026) ; Tribunal pour les actes de la Commission.
- **Juge judiciaire** → TJ, CA et Cour de cassation (clauses abusives, pratiques trompeuses), via Judilibre.

## 4. Sources à ingérer

Règle de lecture : une ligne = un texte ou un lot homogène (même matière, couche, canal, licence, corpus cible) ; tous les identifiants du lot sont énumérés. Aucune ligne P1 ou P2 des huit fiches portant « Dans Vitrine ? = non » n'est omise ; les textes cités par plusieurs fiches sont fusionnés, matières cumulées. Accès : C = CELLAR, P = PISTE, J = JORF, H = HTML/PDF de l'éditeur, API. Licence : EL = réutilisation EUR-Lex (déc. 2011/833/UE), LO = Licence Ouverte 2.0, AV = à vérifier, IN = inconnue, ND = aucune affichée.

| Priorité | Matière | Couche | Source | Identifiant | Accès | Licence | Vérifié ? | Corpus Vitrine cible |
|---|---|---|---|---|---|---|---|---|
| P1 | IA | UE fond | Décision d'exécution 2026/2274 (référence EN 18286:2026) | 32026D2274 | C | EL | oui | `aiact` |
| P1 | IA | Autorité UE | Bureau de l'IA : 5 lignes directrices et 2 codes de bonne pratique | C(2024) 390 non lue ; LD 2025-2026 ; codes juill. 2025 et 10.6.2026 | H | EL (présumée) | partiel | `aiact_doctrine` (nouveau) |
| P1 | IA, Consommation | UE proc | Règlement 2019/1020 (surveillance du marché, appliqué par renvoi) | 32019R1020 | C | EL | non | `aiact`, `consommation` |
| P1 | IA, Consommation | UE fond | Directive 2024/2853 (responsabilité du fait des produits) | 32024L2853 | C | EL | oui | `consommation` |
| P1 | IA, Données/santé, Plateformes, Consommation | FR fond + proc (navette) | DDADUE : art. 24 (IA), 24 bis (habilitation), 25 (Data Act), 35 (TTPA), 20-21 (2024/825) | Sénat n° 118 ; T.A. 63 ; AN n° 2518 | H | LO (à confirmer) | oui / partiel | `preparation` |
| P1 | IA | Doctrine FR | CNIL : 13 fiches pratiques IA, synthèse, introduction, liste de vérification | juill. 2025 | H/PDF | ND (CC BY-ND 4.0 appliquée) | oui | `cnil_doctrine` (extension) |
| P1 | Cybersécurité | UE fond + proc | NIS2 ; règl. exéc. 2024/2690 ; CER ; CRA ; règl. exéc. 2025/2392 | 32022L2555 ; 32024R2690 (OJ L_202402690) ; 32022L2557 ; 32024R2847 ; 32025R2392 | C | EL | oui | `cyber` (nouveau) |
| P1 | Cybersécurité | FR fond + proc | C. défense L. 1332-1 s. et L. 2321-1, L. 2321-2-1 ; loi 2018-133 ; décret 2018-384 ; C. pénal 323-1 à 323-8 | LEGIARTI000028345191 ; LEGIARTI000028342544 ; LEGIARTI000047922728 ; JORFTEXT000036644772 ; JORFTEXT000036939971 ; LEGIARTI000047052655 | P | LO | oui | `cyber_fr` (nouveau) |
| P1 | Cybersécurité, Finance | Préparation (navette) | Projet de loi résilience : art. 5 (ANSSI), 25-37 (supervision, commission, amendes), titre III (DORA) | AN T.A. n° 366 (17.11.2026) ; Sénat n° 33 ; T.A. 78 | H/PDF | LO (non revérifiée) | oui | `preparation` |
| P1 | Finance | UE fond + proc | DORA, directive 2022/2556 et actes de niveau 2 P1 | 32022R2554 ; 32022L2556 ; 32024R1774 ; 32024R1772 ; 32024R1773 ; 32024R2956 ; 32025R0301 ; 32025R0532 | C | EL | oui | `dora` (nouveau) |
| P1 | Finance | UE fond | AMLR, AMLD6, AMLA, 2023/1113, AMLD4 ; gel 833/2014 et 269/2014 | 32024R1624 ; 32024L1640 ; 32024R1620 ; 32023R1113 ; 32015L0849 ; 32014R0833 ; 32014R0269 | C | EL | oui | `lcbft`, `gel` (nouveaux) |
| P1 | Finance | Autorité UE | ABE et AEMF : doctrine, Q&R DORA, liste des prestataires TIC critiques | 32010R1093 ; 32010R1095 ; liste du 18.11.2025 | H/PDF | AV | oui | `dora_doctrine` (nouveau) |
| P1 | Finance | Autorité FR | ACPR, AMF, TRACFIN, DG Trésor : désignation et pouvoirs ; registre national des gels | L. 612-1 ; L. 561-36-1 ; L. 621-1 ; L. 621-2 ; L. 621-15 ; L. 561-23 ; L. 562-9 ; API `ApiPublic/api/v1/publication` | P/API | LO | oui | `lcbft_fr` (nouveau) |
| P1 | Finance | FR fond + proc | CMF L. 561-1 s., R. 561-1 s., L. 562-1 s., L. 612-1 à L. 612-42 ; arrêté du 6.1.2021 | LEGITEXT000006072026 ; LEGIARTI000036824564 ; LEGIARTI000051740660 ; LEGIARTI000051556833 ; LEGIARTI000053782430 ; JORFTEXT000042992976 | P/J | LO | oui | `lcbft_fr` |
| P1 | Finance | Doctrine + décisions FR | ACPR : lignes directrices LCB-FT, principes sectoriels, recueil des sanctions | inconnu (site 403) | H | AV | non | `acpr` (nouveau) |
| P1 | Plateformes | UE fond | DSA ; DMA ; P2B ; TTPA | 32022R2065 ; 32022R1925 ; 32019R1150 ; 32024R0900 | C | EL | oui | `plateformes` (nouveau) |
| P1 | Plateformes | Autorité UE | Commission DG CNECT et DG COMP ; comité DSA ; décisions Temu, Apple/Meta, Google | IP/26/1178 ; IP/25/1085 ; IP/26/1670 ; DSA art. 61-63 | H/PDF | EL | oui | `plateformes_doctrine` (nouveau) |
| P1 | Plateformes | FR fond + proc | LCEN ; loi SREN ; loi 1986 ; décret 2013-1196 ; délibération Arcom 2024-20 | JORFTEXT000000801164 ; JORFTEXT000049563368 ; JORFTEXT000000512205 ; JORFTEXT000028352737 ; JORFTEXT000050385836 | P/J | LO | oui (1986 partiel) | `plateformes_fr` (nouveau) |
| P1 | Plateformes | Autorité FR | Arcom coordinateur (LCEN art. 7) et décisions (2026-405 ; mises en demeure du 3.2.2026) ; CNIL ; DGCCRF (art. 7, 2°) | LCEN art. 7 à 9-2 | P/H | LO (DGCCRF AV) | oui | `arcom` (nouveau) |
| P1 | Plateformes | Recours + juge | CJUE C-492/23 ; Conseil d'État, recours Arcom | 62023CJ0492 ; loi 1986 art. 42-11 | CURIA/P | EL/LO | oui / partiel | `cjue`, `ce` (à élargir) |
| P1 | Données/santé | UE fond + proc | Data Act ; DGA ; directive Open Data ; EHDS | 32023R2854 ; 32022R0868 ; 32019L1024 ; 32025R0327 | C | EL | oui | `donnees`, `ehds` (nouveaux) |
| P1 | Données/santé | Autorité UE | Commission DG CNECT : FAQ Data Act, recommandation clauses types ; registre art. 37 §7 introuvable | 6.9.2024 ; C(2025) 7750 non lue | H | EL | partiel | `donnees_doctrine` (nouveau) |
| P1 | Données/santé | Autorité FR | Arcep (DGA, loi 2024-449 art. 36-38 ; Data Act, art. 35-1 à venir) ; CADA | art. 36 ; T.A. 63 art. 25 ; CRPA L. 341-1 | P/H | LO | oui | `donnees_fr` (nouveau) |
| P1 | Données/santé | FR fond + proc | CRPA livre III ; loi 2024-449 titre III ; CSP L. 1111-8 et R. 1111-8-8 s. ; décret 2026-209 ; CPCE L. 36-11 | LEGITEXT000031366350 ; L. 1111-8 ; TRIS 2026/0452/FR | P | LO | oui / partiel | `donnees_fr`, `sante_fr` |
| P1 | Probité | UE fond + proc | Directive 2026/1021 ; directive 2019/1937 | 32026L1021 ; 32019L1937 | C | EL | oui | `probite` (nouveau) |
| P1 | Probité | FR fond + proc | Sapin II ; loi 2022-401 ; C. pénal 432-11 à 445-2, 131-38, 131-39-2 ; CPP 41-1-2 ; décret 2022-1284 | LEGITEXT000033561874 ; LEGITEXT000045389525 ; LEGIARTI000049778681 ; LEGITEXT000046357757 | P | LO | oui | `probite_fr` (nouveau) |
| P1 | Probité | Autorité FR + doctrine | AFA : recommandations, guides 2026, 5 décisions de la commission des sanctions ; CJIP publiées | JORFTEXT000042932087 ; 4.7.2019 à 9.7.2026 ; 271 PDF | H/PDF | LO | partiel | `afa` (nouveau) |
| P1 | Probité | Autorité FR | HATVP, répertoire des représentants d'intérêts ; Défenseur des droits | jeux data.gouv.fr ; LEO 2011-333 art. 4, 5° | API/H | fr-lo / IN | oui | `hatvp` (nouveau) |
| P1 | Probité | Recours FR | Conseil d'État, recours de pleine juridiction contre les sanctions de l'AFA (art. 17 VII, juridiction non nommée) | JADE ; opendata.justice-administrative.fr | H/XML | LO | partiel (aucune décision trouvée) | `ce` (à élargir) |
| P1 | Durabilité | UE fond | CSRD ; Omnibus I ; ESRS set 1 et 2 ; CSDDD ; EUDR et ses deux reports | 32022L2464 ; 32026L0470 ; 32023R2772 ; 32026R1563 ; 32024L1760 ; 32023R1115 ; 32024R3234 ; 32025R2650 | C | EL | oui | `durabilite` (nouveau) |
| P1 | Durabilité | FR fond + proc | Loi 2017-399 ; C. com. L. 225-102-1, L. 225-102-2, L. 232-6-3, L. 238-1, L. 820-1, L. 821-70 à L. 821-85 ; ordonnance 2023-1142 ; décret 2023-1394 | JORFTEXT000034290626 ; LEGIARTI000051559591 ; JORFTEXT000048519395 ; JORFTEXT000048735301 | P | LO | oui / partiel | `durabilite_fr` (nouveau) |
| P1 | Durabilité | Autorité FR | H2A (C. com. L. 820-1) ; AMF (CMF L. 621-1) ; autorité EUDR CGDD/DGPE sans instrument | L. 820-1 ; L. 621-1 | H/P | IN / AV | oui (base) | `h2a` (nouveau) |
| P1 | Durabilité | Décisions FR | CA Paris pôle 5 ch. 12 ; TJ Paris (vigilance) | RG 24/05193 ; 21/15827 ; 22/03403 ; 23/09018 | H | LO | oui | `vigilance_decisions` (nouveau) |
| P1 | Consommation | UE fond | PCD ; DRD ; 93/13 ; 2019/2161 ; 2024/825 ; 2020/1828 ; GPSR ; EAA ; RFP | 32005L0029 ; 32011L0083 ; 31993L0013 ; 32019L2161 ; 32024L0825 ; 32020L1828 ; 32023R0988 ; 32019L0882 ; 32024L2853 | C | EL | oui | `consommation` (nouveau) |
| P1 | Consommation | UE proc | Règlement CPC 2017/2394 | 32017R2394 | C | EL | oui | `consommation` |
| P1 | Consommation | Autorité UE | Commission DG JUST, réseau CPC, Safety Gate | CPC art. 5, 8, 35, 38 ; GPSR art. 25-27, 30, 34 | H/JS | EL | oui / partiel | `consommation_doctrine` (nouveau) |
| P1 | Consommation | FR fond + proc | Code de la consommation (L. 121-1, L. 212-1, L. 221-5, L. 412-13, L. 421-1, L. 511-1 s., L. 521-1, L. 522-1 s.) ; décret 2023-931 ; loi 2025-391 art. 16 | LEGITEXT000006069565 ; JORFTEXT000048178349 | P | LO | oui (2025-391 partiel) | `conso_fr` (nouveau) |
| P1 | Consommation | Autorité FR | DGCCRF (C. conso L. 522-1, L. 511-3 ; CPC art. 5) | L. 522-1 ; L. 511-3 | H (403) | LO (AV) | partiel | `dgccrf` (nouveau) |
| P1 | Consommation | Juge | CJUE C-301/25 ; TA/CAA/CE (décisions DGCCRF) ; juge judiciaire | 62025CJ0301 | CURIA/P | EL/LO | oui / non | `cjue`, `cc` (à élargir) |
| P1 | Transverse | Préparation | Digital Omnibus (données, plateformes, NIS2, DORA, IA) ; mandat du Conseil | COM(2025) 837 ; 52025PC0837 ; ST 14756/26 | H/PDF | EL | oui (art. 8 DORA non ouvert) | `preparation` |
| P1 | Consommation | Préparation | Digital Fairness Act ; nouveau règlement CPC | COM(2026) 1100 ; COM(2026) 1120 | H/PDF | EL | oui / partiel | `preparation` |
| P2 | IA | UE proc | Règlement d'exécution 2025/454 (groupe scientifique) | 32025R0454 | C | EL | oui | `aiact` |
| P2 | IA | UE fond | Règlement 2023/1230 (machines, applicable 14.1.2027) | 32023R1230 | C | EL | oui | `aiact` |
| P2 | IA | UE fond | Décision 2026/1080 (conclusion de la convention-cadre) ; texte JO 2026/1081 introuvable | 32026D1080 | C | EL | oui / non | `aiact` |
| P2 | IA | FR proc (navette) | LCEN titre V bis (art. 55-1 à 55-6) ; code de la défense L. 1340-1 à L. 1340-7 | T.A. 63 | H | LO | oui | `preparation`, `cyber_fr` |
| P2 | IA | Autorité UE | Comité IA, groupe scientifique, forum consultatif | art. 65-68 | H | EL | oui (base) | `aiact_doctrine` |
| P2 | IA | Autorité UE | Modèle de résumé public des données d'entraînement ; base de données art. 71 | juill. 2025 ; art. 71 | H | EL | partiel / non | `aiact_doctrine` |
| P2 | IA | Autorité FR | Défenseur des droits (art. 77, pressenti) ; ANSM et ACPR (sectorielles) | T.A. 63 | H | IN | non / oui | `preparation` |
| P2 | IA | Doctrine FR | CNIL, programme de travail 2026 (section IA) | 7.4.2026 | H | CC BY-ND 4.0 | oui | `cnil_doctrine` |
| P2 | IA | Juge UE | CJUE, décisions automatisées et profilage (art. 22 RGPD), mobilisables sur l'IA | C-634/21 ; C-203/22 | CURIA | EL | non | `cjue` (à élargir) |
| P2 | IA | Préparation | Lignes directrices attendues (art. 27, 72, 73, 96 §1 g), chaîne de valeur, modifications substantielles | projets et échéances 2.9.2027 et 1.8.2027 | H | EL | partiel | `aiact_doctrine`, `preparation` |
| P2 | Cybersécurité | UE fond | 2026/881 ; CSA ; EUCC ; eIDAS 2 et actes d'exécution ; Cyber Solidarity ; RED 2022/30 et 2023/2444 | 32026R0881 ; 32019R0881 ; 32024R0482 ; 32024R1183 ; 32025R0038 ; 32022R0030 ; 32023R2444 | C | EL | oui / partiel | `cyber` |
| P2 | Cybersécurité | Autorité UE | ENISA (schémas candidats, guides) ; Commission (orientations CRA) | 32019R0881 art. 3 ; CRA art. 26 | H | reproduction avec mention / EL | oui (base) | `cyber_doctrine` (nouveau) |
| P2 | Cybersécurité | FR fond | Décret 2015-351 (SIIV) ; RGS (ord. 2005-1516 art. 9, décret 2010-112) | JORFTEXT000030405967 ; LEGIARTI000006317203 | P | LO | oui | `cyber_fr` |
| P2 | Cybersécurité | Doctrine FR | SecNumCloud v3.2 ; guides ANSSI (hygiène, PSSI-E, EBIOS RM) | versions inconnues | H (Incapsula) | IN | non | `anssi` (bloqué) |
| P2 | Cybersécurité | Préparation | Cybersecurity Act 2 | COM(2026) 11 ; 2026/0011(COD) | H | EL | oui (numéro) / non (stade) | `preparation` |
| P2 | Finance | UE fond | 2024/1502 ; 2025/302 ; 2025/1190 ; MiCA ; 2024/1226 | 32024R1502 ; 32025R0302 ; 32025R1190 ; 32023R1114 ; 32024L1226 | C | EL | oui | `dora`, `lcbft` |
| P2 | Finance | Autorité UE | AEAPP ; comité mixte (liste TIC) ; BCE/MSU ; projets de RTS de l'AMLA | 32010R1094 ; 32013R1024 ; RTS du 30.9.2026 | H/PDF | AV | oui | `dora_doctrine`, `lcbft_doctrine` |
| P2 | Finance | Doctrine FR | AMF (DOC-2019-14 à 18, DOC-2023-01 et 07, DOC-2024-02 et 08, DOC-2025-02) ; TRACFIN (rapport annuel) | DOC-2019-15 ; DOC-2019-16 | H/PDF | AV | oui / non | `amf`, `tracfin` |
| P2 | Finance | FR proc | CMF L. 561-38 à L. 561-44 et L. 561-43 ; R. 562-1 s. ; arrêtés 2021 et 2018 ; L. 574-1 à L. 574-4 | LEGIARTI000054616645 ; LEGIARTI000020196384 ; LEGIARTI000050826169 ; JORFTEXT000043219985 ; JORFTEXT000037856385 ; LEGIARTI000054795760 | P/J | LO | oui | `lcbft_fr` |
| P2 | Finance | Recours FR | Conseil d'État, recours contre les sanctions ACPR, AMF et CNS | JADE ; opendata.justice-administrative.fr | H/XML | LO | oui | `ce` (à élargir) |
| P2 | Finance | Juge UE | CJUE et Tribunal (DORA, AMLR, gel) | 6… (CURIA) | CURIA | EL | oui | `cjue` (à élargir) |
| P2 | Plateformes | UE fond | EMFA ; contenus terroristes ; directive e-commerce | 32024R1083 ; 32021R0784 ; 32000L0031 | C | EL | oui / partiel | `plateformes` |
| P2 | Plateformes | UE proc | 2025/2050 ; 2023/1127 ; 2024/436 ; 2023/1201 ; 2024/2835 ; 2023/814 | 32025R2050 ; 32023R1127 ; 32024R0436 ; 32023R1201 ; 32024R2835 ; 32023R0814 | C | EL | oui | `plateformes` |
| P2 | Plateformes | Autorité UE + FR | Comité des médias ; DGCCRF ; Autorité de la concurrence ; Pharos | EMFA art. 13 ; C. com. L. 420-1 ; LCEN art. 6-1 | H | EL / IN | non / oui | `plateformes_doctrine` |
| P2 | Plateformes | FR fond | Loi 2026-813 (mineurs et réseaux sociaux) | JORFTEXT000054743001 | P | LO | non | `plateformes_fr` |
| P2 | Plateformes | Juge UE | Tribunal, recours DSA et DMA | T-… non vérifiés | CURIA | EL | non | `cjue` (à élargir) |
| P2 | Données/santé | UE fond + proc | HVD ; 2018/1807 ; trois règlements d'exécution EHDS | 32023R0138 ; 32018R1807 ; 32026R0771 ; 32026R2083 ; 32026R2098 | C | EL | oui | `donnees`, `ehds` |
| P2 | Données/santé | Autorité UE | EDIB ; registres DGA (intermédiation, altruisme) | DGA art. 29-30, 11 §2, 17 | H | EL / IN | partiel | `donnees_doctrine` |
| P2 | Données/santé | FR fond | Loi 2016-1321 ; SNDS (CSP L. 1461-1 s.) ; Health Data Hub (L. 1462-1) ; certification HDS (arrêté 2018 mod. 2024) | JORFTEXT000033202746 ; L. 1461-1 ; L. 1462-1 | P | LO | oui / partiel | `sante_fr` |
| P2 | Données/santé | Recours FR | Tribunal administratif, refus de communication ou de réutilisation (CRPA livre III) | — | H/XML | LO | non | `ce` (à élargir) |
| P2 | Données/santé | Préparation | Avis CEPD-CEPS ; référentiel HDS v2.1 ; actes d'exécution EHDS à venir | 11.2.2026 ; TRIS 2026/0452/FR ; mars 2027 | H | EL / conditions CEPD | partiel | `preparation` |
| P2 | Probité | UE fond | Directive 2017/1371 (PIF), modifiée par 2026/1021 | 32017L1371 | C | EL | non | `probite` |
| P2 | Probité | Autorité UE | Commission : statistiques et rapport d'évaluation | art. 33, 34, 38 | H | EL | oui (base) | `probite_doctrine` |
| P2 | Probité | FR fond + proc | Loi 2013-907 ; loi 2025-532 art. 54 III ; CPP 180-2 ; décret 2026-311 | LEGITEXT000028057465 ; LEGITEXT000051736616 ; LEGITEXT000053959784 | P | LO | oui | `probite_fr` |
| P2 | Probité | Autorité FR | PNF : plaquette de présentation (février 2026), site en maintenance | — | H | IN | non | `probite_fr` |
| P2 | Probité | Juge | Cour de cassation (chambre criminelle) ; Conseil constitutionnel 2016-741 DC ; CJUE (aucune affaire) | 2016-741 DC | P/J | LO | oui (mention) | `cc`, `constit`, `cjue` (à élargir) |
| P2 | Probité | Source internationale | Convention OCDE de 1997 sur la corruption | référence non lue | H (Cloudflare) | IN | non | `probite` |
| P2 | Durabilité | UE fond + proc | 2025/794 ; 2025/1416 ; taxonomie (852, 2139, 2178, 1214, 2486) ; SFDR et RTS ; travail forcé ; batteries | 32025L0794 ; 32025R1416 ; 32020R0852 ; 32021R2139 ; 32021R2178 ; 32022R1214 ; 32023R2486 ; 32019R2088 ; 32022R1288 ; 32024R3015 ; 32023R1542 | C | EL | oui | `durabilite` |
| P2 | Durabilité | Autorité UE + FR | Commission (ESRS, taxonomie) ; ESMA et AMF (ECEP 2026) ; H2A (commission des sanctions) ; AMF | ECEP du 13.10.2026 ; L. 821-70 à L. 821-85 | H/PDF | IN | partiel | `durabilite_doctrine` |
| P2 | Durabilité | FR fond | C. com. L. 233-28-4 et L. 232-6-4 | LEGIARTI000051559591 | P | LO | oui | `durabilite_fr` |
| P2 | Durabilité | Préparation | Révision SFDR ; lignes directrices travail forcé ; lignes directrices H2A ; autorités travail forcé, batteries, minerais | COM(2025) 841 ; C/2026/4637 ; janv. 2026 | H | EL / IN | partiel | `preparation` |
| P2 | Consommation | UE fond | Directive 2024/1799 (réparation) | 32024L1799 | C | EL | oui | `consommation` |
| P2 | Consommation | Autorité FR | Conseil national de la consommation ; SignalConso | C. conso D. 821-1 s. | H | IN | oui (base) / non | `conso_fr` |
| P2 | Consommation | FR fond + proc | L. 411-1 ; ordonnance 2021-1734 ; loi 2024-364 art. 2 ; décret 2025-734 | LEGIARTI000032225500 ; JORFTEXT000044546235 ; JORFTEXT000049453263 | P | LO / IN | oui / partiel | `conso_fr` |
| P2 | Consommation | Juge | CJUE C-395/25 ; Conseil constitutionnel (QPC) | 62025CJ0395 | CURIA | EL | oui / non | `cjue`, `constit` (à élargir) |

**P3 — décompte par matière** (après harmonisation des priorités divergentes ; COM(2025) 837, classé P2 ou P3 selon les fiches et P1 par les fiches 04 et 05, est remonté en P1) : IA 4 ; cybersécurité 7 ; finance 4 ; plateformes 1 ; données/santé 2 ; probité 10 ; durabilité 11 ; consommation 2. Total 41.

## 5. Constats transverses

### 5.1 Le DDADUE (Sénat n° 118, T.A. n° 63, AN n° 2518) porte trois désignations et un rattachement contesté

Texte adopté par le Sénat le 18 février 2026, transmis à l'Assemblée nationale le 20 février 2026, aucune lecture achevée au 20 novembre 2026. Article par article, d'après les fiches :

- **Art. 24 — IA** (identifié par la fiche 05 ; contenu lu au T.A. 63). Crée le titre nouveau de la LIL (art. 124-10 à 124-17) : CNIL pour les pratiques interdites c) à h) de l'art. 5 §1 (art. 124-10), pour le haut risque de l'annexe III points 1, 4, 6, 7 et 8, point 3 hors formation professionnelle, point 5 sauf crédit et assurance (art. 124-11), pour la transparence de l'art. 50 §3 (art. 124-12), avec les pouvoirs d'enquête de la LIL (art. 124-14). Modifie le code de la consommation (35° de L. 511-7 : DGCCRF pour les pratiques a) et b) et la transparence), la loi 1986 (art. 20-12 et 20-13 : Arcom), le code de la défense (L. 1340-1 à L. 1340-7 : infrastructures critiques, autorité désignée par décret), la LCEN (art. 55-1 à 55-6 : coordination, PEReN, ANSSI) et le CJA (L. 116-1 : le Conseil d'État contrôle ses propres systèmes).
- **Art. 24 bis — habilitation.** Ordonnance dans les six mois : adaptation outre-mer, conditions d'accès aux bacs à sable et essais en conditions réelles (art. 57 à 61 du règlement), désignation des autorités de protection des droits fondamentaux (art. 77).
- **Art. 25 — Data Act.** Insère l'art. 35-1 dans la loi 2024-449 : l'Arcep est l'autorité compétente **à l'exception du chapitre VII**, avec pouvoirs d'information et d'enquête (CPCE L. 32-4, L. 32-5), sanctions selon L. 36-11 (3 % du CA, 5 % en récidive, ou 150 000 € et 375 000 €), traitement des réclamations (L. 36-8) et certification des organes de règlement des litiges (art. 10 §5). Art. 35-2 : extension à Saint-Barthélemy et Saint-Pierre-et-Miquelon.
- **Art. 35 — TTPA.** Désigne l'Arcom (marquage et transparence, art. 22 §4 du règlement) et la CNIL (ciblage) ; crée les art. 20-9 à 20-11 de la loi 1986. Le TTPA est applicable, la désignation ne l'est pas.
- **Art. 20 et 21 — 2024/825 (rattachement contesté).** Transposent selon la fiche 08 la directive sur les allégations environnementales (code de la consommation L. 121-2 à L. 121-4, L. 111-1, L. 221-5, L. 221-14 ; code de l'environnement). La fiche 08 les rattache à un « DDADUE 2025 » et à un rapport Sénat n° 300, alors que les fiches 01, 04 et 05 rattachent le texte transmis au n° 118, au T.A. 63 et à un rapport n° 337 — contradiction signalée en § 5.6 ; ne pas les compter parmi les trois désignations établies avant vérification du dossier parlementaire.

Conséquence : trois matières (IA, données, plateformes) dépendent de trois articles d'un même texte, et un quatrième volet (consommation) lui est rattaché sans certitude : l'échec ou l'amendement du DDADUE retarde plusieurs chaînes de contrôle à la fois.

### 5.2 La loi résilience (T.A. AN n° 366) porte NIS2, CER et DORA

Adoptée par l'Assemblée nationale le 17 novembre 2026, transmise au Sénat, CMP non vérifiée. Titre I (art. 1er) : résilience des activités d'importance vitale, transposition de la CER, réécriture du chapitre II du titre III du livre III de la première partie du code de la défense. Titre II (art. 5 à 37 ter) : cybersécurité, transposition de NIS2 — art. 5 (ANSSI), 25 (injonctions), 26 et 26 A (agents assermentés), 35 (manquements), 36 (commission des sanctions), 37 (amendes 10 M€ ou 2 %, 7 M€ ou 1,4 %, administrations exclues). Titre III (art. 34 et suivants, 43 A à 63) : modifications sectorielles, dont la transposition de la directive 2022/2556 et les canaux uniques de déclaration DORA (CMF L. 612-24-1 et L. 621-9-4), avec report au 17 juillet 2027 pour certaines sociétés de financement (art. 62). Aucun décret d'application pris ; le numéro de la future loi est laissé en blanc.

### 5.3 Accès : un canal officiel par famille de sources, et sept sources fermées

- **EUR-Lex** renvoie 202 sans contenu (WAF) dans les huit fiches. Le canal de remplacement est **CELLAR** (`publications.europa.eu/resource/celex/...`, XHTML, `Accept-Language: fra`), qui sert le même JO et répond 200.
- **SPARQL CELLAR** (`publications.europa.eu/webapi/rdf/sparql`) : la fiche 05 le déclare inutilisable (200 mais zéro résultat, y compris sur une requête témoin RGPD, en XML comme en JSON) ; la fiche 07 déclare l'avoir utilisé pour lire les métadonnées et les consolidations. **Contradiction non tranchée** — à rejouer avant de fonder un contrôle de complétude sur cet endpoint.
- **Légifrance** renvoie 403 (Cloudflare) aux requêtes automatisées dans les fiches 03, 06 et 08 ; la fiche 07 le dit bloqué pour `curl` mais lisible en HTTP ordinaire. Canal de remplacement : **API PISTE** (`consult/legiPart`, `consult/code`, `getArticleWithIdAndNum`) et dumps DILA. Le JORF passe par l'API JORF.
- **Sites d'autorités fermés** : `cyber.gouv.fr` (Incapsula : doctrine ANSSI, SecNumCloud, produits qualifiés, licence), `economie.gouv.fr` et DGCCRF (Cloudflare, HTTP 429 : sanctions, fiches accessibilité, bureau de liaison CPC, page CEDEF des CJIP), `acpr.banque-france.fr` (403 : doctrine et décisions de la commission des sanctions, P1), `oecd.org` (Cloudflare : convention de 1997), `tribunal-de-paris.justice.fr` (maintenance), `signal.conso.gouv.fr` (maintenance), `h2a-france.org` (non ouvert). Ce qui en dépend est identifié comme non vérifié dans les fiches, jamais reconstitué.
- **Accessibles** : `amf-france.org`, `esma.europa.eu`, `eba.europa.eu`, `data.gouv.fr`, `gels-avoirs.dgtresor.gouv.fr` (API JSON), `assemblee-nationale.fr`, `senat.fr`, `courdecassation.fr`, `arcom.fr`, `defense-droits.fr`, `hatvp.fr`, `agence-francaise-anticorruption.gouv.fr` (PDF sans API).

### 5.4 Licences : ce qui est sûr, ce qui est présumé, ce qui reste à établir

- **Sûres** : Licence Ouverte 2.0 (Légifrance, JADE et `opendata.justice-administrative.fr`, Judilibre, data.gouv.fr, registre national des gels, HATVP `fr-lo`) ; réutilisation EUR-Lex au titre de la décision 2011/833/UE, citée partout mais **relue nulle part**.
- **Présumées** : Sénat, Assemblée nationale, ministère de la Justice, DGCCRF, AFA (etalab-2.0 en pied de page, non vérifiée page par page), Défenseur des droits, PNF.
- **Non établies** : ACPR, AMF, Arcom, Autorité de la concurrence, ENISA (reproduction avec mention, pas de licence ouverte), Bureau de l'IA, ABE, AEMF, AEAPP, AMLA, H2A, EFRAG, CEPD, Cour de cassation (site), ESMA. Aucune ingestion intégrale de ces sources avant arbitrage : la loi ne suffit pas, il faut la mention et la licence.
- **Exclues par nature** : normes harmonisées EN (droit d'auteur, vente AFNOR) — seules les références au JO sont ingérables ; décisions des organes certifiés de règlement des litiges du Data Act (privées).

### 5.5 Périmètre du serveur : quatre corpus de décisions sont filtrés sur les données personnelles

`ce`, `cc`, `cjue` et `constit` ne couvrent que les données personnelles ; `textes_fr` s'arrête au décret 2019-536, au code pénal 226-16 à 226-24 et au CPCE L. 34-5 ; `preparation` ne contient ni l'Omnibus ni le projet de loi résilience (recherche MCP du 20.11.2026). Les nouvelles matières rendent ce filtrage structurellement faux : une question « sanction ACPR » ou « devoir de vigilance » ne peut pas être servie par `ce` en l'état.

Deux options, non exclusives : élargir le filtre des corpus existants (coût : re-collecte et re-classification, risque de noyer la recherche par similarité) ; créer des corpus de décisions par autorité (AFA, ACPR, AMF, Arcom, H2A, Commission DSA/DMA, DGCCRF), adossés à un corpus de texte par matière. La seconde est préférable pour les autorités à faible volume et forte valeur (AFA : 5 décisions ; Arcom : décisions 42-7), la première pour les juridictions (CE, cass., CJUE), dont le volume impose un filtre par visa plutôt qu'un corpus séparé.

### 5.6 Corrections du coordinateur, à intégrer telles quelles

- **Recours contre les sanctions ACPR** = Conseil d'État, pleine juridiction (**CMF L. 612-16**) — *à confirmer sur Légifrance*. La fiche 03 n'a lu aucune disposition désignant la juridiction et n'a vu la règle que dans un extrait de la page « Procédure disciplinaire » de l'ACPR, site inaccessible ; la référence L. 612-16 est donc une correction externe, pas une lecture.
- **Recours contre les sanctions AMF** = Conseil d'État pour les personnes et entités régulées, cour d'appel de Paris pour les autres (**CMF L. 621-30**) — *à confirmer sur Légifrance*. La fiche 03 lit dans L. 621-30, dernier alinéa, un renvoi au recours « sans désigner la juridiction » ; la répartition CE / CA Paris est une correction externe.

**Contradictions relevées entre fiches** (signalées, non tranchées) : (1) SPARQL CELLAR, inutilisable pour la fiche 05, utilisé pour la fiche 07 ; (2) DDADUE, trois références parlementaires pour un même texte (Sénat n° 118 et rapport n° 337 dans les fiches 01, 04 et 05 ; rapport n° 300 dans la fiche 08) alors que le numéro AN n° 2518 et la date du 18 février 2026 sont communs ; (3) accès Légifrance, 403 pour les fiches 03, 06 et 08, lisible en HTTP pour la fiche 07 ; (4) recours ACPR et AMF, « non lu sur un texte » dans la fiche 03, articles précisés par la correction du coordinateur ; (5) date d'adoption du T.A. 63, 18 février selon le dossier, 19 février selon `vie-publique.fr` (écart interne à la fiche 05).

## 6. Plan en lots

Ordre : P1 avant P2 ; sources accessibles par un canal déjà utilisé (CELLAR, PISTE) avant le scraping HTML/PDF ; droit en vigueur avant droit en navette ; textes avant doctrine et décisions, qui n'ont de sens qu'adossés au texte ; transverse en dernier. Aucune date calendaire n'est fixée : l'ordre suffit.

### Lot 1 — Ingérer le socle cyber UE

- Matière : cybersécurité. Sources : `32022L2555`, `32024R2690` (OJ `L_202402690`, CELEX non résolu), `32022L2557`, `32024R2847`, `32025R2392`. Corpus : `cyber` (nouveau). Canal : CELLAR XHTML FR.
- Acceptation : `etat_corpus` montre 5 documents ; NIS2 art. 34 (10 M€ ou 2 %), CRA art. 64 (15 M€ ou 2,5 %), CER art. 26 (transposition 17.10.2024) retrouvés par `search` ; `decisions_citant 32022L2555` ne renvoie plus « document inconnu ».
- Dépendances : aucune. Risques : CELEX 2024/2690 non résolu (ingérer par identifiant OJ) ; CRA en application échelonnée (art. 71), ne pas dater le corpus au 11.12.2027.

### Lot 2 — Ingérer DORA et ses actes de niveau 2

- Matière : finance. Sources P1 : `32022R2554`, `32022L2556`, `32024R1774`, `32024R1772`, `32024R1773`, `32024R2956`, `32025R0301`, `32025R0532`. Corpus : `dora` (nouveau). Canal : CELLAR.
- Acceptation : 8 documents ; DORA art. 19 (délais 4 h, 24 h, 72 h, un mois) et art. 31-44 présents ; `etat_corpus` compte les unités des 13 textes annoncés une fois les 5 P2/P3 ajoutés.
- Dépendances : aucune. Risques : aucune consolidation CELLAR de DORA trouvée (`02022R2554-…` inexistant) — ingérer l'acte d'origine et documenter l'absence de consolidation avant d'affirmer qu'il n'est pas modifié.

### Lot 3 — Ingérer le paquet LCB-FT et le gel des avoirs

- Matière : finance. Sources : `32024R1624`, `32024L1640`, `32024R1620`, `32023R1113`, `32015L0849`, `32014R0833`, `32014R0269`. Corpus : `lcbft` et `gel` (nouveaux). Canal : CELLAR, **par consolidation datée** pour 833/2014 et 269/2014.
- Acceptation : 7 documents ; AMLR art. 3 (assujettis) et art. 68 (sanctions) présents ; les deux règlements de gel portent une date de consolidation, pas leur version d'origine.
- Dépendances : aucune. Risques : amendements continus des règlements de gel ; ne jamais ingérer l'acte d'origine seul.

### Lot 4 — Ingérer DSA, DMA et leurs actes

- Matière : plateformes. Sources : `32022R2065`, `32022R1925`, `32019R1150`, `32024R0900` ; actes `32025R2050`, `32023R1127`, `32024R0436`, `32023R1201`, `32024R2835`, `32023R0814`. Corpus : `plateformes` (nouveau). Canal : CELLAR.
- Acceptation : 10 documents ; DSA art. 56 (compétence exclusive VLOP) et art. 74 (6 %), DMA art. 30 (10 %) présents.
- Dépendances : aucune. Risques : liste des actes postérieurs à 2025 à reconstituer par la relation « based on » une fois l'endpoint SPARQL validé (§ 5.3).

### Lot 5 — Ingérer Data Act, DGA, Open Data et EHDS

- Matière : données/santé. Sources : `32023R2854`, `32022R0868`, `32019L1024`, `32025R0327` ; `32023R0138`, `32018R1807`, `32026R0771`, `32026R2083`, `32026R2098`. Corpus : `donnees` et `ehds` (nouveaux). Canal : CELLAR.
- Acceptation : 9 documents ; Data Act art. 37 et 40, EHDS art. 19 et 55 présents ; `etat_corpus` distingue les deux corpus.
- Dépendances : aucune. Risques : EHDS fait 471 864 caractères en XHTML FR — vérifier la découpe par chapitre ; ne pas conclure de l'absence d'un acte d'exécution à son inexistence (liste non consolidée).

### Lot 6 — Ingérer CSRD, ESRS, CSDDD et EUDR

- Matière : durabilité. Sources : `32022L2464`, `32026L0470`, `32023R2772`, `32026R1563`, `32024L1760`, `32023R1115`, `32024R3234`, `32025R2650`. Corpus : `durabilite` (nouveau). Canal : CELLAR.
- Acceptation : 8 documents ; CSDDD art. 27 (3 %) et EUDR art. 25 (4 %) présents ; les ESRS set 2 sont composés depuis `32026R1563` seul, la consolidation CELLAR s'arrêtant au 1.1.2025.
- Dépendances : aucune. Risques : seuils et articles modifiés par l'Omnibus I — ne pas ingérer la CSDDD de 2024 sans sa consolidation `02024L1760-20260318` ; normes ESRS volumineuses (annexes).

### Lot 7 — Ingérer le socle consommation UE

- Matière : consommation. Sources : `32005L0029`, `32011L0083`, `31993L0013`, `32019L2161`, `32024L0825`, `32020L1828`, `32023R0988`, `32019L0882`, `32024L2853`, `32017R2394`. Corpus : `consommation` (nouveau). Canal : CELLAR.
- Acceptation : 10 documents ; PCD consolidation `02005L0029-20260927` et ses points 2 bis à 4 quater, GPSR art. 44, CPC art. 5 présents.
- Dépendances : aucune. Risques : 2024/825 est applicable depuis le 27.9.2026 sans transposition française — le corpus doit refléter la directive, pas le droit français.

### Lot 8 — Ingérer la directive corruption et les lanceurs d'alerte

- Matière : probité. Sources : `32026L1021`, `32019L1937`. Corpus : `probite` (nouveau). Canal : CELLAR.
- Acceptation : 2 documents ; 2026/1021 art. 14 §3 (5 % ou 40 M€), art. 19 §1 (8 ans) et art. 22 (organismes nationaux) présents.
- Dépendances : aucune. Risques : transposition due au 1.6.2028, aucun texte français déposé — corpus de droit de l'Union seulement.

### Lot 9 — Compléter aiact

- Matière : IA. Sources : `32026D2274`, `32025R0454`, `32023R1230`, `32026D1080`, `32019R1020`, `32024L2853`. Corpus : `aiact` (extension, sans re-consolider le texte de base). Canal : CELLAR.
- Acceptation : `aiact` passe de 1 à 7 documents ; `search` retrouve EN 18286:2026 et 2019/1020 art. 14 dans `aiact` ; la consolidation `02024R1689-20260727` reste inchangée (aucune régression de `etat_corpus`).
- Dépendances : lot 7 pour `32024L2853` (éviter le doublon). Risques : ne pas dupliquer le texte de base ; 2026/1081 introuvable, ne pas l'inventer.

### Lot 10 — Ingérer les textes français de cyber et de finance

- Matières : cybersécurité, finance. Sources : `LEGIARTI000028345191`, `LEGIARTI000028342544`, `LEGIARTI000047922728`, `JORFTEXT000036644772`, `JORFTEXT000036939971`, `LEGIARTI000047052655` ; CMF `LEGITEXT000006072026`, `LEGIARTI000036824564`, `LEGIARTI000051740660`, `LEGIARTI000051556833`, `LEGIARTI000053782430`, `JORFTEXT000042992976`. Corpus : `cyber_fr` et `lcbft_fr` (nouveaux). Canal : PISTE `legiPart` et `consult/code`, API JORF.
- Acceptation : les 6 textes cyber et les 6 blocs CMF présents ; NIS2 art. 34 et CMF L. 612-40 retrouvés par article ; `etat_corpus` montre deux corpus distincts.
- Dépendances : aucune. Risques : Légifrance 403 sur certaines requêtes (PISTE obligatoire) ; versions en vigueur au 20.11.2026 à figer par date de consultation.

### Lot 11 — Ingérer les textes français de plateformes et de consommation

- Matières : plateformes, consommation. Sources : `JORFTEXT000000801164`, `JORFTEXT000049563368`, `JORFTEXT000000512205`, `JORFTEXT000028352737`, `JORFTEXT000050385836` ; `LEGITEXT000006069565`, `JORFTEXT000048178349`. Corpus : `plateformes_fr`, `conso_fr` (nouveaux). Canal : PISTE et JORF.
- Acceptation : LCEN art. 7, loi 1986 art. 42-7 et 42-11, code de la consommation L. 522-1 et L. 132-2 présents ; délibération Arcom 2024-20 ingérée comme doctrine.
- Dépendances : aucune. Risques : loi 1986 lue en renvoi seulement (`LEGITEXT000006068930` non ouvert) ; loi 2025-391 sans identifiant JORFTEXT — à retrouver avant ingestion.

### Lot 12 — Ingérer les textes français de données, de santé et de probité

- Matières : données/santé, probité. Sources : `LEGITEXT000031366350` (CRPA livre III), loi 2024-449 titre III, CSP L. 1111-8 et R. 1111-8-8 s., décret 2026-209 (TRIS 2026/0452/FR), CPCE L. 36-11 ; `LEGITEXT000033561874`, `LEGITEXT000045389525`, `LEGIARTI000049778681`, `LEGITEXT000046357757`, `LEGITEXT000028057465`. Corpus : `donnees_fr`, `sante_fr`, `probite_fr` (nouveaux). Canal : PISTE et JORF.
- Acceptation : CRPA L. 321-1 et L. 324-1, CPCE L. 36-11, CPP 41-1-2, art. 17 de la loi 2016-1691 présents ; décret 2026-209 porte sa référence lue sur Légifrance, pas seulement sur TRIS.
- Dépendances : aucune. Risques : véhicule de transposition de la directive 2019/1024 non identifié — ne pas présenter le CRPA comme transposé ; décret 2026-209 non lu sur Légifrance à ce jour.

### Lot 13 — Ingérer les textes français de durabilité

- Matière : durabilité. Sources : loi 2017-399, C. com. L. 225-102-1, L. 225-102-2, L. 232-6-3, L. 233-28-4, L. 238-1, L. 820-1, L. 821-70 à L. 821-85 ; ordonnance 2023-1142 ; décret 2023-1394. Corpus : `durabilite_fr` (nouveau). Canal : PISTE et JORF.
- Acceptation : les articles de vigilance et de certification présents ; L. 225-102-2 lu sur sa page, pas déduit d'un renvoi ; `etat_corpus` montre le corpus.
- Dépendances : aucune. Risques : renumérotation au 1.1.2025 (ex-L. 225-102-4 et ex-L. 225-102-5) ; aucune transposition de l'Omnibus I, les seuils français restent ceux de la CSRD d'origine.

### Lot 14 — Créer les corpus de doctrine des autorités

- Matières : IA, probité, durabilité, plateformes, cybersécurité. Sources : CNIL fiches IA (13 + synthèse), AFA (recommandations, guides 2026), Bureau de l'IA (5 LD, 2 codes), H2A (lignes directrices janvier 2026), Arcom (référentiel 2024-20), ENISA. Corpus : `cnil_doctrine` (extension), `afa`, `aiact_doctrine`, `h2a`, `arcom`, `cyber_doctrine`. Canal : HTML/PDF des éditeurs — **premier lot de scraping**, donc après tous les lots CELLAR et PISTE.
- Acceptation : `cnil_doctrine` gagne les fiches IA sans perdre les 56 documents existants ; `afa` contient les recommandations et les 3 guides ; `aiact_doctrine` contient 7 documents datés.
- Dépendances : lot 9 (aiact), lot 13 (H2A). Risques : pas de licence affichée pour la CNIL et le Bureau de l'IA (CC BY-ND 4.0 appliquée par le corpus pour la CNIL, à confirmer) ; pages PDF sans pagination stable (AFA : 111 ressources, 12 pages).

### Lot 15 — Ingérer les décisions des autorités

- Matières : probité, plateformes, finance. Sources : AFA, 5 décisions (4.7.2019, 7.2.2020, 7.7.2021, 20.10.2021, 9.7.2026) ; CJIP publiées (271 PDF, page justice.gouv.fr) ; Arcom (décision 2026-405, mises en demeure du 3.2.2026) ; Commission (IP/26/1178, IP/25/1085, IP/26/1670) ; ACPR et AMF **sous réserve d'accès**. Corpus : `afa`, `arcom`, `plateformes_doctrine`, `acpr`, `amf`.
- Acceptation : 5 décisions AFA, 5 décisions de la Commission (Temu ; Apple ; Meta ; Google Search ; Google Play) issues de 3 communiqués, 2 décisions Arcom ; chaque décision porte sa date et son numéro ; `decisions_citant` sur le texte de rattachement les retrouve.
- Dépendances : lot 14 pour la structure des corpus ; ACPR bloquée (403). Risques : décisions AFA anonymisées sans identifiant stable ; volume CJIP non décompté (ordonnances et communiqués mêlés) ; licence ACPR et AMF non établie.

### Lot 16 — Élargir le périmètre des corpus de décisions (transverse)

- Matières : toutes. Sources : `ce`, `cc`, `cjue`, `constit`, aujourd'hui filtrés sur les données personnelles. Cible : filtre par visa et par matière sur les mêmes flux (JADE, Judilibre, CURIA, CONSTIT) plutôt que nouveaux corpus ; corpus séparés pour les autorités à faible volume (AFA, ACPR, AMF, Arcom, H2A, DGCCRF, Commission DSA/DMA).
- Acceptation : une requête « sanction ACPR », une requête « devoir de vigilance » et une requête « pratiques restrictives » renvoient au moins une décision chacune ; les décisions déjà ingérées en données personnelles ne sont pas perdues ; `etat_corpus` expose le nouveau filtre.
- Dépendances : lots 15 et 13. Risques : re-classification de volume (bruit en recherche par similarité) ; licences AMF, ACPR, Arcom, DGCCRF non établies ; `cc` couvre aussi le pénal de la probité, à ne pas fragmenter.

### Lot 17 — Ingérer les textes en navette

- Matières : IA, données, plateformes, consommation, cyber, finance. Sources : DDADUE (Sénat n° 118, T.A. 63, AN n° 2518) ; loi résilience (T.A. 366). Corpus : `preparation` (extension). Canal : HTML/PDF Sénat et Assemblée nationale.
- Acceptation : les deux textes présents avec leur stade et leur date ; `search` retrouve l'art. 24 (IA), l'art. 25 (Data Act), l'art. 35 (TTPA) et l'art. 5 (ANSSI) ; `etat_corpus` les compte.
- Dépendances : aucune, mais à faire **après** les lots de droit en vigueur. Risques : trois références parlementaires pour le DDADUE (§ 5.6) — ingérer les deux versions (T.A. 63 et AN 2518) et laisser la contradiction visible ; texte modifié à chaque lecture, dater chaque capture.

### Lot 18 — Veiller les textes en préparation (transverse)

- Matières : toutes. Sources à suivre : DDADUE, loi résilience, Digital Omnibus `COM(2025) 837` (`2025/0360(COD)`, mandat Conseil `ST 14756/26`), CSA 2 `COM(2026) 11`, NIS2 `COM(2026) 13`, DFA `COM(2026) 1100`, CPC `COM(2026) 1120`, SFDR `COM(2025) 841`, actes délégués et d'exécution attendus (AI Act art. 6, 27, 51, 72, 92, 101 ; CRA « présomption EUCC » T4 2026 ; EHDS mars 2027 ; RTS ALBC ; transpositions 2026/1021, Omnibus I, CSDDD, 2024/1799, 2024/2853, 2019/1024).
- Acceptation : `preparation` contient chaque proposition avec son numéro COM, son code de procédure et son stade ; `etat_corpus` signale la date de dernière veille ; une recherche sur « Digital Omnibus » et sur « loi résilience » renvoie un document.
- Dépendances : lots 17 et 16. Risques : stades non vérifiés sur OEIL pour CSA 2, NIS2 et l'Omnibus ; plusieurs COM sans code de procédure lu (DFA, CPC, SFDR) ; ne pas créer de corpus par texte, la veille est transversale.

## 6 bis. Ordre d'intégration retenu

> **Décision du 21/11/2026 : périmètre réduit aux vagues 1 à 5** (RGPD, IA, données et santé, cybersécurité, plateformes). Les vagues 6 à 11 sont notées pour plus tard dans [20-plus-tard.md](20-plus-tard.md), sans ticket.

Arbitrage du coordinateur. **Cet ordre remplace la numérotation des lots de la section 6**, qui reste la référence pour le contenu de chaque lot (sources, critères d'acceptation, risques).

Deux critères :
- **Facilité.** 1 = corpus existant ou chaîne déjà en place (CELLAR par CELEX, PISTE par LEGITEXT, scraper CNIL, `preparation`). 2 = nouveau corpus de textes par un canal connu. 3 = scraping d'un nouveau site, ou changement d'architecture.
- **Proximité avec les données personnelles.** Partir de ce qu'un juriste RGPD connaît déjà, puis aller vers les matières qui réutilisent ses notions (traitement, sécurité, notification, profilage), et finir par les matières éloignées.

Règle : pour chaque matière, le texte UE puis le texte français, pour qu'une matière soit utilisable de bout en bout avant d'ouvrir la suivante.

| Rang | Étape | Lots d'origine | Facilité | Lien avec les données personnelles |
|---|---|---|---|---|
| **Vague 1 — Combler les trous du RGPD** ||||
| 1 | Ajouter la décision 2021/915 (clauses types de l'art. 28) au corpus `ccs` | nouveau (absent des lots) | 1 | Les clauses types sous-traitant manquent, alors que les clauses de transfert 2021/914 y sont |
| 2 | Ajouter les articles « données personnelles » des codes français à `textes_fr` : C. trav. L1121-1, L1222-4, L2312-38 ; CSP L1110-4, L1111-7, L1111-8 ; CSI L251-1 s. ; CMF L561-45 ; CRPA L311-3-1 ; C. civ. 9 ; C. pén. 226-1, 226-8-1, 323-1 à 323-8 | nouveau (diff donneespersonnelles.fr) | 1 | Questions RGPD sectorielles quotidiennes : salariés, santé, vidéoprotection |
| 3 | Mettre le Digital Omnibus COM(2025) 837 dans `preparation` | 18 (part) | 1 | Il modifie le RGPD et ePrivacy |
| 4 | Ajouter les fiches IA de la CNIL à `cnil_doctrine` | 14 (part) | 1 | Même éditeur et même chaîne que la doctrine CNIL existante |
| **Vague 2 — L'IA, déjà à moitié dans Vitrine** ||||
| 5 | Compléter `aiact` (2019/1020, EN 18286 en référence, 2023/1230, 2026/1080) | 9 | 1 | AI Act déjà consolidé ; la CNIL sera autorité de surveillance |
| 6 | Créer `aiact_doctrine` : lignes directrices et codes du Bureau de l'IA | 14 (part) | 3 | Les lignes directrices sur les pratiques interdites et la transparence recoupent le RGPD |
| **Vague 3 — Données et santé** ||||
| 7 | Data Act, DGA, Open Data, EHDS | 5 | 2 | Articulation explicite avec le RGPD ; données de santé |
| 8 | Textes français données et santé : CRPA livre III, CSP (HDS), CPCE L36-11, loi SREN titre III | 12 (part données/santé) | 2 | Hébergement de données de santé, CADA |
| **Vague 4 — Cybersécurité** ||||
| 9 | NIS2, 2024/2690, CER, CRA, 2025/2392 | 1 | 2 | Prolonge l'art. 32 (sécurité) et les art. 33-34 (notification) du RGPD |
| 10 | Textes français cyber : Code de la défense (OIV), loi 2018-133, décret 2018-384 | 10 (part cyber) | 2 | Mêmes questions de sécurité et de notification |
| 11 | Loi résilience (T.A. 366) dans `preparation` | 17 (part) | 2 | Elle désignera l'ANSSI pour NIS2 |
| **Vague 5 — Plateformes** ||||
| 12 | DSA, DMA, P2B, publicité politique et leurs actes | 4 | 2 | Publicité ciblée, profilage, mineurs (DSA art. 26 et 28), données sensibles |
| 13 | Textes français plateformes : LCEN, loi SREN, loi de 1986, décret 2013-1196 | 11 (part plateformes) | 2 | Arcom coordinateur ; vérification d'âge, avec avis CNIL |
| 14 | DDADUE (T.A. 63 et AN 2518) dans `preparation` | 17 (part) | 2 | Il désigne les autorités IA, Data Act et publicité politique, dont la CNIL |
| **Vague 6 — Décisions des juridictions** ||||
| 15 | Élargir `ce`, `cc` et `cjue` par un filtre sur le texte visé | 16 | 3 | Chaînes de collecte existantes ; changement d'architecture, décision utilisateur préalable |
| **Vague 7 — Lanceurs d'alerte et probité** ||||
| 16 | Directive 2019/1937, loi 2016-1691 modifiée, décret 2022-1284 | 8 et 12 (part) | 2 | Le dispositif d'alerte est un traitement encadré par un référentiel CNIL |
| 17 | Directive corruption 2026/1021, Sapin II, C. pén. 432-11 s., CPP 41-1-2 | 8 et 12 (part) | 2 | Faible |
| **Vague 8 — Consommation** ||||
| 18 | Socle UE consommation, puis Code de la consommation | 7 et 11 (part) | 2 | Interfaces trompeuses, cookies, prospection : la DGCCRF croise la CNIL |
| **Vague 9 — Finance** ||||
| 19 | DORA et ses actes de niveau 2 | 2 | 2 | Notification d'incidents, sous-traitance TIC |
| 20 | LCB-FT et gel des avoirs, puis CMF | 3 et 10 (part finance) | 2 | Les traitements LCB-FT sont encadrés par la CNIL (CMF L561-45) |
| **Vague 10 — Durabilité** ||||
| 21 | CSRD, ESRS, CSDDD, EUDR, puis textes français | 6 et 13 | 2 | Aucun |
| **Vague 11 — Doctrine et décisions des autorités (scraping)** ||||
| 22 | Doctrine : AFA, H2A, Arcom, ENISA | 14 (reste) | 3 | Faible ; licences à établir site par site |
| 23 | Décisions : AFA, Commission DSA/DMA, Arcom, CJIP ; ACPR et AMF si l'accès est ouvert | 15 | 3 | Faible ; ACPR bloquée (403) |
| **En continu** ||||
| — | Veille des textes en préparation : suivre chaque texte dès que sa matière est ouverte | 18 | 1 | — |

Pourquoi cet ordre :
- **Vagues 1 et 2** : uniquement des corpus existants, presque tout en facilité 1. C'est utile tout de suite à un juriste RGPD et sans risque pour le serveur.
- **Vagues 3 à 5** : les trois matières qui réutilisent le plus les notions RGPD. Ce sont des textes UE et français, par CELLAR et PISTE, sans scraping.
- **Vague 6, entre les deux** : élargir les décisions devient nécessaire dès que trois nouvelles matières existent. Il faut la décision d'architecture de la section 5.5 avant de la lancer.
- **Vagues 7 à 10** : par proximité décroissante avec les données personnelles. Les lanceurs d'alerte passent en tête, car ce sont des dispositifs que la CNIL encadre.
- **Vague 11 en dernier** : scraping de sites sans API, licences non établies, et sites partiellement fermés aux robots.

## 7. Points à vérifier avant ingestion

Liste consolidée et dédoublonnée des sections 10 des fiches, groupée par matière. « Non lu » signifie : identifiant non ouvert sur la source officielle, à contrôler avant de l'écrire dans un corpus.

**Transverse (8 fiches).**
1. EUR-Lex : 202 sans contenu (WAF) — ne jamais fonder une vérification sur ce site ; CELLAR est le canal.
2. SPARQL CELLAR : inutilisable selon la fiche 05, utilisé selon la fiche 07 — rejouer une requête témoin avant de s'en servir pour un contrôle de complétude.
3. Légifrance : 403 sur `curl` (fiches 03, 06, 08), lisible en HTTP ordinaire (fiche 07) — fixer un seul canal (PISTE) et le documenter.
4. Licences : décision 2011/833/UE jamais relue ; licences ACPR, AMF, Arcom, AdlC, DGCCRF, ENISA, Bureau de l'IA, AES, AMLA, H2A, EFRAG, CEPD non établies.
5. Décision 2011/833/UE et Licence Ouverte 2.0 : citer la version lue, pas la présomption.

**IA.**
6. Décision instituant le Bureau de l'IA, C(2024) 390 — non lue.
7. Références des lignes directrices C(2025) 884 et C(2025) 924 — non lues.
8. Convention-cadre du Conseil de l'Europe : `2026/1081` introuvable dans CELLAR (404), ratifications et entrée en vigueur inconnues.
9. 2019/1020 : CELEX `32019R1020` non lu sur source alors qu'il porte la procédure de surveillance.
10. Procédure de l'Omnibus IA : code `2025/359` lu, type d'acte et numéro COM non confirmés.
11. T.A. 63 : articles 24 ter à 24 duodecies non ouverts un par un ; répartition ANSM/ACPR/DGCCRF/annexe I partielle.
12. Juridiction de recours contre les futures sanctions IA : non fixée par le texte.
13. Accès machine aux publications du Bureau de l'IA : aucune API identifiée.
14. Base de données de l'art. 71 : API ou export inconnu.
15. Normes harmonisées en cours : numéros et statuts non vérifiés ; statut final des orientations art. 73 et de la LD art. 6 : aucune version finale.

**Cybersécurité.**
16. Stade exact de COM(2026) 11, COM(2026) 13 et COM(2025) 837 : OEIL n'affiche pas la rubrique « stage reached ».
17. CELEX `32024R2690` ne se résout pas — confirmer l'identifiant OJ `L_202402690`.
18. Actes d'exécution eIDAS : liste, numéros et dates non vérifiés.
19. Juridiction de recours contre la commission des sanctions (L. 1332-18) : CE probable, non établi.
20. ANSSI : site bloqué ; licence, versions des référentiels, produits qualifiés et rôle de MonEspaceNIS2 non vérifiés ; « autorisation préalable pour l'exploitation commerciale » non confirmée.
21. SecNumCloud : version, date et valeur normative non vérifiées ; loi SREN art. 31 (cloud de confiance) non vérifiée.
22. Décret 2009-834 (création de l'ANSSI) : non vérifié et probablement inutile, la base étant L. 2321-1.
23. Acte délégué CRA « présomption EUCC » : sans numéro.
24. Jurisprudence cyber : aucune recherche systématique (CJUE, CE, cass. crim.).

**Finance.**
25. Recours ACPR, AMF et CNS : aucune disposition du CMF lue ne désigne la juridiction ; appliquer les corrections du § 5.6 **après** confirmation sur Légifrance.
26. Doctrine ACPR (lignes directrices, principes sectoriels) : identifiants, dates et versions non lus (403).
27. TRACFIN : aucun identifiant vérifié (rapport annuel, lignes directrices).
28. Décisions de la commission des sanctions ACPR : format, numérotation et volume non vérifiés (403).
29. COM(2025) 837 : CELEX lu dans un résultat, texte non ouvert ; l'art. 8 DORA vient d'un extrait.
30. Consolidations : DORA sans consolidation CELLAR ; 833/2014 et 269/2014 lus en version d'origine — ingérer par consolidation datée.
31. Surveillance directe de l'AMLA : la date de 2028 est au considérant 86, pas dans un article.
32. Directive 2024/1226 : délai expiré (20.5.2025), transposition française non vérifiée.
33. Sanctions DORA en France : application de L. 612-40 par inférence, non par disposition lue.

**Plateformes.**
34. TTPA : date d'application (10 ou 15 octobre 2025) et actes délégués sur le dépôt européen non vérifiés.
35. EMFA : art. 13 et 18 non lus ; siège et publications du comité non identifiés.
36. Directive 2000/31/CE : titre français non résolu (CELEX seul).
37. Décisions X (120 M€, décembre 2025) et AliExpress (550 M€, juillet 2026) : aucun communiqué officiel lu.
38. Désignations DMA : liste et dates non vérifiées ; numéros DMA.10xxxx à relever.
39. Recours devant le Tribunal : numéros T-… non vérifiés.
40. Conseil d'État et référentiel Arcom 2024-20 : aucune décision vérifiée ; portée de l'art. 42-11 pour les sanctions LCEN à confirmer ; `LEGITEXT000006068930` non ouvert.
41. Plafonds DSA dans la LCEN (art. 8-1 et 9) : renvoi lu, montants non lus ; loi 2026-813 non lue.
42. Actes délégués et d'exécution postérieurs à 2025 : liste à reconstituer sur CELLAR.

**Données et santé.**
43. Véhicule de transposition de la directive 2019/1024 : aucun identifié ; l'ordonnance 2021-650 est un faux ami (communications électroniques).
44. Registre de l'art. 37 §7 du Data Act : introuvable ; l'absence de désignation française est établie par l'absence de texte, pas par la source européenne.
45. Recommandation « clauses types » : C(2025) 7750 non lue ; publication au JO non trouvée.
46. Décret 2026-209 : référence établie par TRIS 2026/0452/FR, pas par lecture sur Légifrance.
47. Arrêté du 17.11.2025 (frais de transfert à 0 €) et lignes directrices Arcep du 2.7.2026 : sources secondaires seulement.
48. Autorité de l'art. 23 de la DGA (altruisme) et organismes de l'art. 7 : aucune désignation trouvée.
49. Autorité de remplacement pour le chapitre VII du Data Act : l'Arcep est exclue, aucun successeur nommé.
50. Désignations EHDS (art. 19 et 55) : échéance 26.3.2027, aucun texte français identifié.
51. Date d'adoption du T.A. 63 : 18 ou 19 février 2026, écart non tranché.
52. Liste des actes d'exécution et délégués EHDS : les trois lus ne sont pas exhaustifs.

**Probité.**
53. Juridiction de recours contre les sanctions de l'AFA : art. 17 VII sans juridiction nommée ; aucune décision du CE trouvée.
54. Convention OCDE de 1997 : date, référence de publication et instrument d'approbation non lus (site bloqué).
55. CELEX non ouverts : `32003F0568`, `32017L1371`, `32014L0042` — références connues par renvoi seulement.
56. Liste exhaustive des CJIP : 271 PDF sans index ; décompte exact non fait.
57. Licences AFA, Défenseur des droits, PNF : non lues page par page.
58. Loi 2022-401 : rôle exact dans la transposition de 2019/1937 non reconstitué.
59. CPP 41-1-3 : API renvoie un article vide, texte attesté par la page du ministère seulement.
60. Dépôt parlementaire d'un texte de transposition de 2026/1021 : dossiers AN et Sénat non consultés.

**Durabilité.**
61. L. 225-102-2 : numéro déduit d'un renvoi, non lu sur la page de l'article en vigueur.
62. Aucun instrument juridique ne désigne l'autorité EUDR (annonce CGDD/DGPE) ; travail forcé (échéance 14.12.2025), batteries (art. 54) et minerais (art. 10) : non identifiées.
63. Sanctions françaises de la CSRD : aucune infraction spécifique au défaut de rapport de durabilité ; applicabilité des amendes de 3 750 € non établie.
64. ESRS consolidées : la consolidation CELLAR s'arrête au 1.1.2025 — composer le set 2 depuis `32026R1563`.
65. Code de procédure de COM(2025) 841 : non vérifié.
66. Jurisprudence de recevabilité du 18.6.2024 (trois arrêts CA Paris 5-12) : identifiants et contenus non lus.
67. Décisions du Tribunal sur la taxonomie : identifiants relevés, décisions non lues.
68. H2A : inventaire des décisions, licence et lignes directrices de janvier 2026 non vérifiés.
69. AMF : base juridique précise de la compétence sur l'état de durabilité et licence non vérifiées.
70. Batteries : seuil de 40 M€ non recherché dans le texte adopté ; l'art. 48 ne mentionne qu'une date.
71. Faux positif à écarter : Cass. com., 24.6.2026, n° 24-17.980 porte sur un agent commercial, pas sur la vigilance.

**Consommation.**
72. DGCCRF : sanctions, fiches accessibilité et doctrine non lisibles (site bloqué).
73. Bureau de liaison unique CPC : liste officielle non chargée (HTTP 429).
74. SignalConso : statut, API et licence inconnus (site en maintenance).
75. Recours contre les sanctions DGCCRF : aucun article ne l'organise ; qualification et juridiction à confirmer par une décision.
76. Loi 2025-391 et décret 2025-734 : identifiants JORFTEXT non relevés.
77. Arrêté conjoint EAA (L. 412-13) et sanctions de l'accessibilité : non identifiés.
78. Transpositions 2024/1799 et 2024/2853 : aucun texte français trouvé.
79. Directive de simplification du paquet du 11.11.2026 : numéro COM non lu.
80. Autorités EAA autres que la DGCCRF (Arcep, Arcom, transport) : répartition non vérifiée.
81. Décisions d'exécution IMI 2019/2212 et 2019/2213 : non ouvertes ; CNC : composition et publications non vérifiées.
