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
npm run ce:sync                            # archive JADE globale → data/corpus/ce/ (1,32 Go, long)
npm run ce:sync -- --dry-run               # ce que l'archive produirait, sans écrire
npm run cepd:sync                          # lignes directrices du CEPD → data/corpus/cepd/
npm run cepd:sync -- --dry-run             # ce que la liste produirait, sans écrire
npm run lil:sync -- --date 2026-11-09      # loi Informatique et Libertés → data/corpus/lil/
npm run cnil:sync -- --tout                # historique DINUM + incréments DILA → data/corpus/cnil/
npm run cnil:sync -- --increments --dry-run   # ce que les archives ajouteraient, sans écrire
npm run corpus:index   # index incrémental Ollama + sqlite-vec → data/corpus/index/index.db
npm run mcp:smoke      # vérifie Ollama et leoipulsar/harrier-0.6b
npm run mcp            # serveur MCP sur stdio
npm run mcp:demo       # cinq appels réels au serveur stdio (Ollama requis)
npm run mcp:eval -- --questions questions-v2.csv --split dev    # 30 questions de développement (hors CI)
npm run mcp:eval -- --questions questions-v2.csv --split test --mesurer-test   # 30 questions tenues à l'écart, une seule fois (hors CI)
npm run mcp:eval -- --questions questions-v3.csv --split dev --json            # 40 questions de développement v3, sortie machine (hors CI)
npm run mcp:eval -- --questions questions-cnil.csv                             # 20 questions CNIL (hors CI)
npm run mcp:eval -- --questions questions-ce.csv --split dev                   # 12 questions Conseil d'État (hors CI)
npm run mcp:eval -- --questions questions-cepd.csv --split dev                 # 10 questions CEPD (hors CI)
npm run mcp:eval -- --questions questions-cnil-v2.csv --split dev --seuils 0.690,0.740,0.010   # 25 questions CNIL documentaires (hors CI)
npm run mcp:eval -- --questions questions-cnil-v2.csv --split test --mesurer-test --seuils 0.690,0.740,0.010   # déjà consommé le 2026-11-06 ; ne pas relancer
npm run mcp:eval:filtres                                                        # 12 cas de filtrage CNIL (hors CI)
```

Le MCP lit le RGPD, l'AI Act, la LIL, les délibérations de la CNIL, les décisions du Conseil
d'État et les lignes directrices du CEPD par passage exact et par recherche sémantique, avec
provenance. Seule
la recherche sémantique exige Ollama sur `127.0.0.1:11434` et le modèle `leoipulsar/harrier-0.6b`
(`ollama pull leoipulsar/harrier-0.6b`) : une question qui cite un article (« article 17 ») est servie
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

Le corpus `cnil` porte 3 245 délibérations et 29 299 fragments, filtrés sur trois natures :
`Sanction` (249 documents / 6 342 fragments), `Avis` (2 896 / 21 914) et
`Recommandation/Lignes directrices` (100 / 1 043). Deux origines de fragments cohabitent et sont
déclarées dans `data/corpus/cnil/manifest.json` : `dinum` pour l'historique publié (le parquet
vectorisé, dont on ré-embed le texte et dont on garde le `chunk_index` publié comme base de
citation) et `dila` pour les incréments (découpage local de 600 à 1 200 caractères, dit dans le
`chemin`). `npm run cnil:sync` télécharge le parquet une fois sous `data/raw/cnil/` — non commité,
334 Mo — puis les archives `CNIL_YYYYMMDD-HHMMSS.tar.gz` de la DILA ; un document déjà présent n'est
remplacé que si l'archive est plus récente que sa date, sinon il garde sa numérotation publiée.
`get_decision` rend une décision entière par identifiant `CNILTEXT…` ou par numéro `SAN-…`, et
`search` accepte un paramètre `corpus` (`rgpd`, `aiact`, `cnil`, `lil`, `ce`, `cepd`) et un filtre
`nature` pour les trois natures CNIL. Le filtre est d'abord un choix de corpus, pas de document. La
route Légifrance `https://www.legifrance.gouv.fr/cnil/id/<id>` est déclarée dans le manifeste mais
n'a pas été vérifiée : elle répond 403 aux robots.

