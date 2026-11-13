import { readFileSync } from "node:fs";

/** Jetons de couleur lus dans `@theme` : la seule source de vérité de la palette. */
export const CSS = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

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

export type Paire = readonly [texte: string, fond: string, seuil: number];

/** Texte courant : 4,5:1 ; le rouge sur papier reste réservé aux grands textes : 3:1. */
export const AUTORISEES: readonly Paire[] = [
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
export const INTERDITES: readonly Paire[] = [
  ["muted", "concrete-dark", 4.5],
  ["red", "concrete-dark", 3],
];

/** Les paires sous leur seuil, chacune nommée avec son ratio. */
export function echecs(css: string, paires: readonly Paire[]): string[] {
  return paires
    .map(([texte, fond, seuil]) => ({ texte, fond, seuil, valeur: ratio(jeton(css, texte), jeton(css, fond)) }))
    .filter(({ valeur, seuil }) => valeur < seuil)
    .map(({ texte, fond, seuil, valeur }) => `${texte} sur ${fond} : ${valeur.toFixed(2)}:1 < ${seuil}:1`);
}
