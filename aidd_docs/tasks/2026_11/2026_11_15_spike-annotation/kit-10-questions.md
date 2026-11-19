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
5. Cocher en mettant `x` dans la case **oui** ou **non** ; une case vide vaut « non renseigné ».
   Inscrire les minutes avec une décimale (par exemple `4,5`).
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

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `32016R0679#art_48` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_48) | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.745 | Article 48 Transferts ou divulgations non autorisés par le droit de l'Union Toute décision d'une juridiction ou d'une autorité administrative d'un pay… |  |  |  |  |
| 2 | `32016R0679#art_44` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_44) | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.735 | Article 44 Principe général applicable aux transferts Un transfert, vers un pays tiers ou à une organisation internationale, de données à caractère pe… |  |  |  |  |
| 3 | `32016R0679#art_49` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_49) | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.730 | Article 49 Dérogations pour des situations particulières 1. En l'absence de décision d'adéquation en vertu de l'article 45, paragraphe 3, ou de garant… |  |  |  |  |
| 4 | `32016R0679#art_50` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_50) | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.723 | Article 50 Coopération internationale dans le domaine de la protection des données à caractère personnel La Commission et les autorités de contrôle pr… |  |  |  |  |
| 5 | `32016R0679#art_46` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_46) | RGPD > Chapitre V > Transferts de données à caractère personnel vers des pays tiers ou à des organisations internationales | 0.715 | Article 46 Transferts moyennant des garanties appropriées 1. En l'absence de décision en vertu de l'article 45, paragraphe 3, le responsable du traite… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>32016R0679#art_48</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_48">source officielle</a></summary>

Article 48 Transferts ou divulgations non autorisés par le droit de l'Union Toute décision d'une juridiction ou d'une autorité administrative d'un pays tiers exigeant d'un responsable du traitement ou d'un sous-traitant qu'il transfère ou divulgue des données à caractère personnel ne peut être reconnue ou rendue exécutoire de quelque manière que ce soit qu'à la condition qu'elle soit fondée sur un accord international, tel qu'un traité d'entraide judiciaire, en vigueur entre le pays tiers demandeur et l'Union ou un État membre, sans préjudice d'autres motifs de transfert en vertu du présent chapitre.

</details>

<details><summary>Rang 2 — <code>32016R0679#art_44</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_44">source officielle</a></summary>

Article 44 Principe général applicable aux transferts Un transfert, vers un pays tiers ou à une organisation internationale, de données à caractère personnel qui font ou sont destinées à faire l'objet d'un traitement après ce transfert ne peut avoir lieu que si, sous réserve des autres dispositions du présent règlement, les conditions définies dans le présent chapitre sont respectées par le responsable du traitement et le sous-traitant, y compris pour les transferts ultérieurs de données à caractère personnel au départ du pays tiers ou de l'organisation internationale vers un autre pays tiers ou à une autre organisation internationale. Toutes les dispositions du présent chapitre sont appliquées de manière à ce que le niveau de protection des personnes physiques garanti par le présent règlement ne soit pas compromis.

</details>

<details><summary>Rang 3 — <code>32016R0679#art_49</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_49">source officielle</a></summary>

Article 49 Dérogations pour des situations particulières 1. En l'absence de décision d'adéquation en vertu de l'article 45, paragraphe 3, ou de garanties appropriées en vertu de l'article 46, y compris des règles d'entreprise contraignantes, un transfert ou un ensemble de transferts de données à caractère personnel vers un pays tiers ou à une organisation internationale ne peut avoir lieu qu'à l'une des conditions suivantes: a) la personne concernée a donné son consentement explicite au transfert envisagé, après avoir été informée des risques que ce transfert pouvait comporter pour elle en raison de l'absence de décision d'adéquation et de garanties appropriées; b) le transfert est nécessaire à l'exécution d'un contrat entre la personne concernée et le responsable du traitement ou à la mise en œuvre de mesures précontractuelles prises à la demande de la personne concernée; c) le transfert est nécessaire à la conclusion ou à l'exécution d'un contrat conclu dans l'intérêt de la personne concernée entre le responsable du traitement et une autre personne physique ou morale; d) le transfert est nécessaire pour des motifs importants d'intérêt public; e) le transfert est nécessaire à la constatation, à l'exercice ou à la défense de droits en justice; f) le transfert est nécessaire à la sauvegarde des intérêts vitaux de la personne concernée ou d'autres personnes, lorsque la personne concernée se trouve dans l'incapacité physique ou juridique de donner son consentement; g) le transfert a lieu au départ d'un registre qui, conformément au droit de l'Union ou au droit d'un État membre, est destiné à fournir des 'informations au public et est ouvert à la consultation du public en général ou de toute personne justifiant d'un intérêt légitime, mais uniquement dans la mesure où les conditions prévues pour la consultation dans le droit de l'Union ou le droit de l'État membre sont remplies dans le cas d'espèce. Lorsqu'un transfert ne peut pas être fondé sur une disposition de l'article 45 ou 46, y compris les dispositions relatives aux règles d'entreprise contraignantes, et qu'aucune des dérogations pour des situations particulières visées au premier alinéa du présent paragraphe n'est applicable, un transfert vers un pays tiers ou à une organisation internationale ne peut avoir lieu que si ce transfert ne revêt pas de caractère répétitif, ne touche qu'un nombre limité de personnes concernées, est nécessaire aux fins des intérêts légitimes impérieux poursuivis par le responsable du traitement sur lesquels ne prévalent pas les intérêts ou les droits et libertés de la personne concernée, et si le responsable du traitement a évalué toutes les circonstances entourant le transfert de données et a offert, sur la base de cette évaluation, des garanties appropriées en ce qui concerne la protection des données à caractère personnel. Le responsable du traitement informe l'autorité de contrôle du transfert. Outre qu'il fournit les informations visées aux articles 13 et 14, le responsable du traitement informe la personne concernée du transfert et des intérêts légitimes impérieux qu'il poursuit. 2. Un transfert effectué en vertu du paragraphe 1, premier alinéa, point g), ne porte pas sur la totalité des données à caractère personnel ni sur des catégories entières de données à caractère personnel contenues dans le registre. Lorsque le registre est destiné à être consulté par des personnes justifiant d'un intérêt légitime, le transfert n'est effectué qu'à la demande de ces personnes ou lorsqu'elles en sont les destinataires. 3. Les points a), b), et c) du premier alinéa du paragraphe 1 et le deuxième alinéa du paragraphe 1 ne sont pas applicables aux activités des autorités publiques dans l'exercice de leurs prérogatives de puissance publique. 4. L'intérêt public visé au paragraphe 1, premier alinéa, point d), est reconnu par le droit de l'Union ou le droit de l'État membre auquel le responsable du traitement est soumis. 5. En l'absence de décision d'adéquation, le droit de l'Union ou le droit d'un État membre peut, pour des motifs importants d'intérêt public, fixer expressément des limites au transfert de catégories spécifiques de données à caractère personnel vers un pays tiers ou à une organisation internationale. Les États membres notifient de telles dispositions à la Commission. 6. Le responsable du traitement ou le sous-traitant documente, dans les registres visés à l'article 30, l'évaluation ainsi que les garanties appropriées visées au paragraphe 1, deuxième alinéa, du présent article.

</details>

<details><summary>Rang 4 — <code>32016R0679#art_50</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_50">source officielle</a></summary>

Article 50 Coopération internationale dans le domaine de la protection des données à caractère personnel La Commission et les autorités de contrôle prennent, à l'égard des pays tiers et des organisations internationales, les mesures appropriées pour: a) élaborer des mécanismes de coopération internationale destinés à faciliter l'application effective de la législation relative à la protection des données à caractère personnel; b) se prêter mutuellement assistance sur le plan international dans l'application de la législation relative à la protection des données à caractère personnel, y compris par la notification, la transmission des réclamations, l'entraide pour les enquêtes et l'échange d'informations, sous réserve de garanties appropriées pour la protection des données à caractère personnel et d'autres libertés et droits fondamentaux; c) associer les parties prenantes intéressées aux discussions et activités visant à développer la coopération internationale dans le domaine de l'application de la législation relative à la protection des données à caractère personnel; d) favoriser l'échange et la documentation de la législation et des pratiques en matière de protection des données à caractère personnel, y compris en ce qui concerne les conflits de compétence avec des pays tiers.

</details>

<details><summary>Rang 5 — <code>32016R0679#art_46</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_46">source officielle</a></summary>

Article 46 Transferts moyennant des garanties appropriées 1. En l'absence de décision en vertu de l'article 45, paragraphe 3, le responsable du traitement ou le sous-traitant ne peut transférer des données à caractère personnel vers un pays tiers ou à une organisation internationale que s'il a prévu des garanties appropriées et à la condition que les personnes concernées disposent de droits opposables et de voies de droit effectives. 2. Les garanties appropriées visées au paragraphe 1 peuvent être fournies, sans que cela ne nécessite une autorisation particulière d'une autorité de contrôle, par: a) un instrument juridiquement contraignant et exécutoire entre les autorités ou organismes publics; b) des règles d'entreprise contraignantes conformément à l'article 47; c) des clauses types de protection des données adoptées par la Commission en conformité avec la procédure d'examen visée à l'article 93, paragraphe 2; d) des clauses types de protection des données adoptées par une autorité de contrôle et approuvées par la Commission en conformité avec la procédure d'examen visée à l'article 93, paragraphe 2; e) un code de conduite approuvé conformément à l'article 40, assorti de l'engagement contraignant et exécutoire pris par le responsable du traitement ou le sous-traitant dans le pays tiers d'appliquer les garanties appropriées, y compris en ce qui concerne les droits des personnes concernées; ou f) un mécanisme de certification approuvé conformément à l'article 42, assorti de l'engagement contraignant et exécutoire pris par le responsable du traitement ou le sous-traitant dans le pays tiers d'appliquer les garanties appropriées, y compris en ce qui concerne les droits des personnes concernées. 3. Sous réserve de l'autorisation de l'autorité de contrôle compétente, les garanties appropriées visées au paragraphe 1 peuvent aussi être fournies, notamment, par: a) des clauses contractuelles entre le responsable du traitement ou le sous-traitant et le responsable du traitement, le sous-traitant ou le destinataire des données à caractère personnel dans le pays tiers ou l'organisation internationale; ou b) des dispositions à intégrer dans des arrangements administratifs entre les autorités publiques ou les organismes publics qui prévoient des droits opposables et effectifs pour les personnes concernées. 4. L'autorité de contrôle applique le mécanisme de contrôle de la cohérence visé à l'article 63 dans les cas visés au paragraphe 3 du présent article. 5. Les autorisations accordées par un État membre ou une autorité de contrôle sur le fondement de l'article 26, paragraphe 2, de la directive 95/46/CE demeurent valables jusqu'à leur modification, leur remplacement ou leur abrogation, si nécessaire, par ladite autorité de contrôle. Les décisions adoptées par la Commission sur le fondement de l'article 26, paragraphe 4, de la directive 95/46/CE demeurent en vigueur jusqu'à leur modification, leur remplacement ou leur abrogation, si nécessaire, par une décision de la Commission adoptée conformément au paragraphe 2 du présent article.

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q2 — délai d'un mois pour répondre à une demande d'exercice des droits

