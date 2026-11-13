---
status: approved
date: 2026-11-13
spec: ./spec.md
---

# Plan : périmètre et fraîcheur dans chaque réponse

Une seule phase : le changement tient dans `mcp/tools.ts`, `mcp/server.ts`, `mcp/corpus/sync-rapport.ts` et leurs tests. Révisé après la première revue : fraîcheur par corpus (spec, décision 2).

## Étapes

1. `mcp/tools.ts` — type `Perimetre` et fonction `perimetreDe(rootDir, { corpus?, document? }, avertir)` :
   - manifestes lus une fois par `lireManifestes` (déplacé dans `sync-rapport.ts` avec `ORDRE_SOURCES`), inventaire via `inventaireCorpus`, `a_jour_au` via `lireRapport` ;
   - chaque corpus : `veille` (dans `ORDRE_SOURCES`), `a_jour_au` seulement sous veille, `arrete_le`, `inconnu` hors inventaire ;
   - corpus : demandé → manifeste déclarant le document (`document` ou `text_id`, identifiant normalisé) → tous ;
   - `exclusions` : renvoi fixe vers `etat_corpus` → `corpus[].couverture` ;
   - `avertissement` seulement quand demandé.
2. Brancher `perimetre` sur `getArticle` (trouvé et absent), `getDecision` (toutes les sorties) et `search` (toutes les sorties ; avertissement sur `aucun_resultat_fiable`). Le document inféré de la question compte comme document.
3. `etatCorpus` : chaque corpus porte `couverture` lue au manifeste, `null` sinon.
4. `mcp/server.ts` : consigne `CONSIGNE_PERIMETRE` ajoutée aux trois descriptions ; `etat_corpus` mentionne `couverture`.
5. Tests dans `tests/perimetre.test.ts` (racines temporaires), descriptions dans `tests/mcp.test.ts`, puis `npm run typecheck`, `npm test`, `npm run build`.

## Validation

- Pas de parcours de bout en bout : aucun changement d'interface du site ; le serveur est couvert par le client MCP en mémoire des tests.
