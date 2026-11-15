---
date: 2026-11-15
ticket: "#40"
question: combien de minutes coûte l'annotation d'une question ?
---

# Kit d'annotation : 10 questions chronométrées

Mesure du temps humain que coûte **une** question annotée, pour remplacer l'hypothèse
3 / 5 / 8 minutes du spike #40 par un chiffre constaté.

## Ce que le kit contient

- 10 questions réelles des jeux `dev` du harnais, sur **8 corpus** : `rgpd` (2), `aiact`, `cnil`
  (doctrine), `lil`, `ce`, `cepd`, `cc`, `cjue`.
- 1 question **multi-fragments** : Q1 attend deux articles du RGPD (`art_44` et `art_45`).
  C'est le seul cas multi-références des jeux `dev` existants ; aucun jeu `dev` ne demande
  aujourd'hui une réponse répartie sur deux documents.
- 1 question **hors périmètre** : Q10 (mentions d'une facture d'électricité), bornée au corpus
  `rgpd`. Le serveur la refuse ; la bonne annotation est « limite signalée ».
- Pour chaque question, la sortie **réelle** du serveur MCP local : niveau de confiance et
  top 5 (`ref`, `chemin`, similarité, extrait).

Aucun split `test` n'est touché et aucun marqueur `*.test-consomme.json` n'est écrit.

## Protocole

1. Chronomètre au lancement de la question, arrêt quand la ligne **Minutes** est remplie.
2. Lire la question, puis, pour chaque passage : **Passage pertinent** = ce passage suffit-il, seul
   ou avec un autre, à répondre à la question ? **Citation exacte** = le texte rendu est-il bien
   celui de la référence affichée (`ref` et `chemin`) ? Ces deux colonnes sont indépendantes : un
   passage hors sujet peut porter une citation exacte.
3. Si aucun passage ne répond, chercher le bon fragment dans le corpus comme pour écrire un jeu
   doré, et **compter ce temps** : c'est le vrai coût, pas la seule relecture du top 5.
4. Q10 : ne pas chercher de passage. Noter si le refus est explicite et juste.
5. Inscrire les minutes avec une décimale (par exemple `4,5`).
6. **Ne pas lire la colonne `attendues` pendant la mesure** : elle sert au dépouillement, et la
   connaître fausserait le temps. Elle figure sous chaque question ; la masquer avant de commencer.

## Dépouillement

À remplir à la fin, sans retoucher les blocs ci-dessous.

| Question | Corpus | Minutes | Attendu trouvé dans le top 5 | Limite signalée |
| --- | --- | --- | --- | --- |
| Q1 | `rgpd` | | | |
| Q2 | `rgpd` | | | |
| Q3 | `aiact` | | | |
| Q4 | `cnil` | | | |
| Q5 | `lil` | | | |
| Q6 | `ce` | | | |
| Q7 | `cepd` | | | |
| Q8 | `cc` | | | |
| Q9 | `cjue` | | | |
| Q10 | `rgpd` (hors périmètre) | | | |

- **Total** : ……… minutes pour 10 questions, soit ……… minutes par question en moyenne.
- Extrapolation à 150 questions : `150 × moyenne / 60` = ……… heures.
- Extrapolation à 1 280 questions (≈ 665 réponses confiantes, 35 par corpus × 19, cf. spike) :
  ……… heures.
- Écart avec l'hypothèse du spike (3 / 5 / 8 min) : ………

## D'où vient la sortie

Produite le 2026-11-15 en lançant le serveur MCP local par stdio
(`node mcp/server.ts`, SDK MCP) et en appelant `search` avec `{ question, k: 5, corpus }`.
Modèle `leoipulsar/harrier-0.6b` (1 024 dimensions, Ollama), index
`data/corpus/index/index.db`, seuils de la table du produit (`seuilsDuCorpus`), recherche dense.
Les extraits sont les 150 premiers caractères du texte rendu, espaces normalisés. L'ordre est celui
du serveur : la bande article de 0,02 fait passer un article devant un considérant, donc la
similarité n'est pas strictement décroissante (Q3).

## Les 10 questions

### Q1 — transfert de données vers un pays tiers hors Union européenne

