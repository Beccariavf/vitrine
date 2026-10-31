import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseFeed } from "../veille/sources/arcep.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";

const FEED = readFileSync(new URL("./fixtures/arcep/avis.xml", import.meta.url), "utf8");
const THEMES = readThemes(fileURLToPath(new URL("..", import.meta.url)));

describe("le flux ARCEP", () => {
  const entries = parseFeed(FEED);

  it("garde deux identifiants distincts pour deux décisions", () => {
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((entry) => entry.id)).size, 2);
    assert.ok(entries.every((entry) => entry.url.includes("tx_arcepavis_results")));
  });

  it("nettoie les titres, résumés et dates", () => {
    const first = entries[0];
    assert.ok(first);
    assert.equal(first.source, "arcep");
    assert.ok(!first.title.includes("  "));
    assert.equal(first.publishedAt, "2026-10-23T13:34:21.000Z");
    assert.match(first.summary ?? "", /délégation de signature/);
  });

  it("rattache la décision sur le partage de données aux données non personnelles", () => {
    const shared = entries.find((entry) => entry.title.includes("partage de données"));
    assert.ok(shared);
    const assigned = assignThemes([shared], THEMES);
    assert.deepEqual(assigned[0]?.themes, ["donnees-non-personnelles"]);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://www.arcep.fr/la-regulation/avis-et-decisions-de-larcep.html?tx_arcepavis_results%5Baction%5D=show&amp;tx_arcepavis_results%5Bcontroller%5D=Avis&amp;tx_arcepavis_results%5Bavis%5D=48753",
      "https://example.com/avis",
    );
    assert.throws(() => parseFeed(hostile), /leaves arcep.fr/);
  });
});
