# Phase 2: Mesurer dev puis test une fois

## Acceptance

- `dev` mesuré avec les seuils du produit, sans calibration sur le jeu.
- `test` mesuré une seule fois avec `--mesurer-test` et les mêmes seuils.
- `mcp/eval/questions-cnil-v2.test-consomme.json` écrit, empreinte du CSV `7d9595df…`.
- Une seconde exécution du `test` est refusée.
- `eval-cnil-v2.md` porte les chiffres, les échecs et les limites ; aucun autre rapport n'est réécrit.

## Evidence

| Split | Top 5 | Top 1 | MRR |
| --- | --- | --- | --- |
| `dev` (25) | 14/25 (56,0 %) | 7/25 (28,0 %) | 0,374 |
| `test` (25) | 16/25 (64,0 %) | 12/25 (48,0 %) | 0,560 |

- Seuils : `0,69 / 0,74 / 0,01`, fournis par `--seuils`, identiques aux deux splits.
- Niveaux `test` : 10 confiant, 15 incertain, 0 aucun_resultat_fiable.
- Le garde a été vérifié : la seconde exécution rend « Test déjà consommé ».
- Deux splits antérieurs ont été mesurés puis abandonnés (14/25, puis 15/25 après corrections) ; le second est archivé dans `b442d14`. Le split retenu porte 25 questions neuves sur 25 documents que le `dev` n'utilise pas ; il a été mesuré une fois. Il n'est pas préenregistré, et le rapport le dit.
