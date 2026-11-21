# Audit de sécurité — 2026-11-21

Périmètre : `main` @ `6fb02fe`, lecture seule. Audit fait à la main (le skill `security-review` vise un diff, pas un dépôt entier).

## Résumé

- Aucune faille béante : rien n'est déployé, l'API HTTP écoute `127.0.0.1` seul, le MCP est en stdio, le SQL est paramétré, aucun secret dans le dépôt ni l'historique (dépôt **public**).
- Aucune faille Critique ni Haute. Six Basses, toutes corrigeables en S, à traiter surtout **avant** un déploiement public.

## Failles

| ID | Gravité | Titre | Fichier:ligne | Exploitation | Correctif proposé | Effort | Risque de régression |
|---|---|---|---|---|---|---|---|
| S1 | Basse | API locale sans contrôle de `Host` (DNS rebinding) | `mcp/http.ts:214-237` | Pendant `npm run dev`, une page malveillante rebinde son domaine sur `127.0.0.1:8790` et lit les réponses en même origine. Elle obtient des données publiques du corpus et les messages 503/500 (S2). Elle peut aussi épuiser le limiteur, partagé par toute la boucle locale. Chrome LNA atténue le risque. | En tête de `router`, rendre 403 si `req.headers.host` ∉ {`127.0.0.1:<port>`, `localhost:<port>`}. | S | Faible : les tests appellent déjà l'API par `127.0.0.1`, à vérifier dans `tests/`. |
| S2 | Basse | Messages d'erreur internes renvoyés au client | `mcp/http.ts:259-263`, `290-292`, `309` ; source `mcp/index/search.ts:84` | La réponse 503 contient le chemin absolu de l'index (`/Users/<nom>/…`), donc le nom du compte local. Les 500 rendent `error.message` brut. Seul le cas S1 permet de les lire depuis le web. | Rendre au client un message fixe (« Index indisponible », « Erreur interne ») et écrire le détail sur `stderr`. | S | Faible : mettre à jour les assertions de message dans les tests HTTP. |
| S3 | Basse | `href` des actualités sans contrôle de schéma | `veille/normalize.ts:8-12` → `src/pages/veille/index.astro:190,235`, `src/components/PublicationRangee.astro:53` | Si un flux source (RSS ARCEP/ANSSI/Commission…) publie un lien `javascript:…`, il est écrit dans `data/entries` et rendu en `href` : XSS au clic sur le site statique. Il faut pour cela qu'une source officielle soit compromise. Le site n'est pas déployé et la passe est relue au diff. | Refuser à l'écriture toute entrée dont l'URL n'est pas `https:`/`http:`, comme `urlOfficielle` (`src/lib/essai-recherche.ts:43`) le fait déjà côté essai. | S | Faible. |
| S4 | Basse | Aucun en-tête de sécurité prévu pour le déploiement | absence de `public/_headers` / config Workers | Une fois le site publié : pas de CSP, HSTS, `frame-ancestors`, `nosniff` ni `Referrer-Policy`, donc clickjacking possible et aucune défense en profondeur contre S3. Sans effet tant que rien n'est déployé. | Avec le ticket de déploiement Cloudflare, ajouter `public/_headers` : `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <PUBLIC_RECHERCHE_URL>; frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. | S | Moyen : une CSP stricte peut casser les styles et scripts inline d'Astro ; à vérifier avec `npm run preview`. |
| S5 | Basse | `fast-xml-parser` 5.11.2 : CPU quadratique (GHSA-474x-hrwr-fgx4) | `package.json` ; `stopNodes` dans `mcp/corpus/ce/parse.ts:75`, `mcp/corpus/constit/parse.ts:84` | Une archive DILA (JADE/CONSTIT) piégée bloquerait la sync locale par déni de service. La source est gouvernementale et servie en HTTPS. | `fast-xml-parser` → `5.12.1` (épinglé exact, `npm install fast-xml-parser@5.12.1`), puis `npm test`. | S | Faible : version mineure de la même majeure. |
| S6 | Basse | Actions CI épinglées par tag, identifiants persistés | `.github/workflows/ci.yml:16,27` | Si le tag `v4` d'une action était réécrit, le code changé s'exécuterait en CI. L'impact est borné par `contents: read`, l'absence de secrets et l'absence de `pull_request_target`. | Épingler `actions/checkout` et `actions/setup-node` par SHA, et ajouter `persist-credentials: false` au checkout. | S | Faible. |

