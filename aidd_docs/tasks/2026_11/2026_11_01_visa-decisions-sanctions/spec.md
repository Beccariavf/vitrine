# Références juridiques cliquables et visa de la Cour de cassation

## Target

Les cartes des décisions de la Cour de cassation affichent les textes de fond de leur visa, et chaque référence juridique des cartes ouvre son texte officiel dans un nouvel onglet, sans modifier les actualités.

## Hard constraints

- Le visa de la Cour de cassation remplace l'extraction depuis le titre et le résumé.
- Seuls les instruments rattachés aux matières suivies sont affichés ; les textes de procédure sont exclus.
- Une décision sans visa n'affiche aucune référence.
- Les sanctions CNIL, les actualités et les autres sources gardent leurs références actuelles.
- Le Conseil d'État, les sanctions DMA et ARCOM ne reçoivent aucune nouvelle référence dans ce lot.
- Chaque référence est un lien vers le texte officiel de l'instrument ; le lien vers l'article exact n'est ajouté que si la source fournit son identifiant.
- Le lien de l'actualité et les liens de référence sont distincts et s'ouvrent dans un nouvel onglet.
- La passe reste sous le plafond de 16 appels PISTE ; seules les décisions nouvelles et retenues sont consultées.
- L'extraction est déterministe et testable hors ligne ; une source en panne n'empêche pas les autres.

## Non-goals

- Le visa du Conseil d'État.
- La distinction entre textes visés et manquements.
- Les références des sanctions DMA et ARCOM.
- Le visa de la CJUE via EUR-Lex.
- Une refonte de la carte ou de la liste au-delà des liens et du nouvel onglet.
- La résolution d'un lien profond par article quand la source ne fournit pas l'identifiant.

## Done-when

- La décision Judilibre 25-10.664 affiche les textes de fond de son visa.
- Une décision dont le visa est vide n'affiche aucune pastille.
- Chaque pastille de référence ouvre le texte officiel de l'instrument dans un nouvel onglet.
- Le lien de l'actualité ouvre sa source dans un nouvel onglet, indépendamment des pastilles.
- Aucun texte de procédure n'apparaît dans les références.
- Les cartes CNIL, ANSSI, CEPD, ARCEP, Commission, Commission DMA et ARCOM conservent leurs références actuelles.
- La passe consomme au plus 16 appels PISTE et journalise les appels.
- Les tests hors ligne passent sans appel réseau.

## Open Questions

None

## Stakeholders

- Decider: propriétaire du projet
- Owner: propriétaire du projet
- Consumer: lecteur de la veille

## Context

Brief approuvé : [brainstorm.md](brainstorm.md).

Test du 1er novembre 2026 : le Conseil d'État expose son texte intégral mais pas de visa structuré ; il est exclu du lot. La délibération CNIL testée n'expose pas non plus de visa structuré ; son bloc « Textes de référence » reste la source.
