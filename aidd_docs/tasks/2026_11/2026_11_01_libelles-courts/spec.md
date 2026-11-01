# Libellés courts des références

## Target

Chaque pastille de référence affiche le nom court d'un instrument connu, son libellé complet restant accessible au survol.

## Hard constraints

- Les données gardent le libellé canonique complet : `references` ne change pas.
- L'URL officielle reste dérivée du libellé canonique, jamais du libellé court.
- Les instruments connus ont un libellé court : `RGPD`, `LIL`, `CPCE`, `ePrivacy`, `C. conso`, `AI Act`, `DSA`, `DMA`, `DORA`, `NIS2`, `CRA`, `Data Act`.
- Un instrument inconnu garde son libellé complet ; aucun acronyme n'est inventé.
- Le libellé complet reste accessible au survol de la pastille.
- La carte et la liste affichent le même libellé court.
- Aucun appel réseau, aucune modification de données.
- L'extraction et le rendu restent testés hors ligne.

## Non-goals

- Changer les références stockées ou les URL officielles.
- Traduire un instrument ou lui inventer un acronyme.
- Refondre la carte, la liste ou la mise en page des pastilles.
- Ajouter un lien profond vers l'article exact.

## Done-when

- La carte de 501268 affiche `LIL · art. 8, 82, 20`, `CPCE · art. L. 34-5` et `RGPD · art. 83`.
- La carte CNIL FNAC affiche `LIL · art. 82`.
- Le survol d'une pastille montre le libellé complet de l'instrument.
- Une référence à un instrument inconnu garde son libellé complet.
- La carte et la liste affichent le même libellé.
- Le build produit ces libellés et les liens officiels restent inchangés.
- Les tests hors ligne passent.

## Open Questions

None

## Stakeholders

- Decider: propriétaire du projet
- Owner: propriétaire du projet
- Consumer: lecteur de la veille

## Context

Les libellés complets (« Code des postes et des communications électroniques · art. L. 34-5 ») prennent trop de place dans les pastilles. Le raccourcissement est purement visuel : la donnée et le lien officiel ne bougent pas.
