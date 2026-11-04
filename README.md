# Vitrine

Veille juridique française publiée en statique : les publications des autorités, de la CJUE et
des juridictions françaises sont collectées, normalisées, versionnées dans git, puis rendues en
HTML.

Cinq matières : données personnelles, IA, cybersécurité, données non personnelles, plateformes. La
sélection est locale ; le site public la lit sans JavaScript.

## En local

```bash
npm install
cp .env.example .env                    # renseigner les accès PISTE
git config core.hooksPath .githooks     # active le garde-fou secrets
npm run veille                          # lit les sources et écrit data/
npm run backfill       # recalcule themes sur les entrées existantes
npm run dev            # http://localhost:4321
npm test               # suite hors ligne
npm run build          # génère dist/

npm run corpus:build   # CELLAR → data/corpus/rgpd/
npm run corpus:index   # Ollama + sqlite-vec → data/corpus/index/index.db
npm run mcp:smoke      # vérifie Ollama et qwen3-embedding:0.6b
npm run mcp            # serveur MCP sur stdio
npm run mcp:eval       # 20 questions, métriques datées (hors CI)
```

Le MCP lit le RGPD par article exact et par recherche sémantique, avec provenance. Seule la
recherche sémantique exige Ollama sur `127.0.0.1:11434` et le modèle `qwen3-embedding:0.6b`
(`ollama pull qwen3-embedding:0.6b`) : une question qui cite un article (« article 17 ») est servie
sans index. Sans Ollama, `corpus:index` et la recherche sémantique échouent avec un message qui
nomme la commande.

Pour le brancher dans un client MCP, déclarer un serveur stdio avec le chemin absolu du serveur :

```json
{
  "mcpServers": {
    "rgpd": { "command": "node", "args": ["/Users/val/Developer/Vitrine-mcp/mcp/server.ts"] }
  }
}
```

`mcp/server.ts` résout la racine du dépôt depuis `import.meta.url`, jamais depuis le répertoire
courant : un chemin relatif échouerait hors de la racine.

## Comment ça marche

- `veille/` — le pipeline : dix adaptateurs (neuf autorités, la Commission a deux flux) → normalisation → rattachement aux matières → `data/`.
- `src/` — les pages Astro, qui lisent `data/` au build et filtrent les matières actives.
- `mcp/` — le corpus RGPD, l'index vectoriel et le serveur MCP stdio (`get_article`, `search`),
  séparés du pipeline et du site.
- `data/` — snapshots bruts adressés par leur contenu, entrées JSON, journal d'appels PISTE et
  corpus RGPD, versionnés dans git ; l'index `data/corpus/index/` est un dérivé ignoré.
- `veille/themes.json` — les cinq matières, leurs textes, leurs sources et leur état.
- `tools/parametres.html` — l'outil local qui active ou désactive une matière.
- `aidd_docs/INSTALL.md` — les décisions d'architecture et les étapes d'installation.
