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
  "Le texte rendu vient des corpus locaux (RGPD `32016R0679` et AI Act `32024R1689`), " +
  "jamais d'une génération. Citer la référence et l'URL rendues. Respecter le niveau de " +
  "confiance : « aucun_resultat_fiable » signifie qu'il faut le dire au lecteur, pas inventer " +
  "un passage.";

const CONSIGNE_SERVEUR =
  "Serveur de lecture et de recherche sur deux corpus juridiques européens : le RGPD " +
  "(CELEX 32016R0679) et l'AI Act (CELEX 32024R1689). Les deux outils acceptent le paramètre " +
  "`document` ; sans lui, la recherche couvre les deux corpus. Un document nommé dans la " +
  "question (sigle ou nom ordinaire, casse et ponctuation indifférentes) est honoré quand " +
  "`document` est absent ; sans nom, une référence exacte qui n'existe que dans un corpus est " +
  "`incertain` et le corpus est nommé. Le texte rendu vient du corpus local, jamais d'une génération.";

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

  const serveur = new McpServer(
    { name: "corpus-juridiques", version: "0.1.0" },
    { instructions: CONSIGNE_SERVEUR },
  );

  serveur.registerTool(
    "get_article",
    {
      title: "Lire un article du RGPD ou de l'AI Act",
      description:
        "Rend le texte exact d'un article du RGPD ou de l'AI Act, avec sa référence, son chemin, " +
        "ses dates et son URL. Répondre « introuvable » quand l'article n'existe pas ; ne jamais " +
        "compléter un texte absent. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z
          .string()
          .describe("Identifiant CELEX du document : 32016R0679 (RGPD) ou 32024R1689 (AI Act)"),
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
      title: "Chercher dans le RGPD ou l'AI Act",
      description:
        "Cherche par le sens dans le RGPD ou l'AI Act et rend les passages les plus proches avec leur " +
        "provenance et un niveau de confiance (confiant, incertain, aucun_resultat_fiable). " +
        "L'article pose la règle et le considérant l'éclaire : à pertinence comparable, l'article passe " +
        "devant, mais aucun considérant n'est retiré du résultat. " +
        "Une question qui cite un article rend cet article exact, sans recherche vectorielle. " +
        "Un document nommé dans la question est honoré quand `document` est absent : les sigles et " +
        "noms ordinaires sont reconnus après normalisation de la casse, des diacritiques et de la " +
        "ponctuation (« RGPD », « R.G.P.D. », « règlement général sur la protection des données », " +
        "« règlement général », « règlement (UE) 2016/679 », « AI Act », « IA Act », « règlement IA », " +
        "« règlement européen sur l'intelligence artificielle », « règlement (UE) 2024/1689 ») ; la " +
        "référence exacte et la recherche sémantique s'y restreignent, et un numéro absent de ce " +
        "document est refusé explicitement. Deux corpus nommés n'infèrent rien. " +
        "Si aucun document n'est nommé et que le numéro cité n'existe que dans un corpus, l'article " +
        "est rendu avec le niveau `incertain` et un message qui nomme ce corpus. " +
        "Si le numéro existe dans plusieurs documents, chaque article est rendu avec sa provenance " +
        "et le niveau est `incertain` ; préciser `document` ou nommer le corpus lève l'ambiguïté. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        question: z.string().describe("Question en langage naturel, par exemple « effacement et moteurs de recherche »"),
        k: z.number().int().min(1).max(20).optional().describe("Nombre de passages à rendre, 5 par défaut"),
        document: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à un document : 32016R0679 (RGPD) ou 32024R1689 (AI Act) ; " +
              "absent, les deux corpus répondent",
          ),
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
  process.stderr.write(
    "Serveur MCP des corpus RGPD et AI Act prêt sur stdio (deux outils : get_article, search).\n",
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