Le corpus `lil` porte la loi n° 78-17 dans sa version consolidée : 1 document, 133 articles en
vigueur, 54 articles abrogés écartés et 50 sections parcourues. `npm run lil:sync -- --date
AAAA-MM-JJ` lit PISTE `/consult/legiPart` avec `{ textId, date }`, écrit le snapshot sous
`data/raw/lil/` — non commité — et le corpus sous `data/corpus/lil/`. Chaque article devient une
unité `LEGIARTI…`, avec sa section, sa date de début, son état et l'URL Légifrance. Licence
Ouverte 2.0 (Etalab).

L'évaluation CNIL est séparée : 20 questions dans `mcp/eval/questions-cnil.csv` (12 visant un
document, 6 conceptuelles, 2 pièges), mesurées avec `corpus: cnil` et rapportées dans
`aidd_docs/tasks/2026_11/2026_11_05_corpus-cnil/eval-cnil.md`. Résultat mesuré : la délibération
attendue est rendue dans les cinq passages pour 10 des 18 questions sémantiques (55,6 %, IC 95 %
33,7–75,4), mais pour 9 des 12 questions qui visent un document précis (75,0 %) et 1 des 6 questions
conceptuelles. Un piège sur deux est cité — une sanction de crèche qui n'existe pas dans le corpus —
sans jamais être marqué `confiant`. Vingt questions ne classent pas le corpus : cette mesure ne
calibre aucun seuil, la table CNIL est celle de la promesse ci-dessous.

Le jeu CNIL v2 remplace cette mesure pour les questions documentaires : 50 questions qui visent
chacune une décision, sans jamais citer l'identifiant, le numéro `SAN-…` ni un numéro d'article,
réparties 25 `dev` et 25 `test`. Sur le `test`, mesuré le 2026-11-06 avec les seuils alors globaux du
produit (`0,69 / 0,74 / 0,01`) sur le corpus de sanctions seules — avant l'extension du 2026-11-09 —, le
document attendu figure dans les cinq passages pour 16 questions sur 25 (64,0 %, IC 95 %
44,5–79,8) et au rang 1 pour 12 sur 25 (48,0 %) ; le `MRR` est de 0,560. Ce `test` n'est pas
rejouable : son marqueur est consommé, et il ne mesure pas le corpus actuel. L'évidence courante est
le `dev` **14/25** sur le corpus élargi. Les échecs sont des confusions entre décisions aux faits
presque identiques, pas des documents inexistants. Deux splits `test` ont été mesurés puis
remplacés ; le second est archivé dans `b442d14` et aucun n'est repris. Rapport :
`aidd_docs/tasks/2026_11/2026_11_06_jeu-cnil-v2/eval-cnil-v2.md`.

Le jeu CNIL doctrine (10 questions `dev`) mesure le corpus CNIL, pas le filtre `nature` : le harnais
filtre par corpus et n'exerce pas `search.nature`. Résultat assumé : **3/10 au top 5, MRR 0,225,
top 1 20,0 %**, avec, aux seuils alors calibrés sur ce jeu (0,71 / 0,76 / 0,01), 8 `confiant` dont 3 corrects et
5 faux, et 2 `incertain` faux. À la règle livrée, les mêmes 10 questions donnent 6 `confiant` dont
4 faux. Ce
chiffre est corpus-level et ne doit pas être lu comme une mesure du filtre de nature. Le jeu LIL
donne **10/10 au top 5, MRR 0,750, top 1 60,0 %**.

Le filtrage par métadonnées répond à la limite précédente. Chaque décision CNIL porte désormais un
`type_sanction`, un `montant` de sanction pécuniaire (amende ou liquidation) et la présence d'une `injonction`, lus dans le dispositif :
134 amendes (133 avec montant, une masquée), 95 avertissements, 12 liquidations, 6 rappels et
2 interruptions. `search` accepte `date_min`, `date_max`, `type_sanction`, `montant_min`,
`montant_max` et `numero` ; les filtres descendent dans `vec0` et chaque passage rend ces champs.
Sur un pilote de 12 cas, le top 5 passe de 7/12 sans filtre à 11/12 avec. Le cas restant nomme l'année mais
décrit l'activité de façon trop vague : il faudrait un `secteur`. Rapport :
`aidd_docs/tasks/2026_11/2026_11_06_filtres-cnil/eval-filtres.md`.

