/**
 * Agent launchd du rafraîchissement du corpus.
 *
 * La génération est séparée de l'installation : `corpus:sync --planifier` écrit
 * le plist et imprime les commandes `launchctl`, elle ne charge jamais l'agent
 * à la place de l'utilisateur.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
/** Trois jours, en secondes : la cadence fixée par le ticket. */
export const INTERVALLE_TROIS_JOURS = 3 * 24 * 60 * 60;

/** Étiquette de l'agent dans launchd. */
export const ETIQUETTE = "fr.vitrine.corpus-sync";

export type PlanificateurOptions = {
  /** Racine du dépôt, chemin absolu. */
  rootDir: string;
  /** Binaire Node ; par défaut celui qui exécute la commande. */
  nodePath?: string;
  /** Dossier personnel ; par défaut `os.homedir()`. */
  homeDir?: string;
  intervalle?: number;
};

export type InstallerOptions = PlanificateurOptions & {
  /** Dossier de destination ; par défaut `~/Library/LaunchAgents`. */
  dossier?: string;
  /** N'écrit rien : rend seulement le chemin qui serait utilisé. */
  dryRun?: boolean;
};

/** Échappe une valeur pour un texte XML. */
export function echapperXml(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Contenu du plist launchd, sans effet de bord. */
export function plistCorpusSync(options: PlanificateurOptions): string {
  const rootDir = options.rootDir;
  const nodePath = options.nodePath ?? process.execPath;
  const home = options.homeDir ?? homedir();
  const intervalle = options.intervalle ?? INTERVALLE_TROIS_JOURS;
  if (!Number.isInteger(intervalle) || intervalle <= 0) {
    throw new Error(`Intervalle launchd attendu entier positif ; reçu « ${String(intervalle)} »`);
  }
  const script = join(rootDir, "mcp", "corpus", "sync.ts");
  const logs = join(home, "Library", "Logs");
  const cheminPath = [
    dirname(nodePath),
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${echapperXml(ETIQUETTE)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${echapperXml(nodePath)}</string>
    <string>${echapperXml(script)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${echapperXml(rootDir)}</string>
  <key>StartInterval</key>
  <integer>${intervalle}</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${echapperXml(join(logs, "vitrine-corpus-sync.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${echapperXml(join(logs, "vitrine-corpus-sync.err"))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${echapperXml(cheminPath)}</string>
  </dict>
</dict>
</plist>
`;
}

/** Écrit le plist dans `dossier` (ou `~/Library/LaunchAgents`) et rend son chemin. */
export function installerPlanificateur(options: InstallerOptions): string {
  const home = options.homeDir ?? homedir();
  const dossier = options.dossier ?? join(home, "Library", "LaunchAgents");
  const chemin = join(dossier, `${ETIQUETTE}.plist`);
  if (options.dryRun === true) return chemin;
  const contenu = plistCorpusSync(options);
  mkdirSync(dirname(chemin), { recursive: true });
  mkdirSync(join(home, "Library", "Logs"), { recursive: true });
  try {
    if (readFileSync(chemin, "utf8") === contenu) return chemin;
  } catch {
    // Absent : on l'écrit plus bas.
  }
  writeFileSync(chemin, contenu, "utf8");
  return chemin;
}

/** Cite un chemin pour un shell POSIX, espaces et apostrophes compris. */
export function citerShell(valeur: string): string {
  return `'${valeur.replace(/'/g, `'\\''`)}'`;
}

/** Les deux commandes `launchctl`, chemins cités. */
export function commandesLaunchctl(chemin: string): { installer: string; retirer: string } {
  const cite = citerShell(chemin);
  return {
    installer: `launchctl bootstrap gui/$(id -u) ${cite}`,
    retirer: `launchctl bootout gui/$(id -u) ${cite}`,
  };
}
