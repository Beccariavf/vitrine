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
import { getArticle, getDecision, search, etatCorpus } from "./tools.ts";

/** Racine du dépôt, résolue depuis ce fichier et jamais depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

const CONSIGNE_PROVENANCE =
  "Le texte rendu vient des huit corpus locaux (RGPD `32016R0679`, AI Act `32024R1689`, LIL " +
  "`LEGITEXT000006068624`, délibérations CNIL `cnil`, décisions du Conseil d'État `ce`, lignes " +
  "directrices du CEPD `cepd`, décisions de la Cour de cassation `cc` et décisions de la CJUE " +
  "`cjue`), jamais d'une génération. Citer la référence et l'URL rendues. " +
  "Respecter le niveau de confiance : « aucun_resultat_fiable » signifie qu'il faut le dire au " +
  "lecteur, pas inventer un passage.";

const CONSIGNE_PROMESSE =
  "« confiant » est statistique, jamais par réponse : c'est un taux d'erreur mesuré au niveau du " +
  "document, sur les passages du top 5. Sur le corpus `cnil` (seuils 0,73 / 0,73 / 0,01) et hors " +
  "pièges, la borne haute à 95 % est de 22,6 % (2 erreurs sur 28 réponses confiantes, 7,1 %, à " +
  "51,9 % de couverture) ; constatée sur le test déjà stocké à 10,2 % (0 erreur sur 34 confiantes, 63,0 % " +
  "de couverture). Le meilleur réglage mesuré sur `dev` plafonne à 19,4 %, à 29,6 % de couverture. " +
  "Le sous-ensemble doctrinal " +
  "`questions-cnil-doctrine.csv` est mesuré à part, hors promesse, comme une recherche filtrée " +
  "(nature, dates, type ou montant) et un k < 5 ; les autres corpus, une " +
  "recherche sans `corpus` et une recherche qui ne nomme qu'un document suivent le repli " +
  "0,69 / 0,74 / 0,01 et ne portent aucune promesse chiffrée.";

const CONSIGNE_STATUT_APPLICATION =
  "Chaque passage de `search`, chaque article de `get_article` et chaque décision de " +
  "`get_decision` porte `statut_application`, le vocabulaire uniforme du serveur : `en_vigueur`, " +
  "`abroge`, `propose`, `pendant`, `rendue`, `adoptee` ou `inconnu`. `statut` reste la valeur de la " +
  "source — statut de publication, type d'acte ou statut Légifrance — et n'est jamais réécrit. Un " +
  "texte abrogé ou proposé n'est jamais applicable : le dire, ne pas le présenter comme en vigueur. " +
  "`inconnu` dit que la source n'a pas été reconnue, jamais que le texte s'applique.";

const CONSIGNE_CITATIONS =
  "Chaque décision rendue par `search` et par `get_decision` (corpus `cnil`, `ce`, `cc`, `cjue` et " +
  "`cepd`) porte `citations` : la liste des instruments et articles reconnus dans son texte, non " +
  "exhaustive, chacun avec l'identifiant du document visé (`document`, `32016R0679`…), son lien " +
  "officiel (`url`, `null` quand il est inconnu) et `hors_corpus` (`true` quand ce document n'est " +
  "pas dans le corpus local). Une citation hors corpus garde son lien et ne porte aucun texte ni " +
  "résumé. Un document qui est un instrument connu absent du corpus répond « absent de mon corpus " +
  "(périmètre : RGPD, AI Act, LIL, CNIL, Conseil d'État, CEPD, Cour de cassation, CJUE). », sans " +
  "rendre de texte ni de passage, quand l'appel le nomme par `document` ; " +
  "un identifiant inconnu garde sa réponse actuelle. Une citation " +
  "absente de la liste peut exister dans la décision : ne pas en conclure qu'elle n'y figure pas. " +
  "Citer cette liste telle quelle, sans en déduire d'autres articles. Une liste vide dit qu'aucune " +
  "citation n'a été reconnue, jamais que la décision n'a pas de base juridique.";

const CONSIGNE_SERVEUR =
  "Serveur de lecture et de recherche sur huit corpus juridiques : le RGPD " +
  "(corpus `rgpd`, CELEX 32016R0679), l'AI Act (corpus `aiact`, CELEX 32024R1689), la loi " +
  "Informatique et Libertés (corpus `lil`, LEGITEXT000006068624), les délibérations de la CNIL " +
  "(corpus `cnil`, natures Sanction, Avis et Recommandation/Lignes directrices), les décisions du " +
  "Conseil d'État (corpus `ce`), les lignes directrices du CEPD (corpus `cepd`), les décisions de " +
  "la Cour de cassation sur les données personnelles (corpus `cc`) et celles de la CJUE (corpus " +
  "`cjue`). Les outils de " +
  "recherche acceptent les paramètres `corpus` et `nature` ; sans eux, la recherche couvre les huit " +
  "collections et toutes les natures. Un document nommé dans la question (sigle ou nom ordinaire, " +
  "casse et ponctuation indifférentes) est honoré quand `document` et `corpus` sont absents ; sans " +
  "nom, une référence exacte qui n'existe que dans un corpus est `incertain` et le corpus est " +
  "nommé. `get_decision` rend une sanction par identifiant CNILTEXT ou par numéro SAN-…, sa partie " +
  "opératoire par défaut et le document entier avec `partie: \"tous\"` ; " +
  "un avis ou une recommandation se lit par `search` avec `nature`. Le texte rendu vient du corpus " +
  "local, jamais d'une génération ; l'embedding est local (`leoipulsar/harrier-0.6b` sur Ollama). " +
  "`etat_corpus` dit à quelle date le corpus a été rafraîchi depuis la veille (`a_jour_au`), " +
  "quels documents manquent, quels documents cités restent hors du corpus avec les autorités " +
  "qui les citent, et quelle source a échoué ; il ne lit ni l'index ni le réseau. " +
  CONSIGNE_PROMESSE;

export type ServerDeps = {
  rootDir: string;
  embedder: Embedder;
  /** Index déjà ouvert ; sinon il est ouvert à la première recherche sémantique. */
  index?: Index;
};

