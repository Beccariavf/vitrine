Je consulte d'abord le connecteur juridique et les décisions récentes de la CNIL, pour que la réponse repose sur des sources à jour.

# Bandeau cookies non conforme : risques et sanctions

Un bandeau non conforme expose l'éditeur du site à une sanction de la CNIL, qui peut aller jusqu'à 20 M€ ou 4 % du chiffre d'affaires mondial. Les montants réellement prononcés sont très variables, de 150 000 € à 150 M€ selon les affaires que j'ai retrouvées. Le raisonnement ci-dessous procède par étapes : base légale, sanctions encourues, pratique de la CNIL, puis autres risques.

## 1. Cadre juridique

- **Règle de fond.** L'[article 82 de la loi Informatique et Libertés](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000037813978) transpose l'[article 5, §3 de la directive ePrivacy](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02002L0058-20091219). Il impose une information claire et complète, puis un consentement préalable à toute lecture ou écriture dans le terminal de l'utilisateur. Deux exceptions existent : la finalité exclusive de communication électronique et la stricte nécessité du service demandé.
- **Standard du consentement.** Il se mesure à l'aune du RGPD. La CJUE a jugé qu'une case pré-cochée ne vaut pas consentement ([CJUE, 1er oct. 2019, Planet49, C-673/17, pt 59](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:62017CJ0673)).
- **Exigences de la CNIL.** Les lignes directrices et la recommandation du 17 septembre 2020 ([délibération 2020-092](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000042398022)) détaillent les exigences. La principale : refuser doit être aussi simple qu'accepter.
- **Valeur contentieuse de ces textes.** Le Conseil d'État a écarté l'argument d'une période de tolérance, car l'entrave au retrait du consentement était déjà un manquement avant les lignes directrices ([CE, 7 oct. 2025, n° 494300](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000052375376)).

## 2. Sanctions encourues

L'[article 20 de la LIL](https://www.legifrance.gouv.fr/loda/id/LEGIARTI000049578536) prévoit une gradation.

| Niveau | Mesure | Autorité |
|---|---|---|
| Préventif | Avertissement, rappel aux obligations, **mise en demeure** (délai fixé, publiable) | Président de la CNIL |
| Répressif | Rappel à l'ordre, **injonction de mise en conformité** (astreinte jusqu'à 100 000 €/jour), limitation ou interdiction du traitement | Formation restreinte |
| Pécuniaire | **Amende administrative** | Formation restreinte |
| Procédure simplifiée | Amende plafonnée à **20 000 €**, sans publicité du nom de l'organisme ([CNIL, 17 nov. 2026](https://cnil.fr/fr/node/169161)) | Président ou membre de la formation restreinte |

**Plafonds de l'amende.** Le [RGPD art. 83](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679#art_83) retient le montant le plus élevé entre un plafond fixe et un pourcentage du chiffre d'affaires mondial :
- 10 M€ ou 2 % pour les obligations générales du responsable de traitement.
- 20 M€ ou 4 % pour les manquements aux principes et aux conditions du consentement (art. 5, 6, 7, 9).

Le texte de l'article 20 LIL ne fixe lui-même que le palier de 10 M€ / 2 %. Il renvoie à l'article 83, §5 et 6 pour les 20 M€ / 4 %.

**Qualification des cookies.** Le manquement relève de l'article 82 LIL, non du RGPD seul. La CNIL est donc compétente sans guichet unique pour les cookies (point à vérifier au cas par cas, car certaines affaires sont traitées autrement).

**Critères de modulation.** Le montant dépend de la gravité, de la durée, du nombre de personnes concernées, de l'intentionnalité, d'une éventuelle mise en demeure préalable et des avantages financiers tirés du manquement (art. 83, §2).

## 3. Pratique répressive de la CNIL

Les montants ci-dessous viennent du connecteur juridique et des communiqués de la CNIL.

