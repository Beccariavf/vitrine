import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { canonicalUrl, hashId } from "../veille/normalize.ts";
import { parseFeed, toIsoUtc } from "../veille/sources/cnil.ts";

const FIXTURE = new URL("./fixtures/cnil/feed.xml", import.meta.url);
const xml = readFileSync(FIXTURE, "utf8");

/** Construit un petit flux RSS valide autour des items fournis. */
function feedOf(items: string, extra = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>RSS - Actualités CNIL</title>${extra}
    ${items}
  </channel>
</rss>`;
}

describe("flux CNIL figé", () => {
  it("produit une entrée par actualité du flux", () => {
    assert.equal(parseFeed(xml).length, 10);
  });

  it("renseigne tous les champs de chaque entrée", () => {
    for (const entry of parseFeed(xml)) {
      assert.match(entry.id, /^[0-9a-f]{16}$/);
      assert.ok(entry.title.length > 0);
      assert.match(entry.url, /^https:\/\/www\.cnil\.fr\//);
      assert.match(entry.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.equal(entry.source, "cnil");
    }
  });

  it("donne les mêmes entrées à chaque exécution", () => {
    assert.deepEqual(parseFeed(xml), parseFeed(xml));
  });

  it("dérive l'identifiant de l'URL canonique", () => {
    for (const entry of parseFeed(xml)) {
      assert.equal(entry.id, hashId(entry.url));
      assert.equal(entry.url, canonicalUrl(entry.url));
    }
  });

  it("ne laisse aucun slash final ni query ni fragment dans l'URL", () => {
    for (const entry of parseFeed(xml)) {
      assert.ok(!entry.url.endsWith("/"));
      assert.ok(!entry.url.includes("?"));
      assert.ok(!entry.url.includes("#"));
    }
  });
});

describe("URL canonique et identifiant", () => {
  it("donne le même identifiant à deux écritures de la même page", () => {
    const plain = "https://www.cnil.fr/fr/sanction-cookies-app-fnac";
    const noisy = "https://WWW.CNIL.FR/fr/sanction-cookies-app-fnac/?utm_source=rss#haut";
    assert.equal(canonicalUrl(noisy), plain);
    assert.equal(hashId(noisy), hashId(plain));
  });

  it("donne des identifiants distincts à deux pages différentes", () => {
    assert.notEqual(
      hashId("https://www.cnil.fr/fr/cloture-injonction-google"),
      hashId("https://www.cnil.fr/fr/cepd-declaration-lunettes-connectees"),
    );
  });
});

describe("dates", () => {
  it("convertit un offset en heure UTC", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 2026 13:00:00 +0100"), "2026-10-29T12:00:00.000Z");
  });

  it("conserve une actualité sans date avec une date nulle", () => {
    const [entry] = parseFeed(
      feedOf(`
    <item>
      <title>Sans date</title>
      <link>https://www.cnil.fr/fr/sans-date</link>
    </item>`),
    );
    assert.equal(entry?.publishedAt, null);
    assert.equal(entry?.title, "Sans date");
  });

  it("met à null une date illisible", () => {
    assert.equal(toIsoUtc("pas une date"), null);
    assert.equal(toIsoUtc(""), null);
    assert.equal(toIsoUtc(null), null);
  });
});

describe("flux dégénérés", () => {
  it("accepte un flux vide sans erreur", () => {
    assert.deepEqual(parseFeed(feedOf("")), []);
  });

  it("accepte un flux à un seul item", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Unique</title>
      <link>https://www.cnil.fr/fr/unique</link>
      <pubDate>Tue, 13 Oct 2026 14:00:00 +0200</pubDate>
    </item>`),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.publishedAt, "2026-10-13T12:00:00.000Z");
  });

  it("lève une exception explicite sur un XML malformé", () => {
    assert.throws(() => parseFeed("<rss><channel><item></rss>"), /not valid XML/);
  });

  it("lève une exception explicite sur un XML sans channel", () => {
    assert.throws(() => parseFeed("<autre></autre>"), /no <rss><channel> root/);
  });

  it("ne garde qu'une entrée quand deux items partagent la même URL", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Première</title>
      <link>https://www.cnil.fr/fr/doublon</link>
    </item>
    <item>
      <title>Seconde</title>
      <link>https://www.cnil.fr/fr/doublon/?utm_source=rss</link>
    </item>`),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.title, "Première");
  });
});
