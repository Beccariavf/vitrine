import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { createOllamaEmbedder } from "./embed/embedder.ts";
import type { Embedder } from "./embed/embedder.ts";
import { cheminIndex } from "./index/build.ts";
import { openIndex } from "./index/search.ts";
import type { Index } from "./index/search.ts";
import { getArticle, search } from "./tools.ts";

/** Racine du dépôt, résolue depuis ce fichier et jamais depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

const CONSIGNE_PROVENANCE =
  "Le texte rendu vient du corpus RGPD local, jamais d'une génération. " +
  "Citer la référence et l'URL rendues. Respecter le niveau de confiance : " +
  "« aucun_resultat_fiable » signifie qu'il faut le dire au lecteur, pas inventer un passage.";

export type ServerDeps = {
  rootDir: string;
  embedder: Embedder;
  /** Index déjà ouvert ; sinon il est ouvert à la première recherche sémantique. */
  index?: Index;
};

/** Construit le serveur MCP : deux outils, aucun accès réseau direct. */
export function createServer(deps: ServerDeps): McpServer {
  const { rootDir, embedder } = deps;
  let indexCourant: Index | null = deps.index ?? null;
  const index = (): Index => {
    indexCourant ??= openIndex(cheminIndex(rootDir));
    return indexCourant;
  };

  const serveur = new McpServer({ name: "rgpd", version: "0.1.0" });

  serveur.registerTool(
    "get_article",
    {
      title: "Lire un article du RGPD",
      description:
        "Rend le texte exact d'un article du RGPD, avec sa référence, son chemin, ses dates et son URL. " +
        "Répondre « introuvable » quand l'article n'existe pas ; ne jamais compléter un texte absent. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z.string().describe("Identifiant CELEX du document, par exemple 32016R0679"),
        numero: z.string().describe("Numéro d'article, par exemple 17"),
      },
    },
    async ({ document, numero }) => {
      const resultat = getArticle(rootDir, { document, numero });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "search",
    {
      title: "Chercher dans le RGPD",
      description:
        "Cherche par le sens dans le corpus RGPD et rend les passages les plus proches avec leur provenance " +
        "et un niveau de confiance (confiant, incertain, aucun_resultat_fiable). " +
        "L'article pose la règle et le considérant l'éclaire : à pertinence comparable, l'article passe " +
        "devant, mais aucun considérant n'est retiré du résultat. " +
        "Une question qui cite un article rend cet article exact, sans recherche vectorielle. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        question: z.string().describe("Question en langage naturel, par exemple « effacement et moteurs de recherche »"),
        k: z.number().int().min(1).max(20).optional().describe("Nombre de passages à rendre, 5 par défaut"),
        document: z
          .string()
          .optional()
          .describe("Restreint la recherche à un document, par exemple 32016R0679"),
      },
    },
    async ({ question, k, document }) => {
      const demande = {
        question,
        ...(k === undefined ? {} : { k }),
        ...(document === undefined ? {} : { document }),
      };
      const resultat = await search(rootDir, demande, { embedder, index });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  return serveur;
}

async function main(): Promise<void> {
  const serveur = createServer({ rootDir: RACINE, embedder: createOllamaEmbedder() });
  const transport = new StdioServerTransport();

  process.once("SIGINT", () => {
    void serveur.close().finally(() => process.exit(0));
  });

  await serveur.connect(transport);
  process.stderr.write("Serveur MCP RGPD prêt sur stdio (deux outils : get_article, search).\n");
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
