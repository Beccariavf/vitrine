# Mesures — #113, recherche lexicale seule

Mesure du 2026-11-20 sur l'index réel `data/corpus/index/index.db` (116 541 unités, 1 024 dimensions,
Harrier `leoipulsar/harrier-0.6b` pour la voie dense). Ollama vérifié disponible par `npm run mcp:smoke`
(« leoipulsar/harrier-0.6b, 1024 dimensions, norme 1.000000 »). Aucun split `test` mesuré, aucun index
reconstruit, `data/` non modifié.

## Commandes exactes

```sh
npm run mcp:smoke
node mcp/eval/run.ts --questions <jeu>.csv --split dev --json > <jeu>-dense.json
node mcp/eval/run.ts --questions <jeu>.csv --split dev --recherche lexicale --json > <jeu>-lexical.json
node mcp/eval/compare.ts <jeu>-dense.json <jeu>-lexical.json --vue brute
```

`<jeu>` prend les huit valeurs : `questions-v3`, `questions-cnil-etendu`, `questions-lil`,
`questions-aiact`, `questions-ce`, `questions-cepd`, `questions-cc`, `questions-cjue`.

Le rapport lexical se lit aussi sans `--json` :
`node mcp/eval/run.ts --questions <jeu>.csv --split dev --recherche lexicale` (aucun embedder construit,
modèle affiché « aucun »).

## Résultats par jeu, split `dev`

Métriques du rapport d'évaluation, questions sémantiques seules (les références exactes sont au rang 1
par construction et exclues du dénominateur). `Δ` = lexical − dense, en points de pourcentage, sauf MRR
en points absolus.

| Jeu | n | Top 5 dense | Top 5 lexical | Δ Top 5 | Top 1 dense | Top 1 lexical | Δ Top 1 | MRR dense | MRR lexical | Δ MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| questions-v3 | 34 | 97,1 % | 91,2 % | −5,9 | 67,6 % | 47,1 % | −20,5 | 0,800 | 0,667 | −0,133 |
| questions-cnil-etendu | 54 | 81,5 % | 87,0 % | +5,5 | 70,4 % | 75,9 % | +5,5 | 0,740 | 0,793 | +0,053 |
| questions-lil | 10 | 90,0 % | 60,0 % | −30,0 | 60,0 % | 50,0 % | −10,0 | 0,725 | 0,533 | −0,192 |
| questions-aiact | 3 | 100,0 % | 33,3 % | −66,7 | 66,7 % | 0,0 % | −66,7 | 0,733 | 0,167 | −0,566 |
| questions-ce | 11 | 45,5 % | 72,7 % | +27,2 | 27,3 % | 36,4 % | +9,1 | 0,348 | 0,503 | +0,155 |
| questions-cepd | 10 | 100,0 % | 100,0 % | 0,0 | 90,0 % | 100,0 % | +10,0 | 0,950 | 1,000 | +0,050 |
| questions-cc | 10 | 70,0 % | 80,0 % | +10,0 | 40,0 % | 60,0 % | +20,0 | 0,503 | 0,670 | +0,167 |
| questions-cjue | 10 | 80,0 % | 80,0 % | 0,0 | 70,0 % | 50,0 % | −20,0 | 0,750 | 0,600 | −0,150 |

## Comparaison appariée (`compare.ts --vue brute`)

La vue brute décide sur les rangs, puisque l'échelle de confiance change : le mode lexical n'applique
aucun seuil BM25. Le domaine de décision est l'ensemble des questions `conceptuelle` non pièges, ce qui
inclut une question de `questions-ce` classée « référence exacte » par le rapport (d'où 12 questions
ici contre 11 sémantiques ci-dessus).

| Jeu | Domaine | Top 5 dense → lexical | Top 1 dense → lexical | b / c | p (McNemar) | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| questions-v3 | 34 | 33 → 31 | 23 → 16 | 2 / 9 | 0,0654 | conserver (le candidat perd plus qu'il ne gagne) |
| questions-cnil-etendu | 54 | 44 → 47 | 38 → 41 | 11 / 8 | 0,6476 | non_etabli |
| questions-lil | 10 | 9 → 6 | 6 → 5 | 0 / 1 | 1,0000 | non_etabli (moins de six paires) |
| questions-aiact | 3 | 3 → 1 | 2 → 0 | 0 / 2 | 0,5000 | non_etabli (moins de six paires) |
| questions-ce | 12 | 6 → 8 | 3 → 4 | 1 / 0 | 1,0000 | non_etabli (moins de six paires) |
| questions-cepd | 10 | 10 → 10 | 9 → 10 | 1 / 0 | 1,0000 | non_etabli (moins de six paires) |
| questions-cc | 10 | 7 → 8 | 4 → 6 | 3 / 1 | 0,6250 | non_etabli (moins de six paires) |
| questions-cjue | 10 | 8 → 8 | 7 → 5 | 1 / 3 | 0,6250 | non_etabli (moins de six paires) |

Seul `questions-v3` a assez de paires discordantes (11) pour trancher : il conclut à **conserver le
dense**. Partout ailleurs, l'écart n'est pas établi, ce qui ne veut pas dire qu'il est nul : les jeux
font 3 à 54 questions sémantiques.

## Pièges

Le mode lexical ne refuse rien par seuil : un piège rendu est un piège cité. Sur `questions-v3`, 1 piège
sur 3 est rendu ; sur `questions-cnil-etendu`, 6 sur 6 ; sur `questions-aiact`, 1 sur 1. Aucun jeu
LIL, CE, CEPD, CC ou CJUE ne porte de piège. Ce n'est pas comparable au mode dense, dont les pièges sont
refusés par le plancher de similarité : c'est une limite du mode, dite dans la sortie du harnais.

## Verdict

Perte acceptable pour un mode d'essai gratuit, à condition de ne pas le présenter comme équivalent :
le rappel@5 reste proche ou supérieur sur quatre jeux (CNIL, CE, CC, CEPD), mais il chute sur la LIL
(−30 points) et l'AI Act (3 questions seulement), et le top 1 recule de 20,5 points sur `questions-v3`,
le seul jeu où McNemar tranche — en faveur du dense. L'adoption n'est pas tranchée ici.
