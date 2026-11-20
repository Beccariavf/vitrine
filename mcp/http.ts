import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cheminIndex } from "./index/build.ts";
import { openIndex } from "./index/search.ts";
import type { Index } from "./index/search.ts";
import { search } from "./tools.ts";
import type { Passage } from "./tools.ts";
import type { Embedder } from "./embed/embedder.ts";

/** Racine du dépôt, résolue depuis ce fichier et jamais depuis le répertoire courant. */
export const RACINE = fileURLToPath(new URL("..", import.meta.url));

/** Nombre de passages rendus par l'API : le contrat en fixe cinq. */
export const PASSAGES = 5;
/** Longueur maximale de la question reçue. */
export const MAX_QUESTION = 300;
/** Longueur maximale de l'extrait rendu, points de suspension compris. */
export const MAX_EXTRAIT = 320;
/** Requêtes autorisées par fenêtre et par IP. */
export const LIMITE_DEFAUT = 20;
/** Durée de la fenêtre du limiteur : une minute fixe. */
export const FENETRE_MS = 60_000;
/** Port d'écoute par défaut, sur la boucle locale seule. */
export const PORT_DEFAUT = 8787;
/** Origine admise par défaut : le site Astro en développement. */
export const ORIGINE_DEFAUT = "http://localhost:4321";
/** Origines admises, séparées par des virgules. */
export const VARIABLE_ORIGINES = "VITRINE_HTTP_ORIGINES";
/** Port d'écoute. */
export const VARIABLE_PORT = "VITRINE_HTTP_PORT";

/**
 * Embedder qui lève : l'API ne sert que la recherche lexicale, aucun modèle
 * n'est appelé, ni à l'indexation ni à la requête.
 */
const EMBEDDER_INTERDIT: Embedder = {
  model: "interdit",
  dim: 0,
  embedPassages: () => {
    throw new Error("L'API HTTP ne sert que la recherche lexicale : l'embedder ne doit pas être appelé.");
  },
  embedQuery: () => {
    throw new Error("L'API HTTP ne sert que la recherche lexicale : l'embedder ne doit pas être appelé.");
  },
};

/** Un passage tel que le contrat HTTP le publie : sept champs, rien de plus. */
type PassageHttp = {
  rang: number;
  ref: string;
  corpus: string;
  chemin: string;
  date: string;
  extrait: string;
  url: string;
};

/**
 * Extrait publiable d'un passage : espaces normalisés, au plus `MAX_EXTRAIT`
 * caractères points de suspension compris, coupé au dernier espace rencontré.
 */
function extrait(texte: string): string {
  const normalise = texte.replace(/\s+/g, " ").trim();
  if (normalise.length <= MAX_EXTRAIT) return normalise;
  const coupe = normalise.slice(0, MAX_EXTRAIT - 1);
  const espace = coupe.lastIndexOf(" ");
  const garde = espace > 0 ? coupe.slice(0, espace) : coupe;
  return `${garde.trimEnd()}…`;
}

/** Passage rendu par `search` au passage du contrat, sans aucun autre champ. */
function passageHttp(passage: Passage, position: number): PassageHttp {
  return {
    rang: position + 1,
    ref: passage.ref,
    corpus: passage.corpus,
    chemin: passage.chemin,
    date: passage.date_acte ?? "",
    extrait: extrait(passage.texte),
    url: passage.url,
  };
}

/**
 * Analyse la cible d'une requête ; `null` quand Node l'a transmise sans qu'elle
 * soit une URL valide (`//`, `http://`). Une telle cible ne doit jamais lever
 * hors de la réponse : elle vaut une route inconnue.
 */
function analyserUrl(cible: string | undefined): URL | null {
  try {
    return new URL(cible ?? "/", "http://127.0.0.1");
  } catch {
    return null;
  }
}

/** Ce qu'il faut injecter pour servir l'API, en test comme en exécution directe. */
export type DependancesHttp = {
  rootDir: string;
  /**
   * Index déjà ouvert, ou fournisseur ; absent, il est ouvert depuis
   * `data/corpus/index/index.db` à la première requête et gardé ouvert.
   */
  index?: Index | (() => Index);
  /** Horloge en millisecondes, injectable pour éprouver le limiteur sans attendre. */
  horloge?: () => number;
  /** Requêtes autorisées par fenêtre et par IP, `LIMITE_DEFAUT` par défaut. */
  limite?: number;
  /** Durée de la fenêtre en millisecondes, `FENETRE_MS` par défaut. */
  fenetreMs?: number;
  /** Origines admises par CORS, `[ORIGINE_DEFAUT]` par défaut. */
  origines?: readonly string[];
};

