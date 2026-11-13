import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { lireDemo } from "../src/lib/demo.ts";

const racines: string[] = [];

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "vitrine-demo-"));
  racines.push(racine);
  return racine;
}

/** Écrit `contenu` sous `src/demo/demo.json` d'une racine temporaire. */
function racineAvecDemo(contenu: unknown): string {
  const racine = racineTemporaire();
  mkdirSync(join(racine, "src", "demo"), { recursive: true });
  writeFileSync(
    join(racine, "src", "demo", "demo.json"),
    typeof contenu === "string" ? contenu : JSON.stringify(contenu),
    "utf8",
  );
  return racine;
}

/** Une démo de forme valide, surchargeable champ par champ ; contenu de test, jamais publié. */
function demo(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: "Question de test ?",
    capturee_le: "2026-11-13",
    modele: "modele-de-test",
    sans: "Réponse de test sans connecteur.",
    avec: "Réponse de test avec connecteur.",
    sources: [{ libelle: "RGPD · art. 6", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" }],
    ...surcharges,
  };
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

describe("lireDemo", () => {
  it("rend null quand le fichier manque", () => {
    assert.equal(lireDemo(racineTemporaire()), null);
  });

  it("rend la démo valide champ par champ", () => {
    const lue = lireDemo(racineAvecDemo(demo()));
    assert.deepEqual(lue, demo());
  });

  it("lève en nommant un champ manquant ou vide", () => {
    const { sources: _sources, ...sansSources } = demo();
    assert.throws(() => lireDemo(racineAvecDemo(sansSources)), /"sources"/);
    assert.throws(() => lireDemo(racineAvecDemo(demo({ sources: [] }))), /"sources"/);
    assert.throws(() => lireDemo(racineAvecDemo(demo({ avec: "  " }))), /"avec"/);
    assert.throws(() => lireDemo(racineAvecDemo(demo({ capturee_le: "13/11/2026" }))), /"capturee_le"/);
    assert.throws(() => lireDemo(racineAvecDemo("{")), /JSON illisible/);
  });

  it("lève sur une source dont l'URL n'est pas https", () => {
    const http = demo({ sources: [{ libelle: "RGPD", url: "http://eur-lex.europa.eu/" }] });
    assert.throws(() => lireDemo(racineAvecDemo(http)), /"sources\[0\]\.url"/);
    const relative = demo({ sources: [{ libelle: "RGPD", url: "/rgpd" }] });
    assert.throws(() => lireDemo(racineAvecDemo(relative)), /"sources\[0\]\.url"/);
  });
});
