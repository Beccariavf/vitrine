import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { flushUsage, MAX_CALLS_PER_RUN, PisteSession, readPisteConfig, resetUsage } from "../veille/piste.ts";

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

  it("fusionne les passes d'une même journée dans le journal du jour", async () => {
    resetUsage();
    const root = mkdtempSync(join(tmpdir(), "vitrine-usage-"));
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("oauth")) {
        return response(200, JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      return response(200, JSON.stringify({ results: [] }));
    };
    const date = new Date().toISOString().slice(0, 10);

    try {
      const session = new PisteSession(CONFIG);
      await session.judilibreDecision(fetchImpl, "a");
      await session.judilibre(fetchImpl, new URLSearchParams({ query: "rgpd" }));
      flushUsage(root);

      await session.judilibreDecision(fetchImpl, "b");
      await session.judilibre(fetchImpl, new URLSearchParams({ query: "cnil" }));
      flushUsage(root);

      const usage = JSON.parse(readFileSync(join(root, "data", "usage", `${date}.json`), "utf8")) as {
        calls: Array<{ source: string; endpoint: string }>;
      };
      assert.deepEqual(
        usage.calls.map((call) => `${call.source}/${call.endpoint}`),
        ["judilibre/decision", "judilibre/search", "judilibre/decision", "judilibre/search"],
      );
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("repart d'un journal neuf quand le fichier du jour est illisible", async () => {
    resetUsage();
    const root = mkdtempSync(join(tmpdir(), "vitrine-usage-"));
    const fetchImpl: FetchLike = async () => response(200, JSON.stringify({ id: "abc" }));
    const date = new Date().toISOString().slice(0, 10);

    try {
      mkdirSync(join(root, "data", "usage"), { recursive: true });
      writeFileSync(join(root, "data", "usage", `${date}.json`), "{ pas du json", "utf8");

      const session = new PisteSession(CONFIG);
      await session.judilibreDecision(fetchImpl, "abc");
      flushUsage(root);

      const usage = JSON.parse(readFileSync(join(root, "data", "usage", `${date}.json`), "utf8")) as {
        calls: Array<{ source: string; endpoint: string; status: number }>;
      };
      assert.deepEqual(
        usage.calls.map((call) => `${call.source}/${call.endpoint}/${call.status}`),
        ["judilibre/decision/200"],
      );
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit une décision avec le KeyId et la journalise", async () => {
    resetUsage();
    const root = mkdtempSync(join(tmpdir(), "vitrine-usage-"));
    let seenUrl = "";
    let seenKeyId = "";
    const fetchImpl: FetchLike = async (url, init) => {
      seenUrl = url;
      seenKeyId = init?.headers?.KeyId ?? "";
      return response(200, JSON.stringify({ id: "6ac6079ec27382d099f5a06e", visa: [] }));
    };

    try {
      const session = new PisteSession(CONFIG);
      const decision = await session.judilibreDecision(fetchImpl, "6ac6079ec27382d099f5a06e");

      assert.deepEqual(decision, { id: "6ac6079ec27382d099f5a06e", visa: [] });
      assert.equal(
        seenUrl,
        "https://api.piste.gouv.fr/cassation/judilibre/v1.0/decision?id=6ac6079ec27382d099f5a06e",
      );
      assert.equal(seenKeyId, "key");
      assert.equal(session.remainingCalls(), MAX_CALLS_PER_RUN - 1);

      flushUsage(root);
      const date = new Date().toISOString().slice(0, 10);
      const usage = JSON.parse(readFileSync(join(root, "data", "usage", `${date}.json`), "utf8")) as {
        calls: Array<{ source: string; endpoint: string; status: number }>;
      };
      assert.equal(usage.calls.length, 1);
      assert.equal(usage.calls[0]?.source, "judilibre");
      assert.equal(usage.calls[0]?.endpoint, "decision");
      assert.equal(usage.calls[0]?.status, 200);
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lit un texte avec le jeton, le textId et le journalise comme consult", async () => {
    resetUsage();
    const root = mkdtempSync(join(tmpdir(), "vitrine-usage-"));
    let seenUrl = "";
    let seenAuthorization = "";
    let seenBody = "";
    const fetchImpl: FetchLike = async (url, init) => {
      if (url.includes("oauth")) {
        return response(200, JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      seenUrl = url;
      seenAuthorization = init?.headers?.authorization ?? "";
      seenBody = init?.body ?? "";
      return response(200, JSON.stringify({ text: { id: "CETATEXT000055005484", texte: "Considérant …" } }));
    };

    try {
      const session = new PisteSession(CONFIG);
      const body = await session.consultJuri(fetchImpl, "CETATEXT000055005484");

      assert.deepEqual(body, { text: { id: "CETATEXT000055005484", texte: "Considérant …" } });
      assert.equal(seenUrl, "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/juri");
      assert.equal(seenAuthorization, "Bearer t");
      assert.deepEqual(JSON.parse(seenBody), { textId: "CETATEXT000055005484" });

      flushUsage(root);
      const date = new Date().toISOString().slice(0, 10);
      const usage = JSON.parse(readFileSync(join(root, "data", "usage", `${date}.json`), "utf8")) as {
        calls: Array<{ source: string; endpoint: string; status: number }>;
      };
      assert.deepEqual(
        usage.calls.map((call) => `${call.source}/${call.endpoint}/${call.status}`),
        ["piste/oauth/200", "legifrance/consult/200"],
      );
    } finally {
      resetUsage();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("réserve le plancher d'appels quand une consultation retente après un 401", async () => {
    resetUsage();
    let posts = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("oauth")) {
        return response(200, JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      if (url.includes("consult")) {
        posts += 1;
        return response(401, "");
      }
      return response(200, JSON.stringify({ id: "abc" }));
    };

    try {
      const session = new PisteSession(CONFIG);
      for (let index = 0; index < 8; index += 1) await session.judilibreDecision(fetchImpl, "abc");
      assert.equal(session.remainingCalls(), 8);

      await assert.rejects(() => session.consultJuri(fetchImpl, "CETATEXT000055005484", 6), /budget reserved/);
      assert.equal(posts, 1);
      assert.equal(session.remainingCalls(), 6);
    } finally {
      resetUsage();
    }
  });

  it("compte les appels restants jusqu'à zéro", async () => {
    resetUsage();
    const fetchImpl: FetchLike = async () => response(200, JSON.stringify({ id: "abc" }));
    const session = new PisteSession(CONFIG);

    try {
      for (let index = 0; index < MAX_CALLS_PER_RUN; index += 1) {
        assert.equal(session.remainingCalls(), MAX_CALLS_PER_RUN - index);
        await session.judilibreDecision(fetchImpl, "abc");
      }
      assert.equal(session.remainingCalls(), 0);
      await assert.rejects(() => session.judilibreDecision(fetchImpl, "abc"), /PISTE quota guard/);
    } finally {
      resetUsage();
    }
  });
});