`questions-v3.csv` · split `dev` · corpus `rgpd` · type `conceptuelle` · attendues : `32016R0679#art_12`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `32016R0679#rct_134` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#rct_134) | RGPD > Considérants | 0.719 | (134) Chaque autorité de contrôle devrait, s'il y a lieu, participer à des opérations conjointes avec d'autorités de contrôle. L'autorité de contrôle … |  |  |  |  |
| 2 | `32016R0679#art_12` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_12) | RGPD > Chapitre III > Droits de la personne concernée | 0.686 | Article 12 Transparence des informations et des communications et modalités de l'exercice des droits de la personne concernée 1. Le responsable du tra… |  |  |  |  |
| 3 | `32016R0679#rct_59` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#rct_59) | RGPD > Considérants | 0.704 | (59) Des modalités devraient être prévues pour faciliter l'exercice par la personne concernée des droits qui lui sont conférés par le présent règlemen… |  |  |  |  |
| 4 | `32016R0679#art_16` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_16) | RGPD > Chapitre III > Droits de la personne concernée | 0.672 | Article 16 Droit de rectification La personne concernée a le droit d'obtenir du responsable du traitement, dans les meilleurs délais, la rectification… |  |  |  |  |
| 5 | `32016R0679#art_14` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_14) | RGPD > Chapitre III > Droits de la personne concernée | 0.668 | Article 14 Informations à fournir lorsque les données à caractère personnel n'ont pas été collectées auprès de la personne concernée 1. Lorsque les do… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>32016R0679#rct_134</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#rct_134">source officielle</a></summary>

(134) Chaque autorité de contrôle devrait, s'il y a lieu, participer à des opérations conjointes avec d'autorités de contrôle. L'autorité de contrôle requise devrait être tenue de répondre à la demande dans un délai déterminé.

</details>

<details><summary>Rang 2 — <code>32016R0679#art_12</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_12">source officielle</a></summary>

Article 12 Transparence des informations et des communications et modalités de l'exercice des droits de la personne concernée 1. Le responsable du traitement prend des mesures appropriées pour fournir toute information visée aux articles 13 et 14 ainsi que pour procéder à toute communication au titre des articles 15 à 22 et de l'article 34 en ce qui concerne le traitement à la personne concernée d'une façon concise, transparente, compréhensible et aisément accessible, en des termes clairs et simples, en particulier pour toute information destinée spécifiquement à un enfant. Les informations sont fournies par écrit ou par d'autres moyens y compris, lorsque c'est approprié, par voie électronique. Lorsque la personne concernée en fait la demande, les informations peuvent être fournies oralement, à condition que l'identité de la personne concernée soit démontrée par d'autres moyens. 2. Le responsable du traitement facilite l'exercice des droits conférés à la personne concernée au titre des articles 15 à 22. Dans les cas visés à l'article 11, paragraphe 2, le responsable du traitement ne refuse pas de donner suite à la demande de la personne concernée d'exercer les droits que lui confèrent les articles 15 à 22, à moins que le responsable du traitement ne démontre qu'il n'est pas en mesure d'identifier la personne concernée. 3. Le responsable du traitement fournit à la personne concernée des informations sur les mesures prises à la suite d'une demande formulée en application des articles 15 à 22, dans les meilleurs délais et en tout état de cause dans un délai d'un mois à compter de la réception de la demande. Au besoin, ce délai peut être prolongé de deux mois, compte tenu de la complexité et du nombre de demandes. Le responsable du traitement informe la personne concernée de cette prolongation et des motifs du report dans un délai d'un mois à compter de la réception de la demande. Lorsque la personne concernée présente sa demande sous une forme électronique, les informations sont fournies par voie électronique lorsque cela est possible, à moins que la personne concernée ne demande qu'il en soit autrement. 4. Si le responsable du traitement ne donne pas suite à la demande formulée par la personne concernée, il informe celle-ci sans tarder et au plus tard dans un délai d'un mois à compter de la réception de la demande des motifs de son inaction et de la possibilité d'introduire une réclamation auprès d'une autorité de contrôle et de former un recours juridictionnel. 5. Aucun paiement n'est exigé pour fournir les informations au titre des articles 13 et 14 et pour procéder à toute communication et prendre toute mesure au titre des articles 15 à 22 et de l'article 34. Lorsque les demandes d'une personne concernée sont manifestement infondées ou excessives, notamment en raison de leur caractère répétitif, le responsable du traitement peut: a) exiger le paiement de frais raisonnables qui tiennent compte des coûts administratifs supportés pour fournir les informations, procéder aux communications ou prendre les mesures demandées; ou b) refuser de donner suite à ces demandes. Il incombe au responsable du traitement de démontrer le caractère manifestement infondé ou excessif de la demande. 6. Sans préjudice de l'article 11, lorsque le responsable du traitement a des doutes raisonnables quant à l'identité de la personne physique présentant la demande visée aux articles 15 à 21, il peut demander que lui soient fournies des informations supplémentaires nécessaires pour confirmer l'identité de la personne concernée. 7. Les informations à communiquer aux personnes concernées en application des articles 13 et 14 peuvent être fournies accompagnées d'icônes normalisées afin d'offrir une bonne vue d'ensemble, facilement visible, compréhensible et clairement lisible, du traitement prévu. Lorsque les icônes sont présentées par voie électronique, elles sont lisibles par machine. 8. La Commission est habilitée à adopter des actes délégués en conformité avec l'article 92, aux fins de déterminer les informations à présenter sous la forme d'icônes ainsi que les procédures régissant la fourniture d'icônes normalisées.

</details>

<details><summary>Rang 3 — <code>32016R0679#rct_59</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#rct_59">source officielle</a></summary>

(59) Des modalités devraient être prévues pour faciliter l'exercice par la personne concernée des droits qui lui sont conférés par le présent règlement, y compris les moyens de demander et, le cas échéant, d'obtenir sans frais, notamment, l'accès aux données à caractère personnel, et leur rectification ou leur effacement, et l'exercice d'un droit d'opposition. Le responsable du traitement devrait également fournir les moyens de présenter des demandes par voie électronique, en particulier lorsque les données à caractère personnel font l'objet d'un traitement électronique. Le responsable du traitement devrait être tenu de répondre aux demandes émanant de la personne concernée dans les meilleurs délais et au plus tard dans un délai d'un mois et de motiver sa réponse lorsqu'il a l'intention de ne pas donner suite à de telles demandes.

</details>

<details><summary>Rang 4 — <code>32016R0679#art_16</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_16">source officielle</a></summary>

Article 16 Droit de rectification La personne concernée a le droit d'obtenir du responsable du traitement, dans les meilleurs délais, la rectification des données à caractère personnel la concernant qui sont inexactes. Compte tenu des finalités du traitement, la personne concernée a le droit d'obtenir que les données à caractère personnel incomplètes soient complétées, y compris en fournissant une déclaration complémentaire.

</details>

<details><summary>Rang 5 — <code>32016R0679#art_14</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_14">source officielle</a></summary>

