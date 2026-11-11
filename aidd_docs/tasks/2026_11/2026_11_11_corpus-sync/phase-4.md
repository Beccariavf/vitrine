---
status: completed
---

# Instruction: Ordonnanceur launchd

## Architecture projection

```txt
.
├── ✅ mcp/corpus/sync-planificateur.ts
├── ✏️ mcp/corpus/sync.ts
└── ✏️ tests/corpus-sync.test.ts
```

## Test Scope

| Scénario | Action | Résultat observable | Acteur |
| -------- | ------ | ------------------- | ------ |
| Happy path | `plistCorpusSync({ rootDir, nodePath, homeDir, intervalle })` | un plist `fr.vitrine.corpus-sync` avec `StartInterval` 259200, le nœud, la racine et les journaux | test |
| Edge case | Un chemin contient `&`, `<` ou `"` | le XML est échappé | test |
| Happy path | `--planifier --dossier <tmp>` | le fichier est écrit sous ce dossier, `launchctl` n'est pas appelé | test |
| Edge case | `--planifier --dry-run --dossier <tmp>` | aucun fichier n'est écrit, les commandes imprimées citent le chemin | test |

## Tasks to do

1. Créer `mcp/corpus/sync-planificateur.ts`.
2. `INTERVALLE_TROIS_JOURS = 3 * 24 * 60 * 60`.
3. `plistCorpusSync({ rootDir, nodePath, homeDir, intervalle })` rend le XML : `Label`, `ProgramArguments` (`node`, `<root>/mcp/corpus/sync.ts`), `WorkingDirectory`, `StartInterval`, `RunAtLoad` faux, `StandardOutPath` et `StandardErrorPath` sous `~/Library/Logs/vitrine-corpus-sync.log`, `EnvironmentVariables.PATH` avec le dossier du nœud.
4. `installerPlanificateur({ dossier, ... })` écrit `fr.vitrine.corpus-sync.plist` (dossier par défaut `~/Library/LaunchAgents`) et rend le chemin.
5. CLI `--planifier` : écrire le plist, imprimer le chemin et les deux commandes `launchctl` (chemins cités), puis sortir sans lire les entrées. `--dossier` choisit la destination ; `--dry-run` n'écrit pas le plist.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1–5 | le test prouve l'intervalle, les chemins, l'échappement XML, l'écriture dans `--dossier` et l'absence d'appel système |
