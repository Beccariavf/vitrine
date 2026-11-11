# Phase 4 — Collecte, index et éval dev

## Livrables

- `data/corpus/cc/` et `data/corpus/cjue/` commités avec leurs manifestes.
- Index incrémental reconstruit (`npm run corpus:index`).
- `mcp/eval/questions-cc.csv` et `mcp/eval/questions-cjue.csv`, mesurés en `dev` avec rangs.
- Rapport de couverture et d'éval dans le dossier de tâche.

## Vérification

- Les comptes du manifeste égalent les lignes de `unites.jsonl`.
- Les deux corpus sont dans l'index et filtrés par `corpus`.

## Mesures

- Index : 74 947 unités (`leoipulsar/harrier-0.6b`, 1 024 dimensions), 21 804 ajoutées depuis les 53 143 d'avant le lot.
- Cour de cassation : 6/10 au top 5, MRR 0,470, top 1 40,0 %.
- CJUE : 8/10 au top 5, MRR 0,750, top 1 70,0 %.
- Détail : [`eval.md`](./eval.md) ; comptes : [`coverage.md`](./coverage.md).
