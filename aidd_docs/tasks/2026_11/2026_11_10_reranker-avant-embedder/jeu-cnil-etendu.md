# Jeu CNIL élargi : 120 questions

Fichier : `mcp/eval/questions-cnil-etendu.csv`
Gel : 2026-11-10
`sha256` : `85317ef84ba5de41e02073d7f52618b739abf17325335db03bfd017dc261618b`

## Composition

| Split | Avis | Recommandation/Lignes directrices | Sanction | Piège | Total |
| ----- | ---- | ---------------------------------- | -------- | ----- | ----- |
| dev   | 20   | 7                                  | 27       | 6     | 60    |
| test  | 21   | 6                                  | 27       | 6     | 60    |
| Total | 41   | 13                                 | 54       | 12    | 120   |

| Type          | Nombre |
| ------------- | ------ |
| `conceptuelle` | 108    |
| `piege`        | 12     |

Le mélange est identique de part et d'autre : 27 documents de doctrine par split, dont 20 avis et 7 recommandations en `dev`, 21 avis et 6 recommandations en `test`. Le split `test` est à usage unique : s'il ne portait aucune recommandation, la seule mesure de confirmation possible ne dirait rien de cette tranche de la doctrine.

- 108 documents CNIL distincts, un seul par question ; aucun document n'est visé deux fois, ni dans un split ni entre splits.
- Chaque `sources_attendues` est un identifiant `CNILTEXT…` de document entier, sans `#`.
- Les 54 documents de doctrine vont de février 2021 à avril 2026 ; les 54 sanctions de juillet 2008 à mai 2026.
- Aucun des 108 documents n'était visé par `questions-cnil.csv`, `questions-cnil-v2.csv`, `questions-cnil-doctrine.csv`, `questions-v2.csv` ni `questions-v3.csv` ; aucune question ne reprend un texte d'un autre jeu.

## Questions déplacées

Douze lignes changent de `split`, sans autre modification. Sélection déterministe : les six premières de chaque catégorie dans l'ordre du fichier, avant déplacement.

| Sens        | Document              | Question                                                                                                             |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| dev → test  | `CNILTEXT000051390242` | Quelles exigences la CNIL pose-t-elle pour l'authentification multifacteur des comptes en ligne ?                     |
| dev → test  | `CNILTEXT000053668553` | Que recommande la CNIL aux employeurs qui veulent filtrer la navigation web de leurs salariés avec un serveur mandataire ? |
| dev → test  | `CNILTEXT000053885080` | Quelles règles la CNIL fixe-t-elle pour les pixels de suivi glissés dans les courriels ?                              |
| dev → test  | `CNILTEXT000053950614` | Quelles garanties la CNIL recommande-t-elle pour le vote par correspondance électronique ?                             |
| dev → test  | `CNILTEXT000054047151` | Que recommande la CNIL aux prêteurs qui évaluent le risque de défaillance de leurs clients ?                           |
| dev → test  | `CNILTEXT000054353331` | Quel encadrement la CNIL recommande-t-elle pour les données de localisation des véhicules connectés ?                  |
| test → dev  | `CNILTEXT000053308330` | Quel avis la CNIL a-t-elle rendu sur la mise à jour des changements d'état civil dans les fichiers des organismes ?     |
| test → dev  | `CNILTEXT000053461680` | Quel est l'avis de la CNIL sur l'extension des sources collectées pour détecter les ingérences numériques étrangères ? |
| test → dev  | `CNILTEXT000054019591` | Que pense la CNIL de l'échange de données entre la médecine du travail et l'assurance maladie sur les salariés menacés de désinsertion ? |
| test → dev  | `CNILTEXT000053308064` | Quel avis la CNIL a-t-elle rendu sur l'extension du traitement des titres sécurisés à la fraude à l'identité ?         |
| test → dev  | `CNILTEXT000053722050` | Quelles obligations la CNIL voit-elle pour les hébergeurs de données de santé au nom de la souveraineté ?              |
| test → dev  | `CNILTEXT000053308551` | Que pense la CNIL du dépôt de plainte par visioconférence ?                                                            |

La composition de `dev` a changé : toute mesure `dev` antérieure à ce gel est caduque.

## Vérification

`node --test tests/eval.test.ts` : 90 tests, 90 passés. `npm run typecheck` : aucun diagnostic.

Le bloc `questions-cnil-etendu.csv` verrouille : 120 questions, 60 `dev` / 60 `test`, en‑tête à six colonnes, `corpus` = `cnil` sur chaque ligne, références présentes dans `data/corpus/cnil/unites.jsonl`, pièges sans source, un document distinct par question, absence de reprise d'un autre jeu, absence d'identifiant, de numéro `SAN-…` ou d'article numéroté dans les questions, 27 documents de doctrine et 27 sanctions par split, et la même répartition de la doctrine dans les deux splits : 20 avis + 7 recommandations en `dev`, 21 avis + 6 recommandations en `test`.

Fautes introduites vérifiées : une question reprise de `questions-cnil-v2.csv` échoue en la nommant ; une question qui cite son propre `CNILTEXT…` échoue en la nommant ; une référence absente du corpus échoue en nommant la référence et la question ; un avis remis en `test` échoue en nommant le split et le compte.

## Ce que le jeu ne mesure pas

- Le filtre `nature` de la recherche et les seuils de confiance : le jeu juge le rang du document attendu, rien de plus.
- La justesse de la réponse rédigée : aucune question n'est notée sur son contenu, seulement sur le document retrouvé.
- Le rappel au fragment : les attendues sont des documents entiers, donc un fragment pertinent compte comme trouvé.
- Les questions à référence textuelle (article, `SAN-…`) : le jeu est volontairement documentaire et paraphrasé.
- La distribution des tournures : 120 questions ne couvrent ni le français familier ni les requêtes multi‑lingues.
- Les pièges sont peu nombreux (12) : le taux de citations invalides qu'ils produisent a un intervalle de confiance large.
- Le split `test` est à usage unique : toute mesure dessus consomme le jeu pour le modèle mesuré.
