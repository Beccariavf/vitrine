# Jeu CNIL élargi : 120 questions

Fichier : `mcp/eval/questions-cnil-etendu.csv`
Gel : 2026-11-10
`sha256` : `a0fa775fc26561dcc70eca3d844cc872f4ec174a5bf916cc6fc37478c2c6395b`

## Composition

| Split | Avis | Recommandation/Lignes directrices | Sanction | Piège | Total |
| ----- | ---- | ---------------------------------- | -------- | ----- | ----- |
| dev   | 14   | 13                                 | 27       | 6     | 60    |
| test  | 27   | 0                                  | 27       | 6     | 60    |
| Total | 41   | 13                                 | 54       | 12    | 120   |

| Type          | Nombre |
| ------------- | ------ |
| `conceptuelle` | 108    |
| `piege`        | 12     |

- 108 documents CNIL distincts, un seul par question ; aucun document n'est visé deux fois, ni dans un split ni entre splits.
- Chaque `sources_attendues` est un identifiant `CNILTEXT…` de document entier, sans `#`.
- Les 54 documents de doctrine vont de février 2021 à avril 2026 ; les 54 sanctions de juillet 2008 à mai 2026.
- Aucun des 108 documents n'était visé par `questions-cnil.csv`, `questions-cnil-v2.csv`, `questions-cnil-doctrine.csv`, `questions-v2.csv` ni `questions-v3.csv` ; aucune question ne reprend un texte d'un autre jeu.

## Vérification

`node --test tests/eval.test.ts` : 82 tests, 82 passés. `npm run typecheck` : aucun diagnostic.

Le bloc `questions-cnil-etendu.csv` verrouille : 120 questions, 60 `dev` / 60 `test`, en‑tête à six colonnes, `corpus` = `cnil` sur chaque ligne, références présentes dans `data/corpus/cnil/unites.jsonl`, pièges sans source, un document distinct par question, absence de reprise d'un autre jeu, absence d'identifiant, de numéro `SAN-…` ou d'article numéroté dans les questions, 27 documents d'avis ou recommandations et 27 sanctions par split.

Fautes introduites vérifiées : une question reprise de `questions-cnil-v2.csv` échoue en la nommant ; une question qui cite son propre `CNILTEXT…` échoue en la nommant ; une référence absente du corpus échoue en nommant la référence et la question.

## Ce que le jeu ne mesure pas

- Le filtre `nature` de la recherche et les seuils de confiance : le jeu juge le rang du document attendu, rien de plus.
- La justesse de la réponse rédigée : aucune question n'est notée sur son contenu, seulement sur le document retrouvé.
- Le rappel au fragment : les attendues sont des documents entiers, donc un fragment pertinent compte comme trouvé.
- Les questions à référence textuelle (article, `SAN-…`) : le jeu est volontairement documentaire et paraphrasé.
- La distribution des tournures : 120 questions ne couvrent ni le français familier ni les requêtes multi‑lingues.
- Les pièges sont peu nombreux (12) : le taux de citations invalides qu'ils produisent a un intervalle de confiance large.
- Le split `test` est à usage unique : toute mesure dessus consomme le jeu pour le modèle mesuré.
