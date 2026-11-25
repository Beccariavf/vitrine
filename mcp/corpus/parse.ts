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
  /** Nombre de clauses que l'annexe doit porter ; seules les décisions de clauses types en déclarent. */
  clauses_attendues?: number;
  /** Nombre de points numérotés que la partie opératoire doit porter (recommandation `donnees`). */
  points_attendus?: number;
  /** Nombre d'annexes que la capture doit porter (`donnees`). */
  annexes_attendues?: number;
  /** Parseur dédié, quand le corpus n'est pas un acte CELLAR ordinaire. */
  parseur?: "ccs" | "donnees" | "sante_ue";
  /**
   * CELEX effectivement récupéré : une version consolidée (`0…-AAAAMMJJ`) ou
   * l'acte d'origine quand aucune consolidation française n'existe. Absent :
   * `document`.
   */
  version?: string;
  /** Date de la version consolidée rendue ; `null` quand l'acte d'origine est rendu. */
  date_consolidation?: string | null;
  /** Exclusions déclarées au manifeste, par exemple des considérants absents de la consolidation. */
  exclusions?: string[];
  /**
   * Échelonnement de l'application, quand `date_debut` ne dit que la date
   * générale : le manifeste le porte tel quel, jamais recopié article par article.
   */
  note_application?: string;
};

/**
 * `fragment` désigne un découpage de texte long, propre à la CNIL ; `clause`
 * l'annexe de 2021/914 ; `point` la partie opératoire numérotée d'une
 * recommandation et `annexe` une annexe entière d'un acte de l'économie des
 * données ou de l'espace européen des données de santé ; `proposition` et
 * `affaire` les unités de la préparation ; `notice` une unité qui ne porte que
 * des métadonnées — le corpus `metadonnees` ne connaît pas le contenu des
 * décisions qu'il cite.
 */
export type Niveau =
  | "article"
  | "considérant"
  | "fragment"
  | "clause"
  | "point"
  | "annexe"
  | "proposition"
  | "affaire"
  | "notice";

/** Origine d'un fragment CNIL : l'historique DINUM ou un incrément DILA. */
export type Origine = "dinum" | "dila";

/** L'acte reste le document ; la collection est le corpus. */
export type Unite = {
  ref: string;
  document: string;
  /** Nom du dossier de corpus sous `data/corpus/`, par exemple `rgpd`. */
  corpus: string;
  niveau: Niveau;
  numero: string;
  chemin: string;
  texte: string;
  date_acte: string;
  date_debut: string;
  date_fin: string | null;
  statut: string;
  url: string;
  /** Renseigné pour la CNIL seulement : d'où vient le découpage. */
  origine?: Origine;
  /** Renseigné pour la CNIL (sanction, avis, recommandation) et le Conseil constitutionnel (DC, QPC). */
  nature?: string;
  /** Renseigné pour la CADA seulement : administration qui a reçu la demande. */
  administration?: string;
  /** Renseigné pour la CADA seulement : sens de l'avis (favorable, défavorable, irrecevable…). */
  sens?: string;
  /** Renseigné pour la CNIL seulement : type de sanction du dispositif. */
  type_sanction?: string;
  /** Total des amendes en euros ; `null` si aucune ou si le montant est masqué. */
  montant?: number | null;
  /** Vrai si le dispositif prononce une injonction. */
  injonction?: boolean;
  /** Intitulé officiel : titre CELLAR (préparation) ou intitulé du document (`metadonnees`). */
  titre?: string;
  /** Renseigné pour la préparation seulement : dernière étape du dossier, `<type> — <date>`. */
  derniere_etape?: string;
  /** Renseigné pour la préparation seulement : décision attaquée, `<numéro> (<CELEX>)`. */
  decision_attaquee?: string;
  /** Renseigné pour la préparation seulement : affaire durant depuis plus que la présomption. */
  pendant_presume?: boolean;
  /** Autorité qui a rendu le document ; renseigné pour le corpus `metadonnees`. */
  autorite?: string;
  /**
   * Corpus `metadonnees` seulement : l'unité ne porte que des métadonnées, le
   * serveur ne connaît pas le contenu du document et le dit au rendu.
   */
  metadonnees_seulement?: true;
};

