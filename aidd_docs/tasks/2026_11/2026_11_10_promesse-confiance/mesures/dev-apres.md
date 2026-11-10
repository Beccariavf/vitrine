# Les sept jeux `dev` sous la règle du produit

Mêmes questions, même index, même split `dev` que la phase 1 ; seule la règle a changé.
Les JSON `apres-<jeu>.json` de ce dossier sont la mesure ; aucune valeur n'est recopiée
d'un autre rapport, sauf les colonnes « avant », qui viennent de `risque-couverture.md`
(seuils du produit) et que la réexécution de `mcp/eval/risque.ts` sur les nouveaux JSON
reproduit exactement. Le split `test` n'a pas été touché.

## Conditions de mesure

| Champ | Valeur |
| ----- | ------ |
| Date | 2026-11-10 |
| Modèle | `qwen3-embedding:0.6b`, 1024 dimensions |
| Index | `data/corpus/index/index.db`, 53143 unités |
| Recherche | dense, `k = 5` |
| Split | `dev` pour les sept jeux ; l'AI Act n'a pas de colonne `split` |
| Règle | `--regle produit` : table CNIL `0,67 / 0,67 / 0,02`, repli `0,69 / 0,74 / 0,01` ailleurs |

```sh
node mcp/eval/run.ts --questions questions-v2.csv            --split dev --regle produit --json > mesures/apres-rgpd-v2.json
node mcp/eval/run.ts --questions questions-aiact.csv                    --regle produit --json > mesures/apres-aiact.json
node mcp/eval/run.ts --questions questions-cnil-etendu.csv   --split dev --regle produit --json > mesures/apres-cnil-etendu.json
node mcp/eval/run.ts --questions questions-lil.csv           --split dev --regle produit --json > mesures/apres-lil.json
node mcp/eval/run.ts --questions questions-ce.csv            --split dev --regle produit --json > mesures/apres-ce.json
node mcp/eval/run.ts --questions questions-cepd.csv          --split dev --regle produit --json > mesures/apres-cepd.json
node mcp/eval/run.ts --questions questions-cnil-doctrine.csv --split dev --regle produit --json > mesures/apres-cnil-doctrine.json

node mcp/eval/risque.ts mesures/apres-cnil-etendu.json --seuils 0.67,0.67,0.02
node mcp/eval/risque.ts mesures/apres-<autre>.json     --seuils 0.69,0.74,0.01
```

## 1. `refs` et `similarites` : aucune divergence

Sur les 144 questions des sept jeux, `refs`, `similarites`, `rangs`, `attendues`, `type`
et `piege` sont **identiques** aux JSON de la phase 1, question par question. Seuls
`seuils`, `niveau` et `agregats` bougent : la réexécution n'a déplacé aucun vecteur ni
aucun classement.

Les `niveau` de la phase 1 avaient été calculés aux seuils **calibrés** de chaque jeu ;
leur écart avec les nouveaux n'est donc pas l'effet de la promesse, c'est un passage
« calibré → produit ». Il touche 19 questions :

| Jeu | Niveaux déplacés | Sens |
| --- | ---------------: | ---- |
| RGPD v2 | 1 | confiant → incertain |
| AI Act | 0 | — |
| CNIL étendu | 11 | confiant → incertain |
| LIL | 3 | confiant → incertain |
| Conseil d'État | 0 | — |
| CEPD | 0 | — |
| CNIL doctrine | 4 | 3 confiant → incertain, 1 incertain → confiant |

L'effet qui compte — repli du produit → règle du produit — est en §3, et il ne touche
que les deux jeux CNIL, puisque la table ne porte qu'une ligne.

## 2. Couverture et risque sous la règle appliquée

« Avant » = repli `0,69 / 0,74 / 0,01` (les seuils du produit avant ce plan) ; « après » =
la règle qui s'applique réellement au corpus de chaque jeu. Les deux colonnes de rendu
comptent les questions sémantiques : celles sans aucun passage (« sans passage ») et
celles dont une référence attendue est au top 5 rendu (« justes rendues »).