## Faux positifs écartés

- `astro` ≤ 7.4.6 (GHSA-mh32-jxcr-mh9f, balises dynamiques) : aucun nom de balise dynamique dans `src/`, et la dépendance sert seulement au dev et au build. Passer à 7.4.13 reste conseillé (S).
- `astro` (GHSA-r3h5-4585-7x3w) : concerne `@astrojs/node`, absent du projet.
- Injection SQL / FTS5 : toutes les requêtes sont paramétrées (`mcp/index/search.ts:274-308`, `388-422`) et `requeteLexicale` met chaque mot entre guillemets (`:341`).
- `set:html` : `Collage.astro:82` injecte un SVG du dépôt (`?raw`), `veille/index.astro:331` du CSS construit à partir d'ids validés par `/^[a-z0-9-]+$/` (`veille/themes.ts:43`).
- XSS dans l'essai de recherche : rendu par `textContent` et URL filtrée par `urlOfficielle` (`src/lib/essai-recherche.ts:43-51`).
- Path traversal CEPD : le repli `slugSecurise` (`mcp/corpus/cepd/sync.ts:298`) ne sert qu'au rapport des écartés ; l'écriture (`:687`) utilise le slug assaini par `slugDe`. Les ids Judilibre sont validés (`mcp/corpus/cc/sync.ts:41`).
- SSRF : URLs de sources codées en dur ; PDF CEPD filtrés par hôte (`mcp/corpus/cepd/pdf.ts:116`) et par schéma.
- Injection de commande : `execFileSync` sans shell (`mcp/corpus/delais.ts:292`, `tools/kanban.ts:204`).
- CORS : liste blanche exacte, pas de `*` (`mcp/http.ts:185-192`).
- `PUBLIC_RECHERCHE_URL` : simple URL d'API, pas un secret.
- Données personnelles : `cc` est pseudonymisé (`M. [A]…`) ; les noms complets de `cnil` (87 distincts) et de `ce` (4) relevés par échantillon sont des membres, rapporteurs, commissaires du Gouvernement ou responsables publics. `data/usage/` ne contient que des métriques d'appels PISTE, sans contenu. Le journal HTTP n'enregistre pas la question (`mcp/http.ts:299-302`).

## Secrets

- `.env` ignoré (`.gitignore:13`), jamais ajouté dans les 635 commits ; `.env.example` est vide.
- Les trois valeurs réelles de `.env` ne figurent ni dans l'historique (`git log -S`), ni dans `dist/`, `reports/`, `research_notes/`, `.claude/`, `aidd_docs/` ou `public/`.
- Motifs `sk-`, `ghp_`, `github_pat_`, `AKIA`, `BEGIN … PRIVATE KEY`, `api_key`, `password`, `Bearer` : seulement des faux positifs (CSS `mask-image`, données du corpus, base64 d'image, chaîne de test).
- Hook pre-commit actif (`core.hooksPath=.githooks`) et contrôle en CI.

## Hors périmètre / non vérifié

- Durcissement de l'hôte et des sorties de `launchd`, et dépendances transitives d'Ollama et de `sqlite-vec` (binaire natif).
- Injection de prompt indirecte : les outils MCP rendent mot pour mot le texte du corpus (sources officielles) au client LLM. Les outils ne font que lire, donc rien n'est exploitable côté serveur ; la question se pose côté client.
- Rate limiting derrière un proxy : `remoteAddress` seul (`mcp/http.ts:224`), ce que le code documente. À revoir au déploiement de l'API.
- Futur déploiement : la page compilée appelle par défaut `http://127.0.0.1:8790` depuis le navigateur des visiteurs (`src/components/EssaiRecherche.astro:7`). Il faudra fixer `PUBLIC_RECHERCHE_URL` ou retirer l'encart.
- Je n'ai pas vérifié de façon exhaustive l'absence de données personnelles de personnes privées dans les 1,5 Go de corpus ; j'ai seulement contrôlé un échantillon par motif.