/** Lit `VITRINE_HTTP_ORIGINES` : liste séparée par des virgules, une par défaut. */
export function lireOrigines(valeur: string | undefined): string[] {
  if (valeur === undefined) return [ORIGINE_DEFAUT];
  return valeur
    .split(",")
    .map((origine) => origine.trim())
    .filter((origine) => origine !== "");
}

/** Lit `VITRINE_HTTP_PORT` : entier de 1 à 65535, `PORT_DEFAUT` si absent. */
export function lirePort(valeur: string | undefined): number {
  if (valeur === undefined) return PORT_DEFAUT;
  const port = Number(valeur);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${VARIABLE_PORT} attendu un entier de 1 à 65535 ; reçu « ${valeur} ».`);
  }
  return port;
}

/**
 * Serveur HTTP de la recherche lexicale seule, sur `node:http` sans dépendance.
 * Il ne lit jamais `X-Forwarded-For` : la limitation vise l'adresse de la
 * connexion, ce qui suffit sur la boucle locale (à revoir derrière un proxy).
 */
export function creerServeurHttp(deps: DependancesHttp): Server {
  const horloge = deps.horloge ?? (() => Date.now());
  const limite = deps.limite ?? LIMITE_DEFAUT;
  const fenetreMs = deps.fenetreMs ?? FENETRE_MS;
  const origines = deps.origines ?? [ORIGINE_DEFAUT];
  /** Fenêtres fixes par IP, purgées dès qu'elles sont expirées. */
  const fenetres = new Map<string, { debut: number; compte: number }>();
  let indexCourant: Index | null =
    deps.index !== undefined && typeof deps.index !== "function" ? deps.index : null;
  let corpusConnus: readonly string[] | null = null;

  const index = (): Index => {
    if (indexCourant === null) {
      indexCourant =
        typeof deps.index === "function" ? deps.index() : openIndex(cheminIndex(deps.rootDir));
    }
    return indexCourant;
  };

  /** Collections présentes dans l'index, lues une fois : `corpus` ne vaut que celles-là. */
  const corpusDeLIndex = (courant: Index): readonly string[] => {
    if (corpusConnus === null) {
      corpusConnus = (
        courant.db
          .prepare("SELECT DISTINCT corpus FROM unites ORDER BY corpus")
          .all() as { corpus: string }[]
      ).map((ligne) => ligne.corpus);
    }
    return corpusConnus;
  };

  /** `null` si la requête passe, sinon le nombre de secondes avant la prochaine fenêtre. */
  const autoriser = (ip: string, instant: number): number | null => {
    for (const [cle, fenetre] of fenetres) {
      if (instant - fenetre.debut >= fenetreMs) fenetres.delete(cle);
    }
    const courante = fenetres.get(ip);
    if (courante === undefined) {
      fenetres.set(ip, { debut: instant, compte: 1 });
      return null;
    }
    if (courante.compte >= limite) {
      return Math.max(1, Math.ceil((courante.debut + fenetreMs - instant) / 1000));
    }
    courante.compte += 1;
    return null;
  };

  const entetes = (req: IncomingMessage, res: ServerResponse): void => {
    const origine = req.headers.origin;
    if (origine !== undefined && origines.includes(origine)) {
      res.setHeader("Access-Control-Allow-Origin", origine);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Cache-Control", "no-store");
  };

  const ecrire = (req: IncomingMessage, res: ServerResponse, statut: number, corps: unknown): void => {
    const charge = JSON.stringify(corps);
    entetes(req, res);
    res.statusCode = statut;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(charge));
    res.end(charge);
  };

  const preflight = (req: IncomingMessage, res: ServerResponse): void => {
    entetes(req, res);
    const origine = req.headers.origin;
    if (origine !== undefined && origines.includes(origine)) {
      res.setHeader("Access-Control-Allow-Methods", "GET");
    }
    res.statusCode = 204;
    res.end();
  };

  /** Traite une requête et rend le statut écrit, pour le journal. */
  const router = async (req: IncomingMessage, res: ServerResponse): Promise<number> => {
    const url = analyserUrl(req.url);
    if (url === null) {
      ecrire(req, res, 404, { erreur: "Route inconnue. Seule GET /recherche répond." });
      return 404;
    }
    if (req.method === "OPTIONS" && url.pathname === "/recherche") {
      preflight(req, res);
      return 204;
    }
    const attente = autoriser(req.socket.remoteAddress ?? "inconnue", horloge());
    if (attente !== null) {
      ecrire(req, res, 429, {
        erreur: `Trop de requêtes : ${limite} par minute et par IP.`,
        reessayer_dans_s: attente,
      });
      return 429;
    }
    if (req.method !== "GET" || url.pathname !== "/recherche") {
      ecrire(req, res, 404, { erreur: "Route inconnue. Seule GET /recherche répond." });
      return 404;
    }

    const question = (url.searchParams.get("q") ?? "").trim();
    const caracteres = [...question].length;
    if (question === "") {
      ecrire(req, res, 400, {
        erreur: `Paramètre q requis : une question non vide, ${MAX_QUESTION} caractères au plus.`,
      });
      return 400;
    }
    if (caracteres > MAX_QUESTION) {
      ecrire(req, res, 400, {
        erreur: `Question trop longue : ${caracteres} caractères, ${MAX_QUESTION} au plus.`,
      });
      return 400;
    }

    let courant: Index;
    let connus: readonly string[];
    try {
      courant = index();
      connus = corpusDeLIndex(courant);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ecrire(req, res, 503, {
        erreur:
          `Index indisponible : ${message}` +
          (message.includes("npm run corpus:index") ? "" : " Lancez « npm run corpus:index »."),
      });
      return 503;
    }

    const corpus = url.searchParams.get("corpus");
    if (corpus !== null && !connus.includes(corpus)) {
      ecrire(req, res, 400, {
        erreur: `Corpus inconnu « ${corpus} ». Corpus indexés : ${connus.join(", ")}.`,
      });
      return 400;
    }

    const debut = horloge();
    try {
      const resultat = await search(
        deps.rootDir,
        { question, k: PASSAGES, ...(corpus === null ? {} : { corpus }) },
        { embedder: EMBEDDER_INTERDIT, index: courant, recherche: "lexicale" },
      );
      ecrire(req, res, 200, {
        mode: "lexicale",
        question,
        duree_ms: Math.max(0, Math.round(horloge() - debut)),
        passages: resultat.passages.slice(0, PASSAGES).map(passageHttp),
      });
      return 200;
    } catch (error) {
      ecrire(req, res, 500, {
        erreur: `Recherche impossible : ${error instanceof Error ? error.message : String(error)}`,
      });
      return 500;
    }
  };

  return createServer((req, res) => {
    const debut = horloge();
    const chemin = analyserUrl(req.url)?.pathname ?? "?";
    const journal = (statut: number): void => {
      const duree = Math.max(0, Math.round(horloge() - debut));
      process.stderr.write(`${req.method ?? "?"} ${chemin} ${statut} ${duree} ms\n`);
    };
    void router(req, res)
      .then(journal)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!res.headersSent) {
          ecrire(req, res, 500, { erreur: `Erreur interne : ${message}` });
        } else {
          res.end();
        }
        journal(500);
      });
  });
}

async function main(): Promise<void> {
  const port = lirePort(process.env[VARIABLE_PORT]);
  const origines = lireOrigines(process.env[VARIABLE_ORIGINES]);
  const serveur = creerServeurHttp({ rootDir: RACINE, origines });
  await new Promise<void>((resoudre, rejeter) => {
    serveur.once("error", rejeter);
    serveur.listen(port, "127.0.0.1", resoudre);
  });
  process.stderr.write(
    `Recherche lexicale sur http://127.0.0.1:${port}/recherche — ` +
      `${LIMITE_DEFAUT} requêtes par minute et par IP, origines ${origines.join(", ")}.\n`,
  );
  process.once("SIGINT", () => {
    serveur.close(() => process.exit(0));
  });
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
