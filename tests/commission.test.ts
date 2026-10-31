import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseFeed } from "../veille/sources/commission.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";

const FEED = readFileSync(new URL("./fixtures/commission/rss.xml", import.meta.url), "utf8");
const THEMES = readThemes(fileURLToPath(new URL("..", import.meta.url)));

describe("le flux Commission", () => {
  const entries = parseFeed(FEED);

  it("ne garde que les actualités, pas les événements ni les consultations", () => {
    assert.equal(entries.length, 1);
    assert.ok(entries[0]?.url.includes("/news/"));
  });

  it("construit une entrée datée et rattachée à l'IA et aux données non personnelles", () => {
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(entry.source, "commission");
    assert.equal(entry.publishedAt, "2026-10-26T09:28:00.000Z");
    assert.match(entry.summary ?? "", /AI Act/);
    const assigned = assignThemes([entry], THEMES);
    assert.deepEqual(assigned[0]?.themes.sort(), ["donnees-non-personnelles", "ia"]);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://digital-strategy.ec.europa.eu/en/news/commission-launches-ai-act-support-platform",
      "https://example.com/news/ai",
    );
    assert.throws(() => parseFeed(hostile), /leaves digital-strategy.ec.europa.eu/);
  });

  it("refuse un XML invalide", () => {
    assert.throws(() => parseFeed("<rss><channel></rss>"), /not valid XML/);
  });
});
