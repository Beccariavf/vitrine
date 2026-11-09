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
import { getArticle, getDecision, search } from "./tools.ts";

/** Racine du dépôt, résolue depuis ce fichier et jamais depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

const CONSIGNE_PROVENANCE =
  "Le texte rendu vient des corpus locaux (RGPD `32016R0679`, AI Act `32024R1689`, LIL " +
  "`LEGITEXT000006068624` et délibérations CNIL `cnil` : sanctions, avis, recommandations et " +
  "lignes directrices), jamais " +
  "d'une génération. Citer la référence et l'URL rendues. " +
  "Respecter le niveau de confiance : « aucun_resultat_fiable » signifie qu'il faut le dire au " +
  "lecteur, pas inventer un passage.";

const CONSIGNE_SERVEUR =
  "Serveur de lecture et de recherche sur quatre corpus juridiques : le RGPD " +
  "(CELEX 32016R0679), l'AI Act (CELEX 32024R1689), la loi Informatique et Libertés " +
  "(LIL, LEGITEXT000006068624) et les délibérations de la CNIL " +
  "(corpus `cnil`, natures Sanction, Avis et Recommandation/Lignes directrices). Les outils de " +
  "recherche acceptent les paramètres `corpus` et `nature` ; sans eux, la recherche couvre les " +
  "quatre collections et toutes les natures. Un document nommé dans la question (sigle ou nom " +
  "ordinaire, casse et ponctuation indifférentes) est honoré quand `document` et `corpus` sont " +
  "absents ; sans nom, une référence exacte qui n'existe que dans un corpus est `incertain` et le " +
  "corpus est nommé. `get_decision` rend une sanction entière, par identifiant CNILTEXT ou par " +
  "numéro SAN-… ; un avis ou une recommandation se lit par `search` avec `nature`. Le texte rendu " +
  "vient du corpus local, jamais d'une génération.";

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
      title: "Lire un article du RGPD, de l'AI Act ou de la LIL",
      description:
        "Rend le texte exact d'un article du RGPD, de l'AI Act ou de la LIL, avec sa référence, " +
        "son chemin, ses dates et son URL. Répondre « introuvable » quand l'article n'existe pas ; " +
        "ne jamais compléter un texte absent. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z
          .string()
          .describe(
            "Identifiant du document : 32016R0679 (RGPD), 32024R1689 (AI Act) ou " +
              "LEGITEXT000006068624 (LIL)",
          ),
        numero: z.string().describe("Numéro d'article, par exemple 17"),
      },
    },
    async ({ document, numero }) => {
      const resultat = getArticle(rootDir, { document, numero });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "get_decision",
    {
      title: "Lire une délibération de sanction de la CNIL",
      description:
        "Rend une délibération de sanction entière, par identifiant de document (`CNILTEXT…`) ou par " +
        "numéro (`SAN-2026-015`), avec ses fragments dans l'ordre du document, sa date, sa nature, son " +
        "statut et son URL. Ne cherche pas par le sens : pour une question ouverte, utiliser `search`. " +
        "Un avis ou une recommandation n'est pas rendu ici : l'outil répond `trouve: false` et renvoie " +
        "à `search` avec son filtre `nature`. Ne rend " +
        "pas un fragment isolé et n'invente aucun fragment : une décision absente est dite, avec un " +
        "message. Un numéro porté par deux documents rend les deux, chacun avec son identifiant. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z
          .string()
          .optional()
          .describe("Identifiant du document, par exemple CNILTEXT000055022778"),
        numero: z
          .string()
          .optional()
          .describe("Numéro de délibération, par exemple SAN-2026-015"),
        corpus: z
          .string()
          .optional()
          .describe("Restreint à une collection : cnil, rgpd, aiact ou lil ; absent, tous les corpus"),
      },
    },
    async ({ document, numero, corpus }) => {
      const resultat = getDecision(rootDir, {
        ...(document === undefined ? {} : { document }),
        ...(numero === undefined ? {} : { numero }),
        ...(corpus === undefined ? {} : { corpus }),
      });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "search",
    {
      title: "Chercher dans le RGPD, l'AI Act, la LIL ou les délibérations CNIL",
      description:
        "Cherche par le sens dans le RGPD, l'AI Act, la LIL ou les délibérations de la CNIL " +
        "(sanctions, avis, recommandations et lignes directrices) et rend les passages les plus " +
        "proches avec leur " +
        "provenance et un niveau de confiance (confiant, incertain, aucun_resultat_fiable). " +
        "L'article pose la règle et le considérant l'éclaire : à pertinence comparable, l'article passe " +
        "devant, mais aucun considérant n'est retiré du résultat. " +
        "Une question qui cite un article rend cet article exact, sans recherche vectorielle. " +
        "`corpus` borne la recherche à une collection (`rgpd`, `aiact`, `cnil`, `lil`) et prime sur tout nom " +
        "de document présent dans la question. " +
        "`nature` borne une recherche CNIL à une nature (`Sanction`, `Avis`, " +
        "`Recommandation/Lignes directrices`) ; sans lui, toutes les natures répondent. " +
        "Un document nommé dans la question est honoré quand `document` et `corpus` sont absents : les " +
        "sigles et noms ordinaires sont reconnus après normalisation de la casse, des diacritiques et " +
        "de la ponctuation (« RGPD », « R.G.P.D. », « règlement général sur la protection des données », " +
        "« règlement général », « règlement (UE) 2016/679 », « AI Act », « IA Act », « règlement IA », " +
        "« règlement européen sur l'intelligence artificielle », « règlement (UE) 2024/1689 », « LIL », " +
        "« loi informatique et libertés », « loi 78-17 », « loi n° 78-17 ») ; la " +
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
        corpus: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à une collection : rgpd, aiact, cnil ou lil ; cnil couvre les " +
              "sanctions, avis, recommandations et lignes directrices ; absent, toutes répondent",
          ),
        document: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à un document : 32016R0679 (RGPD), 32024R1689 (AI Act), " +
              "LEGITEXT000006068624 (LIL) ou un identifiant CNILTEXT ; absent, tous les corpus répondent",
          ),
        nature: z
          .string()
          .optional()
          .describe(
            "Restreint une recherche CNIL à une nature : Sanction, Avis ou " +
              "Recommandation/Lignes directrices ; absent, toutes les natures répondent",
          ),
        date_min: z
          .string()
          .optional()
          .describe("Date ISO minimale de la décision CNIL, par exemple 2024-01-01"),
        date_max: z
          .string()
          .optional()
          .describe("Date ISO maximale de la décision CNIL, par exemple 2024-12-31"),
        type_sanction: z
          .enum(["amende", "avertissement", "rappel", "injonction", "liquidation", "interruption", "autre"])
          .optional()
          .describe("Type de sanction CNIL ; absent, tous les types répondent"),
        montant_min: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Montant minimal de la sanction pécuniaire CNIL (amende ou liquidation), en euros"),
        montant_max: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Montant maximal de la sanction pécuniaire CNIL (amende ou liquidation), en euros"),
        numero: z
          .string()
          .optional()
          .describe("Numéro de délibération CNIL, par exemple SAN-2026-015"),
      },
    },
    async ({ question, k, corpus, document, nature, date_min, date_max, type_sanction, montant_min, montant_max, numero }) => {
      const demande = {
        question,
        ...(k === undefined ? {} : { k }),
        ...(corpus === undefined ? {} : { corpus }),
        ...(document === undefined ? {} : { document }),
        ...(nature === undefined ? {} : { nature }),
        ...(date_min === undefined ? {} : { date_min }),
        ...(date_max === undefined ? {} : { date_max }),
        ...(type_sanction === undefined ? {} : { type_sanction }),
        ...(montant_min === undefined ? {} : { montant_min }),
        ...(montant_max === undefined ? {} : { montant_max }),
        ...(numero === undefined ? {} : { numero }),
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
    "Serveur MCP des corpus RGPD, AI Act, LIL et CNIL prêt sur stdio " +
      "(trois outils : get_article, get_decision, search).\n",
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
