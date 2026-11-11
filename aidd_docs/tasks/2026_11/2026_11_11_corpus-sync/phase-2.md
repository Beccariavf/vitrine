---
status: completed
---

# Instruction: Orchestrateur, rapport et index

## Architecture projection

```txt
.
├── ✅ mcp/corpus/sync.ts
├── ✅ mcp/corpus/sync-rapport.ts
├── ✏️ package.json
├── ✏️ tests/corpus-sync.test.ts
└── ✅ data/corpus/sync.json (produit à l'exécution, jamais édité à la main)
```

## Test Scope

| Scénario | Action | Résultat observable | Acteur |
| -------- | ------ | ------------------- | ------ |
| Happy path | Une entrée CNIL manquante, un agent factice qui ajoute le document, un embedder factice | le document est présent dans le rapport et `search` le trouve | test |
| Happy path | Une entrée dont le document est déjà présent | aucun agent n'est appelé ; l'index est vérifié par delta | test |
| Edge case | Un agent lève | corpus identique octet pour octet, source `panne`, `a_jour_au` inchangé | test |
| Edge case | `--dry-run` | aucun fichier écrit, aucun agent appelé | test |
| Edge case | Aucune entrée dans la fenêtre | le rapport est vide, sauf les manquants antérieurs, et `a_jour_au` avance | test |
| Edge case | Une entrée publiée avant la passe mais écrite après | elle est relue grâce au recouvrement de 7 jours | test |
| Edge case | Une passe échouée puis une passe suivante | la fenêtre de l'échec est reprise, l'entrée n'est pas perdue | test |

## Tasks to do

### `1)` Rapport et état

1. Créer `mcp/corpus/sync-rapport.ts` : types `StatutDocument`, `DocumentRapport`, `SourceRapport`, `IndexRapport`, `CorpusRapport`, `RapportSync`.
2. `CHEMIN_RAPPORT = data/corpus/sync.json`. `lireRapport(rootDir)` rend `null` si absent ou illisible ; `ecrireRapport(rootDir, rapport)` écrit du JSON indenté, sans écrire si le contenu est identique.
3. `inventaireCorpus(rootDir)` lit chaque `data/corpus/*/manifest.json` et rend `{ corpus, documents, unites, arrete_le }` : `cnil` par `arrete_le` ; `ce`, `cc`, `cjue` par `date_extraction` ; `lil` par `couverture.date` ; `cepd` par `couverture.date_liste` ; `rgpd` et `aiact` par `null`.
4. `formaterRapport(rapport)` rend un texte court : date de fraîcheur, fenêtre, comptes par statut, documents manquants nommés, sources et index.

### `2)` Orchestrateur

1. Créer `mcp/corpus/sync.ts` avec `syncCorpus(options)`.
2. Options : `rootDir`, `depuis`, `date`, `dryRun`, `agents` (quatre fonctions injectables), `embedder`, `construireIndex`.
3. Fenêtre : `--depuis` fourni, sinon au plus tôt entre `a_jour_au` du rapport précédent et `date - 7 jours` ; si la tentative précédente a échoué (`a_jour_au` différent de `derniere_tentative`), reprendre la fenêtre `depuis` de cette tentative.
4. Lire les entrées de la fenêtre, les mapper, lire les documents présents et les exclusions. Avant synchronisation, classer chaque document en `present`, `manquant`, `ecarte` ou `non_mappe`.
5. Décider des sources : `cnil` si un document CNIL manque ou une entrée CNIL n'est pas mappée ; `ce`, `cc`, `cjue` si un document de leur corpus manque. Ne jamais lancer un corpus statique.
6. Exécuter les sources séquentiellement, attraper chaque erreur, ne pas interrompre les autres. Après chaque source, relire les documents du corpus.
7. Réindexer par `buildIndex(rootDir, embedder)` à chaque passe non `--dry-run` dès qu'un corpus existe : le delta est vide quand rien n'a changé, et une panne d'index est réessayée à la passe suivante. Une erreur d'index est rapportée, sans effacer le corpus.
8. Fusionner les documents encore manquants d'un rapport antérieur : une ligne reste listée tant que le document n'est ni présent ni écarté.
9. Écrire le rapport hors `--dry-run`. `a_jour_au` avance à `date` seulement si aucune source ni l'index n'a échoué ; sinon il garde la valeur précédente. `derniere_tentative` vaut toujours `date` hors `--dry-run`.
10. CLI : `--depuis`, `--date`, `--root`, `--dry-run`, `--json`, `--planifier`, `--dossier`. Sans `--json`, imprimer `formaterRapport`.

### `3)` Agents par défaut

1. `cnil` : `syncIncrements({ rootDir })`, message avec archives lues et documents retenus.
2. `ce` : `syncCe({ rootDir })`, message avec archive et documents.
3. `cc` : `syncCc({ rootDir })` puis `flushUsage(rootDir)` ; une panne du journal d'usage est signalée dans le message mais ne fait pas passer la source en panne après une écriture réussie.
4. `cjue` : `syncCjue({ rootDir })`, message avec documents lus et retenus.
5. Ajouter `"corpus:sync": "node mcp/corpus/sync.ts"` à `package.json`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | le test prouve lecture/écriture idempotente, inventaire des huit manifestes, date d'arrêté par corpus et texte du rapport |
| 2 | le test prouve le choix des sources, l'ordre, la poursuite après panne, le non-avancement de `a_jour_au`, le dry-run sans écriture et la réindexation conditionnelle |
| 2 | un test d'intégration hors ligne prouve qu'une sanction CNIL ajoutée par l'agent devient cherchable par `search` |
| 3 | le test prouve que chaque agent transmet `rootDir` et que `flushUsage` est appelé pour `cc` |