Article 14 Informations à fournir lorsque les données à caractère personnel n'ont pas été collectées auprès de la personne concernée 1. Lorsque les données à caractère personnel n'ont pas été collectées auprès de la personne concernée, le responsable du traitement fournit à celle-ci toutes les informations suivantes: a) l'identité et les coordonnées du responsable du traitement et, le cas échéant, du représentant du responsable du traitement; b) le cas échéant, les coordonnées du délégué à la protection des données; c) les finalités du traitement auquel sont destinées les données à caractère personnel ainsi que la base juridique du traitement; d) les catégories de données à caractère personnel concernées; e) le cas échéant, les destinataires ou les catégories de destinataires des données à caractère personnel; f) le cas échéant, le fait que le responsable du traitement a l'intention d'effectuer un transfert de données à caractère personnel à un destinataire dans un pays tiers ou une organisation internationale, et l'existence ou l'absence d'une décision d'adéquation rendue par la Commission ou, dans le cas des transferts visés à l'article 46 ou 47, ou à l'article 49, paragraphe 1, deuxième alinéa, la référence aux garanties appropriées ou adaptées et les moyens d'en obtenir une copie ou l'endroit où elles ont été mises à disposition; 2. En plus des informations visées au paragraphe 1, le responsable du traitement fournit à la personne concernée les informations suivantes nécessaires pour garantir un traitement équitable et transparent à l'égard de la personne concernée: a) la durée pendant laquelle les données à caractère personnel seront conservées ou, lorsque ce n'est pas possible, les critères utilisés pour déterminer cette durée; b) lorsque le traitement est fondé sur l'article 6, paragraphe 1, point f), les intérêts légitimes poursuivis par le responsable du traitement ou par un tiers; c) l'existence du droit de demander au responsable du traitement l'accès aux données à caractère personnel, la rectification ou l'effacement de celles-ci, ou une limitation du traitement relatif à la personne concernée, ainsi que du droit de s'opposer au traitement et du droit à la portabilité des données; d) lorsque le traitement est fondé sur l'article 6, paragraphe 1, point a), ou sur l'article 9, paragraphe 2, point a), l'existence du droit de retirer le consentement à tout moment, sans porter atteinte à la licéité du traitement fondé sur le consentement effectué avant le retrait de celui-ci; e) le droit d'introduire une réclamation auprès d'une autorité de contrôle; f) la source d'où proviennent les données à caractère personnel et, le cas échéant, une mention indiquant qu'elles sont issues ou non de sources accessibles au public; g) l'existence d'une prise de décision automatisée, y compris un profilage, visée à l'article 22, paragraphes 1 et 4, et, au moins en pareils cas, des informations utiles concernant la logique sous-jacente, ainsi que l'importance et les conséquences prévues de ce traitement pour la personne concernée. 3. Le responsable du traitement fournit les informations visées aux paragraphes 1 et 2: a) dans un délai raisonnable après avoir obtenu les données à caractère personnel, mais ne dépassant pas un mois, eu égard aux circonstances particulières dans lesquelles les données à caractère personnel sont traitées; b) si les données à caractère personnel doivent être utilisées aux fins de la communication avec la personne concernée, au plus tard au moment de la première communication à ladite personne; ou c) s'il est envisagé de communiquer les informations à un autre destinataire, au plus tard lorsque les données à caractère personnel sont communiquées pour la première fois. 4. Lorsqu'il a l'intention d'effectuer un traitement ultérieur des données à caractère personnel pour une finalité autre que celle pour laquelle les données à caractère personnel ont été obtenues, le responsable du traitement fournit au préalable à la personne concernée des informations au sujet de cette autre finalité et toute autre information pertinente visée au paragraphe 2. 5. Les paragraphes 1 à 4 ne s'appliquent pas lorsque et dans la mesure où: a) la personne concernée dispose déjà de ces informations; b) la fourniture de telles informations se révèle impossible ou exigerait des efforts disproportionnés, en particulier pour le traitement à des fins archivistiques dans l'intérêt public, à des fins de recherche scientifique ou historique ou à des fins statistiques sous réserve des conditions et garanties visées à l'article 89, paragraphe 1, ou dans la mesure où l'obligation visée au paragraphe 1 du présent article est susceptible de rendre impossible ou de compromettre gravement la réalisation des objectifs dudit traitement. En pareils cas, le responsable du traitement prend des mesures appropriées pour protéger les droits et libertés ainsi que les intérêts légitimes de la personne concernée, y compris en rendant les informations publiquement disponibles; c) l'obtention ou la communication des informations sont expressément prévues par le droit de l'Union ou le droit de l'État membre auquel le responsable du traitement est soumis et qui prévoit des mesures appropriées visant à protéger les intérêts légitimes de la personne concernée; ou d) les données à caractère personnel doivent rester confidentielles en vertu d'une obligation de secret professionnel réglementée par le droit de l'Union ou le droit des États membre, y compris une obligation légale de secret professionnel.

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q3 — évaluation de la conformité d'un système d'IA à haut risque

`questions-aiact.csv` · split `dev` · corpus `aiact` · type `conceptuelle` · attendues : `32024R1689#art_43`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `32024R1689#art_42` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727) | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.792 | Article 42 Présomption de conformité avec certaines exigences 1. Les systèmes d’IA à haut risque qui ont été entraînés et testés avec des données tena… |  |  |  |  |
| 2 | `32024R1689#rct_123` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689#rct_123) | AI Act > Considérants | 0.798 | (123) Afin de garantir un niveau élevé de fiabilité des systèmes d’IA à haut risque, ces systèmes devraient être soumis à une évaluation de la conform… |  |  |  |  |
| 3 | `32024R1689#rct_178` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689#rct_178) | AI Act > Considérants | 0.795 | (178) Les fournisseurs de systèmes d’IA à haut risque sont encouragés à commencer à se conformer, sur une base volontaire, aux obligations pertinentes… |  |  |  |  |
| 4 | `32024R1689#art_6` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727) | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.767 | Article 6 Règles relatives à la classification de systèmes d’IA comme systèmes à haut risque 1. Un système d’IA mis sur le marché ou mis en service, q… |  |  |  |  |
| 5 | `32024R1689#art_43` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727) | AI Act > Chapitre III > SYSTÈMES D’IA À HAUT RISQUE | 0.764 | Article 43 Évaluation de la conformité 1. Pour les systèmes d’IA à haut risque énumérés à l’annexe III, point 1, lorsque, pour démontrer la conformité… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>32024R1689#art_42</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727">source officielle</a></summary>

Article 42 Présomption de conformité avec certaines exigences 1. Les systèmes d’IA à haut risque qui ont été entraînés et testés avec des données tenant compte du cadre géographique, comportemental, contextuel ou fonctionnel spécifique dans lequel ils sont destinés à être utilisés sont présumés conformes aux exigences pertinentes établies à l’article 10, paragraphe 4. 2. Les systèmes d’IA à haut risque qui ont été certifiés ou pour lesquels une déclaration de conformité a été délivrée dans le cadre d’un schéma de cybersécurité conformément au règlement (UE) 2019/881 et dont les références ont été publiées au Journal officiel de l’Union européenne sont présumés conformes aux exigences de cybersécurité énoncées à l’article 15 du présent règlement, dans la mesure où ces dernières sont couvertes par tout ou partie du certificat de cybersécurité ou de la déclaration de conformité. 3. Lorsque des systèmes d'IA à haut risque relèvent du champ d'application du règlement (UE) 2024/2847 et que les conditions énoncées à l'article 12, paragraphe 1, dudit règlement sont remplies, ces systèmes sont réputés conformes aux exigences de cybersécurité énoncées à l'article 15 du présent règlement.

</details>

<details><summary>Rang 2 — <code>32024R1689#rct_123</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689#rct_123">source officielle</a></summary>

(123) Afin de garantir un niveau élevé de fiabilité des systèmes d’IA à haut risque, ces systèmes devraient être soumis à une évaluation de la conformité avant leur mise sur le marché ou leur mise en service.

</details>

<details><summary>Rang 3 — <code>32024R1689#rct_178</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689#rct_178">source officielle</a></summary>

(178) Les fournisseurs de systèmes d’IA à haut risque sont encouragés à commencer à se conformer, sur une base volontaire, aux obligations pertinentes du présent règlement dès la période transitoire.

</details>

<details><summary>Rang 4 — <code>32024R1689#art_6</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727">source officielle</a></summary>

Article 6 Règles relatives à la classification de systèmes d’IA comme systèmes à haut risque 1. Un système d’IA mis sur le marché ou mis en service, qu’il soit ou non indépendant des produits visés aux points a) et b), est considéré comme étant à haut risque lorsque les deux conditions suivantes sont remplies: a) le système d’IA est destiné à être utilisé comme composant de sécurité d’un produit couvert par la législation d’harmonisation de l’Union dont la liste figure à l’annexe I, ou le système d’IA constitue lui-même un tel produit; b) le produit dont le composant de sécurité visé au point a) est le système d’IA, ou le système d’IA lui-même en tant que produit, est soumis à une évaluation de conformité par un tiers en vue de la mise sur le marché ou de la mise en service de ce produit conformément à la législation d’harmonisation de l’Union dont la liste figure à l’annexe I. 1 bis. Aux fins du présent règlement, y compris le paragraphe 1 du présent article, les systèmes d'IA qui sont uniquement utilisés pour des aspects non liés à la sécurité en ce qui concerne l'assistance aux utilisateurs, l'optimisation des performances, l'efficacité des services, l'automatisation, la commodité ou le contrôle de la qualité ne sont pas considérés comme des composants de sécurité. 1 ter. Nonobstant le paragraphe 1 bis, les systèmes d'IA dont la défaillance ou le dysfonctionnement mettrait en danger la santé et la sécurité sont considérés comme des composants de sécurité. 1 quater. N'est pas considéré comme remplissant la condition énoncée au paragraphe 1, point b), un produit qui doit faire l'objet d'une évaluation de la conformité par un tiers uniquement en raison de risques autres que les risques pour la santé et la sécurité, en particulier les risques liés à la distribution du spectre radioélectrique ou aux interférences électromagnétiques qui n'affectent pas la santé et la sécurité. 2. Outre les systèmes d’IA à haut risque visés au paragraphe 1, les systèmes d’IA visés à l’annexe III sont considérés comme étant à haut risque. 3. Par dérogation au paragraphe 2, un système d’IA visé à l’annexe III n’est pas considéré comme étant à haut risque lorsqu’il ne présente pas de risque important de préjudice pour la santé, la sécurité ou les droits fondamentaux des personnes physiques, y compris en n’ayant pas d’incidence significative sur le résultat de la prise de décision. Le premier alinéa s’applique lorsqu’une des conditions suivantes est remplie: a) le système d’IA est destiné à accomplir un tâche procédurale étroite; b) le système d’IA est destiné à améliorer le résultat d’une activité humaine préalablement réalisée; c) le système d’IA est destiné à détecter les constantes en matière de prise de décision ou les écarts par rapport aux constantes habituelles antérieures et n’est pas destiné à se substituer à l’évaluation humaine préalablement réalisée, ni à influencer celle-ci, sans examen humain approprié; ou d) le système d’IA est destiné à exécuter une tâche préparatoire en vue d’une évaluation pertinente aux fins des cas d’utilisation visés à l’annexe III. Nonobstant le premier alinéa, un système d’IA visé à l’annexe III est toujours considéré comme étant à haut risque lorsqu’il effectue un profilage de personnes physiques. 4. Un fournisseur qui considère qu’un système d’IA visé à l’annexe III n’est pas à haut risque documente son évaluation avant que ce système ne soit mis sur le marché ou mis en service. Ce fournisseur est soumis à l’obligation d’enregistrement visée à l’article 49, paragraphe 2. À la demande des autorités nationales compétentes, le fournisseur fournit la documentation de l’évaluation. 5. Après consultation du Comité européen de l’intelligence artificielle (ci-après dénommé «Comité IA»), et au plus tard le 2 février 2026, la Commission fournit des lignes directrices précisant la mise en œuvre pratique du présent article, conformément à l’article 96, assorties d’une liste exhaustive d’exemples pratiques de cas d’utilisation de systèmes d’IA qui sont à haut risque et de cas d’utilisation qui ne le sont pas. 6. La Commission est habilitée à adopter des actes délégués conformément à l’article 97 pour modifier le paragraphe 3, deuxième alinéa, du présent article en ajoutant de nouvelles conditions à celles qui y sont énoncées, ou en les modifiant, lorsqu’il existe des preuves concrètes et fiables de l’existence de systèmes d’IA qui relèvent du champ d’application de l’annexe III, mais qui ne présentent pas de risque important de préjudice pour la santé, la sécurité ou les droits fondamentaux des personnes physiques. 7. La Commission adopte des actes délégués conformément à l’article 97 afin de modifier le paragraphe 3, deuxième alinéa, du présent article en supprimant l’une des conditions qui y est établie, lorsqu’il existe des preuves concrètes et fiables attestant que cela est nécessaire pour maintenir le niveau de protection de la santé, de la sécurité et des droits fondamentaux prévu par le présent règlement. 8. Toute modification des conditions établies au paragraphe 3, deuxième alinéa, adoptée conformément aux paragraphe 6 et 7 du présent article ne diminue pas le niveau global de protection de la santé, de la sécurité et des droits fondamentaux prévu par le présent règlement et veille à la cohérence avec les actes délégués adoptés conformément à l’article 7, paragraphe 1, et tient compte des évolutions du marché et des technologies.

