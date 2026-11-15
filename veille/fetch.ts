/** Ce que le pipeline attend d'un `fetch` : le minimum, injectable en test. */
export type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** `follow` demande de suivre les redirections ; c'est déjà le défaut de `fetch`. */
  redirect?: "follow";
};

export type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>;