`questions.csv` · split `dev` · corpus `rgpd` · type `conceptuelle` · attendues : `32016R0679#art_44|32016R0679#art_45` · multi-fragments (deux attendues)

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `32016R0679#art_48` | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.745 | Article 48 Transferts ou divulgations non autorisés par le droit de l'Union Toute décision d'une juridiction ou d'une autorité administrative d'un pay… | oui / non | oui / non |
| 2 | `32016R0679#art_44` | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.735 | Article 44 Principe général applicable aux transferts Un transfert, vers un pays tiers ou à une organisation internationale, de données à caractère pe… | oui / non | oui / non |
| 3 | `32016R0679#art_49` | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.730 | Article 49 Dérogations pour des situations particulières 1. En l'absence de décision d'adéquation en vertu de l'article 45, paragraphe 3, ou de garant… | oui / non | oui / non |
| 4 | `32016R0679#art_50` | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.723 | Article 50 Coopération internationale dans le domaine de la protection des données à caractère personnel La Commission et les autorités de contrôle pr… | oui / non | oui / non |
| 5 | `32016R0679#art_46` | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.715 | Article 46 Transferts moyennant des garanties appropriées 1. En l'absence de décision en vertu de l'article 45, paragraphe 3, le responsable du traite… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q2 — délai d'un mois pour répondre à une demande d'exercice des droits

`questions-v3.csv` · split `dev` · corpus `rgpd` · type `conceptuelle` · attendues : `32016R0679#art_12`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `32016R0679#rct_134` | RGPD > Considérants | 0.719 | (134) Chaque autorité de contrôle devrait, s'il y a lieu, participer à des opérations conjointes avec d'autorités de contrôle. L'autorité de contrôle … | oui / non | oui / non |
| 2 | `32016R0679#art_12` | RGPD > Chapitre III > Droits de la personne concernée | 0.686 | Article 12 Transparence des informations et des communications et modalités de l'exercice des droits de la personne concernée 1. Le responsable du tra… | oui / non | oui / non |
| 3 | `32016R0679#rct_59` | RGPD > Considérants | 0.704 | (59) Des modalités devraient être prévues pour faciliter l'exercice par la personne concernée des droits qui lui sont conférés par le présent règlemen… | oui / non | oui / non |
| 4 | `32016R0679#art_16` | RGPD > Chapitre III > Droits de la personne concernée | 0.672 | Article 16 Droit de rectification La personne concernée a le droit d'obtenir du responsable du traitement, dans les meilleurs délais, la rectification… | oui / non | oui / non |
| 5 | `32016R0679#art_14` | RGPD > Chapitre III > Droits de la personne concernée | 0.668 | Article 14 Informations à fournir lorsque les données à caractère personnel n'ont pas été collectées auprès de la personne concernée 1. Lorsque les do… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q3 — évaluation de la conformité d'un système d'IA à haut risque

`questions-aiact.csv` · split `dev` · corpus `aiact` · type `conceptuelle` · attendues : `32024R1689#art_43`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `32024R1689#art_42` | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.792 | Article 42 Présomption de conformité avec certaines exigences 1. Les systèmes d’IA à haut risque qui ont été entraînés et testés avec des données tena… | oui / non | oui / non |
| 2 | `32024R1689#rct_123` | AI Act > Considérants | 0.798 | (123) Afin de garantir un niveau élevé de fiabilité des systèmes d’IA à haut risque, ces systèmes devraient être soumis à une évaluation de la conform… | oui / non | oui / non |
| 3 | `32024R1689#rct_178` | AI Act > Considérants | 0.795 | (178) Les fournisseurs de systèmes d’IA à haut risque sont encouragés à commencer à se conformer, sur une base volontaire, aux obligations pertinentes… | oui / non | oui / non |
| 4 | `32024R1689#art_6` | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.767 | Article 6 Règles relatives à la classification de systèmes d’IA comme systèmes à haut risque 1. Un système d’IA mis sur le marché ou mis en service, q… | oui / non | oui / non |
| 5 | `32024R1689#art_43` | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.764 | Article 43 Évaluation de la conformité 1. Pour les systèmes d’IA à haut risque énumérés à l’annexe III, point 1, lorsque, pour démontrer la conformité… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q4 — Quelles conditions la CNIL pose-t-elle au traitement de données de santé dans un projet de recherche ?