</details>

<details><summary>Rang 5 — <code>32024R1689#art_43</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02024R1689-20260727">source officielle</a></summary>

Article 43 Évaluation de la conformité 1. Pour les systèmes d’IA à haut risque énumérés à l’annexe III, point 1, lorsque, pour démontrer la conformité d’un système d’IA à haut risque avec les exigences énoncées à la section 2, le fournisseur a appliqué les normes harmonisées visées à l’article 40 ou, le cas échéant, les spécifications communes visées à l’article 41, il choisit l’une des procédures d’évaluation de la conformité suivantes sur la base: a) du contrôle interne visé à l’annexe VI; ou b) de l’évaluation du système de gestion de la qualité et de l’évaluation de la documentation technique, avec l’intervention d’un organisme notifié, visée à l’annexe VII. Pour démontrer la conformité d’un système d’IA à haut risque avec les exigences énoncées à la section 2, le fournisseur suit la procédure d’évaluation de la conformité prévue à l’annexe VII dans les cas suivants: a) les normes harmonisées visées à l’article 40 n’existent pas et les spécifications communes visées à l’article 41 font défaut; b) le fournisseur n’a pas appliqué la norme harmonisée ou ne l’a appliquée que partiellement; c) les spécifications communes visées au point a) existent, mais le fournisseur ne les a pas appliquées; d) une ou plusieurs des normes harmonisées visées au point a), ont été publiées assorties d’une restriction et seulement sur la partie de la norme qui a été soumise à une restriction. Aux fins de la procédure d’évaluation de la conformité visée à l’annexe VII, le fournisseur peut choisir n’importe lequel des organismes notifiés. Toutefois, lorsque le système d’IA à haut risque est destiné à être mis en service par les autorités répressives, les services de l’immigration ou les autorités compétentes en matière d’asile ou par les institutions, organes ou organismes de l’UE, l’autorité de surveillance du marché visée à l’article 74, paragraphe 8 ou 9, selon le cas, agit en tant qu’organisme notifié. 2. Pour les systèmes d’IA à haut risque visés à l’annexe III, points 2 à 8, les fournisseurs suivent la procédure d’évaluation de la conformité fondée sur le contrôle interne visée à l’annexe VI, qui ne prévoit pas d’intervention d’un organisme notifié. 3. Pour les systèmes d'IA à haut risque couverts par la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A, le fournisseur du système suit la procédure d'évaluation de la conformité pertinente selon les modalités requises conformément à la législation d'harmonisation de l'Union applicable. Les exigences énoncées à la section 2 du présent chapitre s'appliquent à ces systèmes d'IA à haut risque et font partie de cette évaluation. L'évaluation du système de gestion de la qualité prévue à l'article 17 est également effectuée, et les points 3, 4.3, 4.4 et 4.5, le cinquième paragraphe du point 4.6 et le point 5 de l'annexe VII s'appliquent. Aux fins de ces évaluations de la conformité, les organismes notifiés qui ont été notifiés en vertu de la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A, sont habilités à évaluer la conformité des systèmes d'IA à haut risque avec les exigences énoncées à la section 2 du présent chapitre, à condition que le respect, par ces organismes notifiés, des exigences énoncées à l'article 31, paragraphes 4, 5, 10 et 11, ait été évalué dans le cadre de la procédure de notification conformément à la législation d'harmonisation de l'Union applicable, ce qui est attesté par l'évaluation effectuée dans le cadre de la notification existante. Sans préjudice de l'article 28, les organismes notifiés qui ont été notifiés en vertu de la législation d'harmonisation de l'Union figurant à l'annexe I, section A, introduisent une demande de désignation conformément à la section 4 du présent chapitre au plus tard le 28 janvier 2028. Lorsque la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A, confère au fabricant du produit la faculté de se fonder sur une évaluation de la conformité ne faisant pas intervenir un tiers, à condition que ce fabricant ait appliqué les normes harmonisées afin de garantir le respect de toutes les exigences pertinentes, ce fabricant ne peut faire usage de cette faculté que s'il a également appliqué les normes harmonisées ou, le cas échéant, les spécifications communes visées à l'article 41 couvrant toutes les exigences énoncées à la section 2 du présent chapitre. La classification d'un produit en tant que système d'IA à haut risque conformément à l'article 6, paragraphe 1, n'affecte pas le choix de la procédure d'évaluation de la conformité offert aux fabricants de produits couverts par la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A, y compris, le cas échéant, la possibilité de se fonder sur des normes harmonisées. Les fabricants de ces produits ne sont pas tenus de choisir une procédure d'évaluation de la conformité impliquant une évaluation par un tiers uniquement parce que le produit intègre un système d'IA à haut risque en tant que composant de sécurité, si cela n'est pas requis par la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A. Lorsqu'un système d'IA à haut risque relève à la fois de la législation d'harmonisation de l'Union dont la liste figure à l'annexe I, section A et de l'une des catégories énumérées à l'annexe III, le fournisseur de ce système suit la procédure d'évaluation de la conformité pertinente selon les modalités requises en vertu de la législation d'harmonisation de l'Union applicable dont la liste figure à l'annexe I, section A. 4. Les systèmes d’IA à haut risque qui ont déjà été soumis à une procédure d’évaluation de la conformité sont soumis à une nouvelle procédure d’évaluation de la conformité lorsqu’ils font l’objet de modifications substantielles, que le système modifié soit destiné à être distribué plus largement ou reste utilisé par le déployeur actuel. Pour les systèmes d’IA à haut risque qui continuent leur apprentissage après avoir été mis sur le marché ou mis en service, les modifications apportées au système d’IA à haut risque et à sa performance qui ont été déterminées au préalable par le fournisseur au moment de l’évaluation initiale de la conformité et font partie des informations contenues dans la documentation technique visée à l’annexe IV, point 2), f), ne constituent pas une modification substantielle. 5. La Commission est habilitée à adopter des actes délégués conformément à l’article 97 pour modifier les annexes VI et VII afin de les mettre à jour compte tenu du progrès technique. 6. La Commission est habilitée à adopter des actes délégués conformément à l’article 97 pour modifier les paragraphes 1 et 2 du présent article afin de soumettre les systèmes d’IA à haut risque visés à l’annexe III, points 2 à 8, à tout ou partie de la procédure d’évaluation de la conformité visée à l’annexe VII. La Commission adopte ces actes délégués en tenant compte de l’efficacité de la procédure d’évaluation de la conformité fondée sur le contrôle interne visée à l’annexe VI pour prévenir ou réduire au minimum les risques que ces systèmes font peser sur la santé et la sécurité et sur la protection des droits fondamentaux, ainsi que de la disponibilité de capacités et de ressources suffisantes au sein des organismes notifiés.

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q4 — Quelles conditions la CNIL pose-t-elle au traitement de données de santé dans un projet de recherche ?

`questions-cnil-doctrine.csv` · split `dev` · corpus `cnil` · type `conceptuelle` · attendues : `CNILTEXT000045133748`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `CNILTEXT000054136834#f71` [source](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000054136834) | CNIL > Sanction > Délibération SAN-2026-008 | 0.794 | 116. Ainsi, les traitements de données à caractère personnel dans le domaine de la santé en matière de recherche ne peuvent être mis en œuvre qu’après… |  |  |  |  |
| 2 | `CNILTEXT000048925420#f1` [source](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000048925420) | CNIL > Avis > Délibération 2023-136 | 0.784 | Date de l’avis : 16 novembre 2023 N° de la délibération : 2023-136 N° de demande d’avis : 2230740 Organisme(s) à l’origine de la saisine : Institut na… |  |  |  |  |
| 3 | `CNILTEXT000036195647#f63` [source](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000036195647) | CNIL > Avis > Délibération 2017-299 | 0.781 | L’article 14 du projet de loi vise à insérer dans l’actuel chapitre IX de la loi l’ensemble des dispositions relatives aux traitements de données à ca… |  |  |  |  |
| 4 | `CNILTEXT000017653155#f2` [source](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000017653155) | CNIL > Avis > Délibération 04-041 | 0.780 | EMET L'AVIS SUIVANT Le ministre de la santé, de la famille et des personnes handicapées a saisi la CNIL du projet de décret en Conseil d'Etat relatif … |  |  |  |  |
| 5 | `CNILTEXT000017653248#f2` [source](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000017653248) | CNIL > Avis > Délibération 2005-045 | 0.776 | Emet l'avis suivant Le ministre des solidarités, de la santé et de la famille a saisi à nouveau la Commission nationale de l'informatique et des liber… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>CNILTEXT000054136834#f71</code> · <a href="https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000054136834">source officielle</a></summary>

