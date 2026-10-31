import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFeed } from "../veille/sources/anssi.ts";

const FEED = readFileSync(new URL("./fixtures/anssi/actualite.xml", import.meta.url), "utf8");
const NOW = new Date("2026-10-31T00:00:00.000Z");

describe("le flux ANSSI", () => {
  const entries = parseFeed(FEED, NOW);

  it("ne retient que l'actualité de la fenêtre de 90 jours", () => {
    assert.equal(entries.length, 1);
    assert.ok(entries[0]?.title.startsWith("Bulletin d'actualité CERTFR-2026"));
  });

  it("construit une entrée datée, résumée et sourcée", () => {
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(entry.source, "anssi");
    assert.equal(entry.publishedAt, "2026-10-26T00:00:00.000Z");
    assert.equal(entry.url, "https://www.cert.cyber.gouv.fr/actualite/CERTFR-2026-ACT-045");
    assert.match(entry.summary ?? "", /Vulnérabilités/);
    assert.deepEqual(entry.references, []);
    assert.deepEqual(entry.themes, []);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://www.cert.cyber.gouv.fr/actualite/CERTFR-2026-ACT-045/",
      "https://example.com/actualite/",
    );
    assert.throws(() => parseFeed(hostile, NOW), /leaves the CERT-FR domain/);
  });

  it("refuse un XML invalide", () => {
    assert.throws(() => parseFeed("<rss><channel></rss>", NOW), /not valid XML/);
  });
});
