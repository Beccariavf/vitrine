# Veille par matière

## Target

Le propriétaire choisit les matières couvertes par la veille et la page publique montre, pour chacune, les publications des autorités, de la CJUE et des juridictions françaises qui s'y rattachent, avec leur source officielle.

## Hard constraints

- Quatre matières, et elles seules : données personnelles, IA, cybersécurité, données non personnelles. Le choix porte sur la matière, jamais sur un règlement pris isolément.
- Chaque matière expose ce qu'elle couvre et ses sources :
  - Données personnelles : RGPD, loi Informatique et Libertés, ePrivacy ; CNIL, CEPD, ARCEP.
  - IA : AI Act ; CNIL, Commission européenne.
  - Cybersécurité : NIS2, CER, DORA, CRA ; ANSSI, via ses actualités uniquement.
  - Données non personnelles : Data Act ; ARCEP, Commission européenne.
  - Transverse : CJUE, Conseil d'État, Cour de cassation.
- La CJUE, le Conseil d'État et la Cour de cassation sont transverses : une même source alimente plusieurs matières, filtrée par les instruments cités.
- Une publication peut appartenir à plusieurs matières. Une actualité CNIL sur l'IA relève à la fois de l'IA et des données personnelles.
- Le rattachement à une matière est déterministe et auditable : il s'appuie sur les instruments cités, ou à défaut sur des termes définis. Aucune inférence.
- Aucune veille législative française : ni Journal officiel, ni lois, ni décrets, ni arrêtés. Les transpositions sont couvertes par les actualités des autorités, qui renvoient au texte.
- La Cour de cassation n'est pas reprise via Légifrance : sa source officielle dédiée suffit et évite un doublon.
- La sélection est locale et réservée au propriétaire. Les pages publiques affichent la sélection active en lecture seule ; aucun visiteur ne peut la modifier.
- Aucun compte visiteur, aucun serveur, aucune base de données, aucun déploiement.
- Les résumés proviennent de la source : titre, description ou sommaire officiel, nettoyés et tronqués. Aucun modèle, aucune clé de modèle, aucun coût variable.
- Une passe est hebdomadaire et incrémentale : elle ne relit pas tout l'historique. Une publication est identifiée par un identifiant stable ; aucun doublon pour un même identifiant.
- Deux documents distincts ne sont jamais fusionnés : une actualité d'autorité et le texte qu'elle commente restent deux publications.
- Une source en panne n'emporte pas les autres : les publications déjà écrites restent, et l'échec est signalé.
- La réponse brute de chaque source est conservée, adressée par son contenu, comme preuve de ce qui a été lu.
- Les accès aux sources de jurisprudence respectent leurs quotas et sont journalisés ; une passe s'arrête avant de les dépasser.
- Aucun secret n'est versionné.
- Les pages publiques sont statiques, sans JavaScript et sans requête réseau au chargement. Coût d'exploitation : 0 €.

## Non-goals

- La législation française, le Journal officiel, les lois, décrets et arrêtés.
- La jurisprudence de cassation reprise via Légifrance.
- Le choix d'un règlement individuel dans l'interface.
- Les résumés générés par un modèle, la recherche plein texte, les comptes, la base de données, le serveur, le déploiement.
- Les pages de détail, la pagination, les filtres publics interactifs.
- L'analyse du corps des décisions au-delà des métadonnées et sommaires officiels.
- La correction ou la réécriture des textes sources.
- La couverture exhaustive des sources : la veille reste sélective.

## Done-when

- La page de veille présente les matières actives, les instruments couverts et les sources de chacune.
- Le propriétaire peut activer ou désactiver chaque matière dans l'outil local ; après régénération, une matière inactive disparaît de la page publique.
- Une actualité CNIL sur l'IA apparaît sous IA et sous données personnelles.
- Un arrêt CJUE citant le RGPD apparaît sous données personnelles ; un arrêt hors matière est absent.
- Une décision du Conseil d'État et une décision de la Cour de cassation citant le RGPD apparaissent sous données personnelles, avec leur source et leur lien officiel.
- Une actualité ANSSI apparaît sous cybersécurité.
- Chaque publication affiche sa ou ses matières et sa source.
- Aucun doublon n'est visible pour un même identifiant stable.
- Les pages publiques ne chargent aucun JavaScript et n'émettent aucune requête réseau.
- Une panne d'une source laisse les autres publications en place et signale l'échec.
- Les réponses brutes restent versionnées et aucun secret n'apparaît dans le dépôt.
- Le typage, les tests, la génération statique et la CI réussissent.

## Open Questions

None.

## Stakeholders

- Decider: Val, propriétaire du projet
- Owner: Val
- Consumer: un recruteur ou un associé de cabinet qui parcourt la démonstration ; le propriétaire pour la sélection

## Context

- Brief approuvé : [`brainstorm.md`](./brainstorm.md).
- Accès confirmés : CNIL, CJUE via EUR-Lex, ANSSI actualités, Conseil d'État et Cour de cassation via PISTE, CEPD, ARCEP, Commission européenne.
- La CJUE reste sur EUR-Lex ; les juridictions françaises passent par les sources officielles dédiées.
- Le pipeline existant couvre déjà CNIL et CJUE ; cette évolution ajoute la sélection par matière et les sources manquantes.
