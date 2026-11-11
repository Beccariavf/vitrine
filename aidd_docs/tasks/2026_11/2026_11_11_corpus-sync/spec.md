---
status: approved
date: 2026-11-11
source: GitHub issue #18
---

# Contrat : rafraîchir le corpus depuis la veille

## Objectif observable

Une commande `npm run corpus:sync` lit les entrées récentes de `data/entries/`, fait correspondre celles qui visent un document du corpus, lance les synchronisations concernées, réindexe par delta et écrit un rapport daté. Le serveur MCP expose ce rapport par `etat_corpus` : « corpus à jour au … », documents manquants et état des sources. Un agent `launchd` de trois jours est fourni et installable sans redémarrage.

## Périmètre

- Correspondance entrée → document : `CNILTEXT…` (page CNIL mise en snapshot), `CETATEXT…` (Conseil d'État), identifiant Judilibre (Cour de cassation), CELEX (CJUE).
- Sources déclenchées : `cnil` (incréments DILA), `ce` (archive JADE), `cc` (Judilibre), `cjue` (CELLAR). Les corpus statiques (`rgpd`, `aiact`, `lil`, `cepd`) ne sont pas rafraîchis par cette commande.
- Rapport versionné : `data/corpus/sync.json`, avec `a_jour_au`, dernière tentative, fenêtre, statut par document, comptes par corpus, état des sources et de l'index.
- Fenêtre par défaut : depuis `a_jour_au` du rapport précédent, sinon 7 jours. `--depuis AAAA-MM-JJ` la borne.
- Réindexation incrémentale par `buildIndex` quand une source a écrit.
- Outil MCP `etat_corpus`, sans réseau.
- Générateur de plist `launchd` (`StartInterval` 259 200 s), sans installation automatique.

## Décisions

| # | Décision | Raison |
| --- | --- | --- |
| 1 | La correspondance CNIL se lit dans les snapshots HTML de `data/raw/`, par URL canonique puis liens `legifrance.gouv.fr/cnil/id/CNILTEXT…`. | Les entrées CNIL ne portent pas l'identifiant du texte ; la page est déjà snapshotée par la veille quand ses références sont retenues. Aucun accès réseau supplémentaire. |
| 2 | Une entrée CNIL sans identifiant mappable est dite `non_mappee`, et non ignorée. | Une sanction récente peut être absente du snapshot ; le rapport doit dire pourquoi elle n'est pas vérifiée. |
| 3 | Une source n'est lancée que si une entrée de la fenêtre vise un document absent, sauf `cnil` : elle est aussi lancée pour une entrée non mappée. | Éviter de télécharger 1,32 Go de JADE ou d'appeler CELLAR pour un corpus déjà à jour ; l'incrément CNIL est bon marché et peut porter un document que la page ne nomme pas. |
| 4 | Un document listé comme écarté par le manifeste (`cjue.documents_ecartes`) est `ecarte`, pas `manquant`, et ne déclenche pas de synchronisation. | Une conclusion d'avocat général n'entrera jamais dans le corpus ; la redemander à chaque passe serait du bruit. |
| 5 | L'échec d'une source ou de l'index n'avance pas `a_jour_au` ; le rapport est quand même écrit. | La passe suivante doit reprendre les mêmes entrées, et « à jour » ne doit pas couvrir une source en panne. |
| 6 | Un document manquant après une synchronisation réussie n'est pas un échec de la passe. | Le rapport le nomme ; bloquer la fenêtre le ferait redemander indéfiniment. |
| 7 | L'agent `launchd` est généré dans `~/Library/LaunchAgents/`, jamais chargé par la commande. | Modifier l'ordonnanceur de la machine est une action de l'utilisateur ; la commande imprime les deux lignes `launchctl`. |

## Critères d'acceptation

1. `npm run corpus:sync -- --dry-run` rend la date de fraîcheur, les documents présents, manquants, écartés et non mappés, les sources qui seraient lancées, et n'écrit aucun fichier.
2. Une nouvelle sanction CNIL mappée par snapshot et ajoutée par un incrément DILA devient cherchable après `corpus:sync`, prouvé hors ligne avec un embedder factice.
3. Une entrée dont le document est déjà présent ne déclenche aucun appel de source ; une seconde passe sur la même fenêtre ne réextrait rien.
4. Une source en panne laisse les fichiers du corpus identiques octet pour octet et le rapport porte `panne` pour cette source, `a_jour_au` inchangé.
5. `etat_corpus` rend `a_jour_au`, l'inventaire des huit corpus et les manquants ; le serveur stdio expose quatre outils.
6. `npm run corpus:sync -- --planifier --dossier <dir>` écrit un plist `fr.vitrine.corpus-sync` à `StartInterval` 259 200.
7. `npm test`, `npm run typecheck` et `npm run build` passent.

## Hors périmètre

- VPS, cron système et déploiement du site.
- Rafraîchissement des corpus statiques (`rgpd`, `aiact`, `lil`, `cepd`) et des sources sans corpus (`anssi`, `arcep`, `arcom`, `commission`, `commission-dma`, `cepd`).
- Commit automatique des données par l'ordonnanceur.