| Jeu | Règle après | Sém. | Confiantes av → ap | Couverture av → ap | Risque av → ap | Borne 95 % av → ap | Sans passage av → ap | Justes rendues av → ap |
| --- | ----------- | ---: | -----------------: | -----------------: | -------------: | -----------------: | -------------------: | ---------------------: |
| RGPD v2 | repli `0,69/0,74/0,01` | 19 | 16 → 16 | 84,2 % → 84,2 % | 0,0 % → 0,0 % | 19,4 % → 19,4 % | 0 → 0 | 18 → 18 |
| AI Act | repli `0,69/0,74/0,01` | 3 | 0 → 0 | 0,0 % → 0,0 % | non mesuré | non mesuré | 0 → 0 | 2 → 2 |
| CNIL étendu | table `0,67/0,67/0,02` | 54 | 24 → 22 | 44,4 % → 40,7 % | 20,8 % → 13,6 % | 40,5 % → **33,3 %** | 4 → **0** | 37 → **39** |
| LIL | repli `0,69/0,74/0,01` | 10 | 4 → 4 | 40,0 % → 40,0 % | 0,0 % → 0,0 % | 49,0 % → 49,0 % | 0 → 0 | 10 → 10 |
| Conseil d'État | repli `0,69/0,74/0,01` | 12 | 6 → 6 | 50,0 % → 50,0 % | 16,7 % → 16,7 % | 56,4 % → 56,4 % | 0 → 0 | 8 → 8 |
| CEPD | repli `0,69/0,74/0,01` | 10 | 2 → 2 | 20,0 % → 20,0 % | 0,0 % → 0,0 % | 65,8 % → 65,8 % | 0 → 0 | 10 → 10 |
| CNIL doctrine | table `0,67/0,67/0,02` | 10 | 9 → 6 | 90,0 % → 60,0 % | 66,7 % → 66,7 % | 87,9 % → 90,3 % | 0 → 0 | 3 → 3 |

Cinq jeux sur sept sont inchangés au point près : leur règle est le repli, avant comme
après. Aucun refus ne subsiste nulle part (`bas` du CNIL à 0,67) : les 4 questions muettes
du CNIL étendu sont rendues.

## 3. Effet sur le rendu

Les `refs` étant identiques, le **contenu** du top 5 ne bouge pas : ce qui bouge est
l'existence du rendu (vide sous `aucun_resultat_fiable`) et l'étiquette. Sur les cinq jeux
au repli, ni l'un ni l'autre ne change.

**CNIL étendu** — 15 questions bougent, aucune ne devient muette :

- **2 bonnes réponses rétablies** par le plancher à 0,67 : « amende… trottinettes en
  libre-service » (0,6770) et « sanction… musical.ly devenue TikTok » (0,6812). Toutes
  deux passent `aucun_resultat_fiable → confiant` et ont leur document attendu au top 5 ;
- **2 questions rendues sans la bonne référence** : « autopartage entre particuliers »
  (0,6824, écart 0,0050) et « éditeur de logiciels pour laboratoires » (0,6855, écart
  0,0014), `aucun_resultat_fiable → incertain` — le plancher les rend, la marge leur
  refuse l'étiquette ;
- **2 fausses confiantes tues par la marge de 0,02** : « établissement de paiement »
  (0,7563, écart 0,0139) et « fichier de police des empreintes » (0,7438, écart 0,0117) ;
  c'est ce qui fait passer les erreurs de 5 à 3 ;
- **7 sémantiques `confiant → incertain`** gardent leurs passages : la marge de 0,02 les
  sépare, pas le seuil. Le lecteur perd l'étiquette, pas la réponse ;
- **3 sémantiques `incertain → confiant`** : coupons de paiement (0,7186), messagerie
  vocale (0,7174), groupe hôtelier (0,7280), les trois justes ;
- 1 piège, « puces implantées sous la peau » (0,7670), `confiant → incertain` ; les pièges
  cités restent 6 sur 6, aucun ne s'ajoute.

Bilan : 39 bonnes réponses rendues contre 37, aucune perdue, 3 erreurs confiantes contre 5.

