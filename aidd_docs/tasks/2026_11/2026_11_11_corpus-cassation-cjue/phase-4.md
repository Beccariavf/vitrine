# Phase 4 — Collecte, index et éval dev

## Livrables

- `data/corpus/cc/` et `data/corpus/cjue/` commités avec leurs manifestes.
- Index incrémental reconstruit (`npm run corpus:index`).
- `mcp/eval/questions-cc.csv` et `mcp/eval/questions-cjue.csv`, mesurés en `dev` avec rangs.
- Rapport de couverture et d'éval dans le dossier de tâche.

## Vérification

- Les comptes du manifeste égalent les lignes de `unites.jsonl`.
- Les deux corpus sont dans l'index et filtrés par `corpus`.
