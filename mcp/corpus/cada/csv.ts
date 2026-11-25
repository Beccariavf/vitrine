/**
 * Lecteur CSV du jeu « Avis et conseils de la CADA ».
 *
 * Le fichier consolidé fait ~189 Mo et porte des champs cités qui contiennent
 * des virgules et des retours à la ligne : la lecture est faite en flux, jamais
 * par `split(",")`. Les règles sont celles de la RFC 4180 — guillemets doublés
 * pour un guillemet littéral, séparateur virgule, fin de ligne CRLF ou LF.
 */

import { createReadStream } from "node:fs";

/**
 * Automate d'analyse : il accepte des morceaux de texte et rend les
 * enregistrements complets, ce qui permet de le nourrir d'un flux ou d'une
 * chaîne sans dupliquer la logique.
 */
export class AnalyseurCsv {
  private champ = "";
  private ligne: string[] = [];
  private guillemets = false;
  private premierCaractere = true;
  /** Vrai quand le dernier caractère du morceau précédent était un guillemet. */
  private guillemetEnAttente = false;

  /** Pousse un morceau de texte et rend les enregistrements terminés. */
  pousser(morceau: string): string[][] {
    const enregistrements: string[][] = [];
    for (let index = 0; index < morceau.length; index += 1) {
      const caractere = morceau[index] as string;
      if (this.premierCaractere) {
        this.premierCaractere = false;
        // Le fichier de la CADA commence par un BOM UTF-8.
        if (caractere === "\uFEFF") continue;
      }
      // Un guillemet en fin de morceau peut doubler avec le premier caractère
      // du suivant : la décision est prise ici, jamais à cheval sur deux lots.
      if (this.guillemetEnAttente) {
        this.guillemetEnAttente = false;
        if (caractere === '"') {
          this.champ += '"';
          continue;
        }
        this.guillemets = false;
      }
      if (this.guillemets) {
        if (caractere !== '"') {
          this.champ += caractere;
        } else if (index + 1 < morceau.length) {
          if (morceau[index + 1] === '"') {
            this.champ += '"';
            index += 1;
          } else {
            this.guillemets = false;
          }
        } else {
          this.guillemetEnAttente = true;
        }
        continue;
      }
      if (caractere === '"' && this.champ === "") {
        this.guillemets = true;
      } else if (caractere === ",") {
        this.ligne.push(this.champ);
        this.champ = "";
      } else if (caractere === "\n") {
        this.ligne.push(this.champ.endsWith("\r") ? this.champ.slice(0, -1) : this.champ);
        enregistrements.push(this.ligne);
        this.ligne = [];
        this.champ = "";
      } else {
        this.champ += caractere;
      }
    }
    return enregistrements;
  }

  /** Dernier enregistrement quand le fichier ne finit pas par un retour à la ligne. */
  terminer(): string[][] {
    if (this.guillemetEnAttente) {
      // Le guillemet final était bien la fermeture du champ cité.
      this.guillemetEnAttente = false;
      this.guillemets = false;
    }
    if (this.champ === "" && this.ligne.length === 0) return [];
    this.ligne.push(this.champ);
    this.champ = "";
    const dernier = this.ligne;
    this.ligne = [];
    return [dernier];
  }
}

/** Enregistrements d'un CSV déjà en mémoire, en-tête compris. */
export function lireCsv(texte: string): string[][] {
  const analyseur = new AnalyseurCsv();
  return [...analyseur.pousser(texte), ...analyseur.terminer()];
}

/** Enregistrements d'un fichier CSV, en-tête compris, lus en flux. */
export async function* enregistrementsCsv(chemin: string): AsyncGenerator<string[]> {
  const analyseur = new AnalyseurCsv();
  for await (const morceau of createReadStream(chemin, { encoding: "utf8" })) {
    for (const enregistrement of analyseur.pousser(morceau)) yield enregistrement;
  }
  for (const enregistrement of analyseur.terminer()) yield enregistrement;
}
