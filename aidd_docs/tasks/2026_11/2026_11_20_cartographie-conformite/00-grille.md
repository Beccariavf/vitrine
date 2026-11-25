# Grille de cartographie d'une matière de conformité

État au 20/11/2026. Une fiche par matière, même plan, même tableau. But : savoir ce qu'il faut, ce qu'on a, ce qui manque, pour planifier les tickets.

## Modèle : la matière « données personnelles », déjà couverte

| Couche | Données personnelles | Corpus Vitrine |
|---|---|---|
| Texte UE de fond | RGPD 2016/679 | `rgpd` |
| Texte UE de procédure | Règlement procédural RGPD 2025/2518 (coopération, guichet unique) | `rgpdproc` |
| Autorité UE | CEPD (art. 63-65 : avis, décisions contraignantes, lignes directrices) | `cepd` |
| Autorité nationale | CNIL (désignée par la LIL) | `cnil`, `cnil_doctrine` |
| Texte national de fond | Loi Informatique et Libertés | `lil` |
| Texte national de procédure | Décret 2019-536 (procédure de contrôle et de sanction) | `textes_fr` |
| Recours national | Conseil d'État (recours contre les sanctions CNIL) | `ce` |
| Juge UE | CJUE (renvois préjudiciels) | `cjue` |
| Contrôle constitutionnel | Conseil constitutionnel | `constit` |
| Juge judiciaire | Cour de cassation | `cc` |
| Textes en préparation | Propositions, affaires pendantes | `preparation` |

Chaque fiche reproduit cette chaîne pour sa matière.

## Plan imposé d'une fiche

1. **Champ** : qui est assujetti (catégories, seuils), dates d'application (y compris les reports de 2025-2026).
2. **Droit UE de fond** : actes de base, actes délégués et d'exécution, avec CELEX ou numéro OJ, et état (en vigueur, applicable, consolidé, modifié par quoi).
3. **Droit UE de procédure** : qui contrôle, comment (enquête, coopération entre autorités, mécanisme de cohérence, guichet unique ou pas), sanctions (plafonds, article), voies de recours (Tribunal de l'UE, CJUE).
4. **Autorités UE** : nom, base juridique de sa compétence (article), ce qu'elle publie (lignes directrices, décisions, Q&R, normes techniques), où (URL), et sous quelle licence.
5. **Autorités nationales françaises** : nom, **texte qui la désigne** (article précis ; « non désignée » si c'est le cas, avec le texte en cours), pouvoirs, procédure de sanction (code et articles, commission des sanctions éventuelle), **juridiction de recours** (CE, CA Paris, etc.), ce qu'elle publie.
6. **Droit national de fond et de procédure** : lois, codes (articles précis), décrets, arrêtés ; textes de transposition en cours avec leur stade parlementaire.
7. **Jurisprudence et décisions** : juridictions et organes qui produisent les décisions utiles, avec leur source.
8. **Textes en préparation** : propositions UE (COM, procédure COD, stade), projets de loi français (n°, stade).
9. **Tableau besoin / existant** (obligatoire, format ci-dessous).
10. **Points à vérifier** : tout identifiant non lu sur la source officielle.

## Tableau obligatoire

| Couche | Source | Identifiant | Nature (fond/procédure/doctrine/décision) | Autorité | Accès (API, dump, HTML, PDF) | Licence | Dans Vitrine ? (corpus ou « non ») | Priorité (P1/P2/P3) | Vérifié ? |
|---|---|---|---|---|---|---|---|---|---|

Couches : texte UE de fond, texte UE de procédure, autorité UE, autorité nationale, texte national de fond, texte national de procédure, recours national, juge UE, préparation.

Priorités : P1 = indispensable pour répondre à une question de conformité ; P2 = utile ; P3 = confort.

## Corpus Vitrine actuel (référence pour la colonne « Dans Vitrine ? »)

`rgpd` (32016R0679), `aiact` (consolidation 02024R1689-20260727, à jour du règlement 2026/1744 ; texte seul, sans droit souple), `eprivacy` (32002L0058), `police` (32016L0680), `eudpr` (32018R1725), `rgpdproc` (32025R2518), `ccs` (32021D0914 seulement), `adequation`, `lil` (LEGITEXT000006068624), `textes_fr` (décret 2019-536 ; Code pénal 226-16 à 226-24 ; CPCE L34-5), `preparation`, `cnil`, `cnil_doctrine`, `ce`, `constit`, `cepd`, `cc`, `cjue`, `metadonnees`. Les décisions `ce`, `cc`, `cjue` sont limitées aux données personnelles.

## Règles de recherche

- Sources officielles d'abord : EUR-Lex, Légifrance, sites des autorités, dossiers législatifs AN/Sénat, CURIA.
- Un identifiant non lu sur sa source officielle porte « non » dans la colonne « Vérifié ? ».
- Aucun contournement : une source qui bloque les robots ou dont les conditions l'interdisent est abandonnée, et la fiche le dit. donneespersonnelles.fr ne doit pas être visité.
- Pas de données inventées : une case inconnue s'écrit « inconnu ».