Le corpus `ce` porte les décisions du Conseil d'État depuis 2014 qui traitent des données
personnelles. `npm run ce:sync` liste `https://echanges.dila.gouv.fr/OPENDATA/JADE/`, télécharge
l'archive globale `Freemium_jade_global_*.tar.gz` sous `data/raw/ce/` — non commitée, 1,32 Go — puis
la lit en flux : `fetch` → `Readable.fromWeb` → `createGunzip` → lecteur tar incrémental, sans jamais
charger l'archive ni son contenu décompressé en mémoire. Les deux fonds `jade/global/publie` et
`jade/global/inedit` sont lus : une décision inédite au recueil est une décision du Conseil d'État
comme une autre. JADE mêle le Conseil d'État, les cours administratives d'appel et les tribunaux
administratifs : seules les décisions dont la `JURIDICTION` normalisée vaut exactement « Conseil
d'État » sont retenues, les autres sont écartées et comptées. Le filtre porte aussi sur la date
(`--date-min`, `2014-01-01` par défaut) et sur les mots-clés du descripteur (données personnelles,
données à caractère personnel, informatique et libertés, protection des données, RGPD, CNIL). Le
manifeste `data/corpus/ce/manifest.json` publie les comptes réels, les exclusions par motif et les
comptes par fonds ; `--dry-run` n'écrit rien et une seconde passe sur la même archive et la même
empreinte ne relit rien. Mesure du 9 novembre 2026 : 573 525 entrées lues, 36 191 décisions du
Conseil d'État depuis 2014, 1 312 retenues après mots-clés et 17 703 fragments (fonds `publie` :
181 décisions et 3 080 fragments ; fonds `inedit` : 1 131 décisions et 14 623 fragments) ; 62
doublons entre les deux fonds ; exclusions 399 198 autres juridictions, 138 074 antérieures à 2014,
34 878 sans mot-clé, 1 texte vide. Les 12 questions `dev` de `mcp/eval/questions-ce.csv` rendent le
document attendu au top 5 pour 8 d'entre elles (MRR 0,486, top 1 33,3 %).

Le corpus `cepd` porte les lignes directrices du Comité européen de la protection des données,
extraites de leurs PDF. `npm run cepd:sync` lit d'abord l'index de sitemaps puis ses cinq pages,
retient les URL `/documents/guideline/…_fr` et écarte les traductions `_en`, `_de`, etc. ; le
Wayback Machine ne sert plus que de repli si le sitemap est injoignable. Chaque page de document est
ensuite lue pour son titre, sa date, sa version et son PDF : le PDF français `_fr.pdf` est préféré,
sinon le premier PDF de la version courante, les PDF de consultation étant écartés. Les PDF sont
téléchargés sous `data/raw/cepd/` — non commité — et extraits avec `unpdf`. Un PDF sans texte, de
moins de 2 000 caractères ou dont la part de lettres est inférieure à 50 % est refusé en nommant son
URL. `--limite` et `--depuis` réduisent le jeu avant téléchargement, `--dry-run` n'écrit rien.
Mesure du 9 novembre 2026 : 42 URL `_fr` dans le sitemap, 5 pages lues, 36 lignes directrices,
5 443 fragments, 0 version écartée, 6 URL sans PDF (5 pages WP29 sans PDF et le doublon court
`transparency_fr`, la même ligne étant retenue sous son URL longue) ; période 2018-04-11 à
2025-06-05. Les 36 PDF retenus sont français (`fr: 36`, `en: 0`, `autre: 0`). Les 10 questions `dev`
de `mcp/eval/questions-cepd.csv` rendent le document attendu au rang 1 pour les 10 (MRR 1,000,
top 1 100,0 %).

