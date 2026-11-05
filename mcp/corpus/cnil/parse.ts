/**
 * Parse un fichier `TEXTE_CNIL` de la DILA.
 *
 * La structure est celle de la famille LEGI, pas celle d'EUR-Lex : un
 * `META_COMMUN` (identifiant, nature), un `META_CNIL` (titre, numéro, dates,
 * état juridique) et un `BLOC_TEXTUEL/CONTENU` fait de paragraphes `<p>`.
 * Le texte est copié, jamais reformulé ; les balises et entités sont
 * normalisées par `texteVisible`.
 */

import { texteVisible } from "../parse.ts";
import type { Unite } from "../parse.ts";
import type { DescripteurCnil } from "./historique.ts";

/** Métadonnées d'une délibération, telles que la DILA les publie. */
export type DecisionDila = {
  id: string;
  nature: string;
  titre: string;
  titreComplet: string;
  numero: string;
  natureDelib: string;
  dateTexte: string;
  datePubli: string;
  etatJuridique: string;
  /** Paragraphes `<p>` non vides, dans l'ordre du document. */
  paragraphes: string[];
};

/** Longueur minimale visée d'un fragment local, hors dernier et paragraphe long. */
export const MIN_FRAGMENT = 600;
/** Longueur maximale d'un fragment local. */
export const MAX_FRAGMENT = 1200;

/** Contenu texte d'une balise simple, entités décodées ; `""` si absente. */
function balise(xml: string, nom: string): string {
  const trouve = new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(xml);
  return trouve === null ? "" : texteVisible(trouve[1] ?? "");
}

/**
 * Paragraphes d'un `CONTENU` : les `<p>` quand il y en a, sinon les segments
 * séparés par `<br/>`, forme des textes anciens de la DILA. Un contenu sans
 * aucun texte non vide rend une liste vide, que l'appelant refuse.
 */
function extraireParagraphes(brut: string): string[] {
  const paragraphes = [...brut.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((trouve) => texteVisible(trouve[1] ?? ""))
    .filter((texte) => texte !== "");
  if (paragraphes.length > 0) return paragraphes;
  return brut
    .split(/<br\s*\/?>/i)
    .map((segment) => texteVisible(segment))
    .filter((texte) => texte !== "");
}

/**
 * Parse un `TEXTE_CNIL`. Lève si l'identifiant, la date ou le `BLOC_TEXTUEL`
 * manquent, en nommant le fichier. Un contenu vide (`<CONTENU/>`) rend zéro
 * paragraphe : c'est à l'appelant de refuser un texte qu'il voulait retenir.
 */
export function parseTexteCnil(xml: string, nomFichier = "TEXTE_CNIL"): DecisionDila {
  const id = balise(xml, "ID");
  if (id === "") {
    throw new Error(`${nomFichier} : identifiant META_COMMUN/ID absent`);
  }

  const bloc = /<BLOC_TEXTUEL>([\s\S]*?)<\/BLOC_TEXTUEL>/.exec(xml);
  if (bloc === null) {
    throw new Error(`${nomFichier} : ${id} sans BLOC_TEXTUEL/CONTENU`);
  }

  const contenu = /<CONTENU>([\s\S]*?)<\/CONTENU>/.exec(bloc[1] ?? "");
  const paragraphes = contenu === null ? [] : extraireParagraphes(contenu[1] ?? "");

  const dateTexte = balise(xml, "DATE_TEXTE");
  if (dateTexte === "") {
    throw new Error(`${nomFichier} : ${id} sans META_CNIL/DATE_TEXTE`);
  }

  const numero = balise(xml, "NUMERO");
  return {
    id,
    nature: balise(xml, "NATURE"),
    titre: balise(xml, "TITRE"),
    titreComplet: balise(xml, "TITREFULL"),
    numero: numero === "" ? id : numero,
    natureDelib: balise(xml, "NATURE_DELIB"),
    dateTexte,
    datePubli: balise(xml, "DATE_PUBLI"),
    etatJuridique: balise(xml, "ETAT_JURIDIQUE"),
    paragraphes,
  };
}

/**
 * Regroupe les paragraphes consécutifs jusqu'à `MIN_FRAGMENT` caractères sans
 * dépasser `MAX_FRAGMENT`. Un paragraphe plus long que `MAX_FRAGMENT` reste
 * seul. Les fragments rendus, joints par une espace, redonnent exactement les
 * paragraphes joints par une espace : aucun texte n'est perdu.
 */
export function decouperParagraphes(paragraphes: string[]): string[] {
  const fragments: string[] = [];
  let courant = "";
  const pousser = (): void => {
    if (courant !== "") {
      fragments.push(courant);
      courant = "";
    }
  };

  for (const paragraphe of paragraphes) {
    const texte = paragraphe.trim();
    if (texte === "") continue;
    if (texte.length > MAX_FRAGMENT) {
      pousser();
      fragments.push(texte);
      continue;
    }
    if (courant === "") {
      courant = texte;
    } else if (courant.length + 1 + texte.length <= MAX_FRAGMENT) {
      courant = `${courant} ${texte}`;
    } else {
      pousser();
      courant = texte;
    }
    if (courant.length >= MIN_FRAGMENT) pousser();
  }
  pousser();
  return fragments;
}

/**
 * Mappe une délibération en unités. La numérotation des fragments vient de
 * nous : elle est dite dans `chemin` et dans le manifeste, pour qu'une citation
 * ne la confonde pas avec le `chunk_index` publié de la DINUM.
 */
export function unitesDila(
  decision: DecisionDila,
  descripteur: Pick<DescripteurCnil, "corpus" | "nom" | "url_texte">,
): Unite[] {
  return decouperParagraphes(decision.paragraphes).map((texte, index) => ({
    ref: `${decision.id}#f${index}`,
    document: decision.id,
    corpus: descripteur.corpus,
    niveau: "fragment",
    numero: decision.numero,
    chemin:
      `${descripteur.nom} > Sanctions > Délibération ${decision.numero} > Découpage local`,
    texte,
    date_acte: decision.dateTexte,
    date_debut: decision.dateTexte,
    date_fin: null,
    statut: decision.etatJuridique,
    url: descripteur.url_texte.replace("{id}", decision.id),
    origine: "dila",
  }));
}
