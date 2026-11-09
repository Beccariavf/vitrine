---
status: approved
date: 2026-11-09
---

# MCP données personnelles — compléter le corpus

Rendre le MCP complet sur le domaine données personnelles, pour un usage personnel et comme preuve de compétence ; la page site, la base téléchargeable et le VPS viendront après.

## Acquis

- Seul livrable : le MCP enrichi. Pas de page site, pas de distribution, pas de VPS.
- CNIL : sanctions + avis + recommandations, toutes dates → 3 245 documents, ~29 300 fragments, ~260 Mo, ~19 min d'embedding. Le filtre `--nature` existe déjà ; il doit accepter plusieurs natures.
- LIL : texte consolidé (loi n° 78-17), nouveau corpus.
- Conseil d'État : décisions publiées depuis 2014, nouveau corpus, via PISTE.
- CEPD : lignes directrices, nouveau corpus.
- Réindexation complète en une passe, puis éval par sous-corpus.
- Le volume ne contraint rien : ~30 000 fragments, 8 fois sous le plafond pratique de recherche (~250 000).

## Hypothèses

- Un seul corpus `cnil` ; la nature devient une métadonnée. `get_decision` reste réservé aux sanctions ; avis et recommandations sont cherchables.
- Conseil d'État limité aux décisions publiées depuis 2014.
- Index hors git, pas d'index approximatif.

## Plus tard

- Page site du MCP.
- Base téléchargeable (~900 Mo avec le modèle d'embedding) et installation locale.
- VPS payant optionnel.
- Vérification des licences de redistribution avant publication.

## Ouvert

- Volume réel des décisions du Conseil d'État depuis 2014 : inconnu avant extraction, peut justifier d'ajuster la borne.
- Seuils d'éval propres à chaque sous-corpus.

## Ordre retenu

1. CNIL multi-natures.
2. LIL.
3. CEPD lignes directrices.
4. Conseil d'État depuis 2014.
5. Réindexation complète et éval croisée des quatre sous-corpus.
