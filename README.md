# Vitrine

Veille juridique française publiée en statique : les actualités officielles sont collectées,
normalisées, versionnées dans git, puis rendues en HTML.

## En local

```bash
npm install
npm run veille   # lit la source officielle et écrit data/
npm run dev      # http://localhost:4321
npm test         # suite hors ligne
npm run build    # génère dist/
```

## Comment ça marche

- `veille/` — le pipeline : source officielle → normalisation → `data/`.
- `src/` — les pages Astro, qui lisent `data/` au build.
- `data/` — snapshots bruts adressés par leur contenu et entrées JSON, versionnés dans git.
- `aidd_docs/INSTALL.md` — les décisions d'architecture et les étapes d'installation.
