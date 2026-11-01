# Références des décisions du Conseil d'État

## Target

Les cartes des décisions du Conseil d'État affichent les articles des textes de fond que la décision applique, et une décision dont aucun article appliqué n'est identifié reste sans référence.

## Hard constraints

- Les articles sont extraits du texte intégral de la décision, pas du titre ni du résumé.
- Seuls les articles introduits par une formule d'application ou une phrase de considérant sont retenus : « aux termes », « il résulte des dispositions (combinées) », « en vertu », « en application », « sur le fondement », « L'article X du … garantit/permet/prévoit », et l'anaphore « du même règlement/loi/code/directive » quand elle ouvre une phrase et qu'un verbe d'application la suit.
- Un article cité au titre d'un grief ou d'un manquement n'est jamais affiché.
- Seuls les instruments rattachés aux matières de l'entrée sont retenus ; la lecture ne crée pas de matière.
- Une pastille n'apparaît que si au moins un article est trouvé ; l'instrument seul n'est pas affiché.
- Le texte intégral est lu au plus une fois par nouvelle décision, après le rattachement.
- La passe reste sous le plafond de 16 appels PISTE ; une décision dont le texte n'a pas pu être lu est différée et relue à la passe suivante.
- Aucune référence n'est déduite d'un visa structuré vide, du site du Conseil d'État ou d'une source non officielle.
- L'extraction est déterministe et testée hors ligne, sans appel réseau.

## Non-goals

- L'affichage d'un instrument sans article pour le Conseil d'État.
- Le visa structuré du Conseil d'État, qui n'existe pas dans l'API.
- La lecture du site conseil-etat.fr ou tout scraping.
- La modification des actualités, de la Cour de cassation, de la CJUE, du Conseil constitutionnel, du DMA ou de l'ARCOM.
- Le relèvement du plafond PISTE.
- Un lien profond vers l'article exact quand la source ne fournit pas son identifiant.

## Done-when

- La décision 501268 affiche `Code des postes et des communications électroniques · art. L. 34-5` et `Loi Informatique et Libertés · art. 82, 20`.
- La décision 509589 affiche `Loi Informatique et Libertés · art. 8, 20`.
- La décision 513996 affiche `Loi Informatique et Libertés · art. 31, 118`.
- La décision 509210 affiche `Règlement (UE) 2016/679 · art. 15, 16`.
- La décision 520279 n'affiche plus `Règlement (UE) 2016/679 · art. 5`, qui venait d'un grief.
- Une décision dont le texte n'a pas été lu n'est pas écrite et sera relue à la passe suivante.
- Les cartes CNIL, Cour de cassation, CJUE, DMA et ARCOM conservent leurs références actuelles.
- Chaque pastille ouvre le texte officiel de l'instrument dans un nouvel onglet.
- Les tests hors ligne passent sans appel réseau.
- Une passe complète consomme au plus 16 appels PISTE et journalise les appels.

## Open Questions

None

## Stakeholders

- Decider: propriétaire du projet
- Owner: propriétaire du projet
- Consumer: lecteur de la veille

## Context

Brief approuvé après test sur les 9 décisions du Conseil d'État déjà collectées : 5 sur 9 gagnent des articles appliqués, une se précise (509210), une perd un faux positif (520279). Le visa structuré (`visas`, `visasHtml`) est vide pour le Conseil d'État, même sur une décision publiée au Recueil ; la recherche `typeChamp: "VISA"` ne rend que des identifiants ; le site du Conseil d'État rend le même texte mais impose un scraping. La solution retenue est la lecture du texte intégral par décision, sous le plafond existant.
