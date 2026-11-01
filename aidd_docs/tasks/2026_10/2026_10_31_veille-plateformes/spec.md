# Veille : matière Plateformes

## Target

La veille propose une cinquième matière, Plateformes, qui rassemble les publications officielles relatives au DSA et au DMA et se sélectionne comme les quatre autres.

## Hard constraints

- Cinq matières, et elles seules : données personnelles, IA, cybersécurité, données non personnelles, plateformes. Le choix porte sur la matière, jamais sur un règlement pris isolément.
- Plateformes couvre le DSA (règlement (UE) 2022/2065) et le DMA (règlement (UE) 2022/1925). Son libellé est « Plateformes » ; sa description est « DSA et DMA : plateformes en ligne, contrôleurs d'accès et marchés numériques ».
- Plateformes est active par défaut, comme les quatre autres matières.
- Plateformes s'alimente des actualités numériques de la Commission, des actualités DMA de la Commission, des communiqués de presse de l'ARCOM, de la CJUE, du Conseil d'État et de la Cour de cassation.
- L'ARCOM ne couvre que le DSA. Ses décisions et communiqués audiovisuels — pluralisme, fréquences, appels aux candidatures, mises en demeure de chaînes — sont exclus de la veille.
- Le DMA n'est alimenté que par la Commission et les juridictions ; aucune autorité française n'est traitée comme un régulateur du DMA.
- Toutes les publications de la Commission relatives au DMA sont retenues, y compris les tables rondes, ateliers et fiches ; aucun filtrage par type n'est appliqué.
- Le rattachement est déterministe et auditable : les instruments cités priment, les termes définis complètent. Aucune inférence.
- Les termes restent spécifiques : « plateforme » seul, « marché numérique » seul et « accès » seul ne rattachent pas une publication à Plateformes.
- Une publication peut appartenir à plusieurs matières : une publication DSA qui cite le RGPD relève de Plateformes et de Données personnelles.
- La CJUE, le Conseil d'État et la Cour de cassation sont transverses : une décision citant le DSA ou le DMA apparaît sous Plateformes avec son lien officiel.
- Les titres officiels sont conservés dans leur langue d'origine ; lorsqu'une version française officielle existe, le titre, le résumé et le lien affichés viennent de cette version. Aucune traduction n'est produite.
- Une matière vide ne casse pas la page : le sélecteur et la page publique restent lisibles quand Plateformes n'a aucune publication.
- Le propriétaire peut activer ou désactiver Plateformes ; après régénération, une matière inactive disparaît de la page publique. Les pages publiques restent en lecture seule.
- Les contraintes du contrat « Veille par matière » restent en vigueur : aucune veille législative française, aucun modèle génératif, aucun compte visiteur, aucun serveur, aucune base de données, aucun JavaScript public, aucune requête réseau au chargement, collecte hebdomadaire incrémentale, identifiants stables, aucun doublon, panne d'une source isolée, réponses brutes conservées, quotas respectés, aucun secret versionné, coût d'exploitation 0 €.

## Non-goals

- Les décisions et communiqués audiovisuels de l'ARCOM.
- Les publications de la DGCCRF et de l'Autorité de la concurrence.
- La traduction des titres officiels.
- Le choix d'un règlement isolé, DSA ou DMA, dans l'interface.
- Une source dédiée au Data Act pour la matière « Données non personnelles ».
- Les pages de détail, la pagination, les filtres publics interactifs, la recherche plein texte.
- L'analyse du corps des décisions au-delà des métadonnées et sommaires officiels.
- La couverture exhaustive des sources : la veille reste sélective.

## Done-when

- La page publique présente cinq matières, dont Plateformes, dans le sélecteur compact.
- Le propriétaire peut activer ou désactiver Plateformes ; après régénération, elle disparaît de la page publique.
- Une actualité de la Commission sur le DSA apparaît sous Plateformes.
- Une publication de la Commission sur le DMA apparaît sous Plateformes.
- Un communiqué de l'ARCOM sur le DSA apparaît sous Plateformes avec son lien officiel.
- Un communiqué de l'ARCOM sur les fréquences FM n'apparaît pas sous Plateformes.
- Une décision du Conseil d'État citant le règlement 2022/2065 apparaît sous Plateformes avec son lien officiel.
- Une publication citant à la fois le RGPD et le DSA apparaît sous Données personnelles et sous Plateformes.
- Aucune publication dont le seul indice est le mot « plateforme » n'est rattachée à Plateformes.
- Chaque publication affiche sa ou ses matières et sa source.
- Les pages publiques ne chargent aucun JavaScript et n'émettent aucune requête réseau.
- Une panne d'une source laisse les autres publications en place et signale l'échec.
- Le typage, les tests, la génération statique et la CI réussissent.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la démonstration ; le propriétaire pour la sélection

## Context

- Brief approuvé : [`brainstorm.md`](./brainstorm.md).
- Cette spec étend « Veille par matière » (quatre matières) ; sur le nombre de matières, elle la remplace. Les autres contraintes de cette spec restent en vigueur.
- Volume observé : DSA environ 2 publications par mois à la Commission, DMA environ 1,7 par mois, ARCOM environ 1 par mois. Jurisprudence : aucune décision DSA ou DMA dans les fenêtres récentes — Conseil d'État, 6 décisions citant 2022/2065 dont aucune sur 90 jours ; Cour de cassation, 0 sur 3 mois ; CJUE, 0 sur les 100 dernières entrées.
- L'ARCOM est coordinateur des services numériques pour le DSA ; le DMA est appliqué par la Commission seule.
- « Données non personnelles » reste sans source dédiée et peut rester vide.
- Les actualités de la Commission numérique sont lues dans leur page `/fr/` officielle ; le flux DMA reste en anglais, faute de version française.
- Le sélecteur reste compact : cinq libellés, sans bloc d'instruments ni de sources, conformément à la décision de la spec « Veille par matière ».
