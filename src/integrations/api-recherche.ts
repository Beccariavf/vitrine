/**
 * Intégration Astro : lance l'API HTTP de la recherche lexicale (#116) avec
 * `astro dev`, et l'arrête à sa fermeture. Le build statique n'en dépend pas :
 * aucun hook de build n'est branché.
 */
import type { Server } from "node:http";
import type { AstroIntegration, AstroIntegrationLogger } from "astro";
import { creerServeurHttp, lireOrigines, lirePort, RACINE, VARIABLE_ORIGINES, VARIABLE_PORT } from "../../mcp/http.ts";

/** Nom de l'intégration, tel qu'Astro le journalise. */
export const NOM_INTEGRATION = "vitrine-api-recherche";

/** Variable qui coupe le lancement automatique quand elle vaut exactement `0`. */
export const VARIABLE_ESSAI_AUTO = "VITRINE_ESSAI_AUTO";

/** Message quand le lancement automatique est désactivé. */
export const MESSAGE_DESACTIVE = `${VARIABLE_ESSAI_AUTO}=0 : API de recherche non lancée, l'encart dira service éteint.`;

/** Partie commune de l'avertissement d'échec : le site démarre sans l'API. */
export const MESSAGE_ECHEC = " ; l'encart dira service éteint.";

/** Ce que l'intégration journalise : le logger Astro le satisfait. */
export type Journal = Pick<AstroIntegrationLogger, "info" | "warn">;

/** Origines admises : celles de l'environnement, plus les deux formes du serveur Astro. */
export function composerOrigines(origines: readonly string[], port: number): string[] {
  return [...new Set([...origines, `http://localhost:${port}`, `http://127.0.0.1:${port}`])];
}

/** `VITRINE_ESSAI_AUTO=0` coupe le lancement ; toute autre valeur ou l'absence ne coupe rien. */
export function essaiAutoDesactive(valeur: string | undefined): boolean {
  return valeur === "0";
}

/** Serveur lancé par l'intégration, s'il y en a un ; un redémarrage ferme l'ancien. */
let courant: Server | null = null;

/** Arrête le serveur courant et attend sa fermeture ; sans serveur, ne fait rien. */
export async function arreterApi(): Promise<void> {
  const serveur = courant;
  courant = null;
  if (serveur === null) return;
  await new Promise<void>((resoudre) => {
    serveur.close(() => resoudre());
  });
}

/**
 * Lance l'API sur `port`, après avoir fermé une instance précédente. Une erreur
 * d'écoute — port occupé comprise — rend `null` et un avertissement d'une ligne :
 * le site continue sans l'API. L'index reste ouvert paresseusement par le serveur.
 */
export async function demarrerApi(options: {
  port: number;
  origines: readonly string[];
  logger: Journal;
}): Promise<Server | null> {
  await arreterApi();
  const serveur = creerServeurHttp({ rootDir: RACINE, origines: options.origines });
  try {
    await new Promise<void>((resoudre, rejeter) => {
      serveur.once("error", rejeter);
      serveur.listen(options.port, "127.0.0.1", () => {
        serveur.off("error", rejeter);
        resoudre();
      });
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const motif =
      code === "EADDRINUSE"
        ? `port ${options.port} occupé`
        : error instanceof Error
          ? error.message
          : String(error);
    options.logger.warn(`API de recherche non lancée : ${motif}${MESSAGE_ECHEC}`);
    return null;
  }
  serveur.on("error", (error: Error) => {
    options.logger.warn(`API de recherche interrompue : ${error.message}${MESSAGE_ECHEC}`);
  });
  courant = serveur;
  options.logger.info(`API de recherche lexicale sur http://127.0.0.1:${options.port}/recherche.`);
  return serveur;
}

/** Intégration Astro : l'API suit la vie du serveur de développement, jamais le build. */
export function apiRecherche(): AstroIntegration {
  return {
    name: NOM_INTEGRATION,
    hooks: {
      "astro:server:start": async ({ address, logger }) => {
        if (essaiAutoDesactive(process.env[VARIABLE_ESSAI_AUTO])) {
          logger.info(MESSAGE_DESACTIVE);
          return;
        }
        const port = lirePort(process.env[VARIABLE_PORT]);
        const origines = composerOrigines(lireOrigines(process.env[VARIABLE_ORIGINES]), address.port);
        await demarrerApi({ port, origines, logger });
      },
      "astro:server:done": async () => {
        await arreterApi();
      },
    },
  };
}