116. Ainsi, les traitements de données à caractère personnel dans le domaine de la santé en matière de recherche ne peuvent être mis en œuvre qu’après autorisation de la CNIL, ou à la condition d’être conformes à un référentiel mentionné au II de cet article. 117. En l’espèce, la société IQVIA a été autorisée par la CNIL, en application de l’article 66 susvisé (anciennement article 54), à constituer deux entrepôts de données à caractère personnel, comprenant notamment des données de santé. 118. Ces autorisations, matérialisées par les délibérations n° 2018-289 du 12 juillet 2018 et n° 2021-015 du 4 février 2021, conditionnent la mise en œuvre des traitements en cause à un certain nombre de garanties, ayant trait notamment à l’information et aux droits des personnes concernées, ainsi qu’à la sécurité des données traitées. Ces garanties ont notamment pour objet d’assurer le respect des dispositions légales et réglementaires relatives à la protection des données à caractère personnel. Elles tiennent compte de la nature des données en cause, à savoir des données sensibles relatives à la santé des personnes concernées, ainsi que de leur volume. 119. Pour apprécier le bien-fondé des griefs reprochés par le rapporteur à la société en lien avec ces obligations, la formation restreinte s’attachera à examiner si la constitution des entrepôts LRX et EMR est réalisée conformément aux modalités prévues par les délibérations susvisées.

</details>

<details><summary>Rang 2 — <code>CNILTEXT000048925420#f1</code> · <a href="https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000048925420">source officielle</a></summary>

Date de l’avis : 16 novembre 2023 N° de la délibération : 2023-136 N° de demande d’avis : 2230740 Organisme(s) à l’origine de la saisine : Institut national d’études démographiques Projet concerné : projet de recherche hors santé relatif à l’enquête Expériences de la Prison et Réinsertion Sociale à la Sortie (ExPReSS) Thématiques : Recherches scientifiques (hors santé), casier judiciaire national, enquête réinsertion sociale à la sortie de prison, Genesis, Cassiopée Fondement de la saisine : article 44.6° de la loi n° 78-17 du 6 janvier 1978 modifiée relative à l’informatique, aux fichiers et aux libertés L’essentiel : La CNIL estime les traitements de données à caractère personnel mis en œuvre dans le projet de recherche et d’enquête " Expériences de la Prison et Réinsertion Sociale à la Sortie " poursuivent une finalité légitime. La CNIL clarifie dans quelles conditions il est possible d’accéder, à des fins de recherche scientifique, à des données contenues dans des traitements encadrés par des textes qui ne prévoient ni la finalité recherche ni n’autorise un tiers à être rendu destinataire de ces données pour une telle finalité.

</details>

<details><summary>Rang 3 — <code>CNILTEXT000036195647#f63</code> · <a href="https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000036195647">source officielle</a></summary>

L’article 14 du projet de loi vise à insérer dans l’actuel chapitre IX de la loi l’ensemble des dispositions relatives aux traitements de données à caractère personnel dans le domaine de la santé ; il comporte à cette fin deux sections : l’une relative aux dispositions générales, l’autre relative aux traitements à des fins de recherche, d’étude ou d’évaluation dans le domaine de la santé. A titre liminaire, la Commission estime utile qu’un chapitre de la loi soit dédié aux traitements de données de santé. Elle prend acte de l’économie générale retenue qui ne vise pas à bouleverser les principes en matière de traitement de données de santé qui, pour ceux issus de la loi de modernisation de notre système de santé de janvier 2016, rentrent seulement en application depuis quelques mois. Elle relève toutefois le maintien d’un processus d’autorisation exigeant, encadrant les traitements relatifs à la recherche dans le domaine de la santé, en comparaison de l’allègement général des formalités préalables portées par le Règlement et le projet de loi qui lui est soumis.

</details>

<details><summary>Rang 4 — <code>CNILTEXT000017653155#f2</code> · <a href="https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000017653155">source officielle</a></summary>

EMET L'AVIS SUIVANT Le ministre de la santé, de la famille et des personnes handicapées a saisi la CNIL du projet de décret en Conseil d'Etat relatif aux conditions d'agrément des hébergeurs de données de santé à caractère personnel prévu en application des dispositions de l'article L. 1111-8 du code de la santé publique. Aux termes de celles-ci : "les professionnels de santé ou les établissements de santé ou la personne concernée peuvent déposer des données de santé à caractère personnel, recueillies ou produites à l'occasion des activités de prévention, de diagnostic ou de soins, auprès de personnes physiques ou morales agréées à cet effet. Cet hébergement de données ne peut avoir lieu qu'avec le consentement exprès de la personne concernée. Les traitements de données de santé à caractère personnel que nécessite l'hebergement doivent être réalisés dans le respect des dispositions de la loi du 6 janvier 1978. Les conditions d'agrément des hébergeurs sont fixées par décret en Conseil d'Etat pris après avis de la CNIL et des conseils de l'ordre des professions de santé ainsi que du conseil des professions médicales". Conformément à ces dispositions, le projet de décret "mentionne les informations qui doivent être fournies à l'appui de la demande d'agrément, notamment les modèles de contrats prévus au deuxième alinéa et les dispositions prises pour garantir la sécurité des données traitées en application de l'article 29 de la loi n° 78-17 du 6 janvier 1978

</details>

<details><summary>Rang 5 — <code>CNILTEXT000017653248#f2</code> · <a href="https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000017653248">source officielle</a></summary>

Emet l'avis suivant Le ministre des solidarités, de la santé et de la famille a saisi à nouveau la Commission nationale de l'informatique et des libertés du projet de décret en Conseil d'Etat relatif aux conditions d'agrément des hébergeurs de données de santé à caractère personnel prévu en application des dispositions de l'article L. 1111-8 du code de la santé publique. Cet article est ainsi rédigé : "Les professionnels de santé ou les établissements de santé ou la personne concernée peuvent déposer des données de santé à caractère personnel, recueillies ou produites à l'occasion des activités de prévention, de diagnostic ou de soins, auprès de personnes physiques ou morales agréées à cet effet. Cet hébergement de données ne peut avoir lieu qu'avec le consentement exprès de la personne concernée. Les traitements de données de santé à caractère personnel que nécessite l'hébergement doivent être réalisés dans le respect des dispositions de la loi du 6 janvier 1978. Les conditions d'agrément des hébergeurs sont fixées par décret en Conseil d'Etat pris après avis de la CNIL et des conseils de l'ordre des professions de santé ainsi que du conseil des professions médicales". Le projet de décret "mentionne les informations qui doivent être fournies à l'appui de la demande d'agrément, notamment les modèles de contrats prévus au deuxième alinéa et les dispositions prises pour garantir la sécurité des données traitées en application de l'article 29 de la loi n° 78-17 du

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q5 — À quel âge un mineur peut-il consentir seul à un traitement de données en ligne ?

`questions-lil.csv` · split `dev` · corpus `lil` · type `conceptuelle` · attendues : `LEGIARTI000037823135`

Niveau rendu par le serveur : `confiant`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `LEGIARTI000037823135` [source](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823135) | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre Ier : Dispositions générales | 0.749 | En application du 1 de l'article 8 du règlement (UE) 2016/679 du 27 avril 2016, un mineur peut consentir seul à un traitement de données à caractère p… |  |  |  |  |
| 2 | `LEGIARTI000037822950` [source](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037822950) | LIL > Titre Ier : Dispositions communes > Chapitre Ier : Principes et définitions | 0.655 | Un traitement de données à caractère personnel n'est licite que si, et dans la mesure où, il remplit au moins une des conditions suivantes: 1° Le trai… |  |  |  |  |
| 3 | `LEGIARTI000037823040` [source](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823040) | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre III : Obligations incombant au responsable du traitement et au sous-traitant > Section 3 : Traitements de données à caractère personnel dans le domaine de la santé > Sous-section 1 : Dispositions générales | 0.649 | Sont destinataires de l'information et exercent les droits de la personne concernée par le traitement les titulaires de l'exercice de l'autorité paren… |  |  |  |  |
| 4 | `LEGIARTI000037823081` [source](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823081) | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre III : Obligations incombant au responsable du traitement et au sous-traitant > Section 1 : Obligations générales | 0.640 | Conformément à l'article 29 du règlement (UE) 2016/679 du 27 avril 2016, sauf dispositions législatives ou réglementaires contraires, il est interdit … |  |  |  |  |
| 5 | `LEGIARTI000043887431` [source](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000043887431) | LIL > Titre II : Traitements relevant du régime de protection des données à caractère personnel prévu par le règlement (UE) 2016/679 du 27 avril 2016 > Chapitre II : Droits de la personne concernée | 0.637 | Le droit à l'information s'exerce dans les conditions prévues aux articles 12 à 14 du règlement (UE) 2016/679 du 27 avril 2016. En particulier, lorsqu… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>LEGIARTI000037823135</code> · <a href="https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823135">source officielle</a></summary>

En application du 1 de l'article 8 du règlement (UE) 2016/679 du 27 avril 2016, un mineur peut consentir seul à un traitement de données à caractère personnel en ce qui concerne l'offre directe de services de la société de l'information à compter de l'âge de quinze ans. Lorsque le mineur est âgé de moins de quinze ans, le traitement n'est licite que si le consentement est donné conjointement par le mineur concerné et le ou les titulaires de l'autorité parentale à l'égard de ce mineur. Le responsable de traitement rédige en des termes clairs et simples, aisément compréhensibles par le mineur, les informations et communications relatives au traitement qui le concerne.

</details>

<details><summary>Rang 2 — <code>LEGIARTI000037822950</code> · <a href="https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037822950">source officielle</a></summary>

Un traitement de données à caractère personnel n'est licite que si, et dans la mesure où, il remplit au moins une des conditions suivantes: 1° Le traitement, lorsqu'il relève du titre II, a reçu le consentement de la personne concernée, dans les conditions mentionnées au 11 de l'article 4 et à l'article 7 du règlement (UE) 2016/679 du 27 avril 2016 précédemment mentionné; 2° Le traitement est nécessaire à l'exécution d'un contrat auquel la personne concernée est partie ou à l'exécution de mesures précontractuelles prises à la demande de celle-ci; 3° Le traitement est nécessaire au respect d'une obligation légale à laquelle le responsable du traitement est soumis; 4° Le traitement est nécessaire à la sauvegarde des intérêts vitaux de la personne concernée ou d'une autre personne physique; 5° Le traitement est nécessaire à l'exécution d'une mission d'intérêt public ou relevant de l'exercice de l'autorité publique dont est investi le responsable du traitement; 6° Sauf pour les traitements effectués par les autorités publiques dans l'exécution de leurs missions, le traitement est nécessaire aux fins des intérêts légitimes poursuivis par le responsable du traitement ou par un tiers, à moins que ne prévalent les intérêts ou les libertés et droits fondamentaux de la personne concernée qui exigent une protection des données à caractère personnel, notamment lorsque la personne concernée est un enfant.

