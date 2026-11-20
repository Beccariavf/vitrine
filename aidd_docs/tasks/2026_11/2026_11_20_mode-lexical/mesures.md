# Mesures — #113, recherche lexicale seule

Mesure du 2026-11-20 sur l'index réel `data/corpus/index/index.db` (116 541 unités, 1 024 dimensions,
Harrier `leoipulsar/harrier-0.6b` pour la voie dense). Ollama vérifié disponible par `npm run mcp:smoke`
(« leoipulsar/harrier-0.6b, 1024 dimensions, norme 1.000000 »). Aucun split `test` mesuré, aucun index
reconstruit, `data/` non modifié.

Les treize jeux `dev` du dépôt sont mesurés : les huit du plan (`questions-v3`, `questions-cnil-etendu`,
`questions-lil`, `questions-aiact`, `questions-ce`, `questions-cepd`, `questions-cc`, `questions-cjue`)
et les cinq autres jeux `dev` (`questions.csv` v1, `questions-v2.csv`, `questions-cnil.csv`,
`questions-cnil-v2.csv`, `questions-cnil-doctrine.csv`) ; `questions-cnil.csv` n'a pas de colonne
`split`, le harnais le lit en entier comme `dev`. Les deux jeux RGPD v1 et v2 comptent parce que ce
sont eux qui changent la lecture : sur le corpus phare, le dense gagne significativement.

## Commandes exactes

```sh
npm run mcp:smoke
node mcp/eval/run.ts --questions <jeu>.csv --split dev --json > <jeu>-dense.json
node mcp/eval/run.ts --questions <jeu>.csv --split dev --recherche lexicale --json > <jeu>-lexical.json
node mcp/eval/compare.ts <jeu>-dense.json <jeu>-lexical.json --vue brute
```

Le rapport lexical se lit aussi sans `--json` :
`node mcp/eval/run.ts --questions <jeu>.csv --split dev --recherche lexicale` (aucun embedder construit,
modèle affiché « aucun »). Les fichiers JSON ne sont pas commités : les commandes ci-dessus
reproduisent les mêmes chiffres sur le même index.

## Preuve sur l'index, sans Ollama

Question « durée de conservation des données de vidéosurveillance », `search(..., { recherche:
"lexicale" })`, embedder interdit qui lève s'il est appelé. Cinq références rendues, `distance` et
`similarite` absentes, `rang_lexical` de 1 à 5 :

| rang | référence | corpus |
| ---: | --- | --- |
| 1 | `guidelines-32019-on-processing-of-personal-data-through-video-devices#f120` | CEPD |
| 2 | `CNILTEXT000052266505#f22` (SAN-2025-008) | CNIL |
| 3 | `CNILTEXT000048186230#f8` (2023-067) | CNIL |
| 4 | `CNILTEXT000033734153#f10` (2016-386) | CNIL |
| 5 | `CNILTEXT000021123155#f5` (2009-201) | CNIL |

`VITRINE_RECHERCHE=lexicale npm run mcp:demo` passe ses cinq étapes et affiche « rang lexical » au lieu
d'une similarité.

## Résultats par jeu, split `dev`

Métriques du rapport d'évaluation, questions sémantiques seules (les références exactes sont au rang 1
par construction et exclues du dénominateur). `Δ` = lexical − dense, en points de pourcentage, sauf MRR
en points absolus.

