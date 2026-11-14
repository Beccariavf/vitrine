---
status: approved
date: 2026-11-13
spec: ./spec.md
---

# Plan : citations entre décisions

1. `mcp/corpus/citations-decisions.ts` : extraction des cinq familles (tirets typographiques, date de la décision citée, auto-citations et en-têtes exclus), résolution par clé et date, numéros joints indexés, cache par fichier, `MESURES` et `famillesExposees`.
2. `mcp/tools.ts` : `decisions_citees` sur les passages de `search` et les décisions de `get_decision`.
3. `mcp/server.ts` : outil `decisions_citant_decision`, consigne publiant les chiffres par famille.
4. `mcp/eval/citations-decisions.ts` : échantillonneur déterministe pour la relecture.
5. Mesure : un relecteur indépendant par famille, corrections puis nouvelle passe jusqu'au code final ; `mesure.md`.
6. Tests `tests/citations-decisions.test.ts`, listes d'outils, descriptions ; `npm run typecheck`, `npm test`, `npm run build`.

Pas de parcours de bout en bout : aucune interface du site.
