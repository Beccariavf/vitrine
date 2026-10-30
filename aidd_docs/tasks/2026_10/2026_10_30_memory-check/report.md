# Memory check — 2026-10-30

## Structure

| File | Gap | Why |
| --- | --- | --- |
| `design.md` | missing | `ui` : `src/pages/` |
| `deployment.md` | missing | `deployment` : `.github/workflows/ci.yml` |
| `forms.md` | missing | row `ui` : aucun formulaire dans le site |
| `navigation.md` | missing | row `ui` : deux routes statiques, déjà cartographiées |

## Findings

| File | Finding | Evidence |
| --- | --- | --- |
| `vcs.md` | dit le dépôt privé | `gh repo view` → `PUBLIC` |
| `data.md` | ignore le champ `summary` et le filtre de redondance | `veille/types.ts`, `isRedundantSummary` dans `src/lib/entries.ts` |
| `data.md` | fige « 10 actualités » | le compte change à chaque passe |
| `testing.md` | ignore les tests de résumé et de redondance | `tests/summary.test.ts`, `tests/entries.test.ts` |
| `codebase-map.md` | réduit `src/` au lecteur d'entrées | `src/layouts/`, `src/pages/`, `src/styles/` |
| `codebase-map.md` | omet la CI | `.github/workflows/ci.yml` |

## Notes

- `forms.md` : rien à décrire, le site n'a aucun formulaire ; le créer vide contredirait la règle « aucune section inutilisée ».
- `navigation.md` : les deux routes et leur rôle tiennent déjà dans `codebase-map.md` ; un fichier de plus dupliquerait la carte.
- `architecture.md` : le cron reste « à créer », c'est exact ; `deployment.md` portera l'état réel de la livraison.