</details>

<details><summary>Rang 3 — <code>LEGIARTI000037823040</code> · <a href="https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823040">source officielle</a></summary>

Sont destinataires de l'information et exercent les droits de la personne concernée par le traitement les titulaires de l'exercice de l'autorité parentale, pour les mineurs, ou la personne chargée d'une mission de représentation dans le cadre d'une tutelle, d'une habilitation familiale ou d'un mandat de protection future, pour les majeurs protégés dont l'état ne leur permet pas de prendre seuls une décision personnelle éclairée. Par dérogation au premier alinéa du présent article, pour les traitements de données à caractère personnel réalisés dans le cadre de recherches mentionnées aux 2° et 3° de l'article L. 1121-1 du code de la santé publique ou d'études ou d'évaluations dans le domaine de la santé, ayant une finalité d'intérêt public et incluant des personnes mineures, l'information peut être effectuée auprès d'un seul des titulaires de l'exercice de l'autorité parentale s'il est impossible d'informer l'autre titulaire ou s'il ne peut être consulté dans des délais compatibles avec les exigences méthodologiques propres à la réalisation de la recherche, de l'étude ou de l'évaluation au regard de ses finalités. Le présent alinéa ne fait pas obstacle à l'exercice ultérieur, par chaque titulaire de l'exercice de l'autorité parentale, des droits mentionnés au premier alinéa. Pour ces traitements, le mineur âgé de quinze ans ou plus peut s'opposer à ce que les titulaires de l'exercice de l'autorité parentale aient accès aux données le concernant recueillies au cours de la recherche, de l'étude ou de l'évaluation. Le mineur reçoit alors l'information et exerce seul ses droits. Pour ces mêmes traitements, le mineur âgé de quinze ans ou plus peut s'opposer à ce que les titulaires de l'exercice de l'autorité parentale soient informés du traitement de données si le fait d'y participer conduit à révéler une information sur une action de prévention, un dépistage, un diagnostic, un traitement ou une intervention pour laquelle le mineur s'est expressément opposé à la consultation des titulaires de l'autorité parentale, en application des articles L. 1111-5 et L. 1111-5-1 du code de la santé publique, ou si les liens de famille sont rompus et que le mineur bénéficie à titre personnel du remboursement des prestations en nature de l'assurance maladie et maternité et de la couverture complémentaire mise en place par la loi n° 99-641 du 27 juillet 1999 portant création d'une couverture maladie universelle. Il exerce alors seul ses droits.

</details>

<details><summary>Rang 4 — <code>LEGIARTI000037823081</code> · <a href="https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037823081">source officielle</a></summary>

Conformément à l'article 29 du règlement (UE) 2016/679 du 27 avril 2016, sauf dispositions législatives ou réglementaires contraires, il est interdit au sous-traitant ou à toute autre personne agissant sous l'autorité du responsable du traitement ou sous celle du sous-traitant ayant accès à des données à caractère personnel de traiter ces données sans l'accord du responsable du traitement.

</details>

<details><summary>Rang 5 — <code>LEGIARTI000043887431</code> · <a href="https://www.legifrance.gouv.fr/loda/id/LEGIARTI000043887431">source officielle</a></summary>

Le droit à l'information s'exerce dans les conditions prévues aux articles 12 à 14 du règlement (UE) 2016/679 du 27 avril 2016. En particulier, lorsque les données à caractère personnel sont collectées auprès d'un mineur de moins de quinze ans, le responsable de traitement transmet au mineur les informations mentionnées à l'article 13 de ce règlement dans un langage clair et facilement accessible. La personne auprès de laquelle sont recueillies des données à caractère personnel la concernant est également informée, sauf si elle l'a été au préalable, par le responsable du traitement ou son représentant du droit de définir des directives relatives au sort de ses données à caractère personnel après sa mort, dans les conditions prévues à l'article 85. En application de l'article 23 du même règlement, le droit à l'information ne s'applique pas aux données collectées dans les conditions prévues à l'article 14 de ce règlement et utilisées lors d'un traitement mis en œuvre pour le compte de l'Etat et intéressant la sécurité publique, dans la mesure où une telle limitation est nécessaire au respect des fins poursuivies par ce traitement et prévue par l'acte instaurant le traitement. Il est fait application des dispositions de l'alinéa précédent lorsque le traitement est mis en œuvre par les administrations publiques qui ont pour mission soit de contrôler ou de recouvrer des impositions soit d'effectuer des contrôles de l'activité de personnes physiques ou morales pouvant donner lieu à la constatation d'une infraction ou d'un manquement, à des amendes administratives ou à des pénalités. Le premier alinéa ne s'applique pas à l'information selon laquelle des données à caractère personnel ont été transmises en application du premier alinéa de l'article L. 863-2 du code de la sécurité intérieure.

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q6 — Dans quels cas la personne concernée peut-elle obtenir l'effacement de ses données personnelles ?

`questions-ce.csv` · split `dev` · corpus `ce` · type `conceptuelle` · attendues : `CETATEXT000047773954`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `CETATEXT000051049451#f6` [source](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000051049451) | Conseil d'État > Décision 490416 | 0.755 | 2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que… |  |  |  |  |
| 2 | `CETATEXT000051049452#f4` [source](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000051049452) | Conseil d'État > Décision 490417 | 0.750 | 2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que… |  |  |  |  |
| 3 | `CETATEXT000049149941#f3` [source](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000049149941) | Conseil d'État > Décision 474625 | 0.748 | 2. En premier lieu, l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 relatif à la protection des personnes… |  |  |  |  |
| 4 | `CETATEXT000054758945#f3` [source](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000054758945) | Conseil d'État > Décision 508655 | 0.747 | 2. D'une part, aux termes du paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD): " La… |  |  |  |  |
| 5 | `CETATEXT000039456972#f5` [source](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000039456972) | Conseil d'État > Décision 405910 | 0.745 | 5. Aux termes de l'article 17 du règlement 2016/679 du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du traitement des donné… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>CETATEXT000051049451#f6</code> · <a href="https://www.legifrance.gouv.fr/ceta/id/CETATEXT000051049451">source officielle</a></summary>

2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que la " personne concernée a le droit d'obtenir du responsable du traitement l'effacement, dans les meilleurs délais, de données à caractère personnel la concernant " et énumère les motifs devant en principe conduire. Le paragraphe 3 de cet article prévoit toutefois que le paragraphe 1 ne s'applique pas, notamment, " dans la mesure où le traitement est nécessaire à la constatation, à l'exercice ou à la défense de droits en justice ". Selon le I de l'article 51 de la loi du 6 janvier 1978: " Le droit à l'effacement s'exerce dans les conditions prévues à l'article 17 du règlement (UE) 2016/679 du 27 avril 2016 ". Selon le II du même article: " En cas de non-exécution de l'effacement des données à caractère personnel ou en cas d'absence de réponse du responsable du traitement dans un délai d'un mois à compter de la demande, la personne concernée peut saisir la Commission nationale de l'informatique et des libertés (...) ".

</details>

<details><summary>Rang 2 — <code>CETATEXT000051049452#f4</code> · <a href="https://www.legifrance.gouv.fr/ceta/id/CETATEXT000051049452">source officielle</a></summary>

2. En premier lieu, le paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD) dispose que la " personne concernée a le droit d'obtenir du responsable du traitement l'effacement, dans les meilleurs délais, de données à caractère personnel la concernant " et énumère les motifs devant en principe conduire. Le paragraphe 3 de cet article prévoit toutefois que le paragraphe 1 ne s'applique pas, notamment, " dans la mesure où le traitement est nécessaire à la constatation, à l'exercice ou à la défense de droits en justice ". Selon le I de l'article 51 de la loi du 6 janvier 1978: " Le droit à l'effacement s'exerce dans les conditions prévues à l'article 17 du règlement (UE) 2016/679 du 27 avril 2016 ". Selon le II du même article: " En cas de non-exécution de l'effacement des données à caractère personnel ou en cas d'absence de réponse du responsable du traitement dans un délai d'un mois à compter de la demande, la personne concernée peut saisir la Commission nationale de l'informatique et des libertés (...) ".

</details>

<details><summary>Rang 3 — <code>CETATEXT000049149941#f3</code> · <a href="https://www.legifrance.gouv.fr/ceta/id/CETATEXT000049149941">source officielle</a></summary>

2. En premier lieu, l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du traitement des données à caractère personnel et à la libre circulation de ces données (dit RGPD) dispose que: " 1. La personne concernée a le droit d'obtenir du responsable du traitement l'effacement, dans les meilleurs délais, de données à caractère personnel la concernant et le responsable du traitement a l'obligation d'effacer ces données à caractère personnel dans les meilleurs délais lorsque l'un des motifs suivants s'applique (...). ". L'article 51 de la loi du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés dispose que: " I. Le droit à l'effacement s'exerce dans les conditions prévues à l'article 17 du règlement (UE) 2016/679 du 27 avril 2016. / (...) En cas de non-exécution de l'effacement des données à caractère personnel ou en cas d'absence de réponse du responsable du traitement dans un délai d'un mois à compter de la demande, la personne concernée peut saisir la Commission nationale de l'informatique et des libertés, qui se prononce sur cette demande dans un délai de trois semaines à compter de la date de réception de la réclamation ".

</details>

<details><summary>Rang 4 — <code>CETATEXT000054758945#f3</code> · <a href="https://www.legifrance.gouv.fr/ceta/id/CETATEXT000054758945">source officielle</a></summary>

2. D'une part, aux termes du paragraphe 1 de l'article 17 du règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (RGPD): " La personne concernée a le droit d'obtenir du responsable du traitement l'effacement, dans les meilleurs délais, de données à caractère personnel la concernant et le responsable du traitement a l'obligation d'effacer ces données à caractère personnel dans les meilleurs délais, lorsque l'un des motifs suivants s'applique: / (...) / c) la personne concernée s'oppose au traitement en vertu de l'article 21, paragraphe 1, et il n'existe pas de motif légitime impérieux pour le traitement (...) ". Aux termes du paragraphe 3 du même article: " Les paragraphes 1 et 2 ne s'appliquent pas dans la mesure où ce traitement est nécessaire: / (...) / e) à la constatation, à l'exercice ou à la défense de droits en justice ".

