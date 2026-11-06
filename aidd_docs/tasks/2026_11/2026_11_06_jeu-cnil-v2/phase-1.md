# Phase 1: Écrire et valider le jeu

## Acceptance

- `mcp/eval/questions-cnil-v2.csv` porte 50 lignes, en-tête `question,type,sources_attendues,piege,split,corpus`.
- 50 `reference`, 0 `conceptuelle`, 0 `piege` ; 25 `dev`, 25 `test` ; `corpus = cnil` partout.
- 50 documents distincts, tous présents dans `data/corpus/cnil/unites.jsonl`.
- Aucune question ne contient de virgule (le CSV se découpe sur la virgule), d'identifiant cible, de numéro `SAN-…` cible, ni de `article N`.
- Aucune question n'est déjà dans les jeux v1, v2, v3, AI Act ou CNIL 20.
- `tests/eval.test.ts` couvre ces invariants et échoue si l'un tombe.

## Evidence

- `lireJeu` lit le fichier et `corpusDuJeu` rend `cnil`.
- `validerReferences` passe sur les 50 documents.
- Le test « ne nomme ni l'identifiant ni le numéro » est le garde contre une question de consultation déguisée.
- Chaque prémisse a été relue contre le texte de sa cible. Trois questions du premier jeu ont été corrigées (deux dans `test`, une dans `dev`) : « annuaire » pour `CNILTEXT000051630617`, « chaussures » pour `CNILTEXT000049382214`, « secret » pour `CNILTEXT000050202759`. La vérification d'après mesure a ensuite trouvé une quatrième cible erronée (`CNILTEXT000046693390`, un opérateur de télécommunication et non un courtier) et une paraphrase du jeu de 20. Le split `test` entier a été remplacé par 25 questions neuves sur 25 documents distincts du `dev` ; l'ancien split est archivé dans `b442d14`.
