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
import type { ModeRecherche } from "./tools.ts";
import { CANDIDATS_RERANK, CANDIDATS_RERANK_MAX, CANDIDATS_RERANK_MIN, createLlamaReranker } from "./rerank/reranker.ts";
import type { Reranker } from "./rerank/reranker.ts";
import { LIMITE_DEFAUT, LIMITE_MAX, decisionsCitant } from "./corpus/citants.ts";
import { PERIMETRE } from "./corpus/citations.ts";
import {
  CHAMPS_GOUVERNANCE,
  CORPUS_DECISIONS,
  CORPUS_INSTANTANES,
  LIBELLES_GOUVERNANCE,
  NOMBRE_CORPUS,
  NOMS_SITE,
  SOURCES_SOUS_VEILLE,
  descriptionProvenance,
  descriptionRecherche,
  descriptionServeur,
  nombreEnLettres,
  resumeGouvernance,
} from "./corpus/registre.ts";
import {
  FAMILLES,
  LIMITE_DEFAUT as LIMITE_DEFAUT_DECISIONS,
  LIMITE_MAX as LIMITE_MAX_DECISIONS,
  chiffreFamille,
  decisionsCitantDecision,
  famillesExposees,
} from "./corpus/citations-decisions.ts";

/** Familles exposées et chiffres mesurés, lus au démarrage : la description publie la mesure. */
function chiffresCitationsDecisions(): string {
  const exposees = [...famillesExposees()];
  return (
    `Familles exposées : ${exposees.length === 0 ? "aucune" : exposees.map((f) => `\`${f}\``).join(", ")}. ` +
    "Précision mesurée sur un échantillon relu, seuil : borne basse de Wilson à 95 % ≥ 90 % — " +
    `${FAMILLES.map(chiffreFamille).join(" ; ")}. Les citations à \`date_divergente\` sont moins sûres : ` +
    "les vérifier avant de s'y appuyer."
  );
}

/** Racine du dépôt, résolue depuis ce fichier et jamais depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

/** Phrase de refus d'un instrument connu absent du corpus, celle que `citations.ts` rend. */
const PERIMETRE_REFUS = `(périmètre : ${PERIMETRE})`;

/** Liste de noms de corpus, chacun entre accents graves, pour les descriptions d'outils. */
function nomsEnCode(noms: readonly string[]): string {
  return noms.map((nom) => `\`${nom}\``).join(", ");
}

const CONSIGNE_PROVENANCE =
  `Le texte rendu vient des ${nombreEnLettres(NOMBRE_CORPUS)} corpus locaux ` +
  `(${descriptionProvenance()}), jamais d'une génération. Citer la référence et l'URL rendues. ` +
  "Respecter le niveau de confiance : « aucun_resultat_fiable » signifie qu'il faut le dire au " +
  "lecteur, pas inventer un passage.";

const CONSIGNE_MARQUAGE_DOCTRINE =
  "Les documents du corpus `cnil_doctrine` sont des extraits non modifiés de cnil.fr sous CC BY-ND 4.0. " +
  "Chaque passage de ce corpus porte `marquage` : `mention` (« extrait non modifié · CC BY-ND 4.0 · " +
  "<lien> »), `titre`, `source` (« Source : CNIL – https://www.cnil.fr »), `date_extraction` " +
  "(JJ/MM/AAAA), `licence` et `licence_url`. Reproduire la mention, le titre, la source et la date " +
  "avant l'extrait. Ne jamais résumer, reformuler ni modifier le texte de ces documents, et ne rien " +
  "laisser suggérer que la CNIL soutient cet outil.";

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

const CONSIGNE_METADONNEES =
  "Le corpus `metadonnees` ne contient que des métadonnées : les décisions définitives du guichet unique " +
  "du CEPD (article 60 du RGPD) — identifiant, intitulé, autorité, date et lien officiel, jamais le texte " +
  "ni un résumé. La source CEDH (HUDOC) est arrêtée faute d'accès exploitable : le corpus ne contient " +
  "aucune notice de la CEDH, et une question sur la CEDH ne se conclut pas de son absence. Chaque " +
  "passage de ce corpus porte `metadonnees_seulement: true` et `avertissement_contenu` : afficher la phrase " +
  "« métadonnées seulement — contenu non connu du serveur, consulter la source » et le lien officiel, et " +
  "ne jamais présenter, résumer ni déduire le contenu de la décision : le serveur ne le connaît pas.";

