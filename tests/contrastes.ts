import { readFileSync } from "node:fs";

/** Jetons de couleur lus dans `@theme` : la seule source de vérité de la palette. */
export const CSS = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

export type Theme = "clair" | "sombre";

/** Le thème clair vit dans `@theme`, le sombre dans son bloc `prefers-color-scheme`. */
function bloc(css: string, theme: Theme): string {
  if (theme === "clair") return css;
  const trouve = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/.exec(css);
  if (trouve === null) throw new Error("bloc prefers-color-scheme: dark absent de global.css");
  return trouve[1]!;
}

export function jeton(css: string, nom: string, theme: Theme = "clair"): string {
  const trouve = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(bloc(css, theme));
  if (trouve === null) {
    const ou = theme === "clair" ? "" : " du thème sombre";
    throw new Error(`jeton --color-${nom} absent${ou} de global.css`);
  }
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

/** Une paire de la direction artistique, évaluée dans son thème. */
export type PaireTheme = readonly [texte: string, fond: string, seuil: number, theme: Theme];

const THEMES: readonly Theme[] = ["clair", "sombre"];

/** Texte courant et contrôles : 4,5:1 dans chaque thème. */
const PAIRES_TEXTE: readonly (readonly [texte: string, fond: string])[] = [
  ["encre", "fond"],
  ["encre", "surface"],
  ["encre-douce", "fond"],
  ["encre-douce", "surface"],
  ["sur-accent", "accent"],
  ["accent", "fond"],
];

export const TEXTES: readonly PaireTheme[] = THEMES.flatMap((theme) =>
  PAIRES_TEXTE.map(([texte, fond]) => [texte, fond, 4.5, theme] as const),
);

/** Pastilles de famille : non textuelles, 3:1 (WCAG 1.4.11) sur les deux fonds. */
const FAMILLES_PASTILLE = ["textes", "autorites", "ue", "juridictions", "encre-douce"] as const;
const FONDS_PASTILLE = ["fond", "surface"] as const;

export const PASTILLES: readonly PaireTheme[] = THEMES.flatMap((theme) =>
  FAMILLES_PASTILLE.flatMap((famille) => FONDS_PASTILLE.map((fond) => [famille, fond, 3, theme] as const)),
);

/** Les paires sous leur seuil, nommées par thème, paire et ratio. */
export function echecsTheme(css: string, paires: readonly PaireTheme[]): string[] {
  return paires
    .map(([texte, fond, seuil, theme]) => ({
      texte,
      fond,
      seuil,
      theme,
      valeur: ratio(jeton(css, texte, theme), jeton(css, fond, theme)),
    }))
    .filter(({ valeur, seuil }) => valeur < seuil)
    .map(
      ({ texte, fond, seuil, theme, valeur }) =>
        `${theme} · ${texte} sur ${fond} : ${valeur.toFixed(2)}:1 < ${seuil}:1`,
    );
}
