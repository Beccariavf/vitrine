import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  activeThemes,
  assignThemes,
  matchesTheme,
  readThemes,
  themesForEntry,
  visibleEntries,
} from "../veille/themes.ts";
import type { Theme } from "../veille/themes.ts";
import type { Entry } from "../veille/types.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const themes = readThemes(ROOT);

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "0123456789abcdef",
    title: "Titre",
    officialTitle: "Titre",
    url: "https://www.cnil.fr/fr/titre",
    publishedAt: "2026-10-01T12:00:00.000Z",
    summary: null,
    references: [],
    themes: [],
    source: "cnil",
    ...overrides,
  };
}

const JAUTIVA = entry({
  source: "cjeu",
  title: "Jautiva (C-798/24) — Arrêt de la Cour du 3 septembre 2026",
  officialTitle:
    "Affaire C-798/24, Jautiva: Arrêt de la Cour du 3 septembre 2026 – Protection des données à caractère personnel – Règlement (UE) 2016/679 – Article 5 – Article 6",
  references: ["Règlement (UE) 2016/679 · art. 5, 6"],
});

describe("le catalogue des matières", () => {
  it("contient cinq matières, toutes actives", () => {
    assert.equal(themes.length, 5);
    assert.deepEqual(activeThemes(themes).map((theme) => theme.id), [
      "donnees-personnelles",
      "ia",
      "cybersecurite",
      "donnees-non-personnelles",
      "plateformes",
    ]);
  });

  it("refuse un catalogue de quatre matières", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-themes-"));
    try {
      mkdirSync(join(root, "veille"), { recursive: true });
      writeFileSync(
        join(root, "veille", "themes.json"),
        JSON.stringify({ themes: themes.slice(0, 4) }),
        "utf8",
      );
      assert.throws(() => readThemes(root), /exactly five themes/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse une matière dont active n'est pas un booléen", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-themes-"));
    try {
      mkdirSync(join(root, "veille"), { recursive: true });
      writeFileSync(
        join(root, "veille", "themes.json"),
        JSON.stringify({ themes: themes.map((theme, index) => (index === 0 ? { ...theme, active: "oui" } : theme)) }),
        "utf8",
      );
      assert.throws(() => readThemes(root), /"active" must be a boolean/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("le rattachement", () => {
  it("rattache Jautiva aux données personnelles par son instrument", () => {
    assert.deepEqual(themesForEntry(JAUTIVA, themes), ["donnees-personnelles"]);
  });

  it("rattache une actualité CNIL sur l'IA aux données personnelles et à l'IA", () => {
    const cnil = entry({
      title: "Intelligence artificielle : les recommandations de la CNIL",
      summary: "Un système d'IA au service des personnes.",
    });
    assert.deepEqual(themesForEntry(cnil, themes).sort(), ["donnees-personnelles", "ia"]);
  });

  it("rejette un arrêt sur la citoyenneté", () => {
    const out = entry({
      source: "cjeu",
      title: "Arrêt — Citoyenneté de l'Union — Prestations sociales",
      officialTitle: "Arrêt — Citoyenneté de l'Union — Prestations sociales",
    });
    assert.deepEqual(themesForEntry(out, themes), []);
    assert.deepEqual(assignThemes([out], themes), []);
  });

  it("ne confond pas le droit d'accès à un avocat avec une matière", () => {
    const out = entry({
      source: "cjeu",
      title: "Arrêt — Droit d'accès à un avocat — Directive 2013/48/UE",
      officialTitle: "Arrêt — Droit d'accès à un avocat — Directive 2013/48/UE",
    });
    assert.deepEqual(themesForEntry(out, themes), []);
  });

  it("rattache l'AI Act par son numéro", () => {
    const ai = entry({
      source: "cjeu",
      title: "Arrêt — Règlement (UE) 2024/1689",
      references: ["Règlement (UE) 2024/1689 · art. 6"],
    });
    assert.ok(themesForEntry(ai, themes).includes("ia"));
  });

  it("applique les matières par défaut des sources", () => {
    assert.deepEqual(themesForEntry(entry({ source: "cepd", title: "Décision" }), themes), [
      "donnees-personnelles",
    ]);
    assert.deepEqual(themesForEntry(entry({ source: "anssi", title: "Alerte" }), themes), [
      "cybersecurite",
    ]);
    assert.deepEqual(themesForEntry(entry({ source: "arcep", title: "Décision télécom" }), themes), []);
  });

  it("garde la matière inactive dans l'entrée mais la masque au site", () => {
    const inactive = themes.map((theme): Theme => (theme.id === "ia" ? { ...theme, active: false } : theme));
    const aiOnly = entry({
      source: "cjeu",
      title: "Arrêt — Intelligence artificielle",
      officialTitle: "Arrêt — Intelligence artificielle",
    });
    const assigned = assignThemes([aiOnly], inactive);
    assert.ok(assigned[0]?.themes.includes("ia"));
    assert.deepEqual(visibleEntries(assigned, inactive).map((item) => item.id), []);
    assert.deepEqual(visibleEntries(assigned, themes).map((item) => item.id), [aiOnly.id]);
  });

  it("n'ajoute aucune matière inconnue", () => {
    const assigned = assignThemes([entry({ title: "Intelligence artificielle" })], themes, ["inconnue"]);
    assert.deepEqual(assigned[0]?.themes, ["donnees-personnelles", "ia"]);
  });

  it("expose matchesTheme pour un instrument exact", () => {
    const dp = themes.find((theme) => theme.id === "donnees-personnelles");
    assert.ok(dp);
    assert.equal(matchesTheme(JAUTIVA, dp), true);
  });

  it("rattache le DSA et le DMA à plateformes", () => {
    const dsa = entry({
      source: "cjeu",
      title: "Arrêt — Règlement sur les services numériques — Modération des contenus",
    });
    assert.deepEqual(themesForEntry(dsa, themes), ["plateformes"]);

    const dma = entry({
      source: "cjeu",
      title: "Arrêt — Digital Markets Act — Contrôleur d'accès",
    });
    assert.deepEqual(themesForEntry(dma, themes), ["plateformes"]);
  });

  it("ne rattache pas une simple plateforme", () => {
    const generic = entry({ source: "cjeu", title: "Arrêt — Une plateforme de services" });
    assert.deepEqual(themesForEntry(generic, themes), []);
  });

  it("rattache une entrée RGPD et DSA aux deux matières", () => {
    const both = entry({
      source: "cjeu",
      title: "Arrêt — RGPD et règlement sur les services numériques",
    });
    assert.deepEqual(themesForEntry(both, themes).sort(), ["donnees-personnelles", "plateformes"]);
  });

  it("rattache plateformes par l'instrument cité", () => {
    const dsa = entry({
      source: "cjeu",
      title: "Arrêt",
      references: ["Règlement (UE) 2022/2065 · art. 24"],
    });
    assert.deepEqual(themesForEntry(dsa, themes), ["plateformes"]);
  });

  it("conserve les requêtes PISTE de la matière", () => {
    const plateformes = themes.find((theme) => theme.id === "plateformes");
    assert.deepEqual(plateformes?.queries, ["2022/2065", "2022/1925"]);
  });

  it("refuse des requêtes vides", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-themes-"));
    try {
      mkdirSync(join(root, "veille"), { recursive: true });
      const invalid = themes.map((theme) =>
        theme.id === "plateformes" ? { ...theme, queries: [] } : theme,
      );
      writeFileSync(
        join(root, "veille", "themes.json"),
        JSON.stringify({ themes: invalid }),
        "utf8",
      );
      assert.throws(() => readThemes(root), /"queries" must be a non-empty array/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