| Décision | Date | Amende |
|---|---|---|
| [SAN-2021-023](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000044840062) | 31 déc. 2021 | 150 M€ |
| [SAN-2022-023](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000046768989) | 19 déc. 2022 | 60 M€ |
| [SAN-2023-008](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000047682157) | 8 juin 2023 | 150 000 € |
| [SAN-2025-011](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000052981827) | 27 nov. 2025 | 1,5 M€ (American Express, [communiqué](https://www.cnil.fr/fr/node/167839)) |
| Shein | 1er sept. 2025 | 150 M€ ([DAJ Bercy](https://www.economie.gouv.fr/node/3237490)) |
| Google (publicités dans Gmail et traceurs) | 1er sept. 2025 | 325 M€ ([DAJ Bercy](https://www.economie.gouv.fr/node/3237490)) |
| Conde Nast (vanityfair.fr) | 20 nov. 2025 | 750 000 € ([CNIL](https://www.cnil.fr/fr/node/167821)) |
| Fnac Darty / Fnac Direct | 22 oct. 2026 | 7 M€ ([CNIL](https://cnil.fr/fr/node/169092)) |

**Manquements les plus sanctionnés :**
- **Absence de bouton de refus équivalent.** Dans [SAN-2023-008](https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000047682157), la CNIL a relevé qu'il suffisait d'un clic pour accepter, alors que refuser demandait davantage. L'argument tiré d'un bouton « refuser » à venir n'a pas suffi.
- **Dépôt de cookies avant tout choix.** C'est un des griefs retenus contre [vanityfair.fr](https://www.cnil.fr/fr/cookies-deposes-sans-consentement-la-cnil-sanctionne-la-societe-editrice-du-site-vanityfairfr).
- **Refus ou retrait du consentement sans effet.** Le même communiqué décrit des mécanismes de refus et de retrait défaillants.
- **Information insuffisante.**

**Facteurs aggravants récents.** La sanction Fnac souligne l'existence d'une jurisprudence constante sur les traceurs de personnalisation et de ciblage commercial, qui échappent aux exemptions ([CNIL, 29 oct. 2026](https://cnil.fr/en/node/169095)). La décision Conde Nast tient compte d'une mise en demeure préalable restée sans effet.

**Intensité du contrôle.** Vingt et une entités ont été sanctionnées pour des manquements aux règles sur les traceurs en 2025 ([bilan CNIL 2025](https://www.cnil.fr/en/sanctions-and-corrective-measures-cnils-actions-2025)). Entre juin et octobre 2026, la procédure simplifiée a produit 38 sanctions, notamment sur les cookies ([CNIL](https://cnil.fr/fr/node/169161)). Les PME sont donc concernées, pas seulement les grandes plateformes.

## 4. Autres risques

- **Publicité de la sanction.** Les décisions de l'ordinaire sont publiées, avec une atteinte réputationnelle.
- **Risque contentieux civil.** Les consommateurs ou associations peuvent engager une action sur le fondement du RGPD. Ce point est une connaissance générale, non vérifiée via le connecteur.
- **Risque de validité des données.** Les données collectées sans consentement valable sont illicites, ce qui affecte les exploitations ultérieures (régie publicitaire, analytics).
- **Risque de recours.** Le Conseil d'État contrôle les sanctions, mais valide en pratique le cadre posé par la CNIL ([CE n° 494300](https://www.legifrance.gouv.fr/ceta/id/CETATEXT000052375376)).
- **Responsabilité des tiers.** Les éditeurs de CMP et les partenaires publicitaires peuvent aussi voir leur responsabilité engagée.

## Limites de cette recherche

- Les corpus RGPD, ePrivacy et LIL du connecteur sont des **instantanés fixes** (LIL arrêtée au 9 nov. 2026). Les décisions CNIL et du Conseil d'État sont mises à jour (au 19 nov. 2026 pour le Conseil d'État).
- Les communiqués 2025 et 2026 cités viennent de la **recherche web** (cnil.fr, Bercy), pas du connecteur. Je n'ai pas ouvert les délibérations Shein, Google, Conde Nast et Fnac dans leur intégralité.
- Je n'ai pas vérifié si un texte abroge ou modifie l'article 82 LIL depuis le 9 nov. 2026.
- Le mécanisme du guichet unique n'est pas détaillé pour les cookies.
- Cette réponse est une analyse documentaire, pas un conseil juridique personnalisé.

Je peux dresser une checklist de conformité d'un bandeau (refus équivalent, absence de dépôt préalable, retrait du consentement, durées de conservation). Je peux aussi approfondir une décision précise, comme Shein ou Fnac, pour en extraire la motivation et la méthode de calcul de l'amende.