Chaque `manifest.json` porte un bloc `couverture` émis par sa synchronisation : source, date ou
archive, bornes, types ou natures retenus, exclusions et comptes. Le tableau des six corpus
(documents, fragments, période, source, licence) est
`aidd_docs/tasks/2026_11/2026_11_09_mcp-donnees-personnelles/coverage.md` ; il reprend les comptes
des manifestes, jamais une recopie approximative.

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
Le produit a depuis basculé sur `leoipulsar/harrier-0.6b` (ticket #20) ; l'expérience `4b` reste dans `eval-v2.md`.

Le jeu v3 porte 80 questions écrites contre les 99 articles du RGPD avant toute mesure : 40 `dev`,
40 `test`, dont 34 sémantiques par split, 3 références exactes et 3 pièges. Chaque modèle a été
mesuré une seule fois sur le `test` avec les seuils calibrés sur son propre `dev`. Sur la vue rendue,
`0.6b` place la référence attendue au top 5 pour 29 questions sur 34 (30 au brut) et `4b` pour 31
sur 34 (31 au brut) ; au rang 1 rendu, les deux sont à 25 (26 contre 25 au brut). Les paires
discordantes rendues (`b = 2`, `c = 2`, `b + c = 4` ; `b = 2`, `c = 3`, `b + c = 5` au brut)
restent sous le plancher de six, donc le verdict est **non établi** et le produit a gardé `0.6b`
jusqu'au basculement Harrier du 2026-11-11 (#20). L'avance de `4b` sur `dev` (30 contre 26 au rang 1, `b = 6`, `c = 2`, p ≈ 0,29) n'était pas
significative et le test ne la reproduit pas. Avec 34 questions sémantiques, il
ne détecte qu'un écart d'environ six questions, donc un effet plus petit demanderait un test tenu à
l'écart plus grand ou répété. Le rapport v3 est
`aidd_docs/tasks/2026_11/2026_11_05_mesure-v3-modeles/eval-v3.md` ; il n'est pas fusionné avec le v2.

## Niveaux de confiance

`search` rend trois niveaux : `confiant`, `incertain`, et `aucun_resultat_fiable` qui vide les
passages. « Confiant » est **statistique, jamais par réponse** : c'est un taux d'erreur mesuré au
niveau du **document**, satisfait par un passage du top 5 brut — ni au fragment, ni au rang 1 —, et
il porte sur les seules réponses étiquetées. Aucun signal par passage ne prouve que le premier
résultat est le bon article.

| Corpus demandé | Seuils (`bas / haut / marge`) | Promesse chiffrée |
| --- | --- | --- |
| `cnil` (`questions-cnil-etendu.csv`, 54 questions sémantiques `dev`, pièges exclus) | `0,73 / 0,73 / 0,01` | **22,6 % au plus**, à 51,9 % de couverture |
| Autres corpus, recherche sans `corpus`, recherche à document unique | `0,69 / 0,74 / 0,01` | aucune |

La table est liée au couple (modèle, corpus). Depuis le 2026-11-11, le produit embarque
`leoipulsar/harrier-0.6b` servi par Ollama ; la table CNIL a été recalibrée sur `dev` et sa promesse
constatée sur le `test` déjà stocké, sans nouveau tir (modèle équivalent : rangs et niveaux identiques sur `dev`, écart de similarité ≤ 7,0 × 10⁻⁵).

Hors CNIL, le `dev` ne tranche pas et le repli n'a pas été recalibré : le RGPD monte à 19/19 (+1
question), l'AI Act à 3/3, le CEPD reste à 10/10, mais la LIL perd une question (9/10) et le Conseil
d'État deux (6/12, MRR 0,347 contre 0,486). Ces écarts n'ont aucune puissance statistique (3 à 19
questions sémantiques) et restent des constats `dev` ; le détail est dans
`aidd_docs/tasks/2026_11/2026_11_11_bascule-harrier/mesures/autres-corpus.md`.

Sur le corpus CNIL, 28 des 54 questions sémantiques sont `confiant` (51,9 % de couverture), 2 se
trompent (7,1 %), et la borne haute à 95 % est de **22,6 %** (Wilson). Hors échantillon, le `test`
rend 34 confiantes, 0 erreur, borne **10,2 %**, couverture 63,0 %. La cible de 10 % n'est pas
atteinte en `dev` : aucun réglage mesuré ne descend sous **19,4 %**, et ce minimum coûte la
couverture utile (16 confiantes sur 54, 29,6 %) ; une borne à 10 % avec zéro erreur demanderait
**35 réponses confiantes**. Le sous-ensemble doctrinal (`questions-cnil-doctrine.csv`, corpus
`cnil`) est mesuré à part et hors promesse : 3 confiantes, 3 fausses, borne 100,0 %. Les autres
corpus suivent le repli et ne portent aucune promesse chiffrée (19, 12, 10, 10 et 3 questions
sémantiques pour le RGPD, le Conseil d'État, la LIL, le CEPD et l'AI Act). Une recherche **sans
`corpus`**, ou qui **ne nomme qu'un document**, suit le repli et sort de la promesse : l'instruction
de requête et le bassin de candidats y changent. Le plancher de refus CNIL passe de 0,67 (table qwen3) à 0,73 :
la plus faible similarité d'une bonne réponse vaut 0,7304, et un plancher à 0,74 la tairait.
Une recherche **filtrée** (`nature`, dates, type ou montant de sanction, numéro) et un `k` inférieur
à 5 sortent aussi de la promesse : le bassin de candidats change, et le harnais n'exerce pas ces
filtres.

