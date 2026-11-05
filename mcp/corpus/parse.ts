/**
 * Découpe le rendu XHTML d'un acte EUR-Lex en unités adressables.
 *
 * Les ancres ELI sont stables : `art_N` pour un article, `rct_N` pour un
 * considérant, `cpt_<romain>` pour un chapitre et `cpt_<romain>.tit_1` pour son
 * titre. Le texte est copié, jamais reformulé ; seules les balises, les entités
 * et les espaces sont normalisés.
 */

/** Métadonnées d'un acte, lues depuis `mcp/corpus/<document>.json`. */
export type Descripteur = {
  document: string;
  /** Nom du dossier de corpus sous `data/corpus/`, par exemple `rgpd`. */
  corpus: string;
  /** Nom court utilisé en tête du chemin, par exemple `RGPD`. */
  nom: string;
  titre: string;
  langue: string;
  url: string;
  licence: string;
  date_acte: string;
  date_publication: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  /** Nombre d'articles que la capture doit porter. */
  articles_attendus: number;
  /** Nombre de considérants que la capture doit porter. */
  considerants_attendus: number;
};

export type Niveau = "article" | "considérant";

/** Une unité de texte, une ligne de `unites.jsonl`. */
export type Unite = {
  ref: string;
  document: string;
  niveau: Niveau;
  numero: string;
  chemin: string;
  texte: string;
  date_acte: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  url: string;
};

const ENTITES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Décode les entités nominales et numériques d'un fragment XHTML. */
export function decoderEntites(fragment: string): string {
  return fragment.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entier, code: string) => {
    if (code[0] === "#") {
      const hexadecimal = code[1] === "x" || code[1] === "X";
      const valeur = Number.parseInt(hexadecimal ? code.slice(2) : code.slice(1), hexadecimal ? 16 : 10);
      return Number.isFinite(valeur) ? String.fromCodePoint(valeur) : entier;
    }
    return ENTITES[code.toLowerCase()] ?? entier;
  });
}