</details>

<details><summary>Rang 5 — <code>CETATEXT000039456972#f5</code> · <a href="https://www.legifrance.gouv.fr/ceta/id/CETATEXT000039456972">source officielle</a></summary>

5. Aux termes de l'article 17 du règlement 2016/679 du 27 avril 2016 relatif à la protection des personnes physiques à l'égard du traitement des données à caractère personnel et à la libre circulation de ces données et abrogeant la directive 95/46/CE du 24 octobre 1995, dit règlement général sur la protection des données: " 1. La personne concernée a le droit d'obtenir du responsable du traitement l'effacement, dans les meilleurs délais, de données à caractère personnel la concernant et le responsable du traitement a l'obligation d'effacer ces données à caractère personnel dans les meilleurs délais, lorsque l'un des motifs suivants s'applique: / a) les données à caractère personnel ne sont plus nécessaires au regard des finalités pour lesquelles elles ont été collectées ou traitées d'une autre manière; / b) la personne concernée retire le consentement sur lequel est fondé le traitement, conformément à l'article 6, paragraphe 1, point a), ou à l'article 9, paragraphe 2, point a), et il n'existe pas d'autre fondement juridique au traitement; / c) la personne concernée s'oppose au traitement en vertu de l'article 21, paragraphe 1, et il n'existe pas de motif légitime impérieux pour le traitement, ou la personne concernée s'oppose au traitement en vertu de l'article 21, paragraphe 2; / d) les données à caractère personnel ont fait l'objet d'un traitement illicite; / e) les données à caractère personnel doivent être effacées pour respecter une obligation légale qui est prévue par le droit de l'Union ou par le droit de l'État membre auquel le responsable du traitement est soumis; f) les données à caractère personnel ont été collectées dans le cadre de l'offre de services de la société de l'information visée à l'article 8, paragraphe 1. [...] 3. Les paragraphes 1 et 2 ne s'appliquent pas dans la mesure où ce traitement est nécessaire: / a) à l'exercice du droit à la liberté d'expression et d'information [...] ".

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q7 — Comment le CEPD calcule-t-il le montant des amendes administratives au titre du RGPD ?

`questions-cepd.csv` · split `dev` · corpus `cepd` · type `conceptuelle` · attendues : `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr`

Niveau rendu par le serveur : `confiant`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f236` [source](https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr) | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.809 | Par conséquent, aucun ajustement supplémentaire n’est réalisé. À la suite de cette appréciation, l’autorité de contrôle procède au calcul du montant d… |  |  |  |  |
| 2 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f6` [source](https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr) | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.786 | 7 1.1 – Cadre juridique ..............................................................................................................................… |  |  |  |  |
| 3 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f16` [source](https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr) | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.785 | 47 ANNEXE – TABLEAU D’ILLUSTRATION DES LIGNES DIRECTRICES 04/2022 SUR LE CALCUL DES AMENDES ADMINISTRATIVES AU TITRE DU RGPD .........................… |  |  |  |  |
| 4 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f20` [source](https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr) | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.770 | Les présentes lignes directrices portent sur la méthode de calcul desdites amendes administratives. 1 Dans le présent document, on entend par «États m… |  |  |  |  |
| 5 | `guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f8` [source](https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr) | CEPD > Lignes directrices > Lignes directrices 04/2022 sur le calcul des amendes administratives au titre du RGPD | 0.768 | 13 3.1 – Comportement unique passible de sanctions ...................................................................................................… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f236</code> · <a href="https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr">source officielle</a></summary>

Par conséquent, aucun ajustement supplémentaire n’est réalisé. À la suite de cette appréciation, l’autorité de contrôle procède au calcul du montant de l’amende sur la base du reste des présentes lignes directrices.

</details>

<details><summary>Rang 2 — <code>guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f6</code> · <a href="https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr">source officielle</a></summary>

7 1.1 – Cadre juridique ..................................................................................................................................................7 1.2 – Objectifs ............................................................................................................................................................8 1.3 – Champ d’application ..........................................................................................................................................8 1.4 – Applicabilité .......................................................................................................................................................9 CHAPITRE 2 – MÉTHODE DE CALCUL DU MONTANT DE L’AMENDE ...............................................................

</details>

<details><summary>Rang 3 — <code>guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f16</code> · <a href="https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr">source officielle</a></summary>

47 ANNEXE – TABLEAU D’ILLUSTRATION DES LIGNES DIRECTRICES 04/2022 SUR LE CALCUL DES AMENDES ADMINISTRATIVES AU TITRE DU RGPD ..................................................................................................... 48

</details>

<details><summary>Rang 4 — <code>guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f20</code> · <a href="https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr">source officielle</a></summary>

Les présentes lignes directrices portent sur la méthode de calcul desdites amendes administratives. 1 Dans le présent document, on entend par «États membres» les «États membres de l’EEE». 2 Lignes directrices sur l’application et la fixation des amendes administratives aux fins du règlement (UE) 2016/679, WP 253 (ci-après les «lignes directrices WP 253»). Les lignes directrices WP 253 ont été approuvées par l’EDPB au cours de sa première réunion plénière du 25 mai 2018. Voir la déclaration d’approbation 1/2018, disponible en ligne à cette adresse. 8 Adoptées Ces deux séries de lignes directrices peuvent s’appliquer simultanément et doivent être considérées comme complémentaires.

</details>

<details><summary>Rang 5 — <code>guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr#f8</code> · <a href="https://www.edpb.europa.eu/documents/guideline/guidelines-042022-on-the-calculation-of-administrative-fines-under-the-gdpr_fr">source officielle</a></summary>

13 3.1 – Comportement unique passible de sanctions ...................................................................................................14 3.1.1 – Concours d’infractions ..................................................................................................................................15 3.1.2 – Unité d’action – Article 83, paragraphe 3, du RGPD .................................................................... 17 3.2 – Comportements multiples passibles de sanctions ............................................................................................18 CHAPITRE 4 – MONTANT DE DÉPART DU CALCUL......................................................................................

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q8 — Les images d'un système de vidéoprotection peuvent-elles fonder une sanction disciplinaire ?

