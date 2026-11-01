import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseFeed } from "../veille/sources/commission-dma.ts";
import { assignThemes, readThemes } from "../veille/themes.ts";

const FEED = readFileSync(new URL("./fixtures/commission-dma/rss.xml", import.meta.url), "utf8");
const THEMES = readThemes(fileURLToPath(new URL("..", import.meta.url)));

describe("le flux Commission DMA", () => {
  const entries = parseFeed(FEED);

  it("retient toutes les publications, y compris les tables rondes", () => {
    assert.equal(entries.length, 3);
  });

  it("construit des entrées datées, sourcées et rattachées à plateformes", () => {
    const fine = entries[0];
    assert.ok(fine);
    assert.equal(fine.source, "commission-dma");
    assert.equal(fine.publishedAt, "2026-07-23T10:19:06.000Z");
    assert.match(fine.summary ?? "", /DMA/);
    assert.deepEqual(assignThemes(entries, THEMES).map((entry) => entry.themes), [
      ["plateformes"],
      ["plateformes", "donnees-non-personnelles"],
      ["plateformes"],
    ]);
  });

  it("rattache l'atelier sans sigle par le défaut de la source", () => {
    const workshop = entries[2];
    assert.ok(workshop);
    assert.doesNotMatch(`${workshop.title} ${workshop.summary ?? ""}`, /Digital Markets Act|\bDMA\b/);
    assert.deepEqual(assignThemes([workshop], THEMES)[0]?.themes, ["plateformes"]);
  });

  it("refuse un lien hors domaine", () => {
    const hostile = FEED.replace(
      "https://digital-markets-act.ec.europa.eu/commission-fines-google-eur890-million-breaches-digital-markets-act-2026-07-23_en",
      "https://example.com/decision",
    );
    assert.throws(() => parseFeed(hostile), /leaves digital-markets-act.ec.europa.eu/);
  });

  it("refuse un XML invalide", () => {
    assert.throws(() => parseFeed("<rss><channel></rss>"), /not valid XML/);
  });

  it("déduplique une publication répétée", () => {
    const first = FEED.match(/<item>[\s\S]*?<\/item>/)?.[0] ?? "";
    const duplicated = FEED.replace("</channel>", `${first}</channel>`);
    assert.equal(parseFeed(duplicated).length, 3);
  });
});
