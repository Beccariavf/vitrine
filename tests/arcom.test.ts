import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PAGE, parseFeed } from "../veille/sources/arcom.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";

const FEED = readFileSync(new URL("./fixtures/arcom/press.xml", import.meta.url), "utf8");
const MYM_PAGE = readFileSync(new URL("./fixtures/arcom/page-mym.html", import.meta.url), "utf8");
const FM_PAGE = readFileSync(
  new URL("./fixtures/arcom/page-frequences.html", import.meta.url),
  "utf8",
);
const THEMES = readThemes(fileURLToPath(new URL("..", import.meta.url)));

describe("la source ARCOM", () => {
  const entries = parseFeed(FEED);

  it("ne garde que les communiqués français", () => {
    assert.equal(entries.length, 2);
    assert.ok(entries.every((entry) => entry.url.startsWith("https://www.arcom.fr/presse/")));
  });

  it("construit une entrée datée, sans résumé de flux", () => {
    const mym = entries.find((entry) => entry.url.includes("mym"));
    assert.ok(mym);
    assert.equal(mym.source, "arcom");
    assert.equal(mym.publishedAt, "2026-10-16T12:00:00.000Z");
    assert.equal(mym.summary, null);
  });

  it("garde la page Mym et lui donne un résumé DSA", () => {
    const page = PAGE.parse(MYM_PAGE);
    assert.equal(page.keep, true);
    assert.match(page.summary ?? "", /règlement sur les services numériques/i);
  });

  it("écarte la page audiovisuelle", () => {
    const page = PAGE.parse(FM_PAGE);
    assert.equal(page.keep, false);
    assert.equal(page.summary, null);
  });

  it("rattache à plateformes l'entrée dont la page parle du DSA", () => {
    const mym = entries.find((entry) => entry.url.includes("mym"));
    assert.ok(mym);
    const assigned = assignThemes([{ ...mym, summary: PAGE.parse(MYM_PAGE).summary }], THEMES);
    assert.deepEqual(assigned[0]?.themes, ["plateformes"]);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://www.arcom.fr/presse/larcom-ouvre-une-enquete-sur-la-plateforme-francaise-mym",
      "https://example.com/presse/mym",
    );
    assert.throws(() => parseFeed(hostile), /leaves arcom.fr/);
  });

  it("refuse un XML invalide", () => {
    assert.throws(() => parseFeed("<rss><channel></rss>"), /not valid XML/);
  });
});
