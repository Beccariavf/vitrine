# Vitrine

Veille juridique française publiée en statique : les publications des autorités, de la CJUE et
des juridictions françaises sont collectées, normalisées, versionnées dans git, puis rendues en
HTML.

Cinq matières : données personnelles, IA, cybersécurité, données non personnelles, plateformes. La
sélection est locale ; le site public la lit sans JavaScript.

## En local

Node 24 requis (voir `.nvmrc`) : `nvm use`.

```bash
npm install
cp .env.example .env                    # renseigner les accès PISTE
git config core.hooksPath .githooks     # active le garde-fou secrets
npm run veille                          # lit les sources et écrit data/
npm run backfill       # recalcule themes sur les entrées existantes
npm run dev            # http://localhost:4321
npm test               # suite hors ligne
npm run build          # génère dist/

npm run corpus:build   # CELLAR → data/corpus/{rgpd,aiact}/
npm run corpus:build -- --document aiact   # un seul descripteur
npm run cnil:sync -- --tout                # historique DINUM + incréments DILA → data/corpus/cnil/
npm run cnil:sync -- --increments --dry-run   # ce que les archives ajouteraient, sans écrire
npm run corpus:index   # index incrémental Ollama + sqlite-vec → data/corpus/index/index.db
npm run mcp:smoke      # vérifie Ollama et qwen3-embedding:0.6b
npm run mcp            # serveur MCP sur stdio
npm run mcp:eval -- --questions questions-v2.csv --split dev    # 30 questions de développement (hors CI)
npm run mcp:eval -- --questions questions-v2.csv --split test --mesurer-test   # 30 questions tenues à l'écart, une seule fois (hors CI)
npm run mcp:eval -- --questions questions-v3.csv --split dev --json            # 40 questions de développement v3, sortie machine (hors CI)
npm run mcp:eval -- --questions questions-cnil.csv                             # 20 questions CNIL (hors CI)
```

Le MCP lit le RGPD, l'AI Act et les sanctions de la CNIL par passage exact et par recherche
sémantique, avec provenance. Seule
la recherche sémantique exige Ollama sur `127.0.0.1:11434` et le modèle `qwen3-embedding:0.6b`
(`ollama pull qwen3-embedding:0.6b`) : une question qui cite un article (« article 17 ») est servie
sans index ni modèle. Un document nommé dans la question est honoré quand `document` est absent : les
sigles et noms ordinaires sont reconnus après normalisation de la casse, des diacritiques et de la
ponctuation (« RGPD », « R.G.P.D. », « règlement général sur la protection des données », « règlement
général », « règlement (UE) 2016/679 », « AI Act », « IA Act », « règlement IA », « règlement européen
sur l'intelligence artificielle », « règlement (UE) 2024/1689 ») ; la référence exacte et la recherche
sémantique s'y restreignent, et un numéro absent de ce document est refusé explicitement. Deux corpus
nommés n'infèrent rien. Si aucun document n'est nommé et que le numéro cité n'existe que dans un
corpus, l'article est rendu avec le niveau `incertain` et un message qui nomme ce corpus ; s'il existe
dans les deux, chaque article est rendu avec son document et le niveau est aussi `incertain`. Préciser
`document` ou nommer le corpus lève l'ambiguïté. Sans Ollama, `corpus:index` et la recherche sémantique échouent
avec un message qui nomme la commande. L'index est incrémental : un second passage sur un corpus inchangé
embarque zéro unité et laisse les vecteurs identiques. La construction suit les descripteurs
`mcp/corpus/*.json` ; `--document <corpus>` n'en construit qu'un.

Le troisième corpus, `cnil`, porte les délibérations de sanction : 249 documents et 6 342 fragments,
filtrés sur la nature `Sanction`. Deux origines de fragments cohabitent et sont déclarées dans
`data/corpus/cnil/manifest.json` : `dinum` pour l'historique publié (le parquet vectorisé, dont on
ré-embed le texte et dont on garde le `chunk_index` publié comme base de citation) et `dila` pour les
incréments (découpage local de 600 à 1 200 caractères, dit dans le `chemin`). `npm run cnil:sync`
télécharge le parquet une fois sous `data/raw/cnil/` — non commité, 334 Mo — puis les archives
`CNIL_YYYYMMDD-HHMMSS.tar.gz` de la DILA ; un document déjà présent n'est remplacé que si l'archive
est plus récente que sa date, sinon il garde sa numérotation publiée. `get_decision` rend une
décision entière par identifiant `CNILTEXT…` ou par numéro `SAN-…`, et `search` accepte un
paramètre `corpus` (`rgpd`, `aiact`, `cnil`). Le filtre est d'abord un choix de corpus, pas de
document. La route Légifrance `https://www.legifrance.gouv.fr/cnil/id/<id>` est déclarée dans le
manifeste mais n'a pas été vérifiée : elle répond 403 aux robots.

L'évaluation CNIL est séparée : 20 questions dans `mcp/eval/questions-cnil.csv` (12 visant un
document, 6 conceptuelles, 2 pièges), mesurées avec `corpus: cnil` et rapportées dans
`aidd_docs/tasks/2026_11/2026_11_05_corpus-cnil/eval-cnil.md`. Résultat mesuré : la délibération
attendue est rendue dans les cinq passages pour 10 des 18 questions sémantiques (55,6 %, IC 95 %
33,7–75,4), mais pour 9 des 12 questions qui visent un document précis (75,0 %) et 1 des 6 questions
conceptuelles. Un piège sur deux est cité — une sanction de crèche qui n'existe pas dans le corpus —
sans jamais être marqué `confiant`. Vingt questions ne classent pas le corpus : les seuils restent
ceux du produit, il n'y a pas de calibration propre.