const CONSIGNE_STATUT_APPLICATION =
  "Chaque passage de `search`, chaque article de `get_article` et chaque décision de " +
  "`get_decision` porte `statut_application`, le vocabulaire uniforme du serveur : `en_vigueur`, " +
  "`abroge`, `propose`, `pendant`, `rendue`, `adoptee` ou `inconnu`. `statut` reste la valeur de la " +
  "source — statut de publication, type d'acte ou statut Légifrance — et n'est jamais réécrit. Un " +
  "texte abrogé, annulé ou proposé n'est jamais applicable : le dire, ne pas le présenter comme en " +
  "vigueur. Un texte proposé (corpus `preparation`, `statut_application: propose`) n'est pas un " +
  "texte applicable, et une affaire pendante (`pendant`) n'est pas une décision rendue : ne jamais " +
  "citer l'un comme une règle en vigueur, ni l'autre comme une jurisprudence. Chaque passage de " +
  "`preparation` porte aussi `mention` (« Texte non applicable — proposition en cours de " +
  "procédure » ou « Affaire pendante — aucune décision rendue ») : la transmettre au lecteur. Le " +
  "champ dit la force du document, pas l'applicabilité article par article : le " +
  "corpus ne porte pas les dates d'application échelonnées. `inconnu` dit que la source n'a pas été reconnue, ou que le document est modifié et " +
  "que la version rendue n'est pas nécessairement celle en vigueur ; jamais que le texte s'applique.";

const CONSIGNE_CITATIONS =
  "Chaque décision rendue par `search` (corpus " +
  `${nomsEnCode(CORPUS_DECISIONS)}), et ` +
  "par `get_decision` pour la CNIL, porte `citations` : la liste des instruments et articles reconnus dans son texte, non " +
  "exhaustive, chacun avec l'identifiant du document visé (`document`, `32016R0679`…), son lien " +
  "officiel (`url`, `null` quand il est inconnu) et `hors_corpus` (`true` quand ce document n'est " +
  "pas dans le corpus local). Une citation hors corpus garde son lien et ne porte aucun texte ni " +
  "résumé. Un document qui est un instrument connu absent du corpus répond « absent de mon corpus " +
  `${PERIMETRE_REFUS}. », sans ` +
  "rendre de texte ni de passage, quand l'appel le nomme par `document` ; " +
  "un identifiant inconnu garde sa réponse actuelle. Une citation " +
  "absente de la liste peut exister dans la décision : ne pas en conclure qu'elle n'y figure pas. " +
  "Citer cette liste telle quelle, sans en déduire d'autres articles. Une liste vide dit qu'aucune " +
  "citation n'a été reconnue, jamais que la décision n'a pas de base juridique.";

const CONSIGNE_PERIMETRE =
  "Chaque réponse porte `perimetre` : les corpus interrogés (`corpus`), le document quand l'appel " +
  "y est borné, et `exclusions`, un renvoi vers les exclusions déclarées que rend `etat_corpus` " +
  "(`corpus[].couverture`). Chaque corpus dit sa fraîcheur : `veille: true` pour les corpus " +
  `revérifiés par la synchronisation (${nomsEnCode(SOURCES_SOUS_VEILLE)}), avec \`a_jour_au\`, la dernière ` +
  "synchronisation réussie (`null` si aucune) ; `veille: false` pour un instantané fixe jamais " +
  `revérifié (${nomsEnCode(CORPUS_INSTANTANES)}), daté par \`arrete_le\` ou non daté (\`null\`) ; ` +
  "`inconnu: true` dit qu'un corpus demandé n'existe pas localement et que rien n'y a été interrogé. Ne " +
  "jamais présenter un instantané fixe comme à jour. Le rappeler au lecteur. Une absence de " +
  "résultat ne prouve jamais que la règle n'existe pas : elle peut être hors du périmètre, exclue " +
  "ou postérieure à la date du corpus. Une recherche `aucun_resultat_fiable` porte " +
  "`perimetre.avertissement`, à transmettre tel quel.";

const CONSIGNE_DECISIONS_CITEES =
  "Chaque décision rendue par `search` et `get_decision` porte `decisions_citees` : les décisions " +
  "qu'elle cite, reconnues par leur référence (numéro d'affaire de l'Union, ECLI, délibération " +
  "CNIL, requête du Conseil d'État, pourvoi), chacune avec `famille` et `cibles`, les décisions du " +
  "corpus qu'elle désigne (vide hors corpus, plusieurs quand la référence est ambiguë : ne pas " +
  "choisir). `acte` (`conclusions`, `ordonnance`) dit que le texte cite des conclusions d'avocat " +
  "général ou une ordonnance, pas l'arrêt : des conclusions ne sont jamais au corpus. `date_divergente: true` dit que le texte date la décision citée (`date_citee`) " +
  "autrement que les décisions du corpus de ce numéro : elles sont rendues quand même, à vérifier. " +
  "Le lien dit seulement « cite » : ne jamais le qualifier (applique, écarte, renverse). " +
  "La liste est non exhaustive : une liste vide ne prouve pas que la décision ne cite rien. " +
  `${chiffresCitationsDecisions()}`;

