# Phase 2: Mesurer dev puis test une fois

## Acceptance

- `dev` mesuré avec les seuils du produit, sans calibration sur le jeu.
- `test` mesuré une seule fois avec `--mesurer-test` et les mêmes seuils.
- `mcp/eval/questions-cnil-v2.test-consomme.json` écrit, empreinte du CSV `aa32d105…`.
- Une seconde exécution du `test` est refusée.
- `eval-cnil-v2.md` porte les chiffres, les échecs et les limites ; aucun autre rapport n'est réécrit.

## Evidence

| Split | Top 5 | Top 1 | MRR |
| --- | --- | --- | --- |
| `dev` (25) | 14/25 (56,0 %) | 7/25 (28,0 %) | 0,374 |
| `test` (25) | 15/25 (60,0 %) | 9/25 (36,0 %) | 0,449 |

- Seuils : `0,69 / 0,74 / 0,01`, fournis par `--seuils`, identiques aux deux splits.
- Niveaux `test` : 10 confiant, 15 incertain, 0 aucun_resultat_fiable.
- Le garde a été vérifié : la seconde exécution rend « Test déjà consommé ».
- Une première exécution du `test` a été annulée après vérification : trois prémisses factuelles ne correspondaient pas à leur cible. Les cibles n'ont pas changé, le jeu corrigé a été mesuré une fois, et les chiffres de la première exécution ne sont pas repris.
