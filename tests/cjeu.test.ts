import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  parseCaseTitle,
  parseDecisionDate,
  parseFeed,
  parsePublicationDate,
} from "../veille/sources/cjeu.ts";

const FEED = readFileSync(new URL("./fixtures/cjeu/feed.xml", import.meta.url), "utf8");

describe("le flux CJUE figé", () => {
  const entries = parseFeed(FEED);

  it("parse tous les arrêts du flux, y compris ceux hors matière", () => {
    assert.equal(entries.length, 5);
    const titles = entries.map((entry) => entry.title);
    assert.ok(titles.some((title) => title.startsWith("Jautiva (C-798/24)")));
    assert.ok(titles.some((title) => title.startsWith("Commission européenne contre Hongrie. (C-681/24)")));
    assert.ok(titles.some((title) => title.startsWith("Test contre Autorité. (C-999/25)")));
    assert.ok(titles.some((title) => title.includes("Minister for Justice")));
    assert.ok(titles.some((title) => title.includes("Commission européenne contre IA")));
  });

  it("dédoublonne _SUM/_RES et ignore _INF", () => {
    const hungary = entries.filter((entry) => entry.title.includes("Hongrie"));
    assert.equal(hungary.length, 1);
    assert.ok(!entries.some((entry) => entry.url.includes("62026CO0111")));
  });

  it("donne à chaque arrêt une URL et un identifiant distincts", () => {
    for (const entry of entries) {
      assert.match(entry.url, /^https:\/\/eur-lex\.europa\.eu\/legal-content\/FR\/TXT\/\?uri=CELEX:\d/);
      assert.match(entry.id, /^[0-9a-f]{16}$/);
      assert.equal(entry.source, "cjeu");
    }
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  });

  it("parse Jautiva avec ses références et sa date de décision", () => {
    const jautiva = entries.find((entry) => entry.title.startsWith("Jautiva"));
    assert.ok(jautiva);
    assert.equal(jautiva.publishedAt, "2026-09-03T12:00:00.000Z");
    assert.deepEqual(jautiva.references, [
      "Règlement (UE) 2016/679 · art. 5, 6",
      "Directive (UE) 2017/1132 · art. 14",
    ]);
    assert.ok(jautiva.officialTitle.startsWith("Affaire C-798/24, Jautiva"));
    assert.ok(jautiva.summary?.startsWith("Renvoi préjudiciel – Protection des personnes physiques"));
    assert.ok(!(jautiva.summary ?? "").includes("\u00a0"));
    assert.ok(!jautiva.title.includes("\u00a0"));
  });

  it("utilise le pubDate en secours quand le titre ne porte pas de date", () => {
    const fallback = entries.find((entry) => entry.title.startsWith("Test contre Autorité"));
    assert.ok(fallback);
    assert.equal(fallback.publishedAt, "2026-10-30T12:00:00.000Z");
  });

  it("parse l'arrêt IA et le marque sans matière à ce stade", () => {
    const ia = entries.find((entry) => entry.title.includes("Commission européenne contre IA"));
    assert.ok(ia);
    assert.deepEqual(ia.references, []);
    assert.deepEqual(ia.themes, []);
  });

  it("refuse un XML invalide ou un flux vide", () => {
    assert.throws(() => parseFeed("<rss><channel><item></rss>"), /not valid XML/);
    assert.throws(
      () => parseFeed('<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>'),
      /CJUE feed has no item/,
    );
  });
});

describe("le titre et la date", () => {
  it("sépare le titre et le résumé des deux formats", () => {
    const jautiva = parseCaseTitle(
      "Affaire C-798/24, Jautiva: Arrêt de la Cour du 3 septembre 2026 – A e. a. [Protection des données – Article 5]",
    );
    assert.equal(jautiva.title, "Jautiva (C-798/24) — Arrêt de la Cour du 3 septembre 2026");
    assert.equal(jautiva.summary, "Protection des données – Article 5");

    const hash = parseCaseTitle(
      "Arrêt de la Cour du 12 mars 2026.#Minister for Justice contre I.T.#Citoyenneté.#Affaire C-477/24.",
    );
    assert.equal(hash.title, "Minister for Justice contre I.T. (C-477/24) — Arrêt de la Cour du 12 mars 2026.");
    assert.equal(hash.summary, "Citoyenneté.");
  });

  it("normalise les espaces insécables avant la date", () => {
    assert.equal(parseDecisionDate("du 3\u00a0septembre 2026"), "2026-09-03T12:00:00.000Z");
    assert.equal(parseDecisionDate("sans date"), null);
  });

  it("lit le pubDate au jour calendaire, à midi UTC", () => {
    assert.equal(parsePublicationDate("Mon, 26 Oct 2026 00:00:00 +0100"), "2026-10-26T12:00:00.000Z");
    assert.equal(parsePublicationDate(null), null);
  });
});