export const CONSIGNE_SERVEUR =
  "Serveur de lecture et de recherche juridiques, organisé par champ de gouvernance de la donnée — " +
  `${CHAMPS_GOUVERNANCE.map((champ) => LIBELLES_GOUVERNANCE[champ]).join(", ")}. ` +
  `Par champ, les corpus concernés : ${resumeGouvernance()}. Corpus : ` +
  `${descriptionServeur()}. Les outils de ` +
  "recherche acceptent les paramètres `corpus` et `nature` ; sans eux, la recherche couvre les " +
  `${nombreEnLettres(NOMBRE_CORPUS)} collections indexées et toutes les natures. Un document nommé dans la question (sigle ou nom ordinaire, ` +
  "casse et ponctuation indifférentes) est honoré quand `document` et `corpus` sont absents ; sans " +
  "nom, une référence exacte qui n'existe que dans un corpus est `incertain` et le corpus est " +
  "nommé. `get_decision` rend une sanction par identifiant CNILTEXT ou par numéro SAN-…, sa partie " +
  "opératoire par défaut et le document entier avec `partie: \"tous\"` ; " +
  "un avis ou une recommandation se lit par `search` avec `nature`. Le texte rendu vient du corpus " +
  "local, jamais d'une génération ; l'embedding est local (`leoipulsar/harrier-0.6b` sur Ollama). " +
  "Le serveur peut tourner en recherche lexicale seule (`VITRINE_RECHERCHE=lexicale`) : `search` " +
  "cherche alors par mots sans modèle ni Ollama, rend `recherche: \"lexicale\"` et `rang_lexical`, " +
  "n'expose ni `distance` ni `similarite`, et ne rend `confiant` que sur un appariement exact de " +
  "référence. " +
  "`decisions_citant` rend les décisions qui citent un article, comptées par autorité ; une liste " +
  "vide ne prouve pas qu'aucune ne le cite. " +
  "`decisions_citant_decision` rend les décisions qui citent une décision donnée par sa référence. " +
  "`etat_corpus` dit à quelle date le corpus a été rafraîchi depuis la veille (`a_jour_au`), " +
  "quels documents manquent, quels documents cités restent hors du corpus avec les autorités " +
  "qui les citent, quelle source a échoué et, pour chaque corpus, quelles sources de veille " +
  "l'alimentent avec leur dernière lecture réussie ; il ne lit ni l'index ni le réseau. " +
  CONSIGNE_PROMESSE;

export type ServerDeps = {
  rootDir: string;
  embedder: Embedder;
  /** Index déjà ouvert ; sinon il est ouvert à la première recherche sémantique. */
  index?: Index;
  /** Voie de recherche ; `dense` par défaut, `lexicale` sans modèle à la requête. */
  recherche?: ModeRecherche;
  /** Second étage optionnel ; absent, le comportement reste strictement celui d'avant. */
  rerank?: Reranker;
  /** Nombre de candidats offerts au second étage ; `CANDIDATS_RERANK` par défaut. */
  candidatsRerank?: number;
};

/** Variable d'environnement qui choisit la voie de recherche du serveur. */
export const VARIABLE_RECHERCHE = "VITRINE_RECHERCHE";
/** Voie par défaut : sans variable, le comportement reste strictement celui d'avant. */
export const RECHERCHE_PAR_DEFAUT: ModeRecherche = "dense";
/** Valeurs admises par `VITRINE_RECHERCHE`, dans l'ordre de l'erreur de démarrage. */
export const MODES_RECHERCHE: readonly ModeRecherche[] = ["dense", "hybride", "lexicale"];

/** URL du serveur `llama-server --reranking` ; sa présence active le second étage. */
export const VARIABLE_RERANK_URL = "VITRINE_RERANK_URL";
/** Modèle de rerank demandé au serveur. */
export const VARIABLE_RERANK_MODELE = "VITRINE_RERANK_MODELE";
/** Nombre de candidats offerts au second étage. */
export const VARIABLE_RERANK_CANDIDATS = "VITRINE_RERANK_CANDIDATS";
/** Modèle retenu le 2026-11-27 (GGUF mesuré sur `llama-server --reranking`). */
export const MODELE_RERANK_PAR_DEFAUT = "bge-reranker-v2-m3";