/** Construit le serveur MCP : quatre outils, aucun accès réseau direct. */
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
        "ne jamais compléter un texte absent. Un document qui est un instrument connu absent du " +
        "corpus répond « absent de mon corpus (périmètre : RGPD, AI Act, LIL, CNIL, Conseil " +
        "d'État, CEPD, Cour de cassation, CJUE). », sans rendre de texte ; un identifiant inconnu " +
        "garde la réponse d'un article introuvable. " +
        `${CONSIGNE_STATUT_APPLICATION} ` +
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
        "Rend une délibération de sanction, par identifiant de document (`CNILTEXT…`) ou par " +
        "numéro (`SAN-2026-015`), avec sa date, sa nature, son statut, son URL, son type de " +
        "sanction et son montant. Par défaut, seule la partie opératoire est rendue " +
        "(`partie: \"dispositif\"`) ; `partie: \"tous\"` rend tous les fragments, ce qui peut " +
        "atteindre plusieurs dizaines de milliers de tokens. Les fragments rendus sont entiers et " +
        "dans l'ordre du document. Ne cherche pas par le sens : pour une question ouverte, " +
        "utiliser `search`. Un avis ou une recommandation n'est pas rendu ici : l'outil répond " +
        "`trouve: false` et renvoie à `search` avec son filtre `nature`. N'invente aucun " +
        "fragment : une décision absente est dite, avec un message. Un numéro porté par deux " +
        "documents rend les deux, chacun avec son identifiant. " +
        `${CONSIGNE_CITATIONS} ` +
        `${CONSIGNE_STATUT_APPLICATION} ` +
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
          .describe(
            "Restreint à une collection CNIL : cnil ; les autres corpus relèvent de search. " +
              "Absent, toutes les délibérations répondent",
          ),
        partie: z
          .enum(["dispositif", "tous"])
          .optional()
          .describe(
            "dispositif (défaut) : la partie opératoire seule ; tous : le document entier, " +
              "qui peut dépasser la charge acceptée par le client",
          ),
      },
    },
    async ({ document, numero, corpus, partie }) => {
      const resultat = getDecision(rootDir, {
        ...(document === undefined ? {} : { document }),
        ...(numero === undefined ? {} : { numero }),
        ...(corpus === undefined ? {} : { corpus }),
        ...(partie === undefined ? {} : { partie }),
      });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "etat_corpus",
    {
      title: "Dire à quelle date le corpus est à jour",
      description:
        "Rend la date de la dernière synchronisation réussie depuis la veille (`a_jour_au`), " +
        "la fenêtre de veille, l'inventaire des huit corpus avec leurs comptes, les documents " +
        "manquants et l'état des sources et de l'index. `hors_corpus` porte le classement des " +
        "documents hors corpus : ceux que les décisions citent sans qu'ils soient au corpus, par " +
        "nombre de décisions citantes décroissant (`citations`), avec les autorités qui les citent et " +
        "leur compte ; un document " +
        "déclaré hors du périmètre y est marqué `exclu`, jamais présenté comme un trou. Un document " +
        "manquant n'est pas une génération : il est absent du corpus local et le rapport le nomme. " +
        "Aucun accès réseau, aucun index : lit `data/corpus/sync.json` et les manifestes.",
      inputSchema: {},
    },
    async () => {
      const resultat = etatCorpus(rootDir);
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "search",
    {
      title: "Chercher dans les huit corpus juridiques",
      description:
        "Cherche par le sens dans le RGPD, l'AI Act, la LIL, les délibérations de la CNIL " +
        "(sanctions, avis, recommandations et lignes directrices), les décisions du Conseil d'État, " +
        "les lignes directrices du CEPD, les décisions de la Cour de cassation sur les données " +
        "personnelles et celles de la CJUE, et rend les passages les plus proches avec leur " +
        "provenance et un niveau de confiance (confiant, incertain, aucun_resultat_fiable). " +
        "L'article pose la règle et le considérant l'éclaire : à pertinence comparable, l'article passe " +
        "devant, mais aucun considérant n'est retiré du résultat. " +
        "Une question qui cite un article rend cet article exact, sans recherche vectorielle. " +
        "`corpus` borne la recherche à une collection (`rgpd`, `aiact`, `cnil`, `lil`, `ce`, `cepd`, " +
        "`cc`, `cjue`) " +
        "et prime sur tout nom de document présent dans la question. " +
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
        `${CONSIGNE_CITATIONS} ` +
        `${CONSIGNE_STATUT_APPLICATION} ` +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        question: z.string().describe("Question en langage naturel, par exemple « effacement et moteurs de recherche »"),
        k: z.number().int().min(1).max(20).optional().describe("Nombre de passages à rendre, 5 par défaut"),
        corpus: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à une collection : rgpd, aiact, cnil, lil, ce, cepd, cc ou " +
              "cjue ; cnil couvre les sanctions, avis, recommandations et lignes directrices ; " +
              "absent, toutes répondent",
          ),
        document: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à un document : 32016R0679 (RGPD), 32024R1689 (AI Act), " +
              "LEGITEXT000006068624 (LIL), un identifiant CNILTEXT, un identifiant Judilibre (cc) " +
              "ou un CELEX de jurisprudence (cjue) ; absent, tous les corpus répondent",
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
    "Serveur MCP des huit corpus (RGPD, AI Act, CNIL, LIL, CE, CEPD, CC, CJUE) prêt sur stdio " +
      "(quatre outils : get_article, get_decision, search, etat_corpus).\n",
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