`questions-cc.csv` · split `dev` · corpus `cc` · type `conceptuelle` · attendues : `682d68f316fd466a1ce900c4`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `68b7e546d7454f2f74c1ed90#f8` [source](https://www.courdecassation.fr/decision/68b7e546d7454f2f74c1ed90) | Cour de cassation > Chambre criminelle > Décision du 3 septembre 2025 > 24-83.464 > Texte | 0.727 | 9. Ils constatent que tout système de vidéoprotection comporte des images où apparaissent des personnes pouvant être considérées, dans certains cas, c… |  |  |  |  |
| 2 | `6a9fc91c195da062e0a4b6f5#f14` [source](https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5) | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.727 | 21. En deuxième lieu, il résulte des articles R. 251-1 et R. 253-3, III, 4°, de ce même code que les personnes mettant en oeuvre un système de vidéopr… |  |  |  |  |
| 3 | `6a9fc91c195da062e0a4b6f5#f13` [source](https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5) | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.704 | 19. S'agissant de telles hypothèses, en premier lieu, d'une part, les dispositions du code de la sécurité intérieure relatives aux personnes pouvant a… |  |  |  |  |
| 4 | `6a9fc91c195da062e0a4b6f5#f9` [source](https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5) | Cour de cassation > Chambre criminelle > Décision du 8 septembre 2026 > 25-86.733 > Texte | 0.703 | 2°/ d'autre part, que seuls les enquêteurs spécialement habilités et individuellement désignés à cette fin, ou les tiers ayant eux-mêmes cette qualité… |  |  |  |  |
| 5 | `6ab23021c27382d099dea4e2#f33` [source](https://www.courdecassation.fr/decision/6ab23021c27382d099dea4e2) | Cour de cassation > Chambre criminelle > Décision du 22 septembre 2026 > 26-80.457 > Texte | 0.696 | Réponse de la Cour 30. Pour déclarer le requérant irrecevable en son moyen de nullité de l'exploitation d'images issues du système de vidéoprotection … |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>68b7e546d7454f2f74c1ed90#f8</code> · <a href="https://www.courdecassation.fr/decision/68b7e546d7454f2f74c1ed90">source officielle</a></summary>

9. Ils constatent que tout système de vidéoprotection comporte des images où apparaissent des personnes pouvant être considérées, dans certains cas, comme identifiables au sens de la directive (UE) 2016/680 du Parlement européen et du Conseil du 27 avril 2016 et de la loi n° 78-17 du 6 janvier 1978, et que ce type de système est autorisé par le code de la sécurité intérieure. 10. C'est à tort que les juges ont considéré que le recueil d'images de plaques d'immatriculation de véhicules, ne constituait pas une exploitation de données personnelles. 11. Cependant, l'arrêt n'encourt pas la censure pour les motifs qui suivent.

</details>

<details><summary>Rang 2 — <code>6a9fc91c195da062e0a4b6f5#f14</code> · <a href="https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5">source officielle</a></summary>

21. En deuxième lieu, il résulte des articles R. 251-1 et R. 253-3, III, 4°, de ce même code que les personnes mettant en oeuvre un système de vidéoprotection dans des lieux ou établissements ouverts au public, pouvant être requises directement ou par l'intermédiaire de leur représentant, sont nécessairement autorisées à répondre aux réquisitions ou à remettre spontanément les images provenant de ces systèmes aux officiers et agents de police judiciaire. 22. En troisième lieu, il se déduit des mêmes textes que les services chargés par les autorités publiques de la mise en oeuvre et de l'exploitation de systèmes de vidéoprotection sur la voie publique, pouvant être requis directement ou par l'intermédiaire de leur représentant, sont également nécessairement autorisés à répondre aux réquisitions ou à remettre spontanément les images provenant de ces systèmes aux officiers et agents de police judiciaire.

</details>

<details><summary>Rang 3 — <code>6a9fc91c195da062e0a4b6f5#f13</code> · <a href="https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5">source officielle</a></summary>

19. S'agissant de telles hypothèses, en premier lieu, d'une part, les dispositions du code de la sécurité intérieure relatives aux personnes pouvant accéder aux images de vidéoprotection ou en être destinataires, le cas échéant sous condition d'habilitation et de désignation individuelle, ne sauraient faire obstacle aux pouvoirs de réquisition résultant des articles 60-1, 77-1-1 ou 99-3 du code de procédure pénale, lesquels ne prévoient aucune condition d'habilitation des enquêteurs. 20. D'autre part, il résulte de l'article R. 253-3, III, 4°, du code de la sécurité intérieure que les personnes mettant en oeuvre un système de vidéoprotection peuvent rendre destinataires des images auxquelles elles ont accès les agents et officiers de police judiciaire, sans qu'aucune habilitation ne soit nécessaire pour ceux-ci.

</details>

<details><summary>Rang 4 — <code>6a9fc91c195da062e0a4b6f5#f9</code> · <a href="https://www.courdecassation.fr/decision/6a9fc91c195da062e0a4b6f5">source officielle</a></summary>

2°/ d'autre part, que seuls les enquêteurs spécialement habilités et individuellement désignés à cette fin, ou les tiers ayant eux-mêmes cette qualité et ayant été requis à cette fin, peuvent accéder aux images d'un système de vidéoprotection ; qu'il appartient à la chambre de l'instruction, saisie d'un moyen en ce sens, de contrôler la réalité et la régularité de l'habilitation des enquêteurs ou des tiers ayant accédé aux images extraites d'un système de vidéoprotection ; qu'au cas d'espèce, il résulte de la procédure que les enquêteurs ont procédé à l'exploitation des images et enregistrements du système de vidéoprotection de l'agence [1], sise [Adresse 1] à [Localité 1] sur la commune de [Localité 2], du centre de surveillance urbain de la ville d'[Localité 3], et de l'hôtel [Etablissement 1] sis [Adresse 2] à [Localité 4] ; que la défense relevait néanmoins qu'aucune habilitation des enquêteurs ayant consulté ces images et enregistrements ni aucune réquisition auprès d'une personne régulièrement habilitée à cette fin n'était versée en procédure, de sorte qu'elle était fondée à solliciter l'annulation des procès-verbaux relatant leur exploitation ; qu'en retenant, pour dire la consultation régulière, que « chaque réquisition a été délivrée à une personne nécessairement habilitée : [1] (D20-42), le responsable du centre de surveillance urbain (CSU) de la ville d'[Localité 3] (D44-45 ; D63 ; D83-85), le directeur de l'hôtel [Etablissement 1] sise [Adresse 2] à [Localité 4] (D132) », quand ces motifs sont insuffisants et impropres à établir la réalité de l'habilitation individuelle et spéciale à la consultation des images et enregistrements de systèmes de vidéoprotection de chacune des personnes requises à cette fin, la chambre de l'instruction a violé les articles L. 251-1, L. 251-2, L. 252-1, L. 252-2, L. 252-3, R. 251-1, R. 253-1 et R. 253-3 du Code de la sécurité intérieure, 15-5, 591 et 593 du Code de procédure pénale. »

</details>

<details><summary>Rang 5 — <code>6ab23021c27382d099dea4e2#f33</code> · <a href="https://www.courdecassation.fr/decision/6ab23021c27382d099dea4e2">source officielle</a></summary>

Réponse de la Cour 30. Pour déclarer le requérant irrecevable en son moyen de nullité de l'exploitation d'images issues du système de vidéoprotection de la ville de Paris pour défaut d'habilitation des agents ayant directement consulté ce système, l'arrêt attaqué énonce que les procès-verbaux en cause ont été établis au cours des mois de juillet 2022, janvier et février 2023, que l'intéressé a été mis en examen le 27 mars 2023 et qu'il lui appartenait de saisir la chambre de l'instruction dans le délai de six mois suivant cette date. 31. En statuant ainsi, la chambre de l'instruction a fait l'exacte application des textes visés au moyen.

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q9 — Une adresse IP dynamique constitue-t-elle une donnée à caractère personnel pour l'éditeur d'un site ?

`questions-cjue.csv` · split `dev` · corpus `cjue` · type `conceptuelle` · attendues : `62014CJ0582`

Niveau rendu par le serveur : `incertain`.

| Rang | `ref` | `chemin` | Similarité | Extrait | Pertinent : oui | Pertinent : non | Citation exacte : oui | Citation exacte : non |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |
| 1 | `62014CJ0582#point20` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582) | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.750 | Selon cette juridiction d’appel, une adresse IP dynamique, en combinaison avec la date de la session de consultation à laquelle elle se rapporte, cons… |  |  |  |  |
| 2 | `62014CJ0582#point39` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582) | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.748 | Ensuite, afin de déterminer si une adresse IP dynamique constitue, dans l’hypothèse exposée au point 37 du présent arrêt, une donnée à caractère perso… |  |  |  |  |
| 3 | `62014CJ0582#point49` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582) | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.747 | Eu égard à l’ensemble des considérations qui précèdent, il convient de répondre à la première question que l’article 2, sous a), de la directive 95/46… |  |  |  |  |
| 4 | `62014CJ0582#point31` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582) | CJUE > Arrêt de la Cour C-582/14 > Motifs | 0.739 | Par sa première question, la juridiction de renvoi demande, en substance, si l’article 2, sous a), de la directive 95/46 doit être interprété en ce se… |  |  |  |  |
| 5 | `62019CJ0597#point102` [source](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62019CJ0597) | CJUE > Arrêt de la Cour C-597/19 > Motifs | 0.731 | En premier lieu, s’agissant du traitement en amont en cause au principal, il y a lieu de rappeler qu’une adresse IP dynamique enregistrée par un fourn… |  |  |  |  |

Textes complets (cliquer pour déplier) :

<details><summary>Rang 1 — <code>62014CJ0582#point20</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582">source officielle</a></summary>

Selon cette juridiction d’appel, une adresse IP dynamique, en combinaison avec la date de la session de consultation à laquelle elle se rapporte, constitue, lorsque l’utilisateur du site Internet considéré a révélé son identité pendant cette session, une donnée à caractère personnel, parce que l’opérateur de ce site peut identifier cet utilisateur en croisant son nom avec l’adresse IP de son ordinateur.

</details>

<details><summary>Rang 2 — <code>62014CJ0582#point39</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582">source officielle</a></summary>

Ensuite, afin de déterminer si une adresse IP dynamique constitue, dans l’hypothèse exposée au point 37 du présent arrêt, une donnée à caractère personnel au sens de l’article 2, sous a), de la directive 96/45 à l’égard d’un fournisseur de services de médias en ligne, il convient de vérifier si une telle adresse IP, enregistrée par un tel fournisseur, peut être qualifiée d’information se rapportant à une «personne physique identifiable», lorsque les informations supplémentaires nécessaires pour identifier l’utilisateur d’un site Internet que ce fournisseur de services rend accessible au public sont détenues par le fournisseur d’accès à Internet de cet utilisateur.

</details>

<details><summary>Rang 3 — <code>62014CJ0582#point49</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582">source officielle</a></summary>

Eu égard à l’ensemble des considérations qui précèdent, il convient de répondre à la première question que l’article 2, sous a), de la directive 95/46 doit être interprété en ce sens qu’une adresse IP dynamique enregistrée par un fournisseur de services de médias en ligne à l’occasion de la consultation par une personne d’un site Internet que ce fournisseur rend accessible au public constitue, à l’égard dudit fournisseur, une donnée à caractère personnel au sens de cette disposition, lorsqu’il dispose de moyens légaux lui permettant de faire identifier la personne concernée grâce aux informations supplémentaires dont dispose le fournisseur d’accès à Internet de cette personne. Sur la seconde question

</details>

<details><summary>Rang 4 — <code>62014CJ0582#point31</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62014CJ0582">source officielle</a></summary>

Par sa première question, la juridiction de renvoi demande, en substance, si l’article 2, sous a), de la directive 95/46 doit être interprété en ce sens qu’une adresse IP dynamique enregistrée par un fournisseur de services de médias en ligne à l’occasion de la consultation par une personne d’un site Internet que ce fournisseur rend accessible au public constitue, à l’égard dudit fournisseur, une donnée à caractère personnel au sens de cette disposition, lorsque seul un tiers, en l’occurrence le fournisseur d’accès à Internet de cette personne, dispose des informations supplémentaires nécessaires pour identifier celle‑ci.

</details>

<details><summary>Rang 5 — <code>62019CJ0597#point102</code> · <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62019CJ0597">source officielle</a></summary>

En premier lieu, s’agissant du traitement en amont en cause au principal, il y a lieu de rappeler qu’une adresse IP dynamique enregistrée par un fournisseur de services de médias en ligne à l’occasion de la consultation par une personne d’un site Internet que ce fournisseur rend accessible au public constitue, à l’égard dudit fournisseur, une donnée à caractère personnel, au sens de l’article 4, point 1, du règlement 2016/679, lorsqu’il dispose de moyens légaux lui permettant de faire identifier la personne concernée grâce aux informations supplémentaires dont dispose le fournisseur d’accès à Internet de cette personne (arrêt du 19 octobre 2016, Breyer, C‑582/14, EU:C:2016:779, point 49).

</details>


| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Passage(s) attendu(s) présent(s) dans le top 5 |  |  | — |
| Limite signalée (hors périmètre seulement) |  |  |  |
| **Minutes** (dans la colonne Oui) |  | — | — |

### Q10 — Quelles mentions obligatoires figurent sur une facture d'électricité ?

`questions-v3.csv` · split `dev` · corpus `rgpd` · type `piege` · attendues : `—` · hors périmètre

Niveau rendu par le serveur : `aucun_resultat_fiable`.

Aucun passage rendu : le serveur refuse sous le seuil bas.

| Critère | Oui | Non | Sans objet |
| --- | :---: | :---: | :---: |
| Limite signalée (le refus est-il explicite et juste ?) |  |  | — |
| **Minutes** (dans la colonne Oui) |  | — | — |

