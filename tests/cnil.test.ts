import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { canonicalUrl, hashId } from "../veille/normalize.ts";
import { parseFeed, toIsoUtc } from "../veille/sources/cnil.ts";

const FIXTURE = new URL("./fixtures/cnil/feed.xml", import.meta.url);
const xml = readFileSync(FIXTURE, "utf8");

/**
 * Identifiants attendus du flux figé, calculés une fois hors du test et figés
 * ici : une dérive de la normalisation les casse, au lieu de se comparer à elle-même.
 */
const EXPECTED_IDS = [
  "1fb831fb8c3243d4",
  "4b3a739cc4e144e1",
  "6b483b1190c73ddb",
  "8da07efb6db3ce65",
  "aaebf12b008c7872",
  "c8f46e5ff1ac1686",
  "c95fe100c8350d72",
  "d7fec0bf7c00fb0d",
  "dbedb621bf9e3232",
  "fc7865bf7518a1d6",
];

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

  it("produit les identifiants attendus du flux figé", () => {
    const ids = parseFeed(xml)
      .map((entry) => entry.id)
      .sort();
    assert.deepEqual(ids, EXPECTED_IDS);
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
  it("calcule l'identifiant attendu pour une URL connue", () => {
    assert.equal(hashId("https://www.cnil.fr/fr/sanction-cookies-app-fnac"), "1fb831fb8c3243d4");
  });

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

  it("refuse une date sans offset explicite", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 2026 13:00:00"), null);
  });

  it("refuse une valeur qui n'est pas une date RFC 822", () => {
    assert.equal(toIsoUtc("2026"), null);
    assert.equal(toIsoUtc("2026-10-29"), null);
    assert.equal(toIsoUtc("pas une date"), null);
    assert.equal(toIsoUtc(""), null);
    assert.equal(toIsoUtc(null), null);
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
  it("accepte un canal sans item", () => {
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

  it("refuse un lien qui n'est pas une URL https de la CNIL", () => {
    assert.throws(
      () =>
        parseFeed(
          feedOf(`
    <item>
      <title>Lien piégé</title>
      <link>javascript:alert(1)</link>
    </item>`),
        ),
      /item #0 link is not https/,
    );
    assert.throws(
      () =>
        parseFeed(
          feedOf(`
    <item>
      <title>Lien externe</title>
      <link>https://example.com/fr/actualite</link>
    </item>`),
        ),
      /item #0 link leaves cnil\.fr/,
    );
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