**CNIL doctrine** — 3 `confiant → incertain`, aucune question muette, aucune rendue en
plus. Deux sont fausses (images de vidéosurveillance, liste électorale) ; la troisième,
« réutilisation des décisions de justice » (0,7638), était **juste** : elle reste rendue,
mais perd son étiquette. Les justes rendues ne bougent pas (3 sur 10) ; les fausses
confiantes passent de 6 à 4.

## 4. Verdict par corpus

| Corpus | Verdict |
| ------ | ------- |
| **CNIL** (`cnil-etendu`) | **Plafond atteint, 33,3 %** — exactement le chiffre de `promesse.md`, à 40,7 % de couverture (22/54). Cible de 10 % non atteinte : écart de 23,3 points. Le coût rendu est nul et le gain réel : +2 bonnes réponses, −2 erreurs confiantes. |
| **CNIL doctrine** | **Hors plafond.** 66,7 % de risque (borne 90,3 %) : 4 erreurs sur 6 confiantes. La règle en tue deux, elle ne rend pas ce jeu présentable ; il reste rapporté à part et hors dénominateur. |
| **RGPD v2** | Aucune promesse. 0 erreur sur 16 confiantes, borne 19,4 %, mais 19 sémantiques au maximum : pas la puissance de fixer un plafond. Rendu inchangé. |
| **AI Act** | Non mesurable : 0 confiante sur 3 sémantiques. Rendu inchangé. |
| **LIL** | Aucune promesse. 4 confiantes, 0 erreur, borne 49,0 %. Rendu inchangé. |
| **Conseil d'État** | Aucune promesse. 6 confiantes, 1 erreur, borne 56,4 %. Rendu inchangé. |
| **CEPD** | Aucune promesse. 2 confiantes, 0 erreur, borne 65,8 %. Rendu inchangé. |

La promesse tient sur le seul corpus qui la porte, et elle ne coûte aucune bonne réponse :
c'est ce que la phase 4 devait établir.

## 5. Portée : ce que cette mesure ne couvre pas

Une recherche **sans `corpus`**, ou qui ne nomme **qu'un document**, suit le repli
`0,69 / 0,74 / 0,01` et sort de la promesse : l'instruction de requête et le bassin de
candidats y changent, donc les similarités et les niveaux. Ce mode n'est **pas mesuré**
ici et ne porte aucun chiffre. De même, la réponse prise une à une, le rang 1, le fragment
exact, les autres corpus et la justesse rédactionnelle restent hors promesse.

## 6. Deux écarts relevés, non corrigés ici

1. **`promesse.md` §5 n'est pas la règle qui s'applique.** Sa commande passe le triplet
   CNIL `0,67 / 0,67 / 0,02` aux sept jeux ; le code livré applique le repli à cinq d'entre
   eux. Les lignes non-CNIL de son tableau en diffèrent : RGPD v2 15 confiantes / 78,9 % /
   borne 20,4 % (contre 16 / 84,2 % / 19,4 % ici), AI Act 2 confiantes dont 1 fausse
   (contre 0), LIL 6 / 60,0 % / 39,0 % (contre 4 / 40,0 % / 49,0 %), Conseil d'État
   3 / 25,0 % / 56,1 % (contre 6 / 50,0 % / 56,4 %), CEPD 0 confiante (contre 2 / 65,8 %).
   Ces lignes documentent une expérience, pas le produit : la phase 5 ne doit pas les
   recopier comme contrat. Le tableau de §2 ci-dessus est celui du code livré.
2. **La doctrine suit la table CNIL, pas le repli.** La consigne de mesure donnait le
   repli à tout jeu autre que `cnil-etendu` ; le code choisit la table sur le corpus
   demandé, et `questions-cnil-doctrine.csv` déclare `cnil`. La doctrine est donc mesurée
   ici à `0,67 / 0,67 / 0,02` (6 confiantes, 4 erreurs, borne 90,3 %), ce que le produit
   rend réellement. Au repli, elle donnerait 9 confiantes, 6 erreurs, borne 87,9 % — le
   chiffre déjà publié dans `risque-couverture.md`.
