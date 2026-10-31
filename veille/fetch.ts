/** Ce que le pipeline attend d'un `fetch` : le minimum, injectable en test. */
export type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>;