`questions-cnil-doctrine.csv` · split `dev` · corpus `cnil` · type `conceptuelle` · attendues : `CNILTEXT000045133748`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `CNILTEXT000054136834#f71` | CNIL > Sanction > Délibération SAN-2026-008 | 0.794 | 116. Ainsi, les traitements de données à caractère personnel dans le domaine de la santé en matière de recherche ne peuvent être mis en œuvre qu’après… | oui / non | oui / non |
| 2 | `CNILTEXT000048925420#f1` | CNIL > Avis > Délibération 2023-136 | 0.784 | Date de l’avis : 16 novembre 2023 N° de la délibération : 2023-136 N° de demande d’avis : 2230740 Organisme(s) à l’origine de la saisine : Institut na… | oui / non | oui / non |
| 3 | `CNILTEXT000036195647#f63` | CNIL > Avis > Délibération 2017-299 | 0.781 | L’article 14 du projet de loi vise à insérer dans l’actuel chapitre IX de la loi l’ensemble des dispositions relatives aux traitements de données à ca… | oui / non | oui / non |
| 4 | `CNILTEXT000017653155#f2` | CNIL > Avis > Délibération 04-041 | 0.780 | EMET L'AVIS SUIVANT Le ministre de la santé, de la famille et des personnes handicapées a saisi la CNIL du projet de décret en Conseil d'Etat relatif … | oui / non | oui / non |
| 5 | `CNILTEXT000017653248#f2` | CNIL > Avis > Délibération 2005-045 | 0.776 | Emet l'avis suivant Le ministre des solidarités, de la santé et de la famille a saisi à nouveau la Commission nationale de l'informatique et des liber… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q5 — À quel âge un mineur peut-il consentir seul à un traitement de données en ligne ?

`questions-lil.csv` · split `dev` · corpus `lil` · type `conceptuelle` · attendues : `LEGIARTI000037823135`

Niveau rendu par le serveur : `confiant`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `LEGIARTI000037823135` | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre Ier : Dispositions générales | 0.749 | En application du 1 de l'article 8 du règlement (UE) 2016/679 du 27 avril 2016, un mineur peut consentir seul à un traitement de données à caractère p… | oui / non | oui / non |
| 2 | `LEGIARTI000037822950` | LIL > Titre Ier : Dispositions communes > Chapitre Ier : Principes et définitions | 0.655 | Un traitement de données à caractère personnel n'est licite que si, et dans la mesure où, il remplit au moins une des conditions suivantes: 1° Le trai… | oui / non | oui / non |
| 3 | `LEGIARTI000037823040` | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre III : Obligations incombant au responsable du traitement et au sous-traitant > Section 3 : Traitements de données à caractère personnel dans le domaine de la santé > Sous-section 1 : Dispositions générales | 0.649 | Sont destinataires de l'information et exercent les droits de la personne concernée par le traitement les titulaires de l'exercice de l'autorité paren… | oui / non | oui / non |
| 4 | `LEGIARTI000037823081` | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre III : Obligations incombant au responsable du traitement et au sous-traitant > Section 1 : Obligations générales | 0.640 | Conformément à l'article 29 du règlement (UE) 2016/679 du 27 avril 2016, sauf dispositions législatives ou réglementaires contraires, il est interdit … | oui / non | oui / non |
| 5 | `LEGIARTI000043887431` | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre II : Droits de la personne concernée | 0.637 | Le droit à l'information s'exerce dans les conditions prévues aux articles 12 à 14 du règlement (UE) 2016/679 du 27 avril 2016. En particulier, lorsqu… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q6 — Dans quels cas la personne concernée peut-elle obtenir l'effacement de ses données personnelles ?

`questions-ce.csv` · split `dev` · corpus `ce` · type `conceptuelle` · attendues : `CETATEXT000047773954`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `CETATEXT000051049451#f6` | Conseil d'État > Décision 490416 | 0.755 | 2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que… | oui / non | oui / non |
| 2 | `CETATEXT000051049452#f4` | Conseil d'État > Décision 490417 | 0.750 | 2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que… | oui / non | oui / non |
| 3 | `CETATEXT000049149941#f3` | Conseil d'État > Décision 474625 | 0.748 | 2. En premier lieu, l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 relatif à la protection des personnes… | oui / non | oui / non |
| 4 | `CETATEXT000054758945#f3` | Conseil d'État > Décision 508655 | 0.747 | 2. D'une part, aux termes du paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD): " La… | oui / non | oui / non |
| 5 | `CETATEXT000039456972#f5` | Conseil d'État > Décision 405910 | 0.745 | 5. Aux termes de l'article 17 du règlement 2016/679 du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du traitement des donné… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q7 — Comment le CEPD calcule-t-il le montant des amendes administratives au titre du RGPD ?

`questions-cepd.csv` · split `dev` · corpus `cepd` · type `conceptuelle` · attendues : `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr`