/** Second étage lu dans l'environnement, avec sa fenêtre de candidats. */
export type ConfigRerank = { reranker: Reranker; candidats: number };

/**
 * Lit `VITRINE_RERANK_CANDIDATS` : absent, `CANDIDATS_RERANK` ; un entier de
 * `CANDIDATS_RERANK_MIN` à `CANDIDATS_RERANK_MAX`, sinon le démarrage s'arrête.
 */
export function lireCandidatsRerank(valeur: string | undefined): number {
  if (valeur === undefined) return CANDIDATS_RERANK;
  const nombre = Number(valeur);
  if (!/^\d+$/.test(valeur) || nombre < CANDIDATS_RERANK_MIN || nombre > CANDIDATS_RERANK_MAX) {
    throw new Error(
      `${VARIABLE_RERANK_CANDIDATS} attendu un entier de ${CANDIDATS_RERANK_MIN} à ` +
        `${CANDIDATS_RERANK_MAX} ; reçu « ${valeur === "" ? "(vide)" : valeur} »`,
    );
  }
  return nombre;
}

/**
 * Lit les variables du second étage. `VITRINE_RERANK_URL` absente laisse le
 * serveur strictement inchangé ; en recherche lexicale, le reranker est ignoré
 * et le démarrage le dit sur `stderr`, une fois.
 */
export function lireConfigRerank(
  env: Record<string, string | undefined>,
  recherche: ModeRecherche,
  ecrire: (texte: string) => void = (texte) => process.stderr.write(texte),
): ConfigRerank | undefined {
  const url = env[VARIABLE_RERANK_URL];
  if (url === undefined) return undefined;
  if (recherche === "lexicale") {
    ecrire(
      `${VARIABLE_RERANK_URL} est posée mais la recherche est lexicale ` +
        `(${VARIABLE_RECHERCHE}=lexicale) : reranker ignoré, aucun modèle à la requête.\n`,
    );
    return undefined;
  }
  if (url.trim() === "") {
    throw new Error(
      `${VARIABLE_RERANK_URL} est vide ; donnez l'URL de llama-server --reranking, ` +
        "ou retirez la variable pour désactiver le second étage",
    );
  }
  return {
    reranker: createLlamaReranker({
      url,
      model: env[VARIABLE_RERANK_MODELE] ?? MODELE_RERANK_PAR_DEFAUT,
    }),
    candidats: lireCandidatsRerank(env[VARIABLE_RERANK_CANDIDATS]),
  };
}

/**
 * Signale la première panne du second étage sur `stderr`, jamais les suivantes :
 * une requête cassée ne doit pas inonder le journal du client stdio.
 */
export function avecSignalementPanne(
  reranker: Reranker,
  ecrire: (texte: string) => void,
): Reranker {
  let signale = false;
  return {
    model: reranker.model,
    async score(question, passages) {
      try {
        return await reranker.score(question, passages);
      } catch (error) {
        if (!signale) {
          signale = true;
          const raison = error instanceof Error ? error.message : String(error);
          ecrire(
            `Reranker ${reranker.model} indisponible, recherche sans second étage : ${raison}\n`,
          );
        }
        throw error;
      }
    },
  };
}

/**
 * Lit `VITRINE_RECHERCHE` : absent, `dense` ; une valeur inconnue arrête le
 * démarrage en nommant les valeurs admises.
 */
export function lireModeRecherche(valeur: string | undefined): ModeRecherche {
  if (valeur === undefined) return RECHERCHE_PAR_DEFAUT;
  if ((MODES_RECHERCHE as readonly string[]).includes(valeur)) return valeur as ModeRecherche;
  throw new Error(
    `${VARIABLE_RECHERCHE} attendu ${MODES_RECHERCHE.join(", ")} ; ` +
      `reçu « ${valeur === "" ? "(vide)" : valeur} »`,
  );
}