const ENTITES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  // HTML patrimonial des arrêts anciens de la CJUE : les accents y sont des
  // entités nominales, là où le XHTML moderne porte les caractères.
  aacute: "á",
  acirc: "â",
  agrave: "à",
  aelig: "æ",
  atilde: "ã",
  auml: "ä",
  ccedil: "ç",
  deg: "°",
  eacute: "é",
  ecirc: "ê",
  egrave: "è",
  hellip: "…",
  iacute: "í",
  icirc: "î",
  lrm: "\u200e",
  ntilde: "ñ",
  oacute: "ó",
  ocirc: "ô",
  ordm: "º",
  oslash: "ø",
  otilde: "õ",
  ouml: "ö",
  sect: "§",
  uacute: "ú",
  ucirc: "û",
  ugrave: "ù",
  uuml: "ü",
  yacute: "ý",
  Eacute: "É",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
};

/** Décode les entités nominales et numériques d'un fragment XHTML. */
export function decoderEntites(fragment: string): string {
  return fragment.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entier, code: string) => {
    if (code[0] === "#") {
      const hexadecimal = code[1] === "x" || code[1] === "X";
      const valeur = Number.parseInt(hexadecimal ? code.slice(2) : code.slice(1), hexadecimal ? 16 : 10);
      return Number.isFinite(valeur) ? String.fromCodePoint(valeur) : entier;
    }
    return ENTITES[code] ?? ENTITES[code.toLowerCase()] ?? entier;
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
    corpus: descripteur.corpus,
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
 *
 * `comptes: "considérants"` ne valide que le compte de considérants : la
 * capture est alors l'acte d'origine, dont les articles ne sont pas ceux du
 * corpus consolidé.
 */
export function parseCellar(
  xhtml: string,
  descripteur: Descripteur,
  comptes: "tous" | "considérants" = "tous",
): Unite[] {
  const releves = ancres(xhtml);
  const numerosArticles = new Set(
    releves.filter((ancre) => ancre.genre === "art").map((ancre) => Number(ancre.numero)),
  );
  const numerosConsiderants = new Set(
    releves.filter((ancre) => ancre.genre === "rct").map((ancre) => Number(ancre.numero)),
  );

  if (comptes === "tous") {
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

/** Vrai quand le CELEX récupéré est une version consolidée (secteur `0`). */
export function estConsolide(descripteur: Descripteur): boolean {
  return (descripteur.version ?? descripteur.document).startsWith("0");
}

/** Marqueurs de consolidation : ▼B, ▼M2, ►C1… ouvrent un passage, ◄ le ferme. */
function sansMarqueurs(texte: string): string {
  return texte
    .replace(/[►▼][A-Z]\d*/g, " ")
    .replace(/◄/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?»)\]])/g, "$1")
    .replace(/([«(\[])\s+/g, "$1")
    .trim();
}

/**
 * Texte visible d'un fragment consolidé, sans renvois de modification ; la
 * marque d'un passage supprimé (`—————`) reste.
 */
function texteConsolide(fragment: string): string {
  return sansMarqueurs(texteVisible(fragment));
}

/** `Article premier` → `1`, `Article 15 bis` → `15 bis` ; `null` si le titre n'est pas un article. */
export function numeroArticleConsolide(titre: string): string | null {
  const trouve = /^Article\s+(premier|1er|\d+)(?:\s+(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies))?$/i.exec(titre);
  if (trouve === null || trouve[1] === undefined) return null;
  const base = /^\d+$/.test(trouve[1]) ? String(Number(trouve[1])) : "1";
  return trouve[2] === undefined ? base : `${base} ${trouve[2].toLowerCase()}`;
}

/** URL EUR-Lex d'une version servie : une consolidation n'a pas d'ancre ELI. */
export function urlVersion(version: string): string {
  return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${version}`;
}

/**
 * Considérants du préambule d'une version consolidée : les lignes `(N)` du bloc
 * `preamble`. Une consolidation sans préambule n'en rend aucun.
 */
function considerantsConsolides(xhtml: string): Array<{ numero: string; texte: string }> {
  const considerants: Array<{ numero: string; texte: string }> = [];
  const debutPreambule = xhtml.indexOf('<div class="preamble">');
  if (debutPreambule < 0) return considerants;

  const finPreambule = xhtml.indexOf('<p class="title-article-norm">', debutPreambule);
  const bloc = xhtml.slice(debutPreambule, finPreambule < 0 ? undefined : finPreambule);
  const ligne =
    /<tr>\s*<td[^>]*>\s*<p class="norm">\((\d+)\)<\/p>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
  for (let trouve = ligne.exec(bloc); trouve !== null; trouve = ligne.exec(bloc)) {
    const [, numero, contenu] = trouve;
    if (numero === undefined || contenu === undefined) continue;
    const texte = texteConsolide(contenu);
    if (texte === "") throw new Error(`Considérant ${numero} vide`);
    considerants.push({ numero: String(Number(numero)), texte });
  }
  return considerants;
}

/**
 * Parcourt les articles d'une version consolidée et remet chacun à `visiter`
 * avec son chapitre courant. Le comptage et le parsing passent par ce même
 * parcours pour ne jamais diverger : un titre illisible ou un article en double
 * lève en nommant `libelle`.
 */
function parcourirArticlesConsolides(
  xhtml: string,
  libelle: string,
  visiter: (numero: string, texte: string, chapitre: { numero: string; titre: string } | null) => void,
): void {
  const fin = xhtml.search(/<[a-z]+ class="(?:separator-short|title-annex|doc-annex)/);
  const finArticles = fin < 0 ? xhtml.length : fin;
  const reperes: Array<{ genre: "article" | "division"; position: number }> = [];
  const motif = /<p class="(title-article-norm|title-division-1)(?=[">\s])/g;
  for (let trouve = motif.exec(xhtml); trouve !== null && trouve.index < finArticles; trouve = motif.exec(xhtml)) {
    reperes.push({ genre: trouve[1] === "title-article-norm" ? "article" : "division", position: trouve.index });
  }

  let chapitre: { numero: string; titre: string } | null = null;
  const vus = new Set<string>();
  for (const [index, repere] of reperes.entries()) {
    const limite = reperes[index + 1]?.position ?? finArticles;
    const segment = xhtml.slice(repere.position, limite);
    const finTitre = segment.indexOf("</p>");
    const titre = texteConsolide(segment.slice(0, finTitre + 4));
    if (repere.genre === "division") {
      const chapitreTrouve = /^CHAPITRE\s+([IVXLC]+)$/i.exec(titre);
      if (chapitreTrouve?.[1] !== undefined) {
        // Les consolidations récentes portent un `id` sur le sous-titre.
        const sousTitre = /<p class="title-division-2"[^>]*>([\s\S]*?)<\/p>/.exec(segment);
        chapitre = {
          numero: chapitreTrouve[1].toUpperCase(),
          titre: sousTitre?.[1] === undefined ? "" : texteConsolide(sousTitre[1]),
        };
      }
      continue;
    }
    const numero = numeroArticleConsolide(titre);
    if (numero === null) throw new Error(`Titre d'article illisible : « ${titre} »`);
    if (vus.has(numero)) throw new Error(`Article ${numero} en double dans ${libelle}`);
    vus.add(numero);
    visiter(numero, texteConsolide(segment), chapitre);
  }
}

