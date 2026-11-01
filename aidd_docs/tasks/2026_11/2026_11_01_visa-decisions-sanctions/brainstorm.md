---
status: approved
---

# Visa officiel pour les décisions et sanctions

Un lecteur voit d'un coup d'œil, sur les cartes des décisions de justice et des sanctions, les textes de fond que la juridiction ou l'autorité a appliqués — au-delà du RGPD et de la LIL — et peut ouvrir chaque référence sans quitter la veille.

## Clear

- Le premier lot couvre les décisions et sanctions dont la source expose un visa exploitable : Cour de cassation (Judilibre), CJUE si EUR-Lex le permet. Les sanctions CNIL gardent le bloc « Textes de référence » de leur page, qui tient lieu de visa.
- Le Conseil d'État est exclu : l'API Légifrance rend le texte intégral mais `visas` est vide ; les articles cités dans le corps ne sont pas les textes appliqués.
- Pour ces entrées, le visa remplace l'extraction actuelle ; les actualités ne changent pas.
- Seuls les instruments rattachés aux matières suivies sont gardés ; les textes de procédure sont écartés.
- Aucune référence n'est devinée pour les sanctions DMA et ARCOM : sans visa, la carte reste sans pastille.
- Chaque pastille est un lien vers le texte officiel de l'instrument (EUR-Lex ou Légifrance) ; le libellé garde l'article.
- Le lien de l'actualité et chaque lien de référence sont distincts et ouvrent un nouvel onglet : la carte et la liste restent en place.
- Le budget d'appels est une contrainte du lot : les lectures de visa sont groupées quand l'API le permet et mises en cache par décision ; aucune lecture pour une décision non retenue.
- Cas de contrôle : la décision Judilibre 25-10.664 expose son visa ; une décision dont le visa est vide n'affiche rien ; la sanction FNAC conserve « LIL · art. 82 » sans texte de procédure.
- La passe reste déterministe, testable hors ligne, et une source en panne n'empêche pas les autres.

## Assumed

- `references` reste un tableau de chaînes ; l'URL est dérivée du libellé canonique, sans nouveau champ.
- Les pastilles gardent leur format actuel et un libellé court.
- Le lien profond vers l'article exact n'est ajouté que si la source fournit l'identifiant ; aucun appel API supplémentaire pour le résoudre.
- Les sanctions CNIL ne changent pas : le bloc « Textes de référence » de la page est conservé.
- La CJUE reste sur le titre officiel si le parsing EUR-Lex coûte plus qu'il ne rapporte.
- Les actualités existantes gardent leurs références actuelles.
- Le plafond de 16 appels par passe reste la garde ; l'optimisation doit tenir dedans.
