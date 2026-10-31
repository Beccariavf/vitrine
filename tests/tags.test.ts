import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { activeTags, matchesActiveTags, matchesTag, readTags } from "../veille/tags.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const tags = readTags(ROOT);

const JAUTIVA =
  "Affaire C-798/24, Jautiva: Arrêt de la Cour (première chambre) du 3 septembre 2026 – " +
  "Protection des personnes physiques à l'égard du traitement des données à caractère personnel – " +
  "Règlement (UE) 2016/679 – Article 5 – Article 6 – Directive (UE) 2017/1132 – Article 14";

describe("le catalogue de tags", () => {
  it("contient quatre tags, dont deux actifs", () => {
    assert.equal(tags.length, 4);
    assert.deepEqual(
      activeTags(tags).map((tag) => tag.id),
      ["rgpd", "droits-donnees"],
    );
  });

  it("garde IA et cybersécurité inactifs", () => {
    assert.equal(tags.find((tag) => tag.id === "ia")?.active, false);
    assert.equal(tags.find((tag) => tag.id === "cybersecurite")?.active, false);
  });
});

describe("le filtre", () => {
  it("retient Jautiva par le tag RGPD", () => {
    const rgpd = tags.find((tag) => tag.id === "rgpd");
    assert.ok(rgpd);
    assert.equal(matchesTag(JAUTIVA, rgpd), true);
    assert.equal(matchesActiveTags(JAUTIVA, tags), true);
  });

  it("rejette un arrêt sur la citoyenneté", () => {
    assert.equal(
      matchesActiveTags("Arrêt de la Cour – Citoyenneté de l'Union – Libre circulation – Prestations sociales", tags),
      false,
    );
  });

  it("rejette un arrêt sur l'accès à un avocat", () => {
    assert.equal(
      matchesActiveTags("Arrêt de la Cour – Droit d'accès à un avocat – Directive 2013/48/UE", tags),
      false,
    );
  });

  it("distingue un tag inactif d'un tag actif", () => {
    const title = "Arrêt – Intelligence artificielle – Règlement 2024/1689";
    const ia = tags.find((tag) => tag.id === "ia");
    assert.ok(ia);
    assert.equal(matchesTag(title, ia), true);
    assert.equal(matchesActiveTags(title, tags), false);

    const withIa = tags.map((tag) => (tag.id === "ia" ? { ...tag, active: true } : tag));
    assert.equal(matchesActiveTags(title, withIa), true);
  });

  it("ne confond pas le sigle IA avec une syllabe", () => {
    const ia = tags.find((tag) => tag.id === "ia");
    assert.ok(ia);
    assert.equal(matchesTag("Arrêt relative aux prestations", ia), false);
  });
});

describe("une configuration invalide", () => {
  it("lève une erreur claire au lieu de filtrer avec un défaut", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-tags-"));
    try {
      mkdirSync(join(root, "veille"), { recursive: true });
      writeFileSync(
        join(root, "veille", "tags.json"),
        JSON.stringify({ tags: [{ id: "x", label: "X", active: "oui", terms: ["x"] }] }),
        "utf8",
      );
      assert.throws(() => readTags(root), /"active" must be a boolean/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
