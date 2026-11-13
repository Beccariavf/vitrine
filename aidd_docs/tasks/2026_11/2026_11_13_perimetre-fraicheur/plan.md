---
status: approved
date: 2026-11-13
spec: ./spec.md
---

# Plan : périmètre et fraîcheur dans chaque réponse

Une seule phase : le changement tient dans `mcp/tools.ts`, `mcp/server.ts` et leurs tests.

## Étapes

1. `mcp/tools.ts` — type `Perimetre` et fonction `perimetreDe(rootDir, { corpus?, document? }, avertir)` :
   - inventaire via `inventaireCorpus`, `a_jour_au` via `lireRapport` ;
   - corpus : demandé → manifeste déclarant le document (`document` ou `text_id`, identifiant normalisé) → tous ;
   - `exclusions` : renvoi fixe vers `etat_corpus` → `corpus[].couverture` ;
   - `avertissement` seulement quand demandé.
2. Brancher `perimetre` sur `getArticle` (trouvé et absent), `getDecision` (toutes les sorties) et `search` (toutes les sorties ; avertissement sur `aucun_resultat_fiable`). Le document inféré de la question compte comme document.
3. `etatCorpus` : chaque corpus porte `couverture` lue au manifeste, `null` sinon.
4. `mcp/server.ts` : consigne `CONSIGNE_PERIMETRE` ajoutée aux trois descriptions ; `etat_corpus` mentionne `couverture`.
5. Tests dans `tests/mcp.test.ts` (racines temporaires), puis `npm run typecheck`, `npm test`, `npm run build`.

## Validation

- Pas de parcours de bout en bout : aucun changement d'interface du site ; le serveur est couvert par le client MCP en mémoire des tests.