La borne décrit les 54 questions sémantiques, **pièges exclus**. Sur les 6 pièges du jeu, 5 sont cités
en `dev` et 2 sont rendus `confiant` et faux (compagnie aérienne, 0,7578 ; puces sous-cutanées,
0,7777) : les compter donnerait 30 confiantes et 4 erreurs (13,3 %, borne 29,7 %). En `test`, 5 sont
cités et 2 sont `confiant` et faux (domotique, cantines).

La règle de choix, les mesures et ce qui invaliderait la promesse sont dans
`aidd_docs/tasks/2026_11/2026_11_10_promesse-confiance/promesse.md`.

## Démonstration

`npm run mcp:demo` lance `mcp/server.ts` comme le ferait un client, s'y connecte sur stdio et
appelle les trois outils sur cinq questions : article exact, recherche RGPD, recherche AI Act,
filtres CNIL, décision entière. Sortie réelle, Ollama requis :

```
### 4. Filtres CNIL poussés dans l'index : cookies, amendes, 2025
→ search {"question":"Quelle sanction pour des cookies ?","corpus":"cnil","k":3,"date_min":"2025-01-01","date_max":"2025-12-31","type_sanction":"amende"}
  confiance : incertain
  1. 0.814 · fragment · SAN-2025-010 · 2025-11-20 · amende · 750 000 €
     CNILTEXT000052851847#f11 · https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000052851847
     23. La formation restreinte relève que, lors du contrôle en ligne, la délégation a constaté le dépôt d’un cookie NID qui a pour finalité de faciliter la connexion de l’utilisateur et permet de stocker ses préférences lor…
```

Ce n'est pas un test : la suite couvre le protocole en mémoire et le calcul hors ligne, et
`tests/server-stdio.test.ts` vérifie que le point d'entrée démarre et expose les trois outils sans
Ollama. La démonstration prouve le chemin complet — entrée stdio, embeddings, index construit — et
affiche la provenance de chaque passage.

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
courant : un chemin relatif n'est donc valable que si le répertoire de travail est la racine du
dépôt. Si votre client exige un répertoire de travail explicite, ajoutez
`"cwd": "/absolute/path/to/Vitrine-mcp"` à côté de `command`.

OpenCode lit `opencode.json` à la racine, où le serveur est déjà déclaré en local :

```json
{
  "mcp": {
    "servers": {
      "vitrine": {
        "type": "local",
        "command": ["node", "mcp/server.ts"],
        "cwd": "."
      }
    }
  }
}
```

Le chemin reste relatif et vaut donc pour tout clone, parce que le répertoire de travail est déclaré
en même temps. Les outils arrivent groupés sous `tools.vitrine.*` (Code Mode) ; `"codemode": false`
les expose comme outils directs.

## Comment ça marche

- `veille/` — le pipeline : dix adaptateurs (neuf autorités, la Commission a deux flux) → normalisation → rattachement aux matières → `data/`.
- `src/` — les pages Astro, qui lisent `data/` au build et filtrent les matières actives.
- `mcp/` — les corpus RGPD, AI Act, LIL, CNIL, Conseil d'État et CEPD, l'index vectoriel et lexical,
  le serveur MCP stdio (`get_article`, `get_decision`, `search`), séparés du pipeline et du site.
- `data/` — snapshots bruts adressés par leur contenu, entrées JSON, journal d'appels PISTE et
  corpus RGPD/AI Act/LIL/CNIL/CE/CEPD, versionnés dans git ; l'index `data/corpus/index/` est un
  dérivé ignoré, et les sources brutes sous `data/raw/cnil/`, `data/raw/lil/`, `data/raw/ce/` et
  `data/raw/cepd/` aussi.
- `veille/themes.json` — les cinq matières, leurs textes, leurs sources et leur état.
- `tools/parametres.html` — l'outil local qui active ou désactive une matière.
- `aidd_docs/INSTALL.md` — les décisions d'architecture et les étapes d'installation.