/** Retire les balises et les commentaires, décode les entités, normalise les espaces. */
export function texteVisible(fragment: string): string {
  const sansCommentaire = fragment.replace(/<!--[\s\S]*?-->/g, " ");
  return decoderEntites(sansCommentaire.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?»)\]])/g, "$1")
    .replace(/([«(\[])\s+/g, "$1")
    .trim();
}

/** Contenu du `<div>` qui porte `ancre`, équilibrage des `<div>` compris ; `null` si absent. */
export function contenuDiv(xhtml: string, ancre: string): string | null {
  const position = xhtml.indexOf(`id="${ancre}"`);
  if (position < 0) return null;

  const debut = xhtml.lastIndexOf("<div", position);
  if (debut < 0) return null;

  const balise = /<\/?div\b[^>]*>/gi;
  balise.lastIndex = debut;
  let profondeur = 0;
  for (let trouve = balise.exec(xhtml); trouve !== null; trouve = balise.exec(xhtml)) {
    profondeur += trouve[0].startsWith("</") ? -1 : 1;
    if (profondeur === 0) return xhtml.slice(debut, balise.lastIndex);
  }
  return null;
}

type Ancre = { genre: "art" | "rct" | "cpt"; numero: string; position: number };

function ancres(xhtml: string): Ancre[] {
  const trouvees: Ancre[] = [];
  const motif = /id="(art|rct|cpt)_(\d+|[IVXLC]+)"/g;
  for (let trouve = motif.exec(xhtml); trouve !== null; trouve = motif.exec(xhtml)) {
    const [, genre, numero] = trouve;
    if (genre === undefined || numero === undefined) continue;
    trouvees.push({ genre: genre as Ancre["genre"], numero, position: trouve.index });
  }
  return trouvees;
}

/** Premier numéro manquant dans `1..total`, pour nommer l'ancre absente. */
function premierManquant(numeros: Set<number>, total: number): number | null {
  for (let numero = 1; numero <= total; numero += 1) {
    if (!numeros.has(numero)) return numero;
  }
  return null;
}

function uniteDe(
  descripteur: Descripteur,
  niveau: Niveau,
  numero: string,
  chemin: string,
  texte: string,
): Unite {
  const prefixe = niveau === "article" ? "art" : "rct";
  return {
    ref: `${descripteur.document}#${prefixe}_${numero}`,
    document: descripteur.document,
    niveau,
    numero,
    chemin,
    texte,
    date_acte: descripteur.date_acte,
    date_debut: descripteur.date_debut,
    date_fin: descripteur.date_fin,
    statut: descripteur.statut,
    url: `${descripteur.url}#${prefixe}_${numero}`,
  };
}

/**
 * Rend les articles et les considérants d'un acte CELLAR, dans l'ordre du
 * document. Les comptes viennent du descripteur : une capture incomplète ou un
 * descripteur périmé lèvent en nommant le document et le compte attendu ; aucun
 * appelant n'écrit alors de fichier.
 */
export function parseCellar(xhtml: string, descripteur: Descripteur): Unite[] {
  const releves = ancres(xhtml);
  const numerosArticles = new Set(
    releves.filter((ancre) => ancre.genre === "art").map((ancre) => Number(ancre.numero)),
  );
  const numerosConsiderants = new Set(
    releves.filter((ancre) => ancre.genre === "rct").map((ancre) => Number(ancre.numero)),
  );

  const articleManquant = premierManquant(numerosArticles, descripteur.articles_attendus);
  if (articleManquant !== null) {
    throw new Error(
      `Capture ${descripteur.document} incomplète : ancre art_${articleManquant} absente ` +
        `(${numerosArticles.size} articles au lieu de ${descripteur.articles_attendus})`,
    );
  }
  if (numerosArticles.size !== descripteur.articles_attendus) {
    throw new Error(
      `Capture ${descripteur.document} : ${numerosArticles.size} articles au lieu de ` +
        `${descripteur.articles_attendus} attendus`,
    );
  }
  const considerantManquant = premierManquant(
    numerosConsiderants,
    descripteur.considerants_attendus,
  );
  if (considerantManquant !== null) {
    throw new Error(
      `Capture ${descripteur.document} incomplète : ancre rct_${considerantManquant} absente ` +
        `(${numerosConsiderants.size} considérants au lieu de ${descripteur.considerants_attendus})`,
    );
  }
  if (numerosConsiderants.size !== descripteur.considerants_attendus) {
    throw new Error(
      `Capture ${descripteur.document} : ${numerosConsiderants.size} considérants au lieu de ` +
        `${descripteur.considerants_attendus} attendus`,
    );
  }

  const unites: Unite[] = [];
  let chapitre: { numero: string; titre: string } | null = null;

  for (const ancre of releves) {
    if (ancre.genre === "cpt") {
      const titulaire = contenuDiv(xhtml, `cpt_${ancre.numero}.tit_1`);
      chapitre = { numero: ancre.numero, titre: titulaire === null ? "" : texteVisible(titulaire) };
      continue;
    }
    const contenu = contenuDiv(xhtml, `${ancre.genre}_${ancre.numero}`);
    if (contenu === null) {
      throw new Error(`Ancre ${ancre.genre}_${ancre.numero} annoncée mais introuvable`);
    }
    const texte = texteVisible(contenu);
    if (texte === "") {
      throw new Error(`Ancre ${ancre.genre}_${ancre.numero} vide`);
    }

    if (ancre.genre === "rct") {
      unites.push(uniteDe(descripteur, "considérant", ancre.numero, `${descripteur.nom} > Considérants`, texte));
      continue;
    }
    const cheminChapitre =
      chapitre === null
        ? descripteur.nom
        : [descripteur.nom, `Chapitre ${chapitre.numero}`, chapitre.titre]
            .filter((element) => element !== "")
            .join(" > ");
    unites.push(uniteDe(descripteur, "article", ancre.numero, cheminChapitre, texte));
  }

  return unites;
}

/** Enveloppe historique : le RGPD se parse comme tout acte CELLAR. */
export function parseRgpd(xhtml: string, descripteur: Descripteur): Unite[] {
  return parseCellar(xhtml, descripteur);
}