| Jeu | n | Top 5 dense | Top 5 lexical | Δ Top 5 | Top 1 dense | Top 1 lexical | Δ Top 1 | MRR dense | MRR lexical | Δ MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| questions (v1) | 20 | 95,0 % | 80,0 % | −15,0 | 85,0 % | 50,0 % | −35,0 | 0,900 | 0,617 | −0,283 |
| questions-v2 | 19 | 100,0 % | 78,9 % | −21,1 | 78,9 % | 36,8 % | −42,1 | 0,886 | 0,530 | −0,356 |
| questions-v3 | 34 | 97,1 % | 91,2 % | −5,9 | 67,6 % | 47,1 % | −20,5 | 0,800 | 0,667 | −0,133 |
| questions-cnil | 18 | 33,3 % | 61,1 % | +27,8 | 33,3 % | 50,0 % | +16,7 | 0,333 | 0,542 | +0,209 |
| questions-cnil-etendu | 54 | 81,5 % | 87,0 % | +5,5 | 70,4 % | 75,9 % | +5,5 | 0,740 | 0,793 | +0,053 |
| questions-cnil-v2 | 25 | 84,0 % | 76,0 % | −8,0 | 48,0 % | 68,0 % | +20,0 | 0,610 | 0,710 | +0,100 |
| questions-cnil-doctrine | 10 | 20,0 % | 40,0 % | +20,0 | 10,0 % | 30,0 % | +20,0 | 0,120 | 0,350 | +0,230 |
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
| questions (v1) | 20 | 19 → 16 | 17 → 10 | 0 / 7 | 0,0156 | conserver |
| questions-v2 | 19 | 19 → 15 | 15 → 7 | 0 / 8 | 0,0078 | conserver |
| questions-v3 | 34 | 33 → 31 | 23 → 16 | 2 / 9 | 0,0654 | conserver (le candidat perd plus qu'il ne gagne) |
| questions-cnil | 6 | 0 → 2 | 0 → 1 | 1 / 0 | 1,0000 | non_etabli (moins de six paires) |
| questions-cnil-etendu | 54 | 44 → 47 | 38 → 41 | 11 / 8 | 0,6476 | non_etabli (gain non significatif) |
| questions-cnil-v2 | 0 | — | — | 0 / 0 | 1,0000 | non_etabli (aucune question conceptuelle) |
| questions-cnil-doctrine | 10 | 2 → 4 | 1 → 3 | 2 / 0 | 0,5000 | non_etabli (moins de six paires) |
| questions-lil | 10 | 9 → 6 | 6 → 5 | 0 / 1 | 1,0000 | non_etabli (moins de six paires) |
| questions-aiact | 3 | 3 → 1 | 2 → 0 | 0 / 2 | 0,5000 | non_etabli (moins de six paires) |
| questions-ce | 12 | 6 → 8 | 3 → 4 | 1 / 0 | 1,0000 | non_etabli (moins de six paires) |
| questions-cepd | 10 | 10 → 10 | 9 → 10 | 1 / 0 | 1,0000 | non_etabli (moins de six paires) |
| questions-cc | 10 | 7 → 8 | 4 → 6 | 3 / 1 | 0,6250 | non_etabli (moins de six paires) |
| questions-cjue | 10 | 8 → 8 | 7 → 5 | 1 / 3 | 0,6250 | non_etabli (moins de six paires) |

Quatre jeux dépassent le plancher de six paires discordantes : `questions`, `questions-v2` et
`questions-v3` concluent tous à **conserver le dense** (deux fois significativement, p = 0,0156 et
0,0078 ; v3 par la règle b ≤ c, p = 0,0654), et `questions-cnil-etendu` ne conclut pas (p = 0,6476).
Partout ailleurs l'écart n'est pas établi, ce qui ne veut pas dire qu'il est nul : les jeux font 3 à
54 questions sémantiques.

## Pièges

Le mode lexical ne refuse rien par seuil : un piège rendu est un piège cité. Pièges cités par jeu :
`questions` 6/6, `questions-v2` 4/4, `questions-v3` 1/3, `questions-cnil` 1/1,
`questions-cnil-etendu` 6/6, `questions-aiact` 1/1 ; les autres jeux n'en portent aucun. Ce n'est pas
comparable au mode dense, dont les pièges sont refusés par le plancher de similarité : c'est une limite
du mode, dite dans la sortie du harnais.

## Verdict

Perte non acceptable comme substitut : sur les trois jeux RGPD (v1, v2, v3), le dense gagne, deux fois
significativement, et le top 1 lexical tombe de 20,5 à 42,1 points ; aucun gain établi ailleurs (CNIL,
Conseil d'État, Cour de cassation) ne compense la perte établie sur le corpus phare. Le mode ne convient
qu'à un essai gratuit explicitement présenté comme dégradé. L'adoption n'est pas tranchée ici.
