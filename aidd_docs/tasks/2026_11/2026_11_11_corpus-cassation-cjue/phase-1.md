# Phase 1 — Budget PISTE et parseur Cour de cassation

## Livrables

- `PisteSession` accepte un budget d'appels explicite (`budget`), le plafond de la veille reste le défaut.
- `mcp/corpus/cc/descripteur.json` : requêtes, borne, mots-clés, licence, budget.
- `mcp/corpus/cc/parse.ts` : filtre de pertinence compté, unités (visa + texte découpé), validation.

## Vérification

- Tests unitaires du budget : un budget de 2 laisse deux appels, le troisième lève.
- Tests du parseur : décision pertinente (visa RGPD) retenue, décision hors sujet écartée, décision avant 2014 écartée et comptée, texte vide écarté.