/** Nombre d'articles d'une version consolidée, sans valider les comptes du descripteur. */
export function compterArticlesConsolide(xhtml: string, libelle = "la consolidation"): number {
  let total = 0;
  parcourirArticlesConsolides(xhtml, libelle, () => {
    total += 1;
  });
  return total;
}

/** Nombre de considérants du préambule d'une version consolidée ; zéro sans préambule. */
export function compterConsiderantsConsolide(xhtml: string): number {
  return considerantsConsolides(xhtml).length;
}

/**
 * Rend les articles et les considérants d'une version consolidée CELLAR. Ce
 * format n'a pas d'ancres ELI : un article commence à `title-article-norm`, un
 * chapitre à `title-division-1` (son titre suit en `title-division-2`), les
 * considérants sont les lignes `(N)` du préambule, et les articles s'arrêtent
 * aux notes (`separator-short`) ou à la première annexe. Les comptes du
 * descripteur font foi, comme pour `parseCellar` ; l'URL est celle de la
 * version servie, qui n'a pas de fragment.
 */
export function parseConsolide(xhtml: string, descripteur: Descripteur): Unite[] {
  const version = descripteur.version ?? descripteur.document;
  const url = urlVersion(version);
  const unites: Unite[] = [];

  for (const considerant of considerantsConsolides(xhtml)) {
    unites.push({
      ...uniteDe(
        descripteur,
        "considérant",
        considerant.numero,
        `${descripteur.nom} > Considérants`,
        considerant.texte,
      ),
      url,
    });
  }

  parcourirArticlesConsolides(xhtml, version, (numero, texte, chapitre) => {
    const chemin =
      chapitre === null
        ? descripteur.nom
        : [descripteur.nom, `Chapitre ${chapitre.numero}`, chapitre.titre].filter((element) => element !== "").join(" > ");
    unites.push({
      ...uniteDe(descripteur, "article", numero.replace(" ", ""), chemin, texte),
      numero,
      url,
    });
  });

  const articles = unites.filter((unite) => unite.niveau === "article").length;
  const considerants = unites.length - articles;
  if (articles !== descripteur.articles_attendus) {
    throw new Error(
      `Capture ${version} : ${articles} articles au lieu de ${descripteur.articles_attendus} attendus`,
    );
  }
  if (considerants !== descripteur.considerants_attendus) {
    throw new Error(
      `Capture ${version} : ${considerants} considérants au lieu de ${descripteur.considerants_attendus} attendus`,
    );
  }
  return unites;
}