Niveau rendu par le serveur : `confiant`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f236` | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.809 | Par conséquent, aucun ajustement supplémentaire n’est réalisé. À la suite de cette appréciation, l’autorité de contrôle procède au calcul du montant d… | oui / non | oui / non |
| 2 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f6` | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.786 | 7 1.1 – Cadre juridique ..............................................................................................................................… | oui / non | oui / non |
| 3 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f16` | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.785 | 47 ANNEXE – TABLEAU D’ILLUSTRATION DES LIGNES DIRECTRICES 04/2022 SUR LE CALCUL DES AMENDES ADMINISTRATIVES AU TITRE DU RGPD .........................… | oui / non | oui / non |
| 4 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f20` | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.770 | Les présentes lignes directrices portent sur la méthode de calcul desdites amendes administratives. 1 Dans le présent document, on entend par «États m… | oui / non | oui / non |
| 5 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f8` | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.768 | 13 3.1 – Comportement unique passible de sanctions ...................................................................................................… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q8 — Les images d'un système de vidéoprotection peuvent-elles fonder une sanction disciplinaire ?

`questions-cc.csv` · split `dev` · corpus `cc` · type `conceptuelle` · attendues : `682d68f316fd466a1ce900c4`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `68b7e546d7454f2f74c1ed90#f8` | Cour de cassation > Chambre criminelle > Décision du 3 septembre 2025 > 24-83.464 > Texte | 0.727 | 9. Ils constatent que tout système de vidéoprotection comporte des images où apparaissent des personnes pouvant être considérées, dans certains cas, c… | oui / non | oui / non |
| 2 | `6a9fc91c195da062e0a4b6f5#f14` | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.727 | 21. En deuxième lieu, il résulte des articles R. 251-1 et R. 253-3, III, 4°, de ce même code que les personnes mettant en oeuvre un système de vidéopr… | oui / non | oui / non |
| 3 | `6a9fc91c195da062e0a4b6f5#f13` | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.704 | 19. S'agissant de telles hypothèses, en premier lieu, d'une part, les dispositions du code de la sécurité intérieure relatives aux personnes pouvant a… | oui / non | oui / non |
| 4 | `6a9fc91c195da062e0a4b6f5#f9` | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.703 | 2°/ d'autre part, que seuls les enquêteurs spécialement habilités et individuellement désignés à cette fin, ou les tiers ayant eux-mêmes cette qualité… | oui / non | oui / non |
| 5 | `6ab23021c27382d099dea4e2#f33` | Cour de cassation > Chambre criminelle > Décision du 22 septembre 2026 > 26-80.457 > Texte | 0.696 | Réponse de la Cour 30. Pour déclarer le requérant irrecevable en son moyen de nullité de l'exploitation d'images issues du système de vidéoprotection … | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q9 — Une adresse IP dynamique constitue-t-elle une donnée à caractère personnel pour l'éditeur d'un site ?

`questions-cjue.csv` · split `dev` · corpus `cjue` · type `conceptuelle` · attendues : `62014CJ0582`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Passage pertinent | Citation exacte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `62014CJ0582#point20` | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.750 | Selon cette juridiction d’appel, une adresse IP dynamique, en combinaison avec la date de la session de consultation à laquelle elle se rapporte, cons… | oui / non | oui / non |
| 2 | `62014CJ0582#point39` | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.748 | Ensuite, afin de déterminer si une adresse IP dynamique constitue, dans l’hypothèse exposée au point 37 du présent arrêt, une donnée à caractère perso… | oui / non | oui / non |
| 3 | `62014CJ0582#point49` | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.747 | Eu égard à l’ensemble des considérations qui précèdent, il convient de répondre à la première question que l’article 2, sous a), de la directive 95/46… | oui / non | oui / non |
| 4 | `62014CJ0582#point31` | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.739 | Par sa première question, la juridiction de renvoi demande, en substance, si l’article 2, sous a), de la directive 95/46 doit être interprété en ce se… | oui / non | oui / non |
| 5 | `62019CJ0597#point102` | CJUE > Arrêt de la Cour C-597/19 > Motifs | 0.731 | En premier lieu, s’agissant du traitement en amont en cause au principal, il y a lieu de rappeler qu’une adresse IP dynamique enregistrée par un fourn… | oui / non | oui / non |

| Critère | À remplir |
| --- | --- |
| Passage(s) attendu(s) présent(s) dans le top 5 | oui / non |
| Limite signalée (hors périmètre seulement) | oui / non / sans objet |
| **Minutes** | |

### Q10 — Quelles mentions obligatoires figurent sur une facture d'électricité ?

`questions-v3.csv` · split `dev` · corpus `rgpd` · type `piege` · attendues : `—` · hors périmètre

Niveau rendu par le serveur : `aucun_resultat_fiable`.

Aucun passage rendu : le serveur refuse sous le seuil bas.

| Critère | À remplir |
| --- | --- |
| Limite signalée (le refus est-il explicite et juste ?) | oui / non |
| **Minutes** | |

