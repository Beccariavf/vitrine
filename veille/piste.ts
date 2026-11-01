import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchLike } from "./fetch.ts";

/** Source des appels PISTE : un jeton, une recherche par requête de matière et par source. */
export const MAX_CALLS_PER_RUN = 16;

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const LEGIFRANCE_SEARCH = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search";
const LEGIFRANCE_CONSULT = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/juri";
const JUDILIBRE_SEARCH = "https://api.piste.gouv.fr/cassation/judilibre/v1.0/search";
const JUDILIBRE_DECISION = "https://api.piste.gouv.fr/cassation/judilibre/v1.0/decision";

export type PisteConfig = {
  clientId: string;
  clientSecret: string;
  keyId: string;
};

type Call = {
  source: string;
  endpoint: string;
  status: number;
  durationMs: number;
  at: string;
};

const calls: Call[] = [];

/** Remet le journal à zéro ; utilisé par les tests. */
export function resetUsage(): void {
  calls.length = 0;
}

/** Appels déjà journalisés aujourd'hui ; un fichier absent ou illisible ne rend rien. */
function readUsage(path: string): Call[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }

  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return [];
    const stored = (value as { calls?: unknown }).calls;
    return Array.isArray(stored) ? (stored as Call[]) : [];
  } catch {
    return [];
  }
}

/** Écrit le journal du jour, fusionné avec les passes précédentes, puis le vide. */
export function flushUsage(rootDir: string): void {
  if (calls.length === 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(rootDir, "data", "usage");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${date}.json`);
  const journal = [...readUsage(path), ...calls];
  writeFileSync(path, `${JSON.stringify({ date, calls: journal }, null, 2)}\n`, "utf8");
  calls.length = 0;
}

/** Lit les trois secrets PISTE ; `null` si l'un manque, pour ignorer les sources API. */
export function readPisteConfig(env: NodeJS.ProcessEnv = process.env): PisteConfig | null {
  const clientId = env.PISTE_CLIENT_ID?.trim();
  const clientSecret = env.PISTE_CLIENT_SECRET?.trim();
  const keyId = env.PISTE_KEY_ID?.trim();
  if (!clientId || !clientSecret || !keyId) return null;
  return { clientId, clientSecret, keyId };
}

function record(source: string, endpoint: string, status: number, startedAt: number): void {
  calls.push({
    source,
    endpoint,
    status,
    durationMs: Date.now() - startedAt,
    at: new Date().toISOString(),
  });
}

function assertQuota(): void {
  if (calls.length >= MAX_CALLS_PER_RUN) {
    throw new Error(`PISTE quota guard: ${MAX_CALLS_PER_RUN} calls already made in this pass`);
  }
}

async function readJson(response: Awaited<ReturnType<FetchLike>>, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: invalid JSON (${reason})`, { cause: error });
  }
}

/**
 * Une session PISTE : un jeton OAuth réutilisé jusqu'à expiration, une seule
 * nouvelle demande après un 401, et un journal d'appels partagé.
 */
export class PisteSession {
  readonly config: PisteConfig;
  private token: string | null = null;
  private expiresAt = 0;

  constructor(config: PisteConfig) {
    this.config = config;
  }

  private async fetchToken(fetchImpl: FetchLike): Promise<string> {
    if (this.token !== null && Date.now() < this.expiresAt) return this.token;

    assertQuota();
    const started = Date.now();
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "openid",
    }).toString();
    const response = await fetchImpl(OAUTH_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    record("piste", "oauth", response.status, started);
    const value = (await readJson(response, "PISTE OAuth")) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof value.access_token !== "string" || value.access_token === "") {
      throw new Error("PISTE OAuth: missing access_token");
    }
    const expiresIn = typeof value.expires_in === "number" ? value.expires_in : 3600;
    this.token = value.access_token;
    this.expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
    return this.token;
  }

  /** Recherche Légifrance ; un 401 invalide le jeton et retente une fois. */
  async legifrance(fetchImpl: FetchLike, body: unknown): Promise<unknown> {
    return this.postLegifrance(fetchImpl, LEGIFRANCE_SEARCH, "search", body, "Légifrance search");
  }

  /**
   * Texte intégral d'une décision, lu par son identifiant : la recherche ne le
   * porte pas, et le Conseil d'État n'a pas de visa structuré à lire.
   */
  async consultJuri(fetchImpl: FetchLike, id: string, floor = 0): Promise<unknown> {
    return this.postLegifrance(fetchImpl, LEGIFRANCE_CONSULT, "consult", { textId: id }, "Légifrance consult", floor);
  }

  /**
   * Un POST Légifrance authentifié ; un 401 invalide le jeton et retente une fois.
   * `floor` réserve au moins ce nombre d'appels : un 401 peut coûter un jeton et
   * une seconde requête, et le plancher est vérifié avant chaque consommation.
   */
  private async postLegifrance(
    fetchImpl: FetchLike,
    url: string,
    endpoint: string,
    body: unknown,
    label: string,
    floor = 0,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (floor > 0 && this.remainingCalls() <= floor) {
        throw new Error(`${label}: PISTE call budget reserved (${floor} calls)`);
      }
      const token = await this.fetchToken(fetchImpl);
      if (floor > 0 && this.remainingCalls() <= floor) {
        throw new Error(`${label}: PISTE call budget reserved (${floor} calls)`);
      }
      assertQuota();
      const started = Date.now();
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      record("legifrance", endpoint, response.status, started);
      if (response.status === 401 && attempt === 0) {
        this.token = null;
        this.expiresAt = 0;
        continue;
      }
      return readJson(response, label);
    }
    throw new Error(`${label}: unauthorized after token refresh`);
  }

  /** Recherche Judilibre, authentifiée par `KeyId`. */
  async judilibre(fetchImpl: FetchLike, params: URLSearchParams): Promise<unknown> {
    assertQuota();
    const started = Date.now();
    const response = await fetchImpl(`${JUDILIBRE_SEARCH}?${params.toString()}`, {
      method: "GET",
      headers: { KeyId: this.config.keyId, accept: "application/json" },
    });
    record("judilibre", "search", response.status, started);
    return readJson(response, "Judilibre search");
  }

  /**
   * Une décision Judilibre, lue par son identifiant : le visa ne figure que dans
   * la décision, pas dans les résultats de recherche.
   */
  async judilibreDecision(fetchImpl: FetchLike, id: string): Promise<unknown> {
    assertQuota();
    const started = Date.now();
    const params = new URLSearchParams({ id });
    const response = await fetchImpl(`${JUDILIBRE_DECISION}?${params.toString()}`, {
      method: "GET",
      headers: { KeyId: this.config.keyId, accept: "application/json" },
    });
    record("judilibre", "decision", response.status, started);
    return readJson(response, "Judilibre decision");
  }

  /** Appels encore autorisés dans cette passe ; `0` interdit tout nouvel appel. */
  remainingCalls(): number {
    return Math.max(0, MAX_CALLS_PER_RUN - calls.length);
  }
}