/** Enveloppe historique : le RGPD se parse comme tout acte CELLAR. */
export function parseRgpd(xhtml: string, descripteur: Descripteur): Unite[] {
  return parseCellar(xhtml, descripteur);
}

/**
 * Valide un corpus avant écriture : référence unique et non vide, texte non
 * vide, document et corpus nommés, date ISO. Le nom du corpus est dans le
 * message pour qu'une capture fautive se nomme elle-même.
 */
export function validerUnitesCorpus(unites: readonly Unite[], nomCorpus: string): void {
  const erreurs: string[] = [];
  const vues = new Set<string>();
  for (const unite of unites) {
    if (unite.ref.trim() === "") {
      erreurs.push("référence vide");
      continue;
    }
    if (vues.has(unite.ref)) erreurs.push(`référence dupliquée : ${unite.ref}`);
    vues.add(unite.ref);
    if (unite.texte.trim() === "") erreurs.push(`texte vide : ${unite.ref}`);
    if (unite.document.trim() === "") erreurs.push(`document vide : ${unite.ref}`);
    if (unite.corpus.trim() === "") erreurs.push(`corpus vide : ${unite.ref}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(unite.date_acte) || Number.isNaN(Date.parse(unite.date_acte))) {
      erreurs.push(`date non ISO : ${unite.ref} (${unite.date_acte || "vide"})`);
    }
  }
  if (erreurs.length > 0) {
    const liste = erreurs.slice(0, 10).join(" ; ");
    const reste = erreurs.length > 10 ? ` ; et ${erreurs.length - 10} autre(s)` : "";
    throw new Error(`Corpus ${nomCorpus} invalide, rien n'est écrit : ${liste}${reste}`);
  }
}
