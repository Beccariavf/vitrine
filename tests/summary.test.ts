import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { SUMMARY_MAX_LENGTH, toSummary } from "../veille/summary.ts";

describe("le nettoyage d'une description", () => {
  it("retire les balises HTML", () => {
    assert.equal(
      toSummary("<p>Bonjour <strong>le</strong> monde</p>"),
      "Bonjour le monde",
    );
  });

  it("décode une entité doublement encodée, puis retire la balise qu'elle cachait", () => {
    assert.equal(
      toSummary("&amp;lt;p&amp;gt;Texte cité&amp;lt;/p&amp;gt;"),
      "Texte cité",
    );
  });

  it("décode les entités nommées connues", () => {
    assert.equal(toSummary("a &amp;amp; b"), "a & b");
    assert.equal(toSummary("&quot;guillemets&quot; et &apos;apostrophes&apos;"), "\"guillemets\" et 'apostrophes'");
  });

  it("décode les entités numériques décimales et hexadécimales", () => {
    assert.equal(toSummary("caf&#233; et &#x41;"), "café et A");
    assert.equal(toSummary("&#x1F600;"), "😀");
  });

  it("remplace les espaces insécables encodés une ou deux fois", () => {
    assert.equal(toSummary("7&nbsp;millions"), "7 millions");
    assert.equal(toSummary("7&amp;nbsp;millions"), "7 millions");
    assert.equal(toSummary("7\u00a0millions"), "7 millions");
  });

  it("ramène retours à la ligne et espaces multiples à un seul espace", () => {
    assert.equal(toSummary("  Un\n\ttitre   sur\nplusieurs lignes  "), "Un titre sur plusieurs lignes");
  });

  it("ne laisse ni balise, ni entité, ni double espace sur le flux CNIL", () => {
    const summary = toSummary("<p>Le 22 octobre 2026, la CNIL a sanctionné&nbsp;la société.</p>");
    assert.equal(summary, "Le 22 octobre 2026, la CNIL a sanctionné la société.");
    assert.ok(!/[<>&]/.test(summary ?? ""));
    assert.ok(!/\s{2}/.test(summary ?? ""));
  });
});

describe("la troncature", () => {
  it("coupe sur le dernier espace des 199 premiers caractères", () => {
    const text = "abc ".repeat(60).trim();
    const summary = toSummary(text);

    assert.ok(summary !== null);
    assert.ok(summary.length <= SUMMARY_MAX_LENGTH);
    assert.ok(summary.endsWith("…"));
    assert.ok(text.startsWith(summary.slice(0, -1)), "le résumé est un début du texte, sans mot inventé");
    assert.equal(text.charAt(summary.length - 1), " ", "la coupe tombe sur une frontière de mot");
  });

  it("coupe à 199 caractères quand aucun espace ne s'y trouve", () => {
    const text = "a".repeat(201);
    const summary = toSummary(text);

    assert.equal(summary, `${"a".repeat(SUMMARY_MAX_LENGTH - 1)}…`);
    assert.equal(summary?.length, SUMMARY_MAX_LENGTH);
  });

  it("n'ajoute aucune ellipse à un texte de 200 caractères ou moins", () => {
    const exact = "b".repeat(SUMMARY_MAX_LENGTH);
    assert.equal(toSummary(exact), exact);
    assert.equal(toSummary("Texte court."), "Texte court.");
  });

  it("mesure la troncature après nettoyage, ellipse comprise", () => {
    const text = `<p>${"mot ".repeat(80).trim()}</p>`;
    const summary = toSummary(text);

    assert.ok(summary !== null);
    assert.ok(summary.length <= SUMMARY_MAX_LENGTH);
    assert.ok(summary.endsWith("…"));
  });
});

describe("une description absente ou vide", () => {
  it("rend null quand la description manque", () => {
    assert.equal(toSummary(null), null);
    assert.equal(toSummary(""), null);
  });

  it("rend null quand le nettoyage ne laisse rien", () => {
    assert.equal(toSummary("   \n\t "), null);
    assert.equal(toSummary("<p> </p>"), null);
    assert.equal(toSummary("&nbsp;"), null);
  });
});
