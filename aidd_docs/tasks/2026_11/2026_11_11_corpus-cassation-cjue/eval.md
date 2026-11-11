# Éval `dev` des deux corpus

Mesures du 11 novembre 2026, sur l'index produit (`data/corpus/index/index.db`, 74 947 unités, `leoipulsar/harrier-0.6b`, 1 024 dimensions), hors split `test`. Les deux jeux comptent 10 questions conceptuelles chacun, sans piège ; la référence attendue est un document entier, satisfait par n'importe lequel de ses fragments.

## Cour de cassation (`questions-cc.csv`, corpus `cc`)

```
recherche sémantique : 10 questions, recall@5 0.600 (6/10), MRR 0.470
top-1 sémantique : 40.0 %
niveaux sémantiques : 5 confiant, 5 incertain, 0 aucun_resultat_fiable (table produit 0,69 / 0,74 / 0,01 ; 6 / 4 avec la grille calibrée sur ce dev)
```

| Question | Document | Rang | Similarité |
|---|---|---:|---:|
| Communication des données personnelles d'autres salariés dans une expertise | `6af2c6c76c2e1778126fe354` | 5 | 0,738 |
| Droit à l'effacement et déréférencement | `6a1fbf96cdc6046d47ea0349` | absent | — |
| Données d'une garde à vue annulée au fichier TAJ | `69786db4cdc6046d47d707b1` | 1 | 0,721 |
| Détournement de finalité d'un traitement | `6965e5becdc6046d471b4ab6` | absent | — |
| Enregistrement des séances du CSE et données des salariés | `6ac6079ec27382d099f5a06e` | 1 | 0,748 |
| Données de trafic sous contrôle judiciaire | `6717402d6a24f8a713323ad6` | absent | — |
| Reconnaissance faciale dans une enquête pénale | `673d7cc0d666990c113dbe3a` | 1 | 0,743 |
| Vidéoprotection et sanction disciplinaire | `682d68f316fd466a1ce900c4` | absent | — |
| Communication de documents de tiers contenant des données personnelles | `66fe33ec91b69e88a370f983` | 2 | 0,734 |
| Géolocalisation d'un véhicule et directive ePrivacy | `65dd88c8af7bf00008e554e6` | 1 | 0,779 |

Les quatre absences sont des décisions proches d'une autre décision retenue : le corpus contient 352 décisions aux visas et aux textes souvent voisins. Les rangs ne dépendent pas des seuils. Les niveaux affichés sont ceux de la table produit ; avec la grille calibrée sur ce `dev` (0,670 / 0,720 / 0,010), on obtient 6 `confiant` et 4 `incertain`.

## CJUE (`questions-cjue.csv`, corpus `cjue`)

```
recherche sémantique : 10 questions, recall@5 0.800 (8/10), MRR 0.750
top-1 sémantique : 70.0 %
niveaux sémantiques : 1 confiant, 9 incertain, 0 aucun_resultat_fiable (table produit 0,69 / 0,74 / 0,01 ; 2 / 8 avec la grille calibrée sur ce dev)
```

| Question | Document | Rang | Similarité |
|---|---|---:|---:|
| Déréférencement par un moteur de recherche (Google Spain) | `62012CJ0131` | absent | — |
| Protection adéquate d'un pays tiers (Schrems I) | `62014CJ0362` | 1 | 0,749 |
| Transferts vers les États-Unis après le Privacy Shield (Schrems II) | `62018CJ0311` | 2 | 0,725 |
| Conservation généralisée des données de trafic | `62012CJ0293` | absent | — |
| Conservation imposée par une réglementation nationale | `62015CJ0203` | 1 | 0,724 |
| Adresse IP dynamique comme donnée personnelle | `62014CJ0582` | 1 | 0,750 |
| Copie d'examen professionnel et donnée personnelle | `62016CJ0434` | 1 | 0,755 |
| Autorité de concurrence et RGPD (Meta/Bundeskartellamt) | `62021CJ0252` | 1 | 0,766 |
| Scoring automatisé et décision individuelle (SCHUFA) | `62021CJ0634` | 1 | 0,725 |
| Droit d'accès et copie des documents | `62021CJ0487` | 1 | 0,726 |

Les deux absences sont des arrêts très cités, dont les points de motivation répètent le vocabulaire d'autres décisions du corpus (conservation, déréférencement). Les rangs ne dépendent pas des seuils. Les niveaux affichés sont ceux de la table produit ; la grille calibrée sur ce `dev` (0,670 / 0,720 / 0,010) donne 2 `confiant` et 8 `incertain`.

## Lecture

Ces deux jeux ne calibrent aucun seuil de production : ils constatent des rangs sur un `dev` de 10 questions, trop court pour fonder une promesse chiffrée. `SEUILS_PAR_CORPUS` ne porte que la CNIL ; `cc` et `cjue` suivent le repli `0,69 / 0,74 / 0,01` dans le produit.
