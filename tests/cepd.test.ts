import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFeed } from "../veille/sources/cepd.ts";

const FEED = readFileSync(new URL("./fixtures/cepd/news.xml", import.meta.url), "utf8");

describe("le flux CEPD", () => {
  const entries = parseFeed(FEED);

  it("rend une entrée datée, résumée et sourcée", () => {
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(entries.length, 1);
    assert.equal(entry.source, "cepd");
    assert.equal(entry.publishedAt, "2026-10-16T12:00:00.000Z");
    assert.ok(entry.url.startsWith("https://www.edpb.europa.eu/news/"));
    assert.match(entry.summary ?? "", /Date of final decision/);
    assert.deepEqual(entry.references, []);
    assert.deepEqual(entry.themes, []);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://www.edpb.europa.eu/news/norwegian-dpa-fines-xandr-eur-8-600-000-for-unlawful-processing-of-personal-data_en",
      "https://example.com/news/",
    );
    assert.throws(() => parseFeed(hostile), /leaves edpb.europa.eu/);
  });

  it("refuse un flux vide ou invalide", () => {
    assert.throws(
      () => parseFeed('<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>'),
      /CEPD feed has no item/,
    );
    assert.throws(() => parseFeed("<rss><channel></rss>"), /not valid XML/);
  });
});
