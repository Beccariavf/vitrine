---
status: pending
---

# Instruction: Serveur MCP

## Architecture projection

```txt
.
├── ✅ mcp/
│   ├── ✅ tools.ts
│   ├── ✅ confidence.ts
│   └── ✅ server.ts
├── ✅ tests/
│   └── ✅ mcp.test.ts
└── ✏ package.json
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Écrire un corpus de test de six unités et un index factice | Les outils ont une source | cli |
| Happy path   | Appeler `get_article` avec `document` `32016R0679` et `numero` `17` | Le texte, `32016R0679#art_17`, la date et l'URL | cli |
| Happy path   | Appeler `search` avec « effacement » | La référence `art_17` figure dans les cinq premiers passages | cli |
| Happy path   | Appeler `search` avec « article 17 du RGPD » | Le court-circuit exact rend `confiant` sans interroger l'index | cli |
| Edge case    | Appeler `get_article` sur un article absent | Une réponse explicite « introuvable », jamais une chaîne vide | cli |
| Edge case    | Appeler `search` sur une question hors corpus | `aucun_resultat_fiable`, aucun passage inventé | cli |
| Edge case    | Chercher `fetch` dans `mcp/server.ts` et `mcp/tools.ts` | Aucun appel réseau | cli |
| Teardown     | Fermer la connexion en mémoire | Aucune ressource ouverte | cli |

## Tasks to do

### `1)` Lire un article exact

> Le texte vient du corpus, jamais d'une génération.

1. Écrire `getArticle(rootDir, { document, numero })` dans `mcp/tools.ts`.
2. Lire `data/corpus/<document>/unites.jsonl`, filtrer sur `niveau: "article"` et `numero` normalisé.
3. Rendre `ref`, `document`, `niveau`, `numero`, `chemin`, `texte`, `date_acte`, `date_debut`, `date_fin`, `statut`, `url`.
4. Rendre `{ trouve: false }` quand aucun article ne correspond, en nommant le numéro demandé.

### `2)` Chercher par le sens

> Un court-circuit déterministe avant les vecteurs.

1. Écrire `search(rootDir, { question, k, document })` dans `mcp/tools.ts`.
2. Détecter une référence exacte avec `/\b(?:article|art\.?)\s*(\d+)/i` ; si elle existe, appeler `getArticle` et rendre `confiant`.
3. Sinon, embarquer la requête et interroger l'index par `searchIndex`.
4. Rendre le niveau de confiance et les passages avec `ref`, `document`, `texte`, `chemin`, `url`, `date_acte`, `date_debut`, `date_fin`, `statut`.
5. Rédiger la description de l'outil : citer la provenance, respecter le niveau rendu, ne jamais compléter un texte absent.

### `3)` Nommer la confiance

> Le serveur ne maîtrise pas la rédaction, seulement ce qu'il rend.

1. Écrire `niveauConfiance(resultats, exact)` et les seuils dans `mcp/confidence.ts`.
2. Convertir la distance cosinus en similarité `1 - distance` avant comparaison.
3. `confiant` si la référence est exacte, ou si la similarité du premier dépasse le seuil haut avec la marge requise.
4. `aucun_resultat_fiable` sous le seuil bas ou sans résultat ; `incertain` entre les deux.
5. Documenter les seuils initiaux comme à calibrer en phase 4.

### `4)` Exposer en stdio

> Deux outils, aucune ressource réseau, aucun journal sur `stdout`.

1. Écrire `mcp/server.ts` avec `McpServer` importé de `@modelcontextprotocol/sdk/server/mcp.js` et `StdioServerTransport` de `@modelcontextprotocol/sdk/server/stdio.js`.
2. Déclarer `get_article` et `search` avec un `inputSchema` Zod et les consignes de provenance.
3. Résoudre la racine du dépôt depuis `import.meta.url`, jamais depuis `process.cwd()`.
4. Connecter `StdioServerTransport`, écrire les journaux sur `stderr`, sortir proprement sur `SIGINT`.
5. Ajouter `"mcp": "node mcp/server.ts"` et épingler `@modelcontextprotocol/sdk@1.32.2` et `zod` en version exacte.

### `5)` Verrouiller par les tests

> Les outils sont purs ; le serveur se teste en mémoire.

1. Écrire `tests/mcp.test.ts` sur un corpus et un embedder factices.
2. Vérifier l'article exact, l'article absent, la recherche sémantique, le court-circuit exact et les trois niveaux de confiance.
3. Vérifier que les deux outils sont enregistrés avec `InMemoryTransport.createLinkedPair()` importé de `@modelcontextprotocol/sdk/inMemory.js`.
4. Vérifier qu'aucun `fetch` n'apparaît dans `mcp/server.ts` ni `mcp/tools.ts`.
5. Lancer `npm test` et `npm run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `numero` `17` rend `32016R0679#art_17`, le texte complet, la date et l'URL ; un numéro absent rend `{ trouve: false }`. |
| 2 | « article 17 du RGPD » rend `confiant` sans index ; « effacement » rend `art_17` dans les cinq premiers. |
| 3 | Les trois niveaux se déduisent de la similarité et de la marge, avec les cas limites documentés. |
| 4 | Le serveur démarre sur stdio, expose exactement `get_article` et `search`, et n'écrit rien sur `stdout` hors protocole. |
| 5 | Les tests passent hors ligne et les deux outils sont visibles dans la liste du client en mémoire. |