L'évaluation v2 porte sur 60 questions écrites contre le texte du RGPD : 12 références exactes,
38 conceptuelles et 10 pièges, réparties en 30 `dev` et 30 `test`. Chaque mesure est filtrée par
corpus, pour qu'un jeu ne mélange jamais deux collections. Les 30 questions
`test` ne règlent rien et ne se mesurent qu'une fois : `--mesurer-test` est obligatoire et un
marqueur commité refuse la seconde exécution. Ce marqueur est une trace de consommation, pas une preuve
d'exécution : le supprimer ou copier le CSV sous un autre nom contourne le garde, qui n'arrête
qu'une seconde exécution accidentelle. Sur le `test` tenu à l'écart, le produit rend la référence
attendue dans les cinq passages pour 17 des 19 questions sémantiques (23/25 hors pièges), et au rang
1 pour 16/19. La paraphrase « droit de récupérer mes données » est rendue `confiant` sur `art_15`
alors que `art_20` est attendu ; une seconde question (`art_80`) est refusée sous le seuil bas alors
que son rang brut est 1 ; 1 piège sur 5 est cité. Le classement brut donne 18/19 au top 5 et 17/19
au rang 1 : ces chiffres ne sont pas ceux que le produit rend. La recherche hybride FTS5 + RRF a été mesurée
sur `dev` mais n'est pas retenue comme voie par défaut : elle gagne une question au top 5 et perd
26 points de top 1. Les chiffres datés vivent dans
`aidd_docs/tasks/2026_11/2026_11_05_qualite-v2-aiact/eval-v2.md` (v2) et `eval-aiact.md` (12
questions AI Act, sans classement) ; le rapport v1 reste
`aidd_docs/tasks/2026_11/2026_11_04_qualite-mcp/eval.md`, jamais fusionné avec le v2.

`qwen3-embedding:4b` a été mesuré sur les 30 questions `dev` : il répare une question au top 5
(`art_56`), en casse une autre (`art_35`), garde le même top 1 et coûte 6,9× plus d'indexation selon cette mesure v2,
un chiffre que la mesure v3 porte à 15,5× pour la même indexation : le coût reste imprécis.
Le produit garde `0.6b` ; l'expérience est dans `eval-v2.md`.

Le jeu v3 porte 80 questions écrites contre les 99 articles du RGPD avant toute mesure : 40 `dev`,
40 `test`, dont 34 sémantiques par split, 3 références exactes et 3 pièges. Chaque modèle a été
mesuré une seule fois sur le `test` avec les seuils calibrés sur son propre `dev`. Sur la vue rendue,
`0.6b` place la référence attendue au top 5 pour 29 questions sur 34 (30 au brut) et `4b` pour 31
sur 34 (31 au brut) ; au rang 1 rendu, les deux sont à 25 (26 contre 25 au brut). Les paires
discordantes rendues (`b = 2`, `c = 2`, `b + c = 4` ; `b = 2`, `c = 3`, `b + c = 5` au brut)
restent sous le plancher de six, donc le verdict est **non établi** et `0.6b` reste le modèle du
produit. L'avance de `4b` sur `dev` (30 contre 26 au rang 1, `b = 6`, `c = 2`, p ≈ 0,29) n'était pas
significative et le test ne la reproduit pas. Avec 34 questions sémantiques, il
ne détecte qu'un écart d'environ six questions, donc un effet plus petit demanderait un test tenu à
l'écart plus grand ou répété. Le rapport v3 est
`aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/eval-v3.md` ; il n'est pas fusionné avec le v2.

Pour le brancher dans un client MCP, déclarer un serveur stdio avec le chemin absolu du serveur et
remplacer `/absolute/path/to/Vitrine-mcp` par la racine de votre clone :

```json
{
  "mcpServers": {
    "rgpd": { "command": "node", "args": ["/absolute/path/to/Vitrine-mcp/mcp/server.ts"] }
  }
}
```

`mcp/server.ts` résout la racine du dépôt depuis `import.meta.url`, jamais depuis le répertoire
courant : un chemin relatif échouerait hors de la racine. Si votre client exige un répertoire de
travail explicite, ajoutez `"cwd": "/absolute/path/to/Vitrine-mcp"` à côté de `command`.

## Comment ça marche

- `veille/` — le pipeline : dix adaptateurs (neuf autorités, la Commission a deux flux) → normalisation → rattachement aux matières → `data/`.
- `src/` — les pages Astro, qui lisent `data/` au build et filtrent les matières actives.
- `mcp/` — les corpus RGPD, AI Act et CNIL, l'index vectoriel et lexical, le serveur MCP stdio
  (`get_article`, `get_decision`, `search`), séparés du pipeline et du site.
- `data/` — snapshots bruts adressés par leur contenu, entrées JSON, journal d'appels PISTE et
  corpus RGPD/AI Act/CNIL, versionnés dans git ; l'index `data/corpus/index/` est un dérivé ignoré,
  et le parquet DINUM sous `data/raw/cnil/` aussi.
- `veille/themes.json` — les cinq matières, leurs textes, leurs sources et leur état.
- `tools/parametres.html` — l'outil local qui active ou désactive une matière.
- `aidd_docs/INSTALL.md` — les décisions d'architecture et les étapes d'installation.
