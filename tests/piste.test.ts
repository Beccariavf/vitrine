import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import {
  MAX_CALLS_PER_RUN,
  PisteSession,
  readPisteConfig,
  resetUsage,
} from "../veille/piste.ts";

const CONFIG = { clientId: "client", clientSecret: "secret", keyId: "key" };

function response(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

describe("la session PISTE", () => {
  it("réutilise le jeton et le redemande après un 401", async () => {
    resetUsage();
    let oauth = 0;
    let search = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("oauth")) {
        oauth += 1;
        return response(200, JSON.stringify({ access_token: `t${oauth}`, expires_in: 3600 }));
      }
      search += 1;
      if (search === 1) return response(401, "");
      return response(200, JSON.stringify({ results: [] }));
    };

    const session = new PisteSession(CONFIG);
    const result = await session.legifrance(fetchImpl, {});
    assert.deepEqual(result, { results: [] });
    assert.equal(oauth, 2);
    assert.equal(search, 2);
  });

  it("s'arrête au plafond d'appels", async () => {
    resetUsage();
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("oauth")) {
        return response(200, JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      return response(200, JSON.stringify({ results: [] }));
    };
    const session = new PisteSession(CONFIG);

    await assert.rejects(async () => {
      for (let index = 0; index < MAX_CALLS_PER_RUN + 1; index += 1) {
        await session.legifrance(fetchImpl, {});
      }
    }, /PISTE quota guard/);
    resetUsage();
  });

  it("lit les trois secrets ou rend null", () => {
    assert.deepEqual(
      readPisteConfig({ PISTE_CLIENT_ID: "a", PISTE_CLIENT_SECRET: "b", PISTE_KEY_ID: "c" }),
      { clientId: "a", clientSecret: "b", keyId: "c" },
    );
    assert.equal(readPisteConfig({ PISTE_CLIENT_ID: "a" }), null);
  });
});