/** Construit le serveur MCP : six outils, aucun accès réseau direct. */
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
      title: "Lire un article d'un texte du corpus",
      description:
        "Rend le texte exact d'un article du RGPD, de l'AI Act, de la directive ePrivacy, de la " +
        "directive police-justice, du règlement 2018/1725, du règlement procédural RGPD, des " +
        "décisions 2021/914 et 2021/915 sur les clauses contractuelles types, des textes UE de " +
        "l'économie des données (Data Act, DGA, directive Open Data, ensembles de forte valeur, " +
        "libre circulation, recommandation clauses types, logos DGA), de la " +
        "LIL ou d'un texte français d'application (décret 2019-536, Code pénal 226-16 à 226-24, " +
        "226-1, 226-8-1 et chapitre 323, CPCE L32-3, L34-1 et L34-5, Code du travail, Code de la " +
        "santé publique, Code de la sécurité intérieure (vidéoprotection), Code monétaire et " +
        "financier, CRPA, Code civil), avec sa référence, son chemin, ses dates et son URL. ePrivacy et la directive " +
        "police-justice sont rendues dans leur version consolidée en vigueur ; les règlements " +
        "2018/1725 et 2025/2518, jamais modifiés, dans leur texte d'origine : `etat_corpus` en " +
        "donne la version et la date (`corpus[].couverture.version`, `date_consolidation`). Un article " +
        "inséré se demande avec son suffixe (`15 bis`). Répondre « introuvable » quand l'article " +
        "n'existe pas ; ne jamais compléter un texte absent. Un document qui est un instrument " +
        `connu absent du corpus répond « absent de mon corpus ${PERIMETRE_REFUS}. », sans ` +
        "rendre de texte ; un article hors de la partie couverte d'un code du corpus est dit hors du " +
        "corpus ; un identifiant inconnu " +
        "garde la réponse d'un article introuvable. " +
        "Un paramètre `date` (AAAA-MM-JJ), accepté pour la LIL seule, rend la version applicable " +
        "à cette date avec `date_debut` et `date_fin` ; un article absent à cette date est dit " +
        "« inexistant à la date … », une date antérieure à la collecte répond « historique non " +
        "couvert avant … », et tout autre corpus est refusé. L'historique se collecte par " +
        "`npm run lil:historique`. " +
        `${CONSIGNE_STATUT_APPLICATION} ` +
        `${CONSIGNE_PERIMETRE} ` +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z
          .string()
          .describe(
            "Identifiant du document : 32016R0679 (RGPD), 32024R1689 (AI Act), 32002L0058 " +
              "(ePrivacy), 32016L0680 (directive police-justice), 32018R1725 (règlement " +
              "2018/1725), 32025R2518 (règlement procédural RGPD), 32021D0914 (clauses contractuelles " +
              "types, transfert), 32021D0915 (clauses contractuelles types, sous-traitance), " +
              "32023R2854 (Data Act), 32022R0868 (DGA), 32019L1024 (directive Open Data), " +
              "32023R0138 (ensembles de forte valeur), 32018R1807 (libre circulation), " +
              "32026H2394 (recommandation clauses types), 32023R1622 (logos DGA), LEGITEXT000006068624 (LIL), " +
              "LEGITEXT000038567662 (décret 2019-536), LEGITEXT000006070719 (Code pénal), " +
              "LEGITEXT000006070987 (CPCE), LEGITEXT000006072050 (Code du travail), " +
              "LEGITEXT000006072665 (Code de la santé publique), LEGITEXT000025503132 (Code de la " +
              "sécurité intérieure), LEGITEXT000006072026 (Code monétaire et financier), " +
              "LEGITEXT000031366350 (CRPA) ou LEGITEXT000006070721 (Code civil)",
          ),
        numero: z.string().describe("Numéro d'article, par exemple 17, 15 bis, 26-1, 226-16, L34-5 ou unique"),
        date: z
          .string()
          .optional()
          .describe(
            "Date AAAA-MM-JJ ; LIL seulement : rend la version applicable à cette date " +
              "(`date_debut`, `date_fin`). Sans date, la version en vigueur du corpus",
          ),
      },
    },
    async ({ document, numero, date }) => {
      const resultat = getArticle(rootDir, {
        document,
        numero,
        ...(date === undefined ? {} : { date }),
      });
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
        `${CONSIGNE_DECISIONS_CITEES} ` +
        `${CONSIGNE_STATUT_APPLICATION} ` +
        `${CONSIGNE_PERIMETRE} ` +
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
    "decisions_citant",
    {
      title: "Trouver les décisions qui citent un article",
      description:
        "Rend les décisions du corpus qui citent un article (`document` + `numero`) : CNIL, Conseil " +
        "d'État, Cour de cassation, CJUE et documents du CEPD, chacune avec son autorité, " +
        "son intitulé, sa date, son lien et la citation qui vise l'instrument (`reference`), triées " +
        "par date décroissante. `total` et `par_autorite` comptent toutes les décisions citantes, " +
        `même quand la liste est paginée par \`limite\` (${LIMITE_DEFAUT} par défaut, ${LIMITE_MAX} au plus) ` +
        "et `decalage` ; `tronque` dit qu'il en reste. Le numéro s'écrit `9`, `art. 9`, `1er` ou " +
        "`L. 34-5` ; un alinéa (`9(2)`) compte comme l'article ; une plage (`8–10`) compte et " +
        "porte `via_plage: true` ; `26-1` reste un autre article que `26`, `9 bis` " +
        "n'est pas `9`. Pour la loi 78-17, renumérotée par l'ordonnance 2018-1125 au 2019-06-01, " +
        "les décisions antérieures visent la numérotation antérieure de la loi, donc un autre " +
        "article : elles sont écartées des comptes et " +
        "comptées dans `ecartees_numerotation_anterieure`. La liste vient des citations reconnues " +
        "dans le texte des décisions : elle est non exhaustive, et une liste vide ne prouve jamais " +
        "qu'aucune décision ne cite l'article — le dire ainsi. `article_au_corpus: false` signale " +
        "un article absent du corpus local, jamais un article « jamais cité » : ses décisions " +
        "citantes restent rendues. Un instrument connu absent du corpus garde la phrase « absent de " +
        "mon corpus (périmètre : …) » ; un identifiant inconnu rend `trouve: false`. " +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        document: z
          .string()
          .describe(
            "Identifiant de l'instrument cité : 32016R0679 (RGPD), 32024R1689 (AI Act), " +
              "LEGITEXT000006068624 (LIL) ou un instrument du catalogue de citations (CPCE…)",
          ),
        numero: z.string().describe("Numéro d'article, par exemple 9, art. 9, 1er ou L. 34-5"),
        limite: z
          .number()
          .int()
          .min(1)
          .max(LIMITE_MAX)
          .optional()
          .describe(`Nombre de décisions rendues, ${LIMITE_DEFAUT} par défaut`),
        decalage: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Nombre de décisions à sauter, 0 par défaut"),
      },
    },
    async ({ document, numero, limite, decalage }) => {
      const resultat = decisionsCitant(rootDir, {
        document,
        numero,
        ...(limite === undefined ? {} : { limite }),
        ...(decalage === undefined ? {} : { decalage }),
      });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  serveur.registerTool(
    "decisions_citant_decision",
    {
      title: "Trouver les décisions qui citent une décision",
      description:
        "Rend les décisions du corpus qui citent une décision donnée par sa référence : numéro " +
        "d'affaire de l'Union (`C-311/18`), ECLI, délibération CNIL (`SAN-2019-001`, `2019-001`), " +
        "requête du Conseil d'État (`353066`) ou pourvoi (`19-17.278`). Chaque décision citante porte " +
        "son autorité, son intitulé, sa date et son lien, triées par date décroissante ; `total` et " +
        "`par_autorite` comptent toutes les décisions, même quand la liste est paginée par " +
        `\`limite\` (${LIMITE_DEFAUT_DECISIONS} par défaut, ${LIMITE_MAX_DECISIONS} au plus) et \`decalage\` ; ` +
        "`tronque` dit qu'il en reste. Chaque décision citante porte `cite`, ce que sa citation " +
        "désigne selon la même résolution que `decisions_citees` (date du texte, `date_divergente`, " +
        "`acte` quand il cite des conclusions ou une ordonnance). " +
        "`cibles` donne la ou les décisions du corpus que la référence " +
        "désigne : vide hors corpus, plusieurs quand elle est ambiguë, sans choix silencieux. Le lien " +
        "dit seulement « cite », jamais applique, écarte ou renverse. La liste est non exhaustive : " +
        "une liste vide ne prouve pas que la décision n'est jamais citée. Une référence d'une famille " +
        "non exposée est refusée avec son chiffre ; une référence illisible est refusée. " +
        `${chiffresCitationsDecisions()} ` +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        reference: z
          .string()
          .describe("Référence de la décision citée : C-311/18, ECLI:EU:C:2020:559, SAN-2019-001, 353066 ou 19-17.278"),
        limite: z
          .number()
          .int()
          .min(1)
          .max(LIMITE_MAX_DECISIONS)
          .optional()
          .describe(`Nombre de décisions rendues, ${LIMITE_DEFAUT_DECISIONS} par défaut`),
        decalage: z.number().int().min(0).optional().describe("Nombre de décisions à sauter, 0 par défaut"),
      },
    },
    async ({ reference, limite, decalage }) => {
      const resultat = decisionsCitantDecision(rootDir, {
        reference,
        ...(limite === undefined ? {} : { limite }),
        ...(decalage === undefined ? {} : { decalage }),
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
        "la fenêtre de veille, l'inventaire des " +
        `${nombreEnLettres(NOMBRE_CORPUS)} corpus avec leurs comptes, les documents ` +
        "manquants et l'état des sources et de l'index. Chaque corpus porte `couverture`, le bloc que " +
        "déclare son manifeste — sources, bornes et exclusions — : c'est la cible du renvoi " +
        "`perimetre.exclusions` des autres outils. Les clés d'exclusion varient selon le corpus " +
        "(`exclusions`, `documents_ecartes`, `versions_ecartees`, `articles_abroges_ecartes`…). " +
        "Chaque corpus porte aussi `veille` : les sources qui l'alimentent avec leur " +
        "`derniere_lecture_reussie` (null quand la veille n'a jamais été lue ici, donc « jamais lue »), " +
        "ou `absente.raison` quand aucune source ne le couvre. `gouvernance` donne les champs de " +
        "gouvernance de chaque corpus (données personnelles, non personnelles, IA, santé) et " +
        "`champs_gouvernance` le résumé par champ du catalogue du registre, y compris un corpus " +
        "absent localement ; tous deux dérivent du registre. `hors_corpus` porte le classement des " +
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
      title: `Chercher dans les ${nombreEnLettres(NOMBRE_CORPUS)} corpus juridiques`,
      description:
        `Cherche par le sens dans ${descriptionRecherche()}, et rend ` +
        "les passages les plus proches avec leur " +
        "provenance et un niveau de confiance (confiant, incertain, aucun_resultat_fiable). " +
        "L'article pose la règle et le considérant l'éclaire : à pertinence comparable, l'article passe " +
        "devant, mais aucun considérant n'est retiré du résultat. " +
        "Une question qui cite un article rend cet article exact, sans recherche vectorielle. " +
        `\`corpus\` borne la recherche à une collection (${nomsEnCode(NOMS_SITE)}) ` +
        "et prime sur tout nom de document présent dans la question. " +
        "`nature` borne une recherche CNIL à une nature (`Sanction`, `Avis`, " +
        "`Recommandation/Lignes directrices`) ; sans lui, toutes les natures répondent. " +
        "Un document nommé dans la question est honoré quand `document` et `corpus` sont absents : les " +
        "sigles et noms ordinaires sont reconnus après normalisation de la casse, des diacritiques et " +
        "de la ponctuation (« RGPD », « R.G.P.D. », « règlement général sur la protection des données », " +
        "« règlement général », « règlement (UE) 2016/679 », « AI Act », « IA Act », « règlement IA », " +
        "« règlement européen sur l'intelligence artificielle », « règlement (UE) 2024/1689 », « LIL », " +
        "« loi informatique et libertés », « loi 78-17 », « loi n° 78-17 », « Data Act », " +
        "« règlement (UE) 2023/2854 », « DGA », « règlement (UE) 2022/868 », « directive Open Data », " +
        "« directive (UE) 2019/1024 », « ensembles de forte valeur », « règlement d'exécution (UE) 2023/138 », " +
        "« libre circulation des données », « règlement (UE) 2018/1807 », « recommandation (UE) 2026/2394 », " +
        "« logos DGA », « règlement d'exécution (UE) 2023/1622 », « décret 2019-536 », « CPCE », " +
        "« code des postes et des communications électroniques », « code pénal », « code du travail », " +
        "« code de la santé publique », « code de la sécurité intérieure », « code monétaire et " +
        "financier », « code des relations entre le public et l'administration », « code civil ») ; la " +
        "référence exacte et la recherche sémantique s'y restreignent, et un numéro absent de ce " +
        "document est refusé explicitement. Deux corpus nommés n'infèrent rien. " +
        "Si aucun document n'est nommé et que le numéro cité n'existe que dans un corpus, l'article " +
        "est rendu avec le niveau `incertain` et un message qui nomme ce corpus. " +
        "Si le numéro existe dans plusieurs documents, chaque article est rendu avec sa provenance " +
        "et le niveau est `incertain` ; préciser `document` (ou son CELEX) lève l'ambiguïté, un " +
        "corpus comme `donnees` ou `ccs` portant plusieurs documents. " +
        "En recherche lexicale seule (`VITRINE_RECHERCHE=lexicale`), les passages portent " +
        "`rang_lexical` (1 = meilleur) et aucune `distance` ni `similarite` ; le niveau reste " +
        "`incertain` hors appariement exact, un score BM25 ne prouvant pas la pertinence. " +
        "Quand le second étage de rerank est actif (`VITRINE_RERANK_URL`), `rerank` porte " +
        "`modele` et `duree_ms` ; s'il est injoignable, la réponse garde le classement dense et " +
        "`rerank` porte `indisponible: true` et `raison`. " +
        `${CONSIGNE_CITATIONS} ` +
        `${CONSIGNE_DECISIONS_CITEES} ` +
        `${CONSIGNE_STATUT_APPLICATION} ` +
        `${CONSIGNE_MARQUAGE_DOCTRINE} ` +
        `${CONSIGNE_METADONNEES} ` +
        `${CONSIGNE_PERIMETRE} ` +
        CONSIGNE_PROVENANCE,
      inputSchema: {
        question: z.string().describe("Question en langage naturel, par exemple « effacement et moteurs de recherche »"),
        k: z.number().int().min(1).max(20).optional().describe("Nombre de passages à rendre, 5 par défaut"),
        corpus: z
          .string()
          .optional()
          .describe(
            `Restreint la recherche à une collection : ${NOMS_SITE.join(", ")} ; ` +
              "cnil couvre les sanctions, avis, recommandations et lignes directrices, " +
              "cnil_doctrine les guides, référentiels, fiches pratiques IA et listes AIPD (extraits " +
              "non modifiés, CC BY-ND 4.0), " +
              "constit les décisions DC et QPC, metadonnees les notices du guichet unique " +
              "(métadonnées seulement) ; absent, toutes répondent, sauf une formule générique de " +
              "famille (« les clauses contractuelles types »), bornée au corpus `ccs`",
          ),
        document: z
          .string()
          .optional()
          .describe(
            "Restreint la recherche à un document : 32016R0679 (RGPD), 32024R1689 (AI Act), " +
              "32002L0058 (ePrivacy), 32016L0680, 32018R1725, 32025R2518, 32021D0914 (clauses " +
              "contractuelles types, transfert), 32021D0915 (clauses contractuelles types, sous-traitance), " +
              "32023R2854 (Data Act), 32022R0868 (DGA), 32019L1024 (directive Open Data), " +
              "32023R0138 (ensembles de forte valeur), 32018R1807 (libre circulation), " +
              "32026H2394 (recommandation clauses types), 32023R1622 (logos DGA), " +
              "LEGITEXT000006068624 (LIL), LEGITEXT000038567662 (décret 2019-536), LEGITEXT000006070719 (Code pénal), LEGITEXT000006070987 (CPCE), LEGITEXT000006072050 (Code du travail), LEGITEXT000006072665 (Code de la santé publique), LEGITEXT000025503132 (Code de la sécurité intérieure), LEGITEXT000006072026 (Code monétaire et financier), LEGITEXT000031366350 (CRPA), LEGITEXT000006070721 (Code civil), un identifiant CNILTEXT, un identifiant CONSTEXT (constit), un identifiant Judilibre (cc) " +
              "ou un CELEX de jurisprudence (cjue) ; absent, tous les corpus répondent, sauf une " +
              "formule générique qui nomme une famille sans décision (« les clauses contractuelles " +
              "types »), bornée au corpus `ccs`",
          ),
        nature: z
          .string()
          .optional()
          .describe(
            "Restreint une recherche à une nature : Sanction, Avis ou Recommandation/Lignes " +
              "directrices (CNIL), DC ou QPC (constit) ; absent, toutes les natures répondent",
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
      const resultat = await search(rootDir, demande, {
        embedder,
        index,
        ...(deps.recherche === undefined ? {} : { recherche: deps.recherche }),
        ...(deps.rerank === undefined ? {} : { rerank: deps.rerank }),
        ...(deps.candidatsRerank === undefined ? {} : { candidatsRerank: deps.candidatsRerank }),
      });
      return { content: [{ type: "text", text: JSON.stringify(resultat, null, 2) }] };
    },
  );

  return serveur;
}

async function main(): Promise<void> {
  const recherche = lireModeRecherche(process.env[VARIABLE_RECHERCHE]);
  const configRerank = lireConfigRerank(process.env, recherche);
  const rerank =
    configRerank === undefined
      ? undefined
      : avecSignalementPanne(configRerank.reranker, (texte) => process.stderr.write(texte));
  const serveur = createServer({
    rootDir: RACINE,
    embedder: createOllamaEmbedder(),
    recherche,
    ...(rerank === undefined || configRerank === undefined
      ? {}
      : { rerank, candidatsRerank: configRerank.candidats }),
  });
  const transport = new StdioServerTransport();

  process.once("SIGINT", () => {
    void serveur.close().finally(() => process.exit(0));
  });

  await serveur.connect(transport);
  process.stderr.write(
    `Serveur MCP des ${nombreEnLettres(NOMBRE_CORPUS)} corpus prêt sur stdio ` +
      "(six outils : get_article, get_decision, search, decisions_citant, decisions_citant_decision, etat_corpus) " +
      `— recherche ${recherche}` +
      (recherche === "lexicale" ? " (sans modèle à la requête)" : "") +
      (rerank === undefined ? "" : `, rerank ${rerank.model} sur ${configRerank?.candidats} candidats`) +
      ".\n",
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
