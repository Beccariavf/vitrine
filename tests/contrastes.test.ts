import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/** Jetons de couleur lus dans `@theme` : la seule source de vérité de la palette. */
const CSS = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

export function jeton(css: string, nom: string): string {
  const trouve = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (trouve === null) throw new Error(`jeton --color-${nom} absent de global.css`);
  return trouve[1]!;
}

function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((debut) => Number.parseInt(hex.slice(debut, debut + 2), 16) / 255);
  const [r, g, b] = canaux.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Ratio de contraste WCAG 2.x entre deux couleurs hexadécimales. */
export function ratio(premier: string, second: string): number {
  const [clair, sombre] = [luminance(premier), luminance(second)].sort((a, b) => b - a);
  return (clair! + 0.05) / (sombre! + 0.05);
}

type Paire = readonly [texte: string, fond: string, seuil: number];

/** Texte courant : 4,5:1 ; le rouge sur papier reste réservé aux grands textes : 3:1. */
const AUTORISEES: readonly Paire[] = [
  ["ink", "concrete", 4.5],
  ["muted", "concrete", 4.5],
  ["ink", "paper", 4.5],
  ["muted", "paper", 4.5],
  ["paper", "blue", 4.5],
  ["paper", "green", 4.5],
  ["paper", "red", 4.5],
  ["ink", "yellow", 4.5],
  ["paper", "concrete-dark", 4.5],
  ["yellow", "concrete-dark", 4.5],
  ["stone", "concrete-dark", 4.5],
  ["red", "paper", 3],
];

/** Paires que le socle sombre interdit : elles doivent rester sous leur seuil. */
const INTERDITES: readonly Paire[] = [
  ["muted", "concrete-dark", 4.5],
  ["red", "concrete-dark", 3],
];

function echecs(css: string, paires: readonly Paire[]): string[] {
  return paires
    .map(([texte, fond, seuil]) => ({ texte, fond, seuil, valeur: ratio(jeton(css, texte), jeton(css, fond)) }))
    .filter(({ valeur, seuil }) => valeur < seuil)
    .map(({ texte, fond, seuil, valeur }) => `${texte} sur ${fond} : ${valeur.toFixed(2)}:1 < ${seuil}:1`);
}

describe("contrastes de la palette", () => {
  it("calcule le ratio WCAG de référence", () => {
    assert.equal(ratio("#000000", "#ffffff").toFixed(2), "21.00");
    assert.equal(ratio("#121212", "#f4f0e8").toFixed(2), "16.48");
  });

  it("fait passer chaque paire autorisée à son seuil", () => {
    assert.deepEqual(echecs(CSS, AUTORISEES), []);
  });

  it("garde chaque paire interdite sous son seuil", () => {
    for (const [texte, fond, seuil] of INTERDITES) {
      const valeur = ratio(jeton(CSS, texte), jeton(CSS, fond));
      assert.ok(valeur < seuil, `${texte} sur ${fond} devrait rester sous ${seuil}:1 (${valeur.toFixed(2)}:1)`);
    }
  });

  it("nomme la paire et le ratio quand un vert trop clair remplace le jeton", () => {
    const modifie = CSS.replace(/--color-green:\s*#[0-9a-fA-F]{6};/, "--color-green: #3a7d44;");
    assert.deepEqual(echecs(modifie, AUTORISEES), ["paper sur green : 4.40:1 < 4.5:1"]);
  });

  it("lève en nommant un jeton absent", () => {
    assert.throws(() => jeton(CSS, "violet"), /--color-violet absent/);
  });
});
