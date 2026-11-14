/**
 * Découpe l'annexe de la décision 2021/914 (clauses contractuelles types) en
 * unités citables. Le corps de la décision se parse comme tout acte CELLAR ;
 * l'annexe n'a pas d'ancres ELI : chaque clause commence à un titre
 * `oj-ti-grseq-1` (« Clause 8 », « 8.1. Instructions »), et les variantes
 * propres à un module sont ouvertes par un titre `MODULE N`.
 *
 * Une clause sans variante de module donne une unité. Une clause déclinée par
 * module donne une unité par module : `numero` reste la clause, le texte et le
 * chemin portent le module, et la ref ajoute `_mN` pour rester unique.
 */

import { contenuDiv, parseCellar, texteVisible } from "../parse.ts";
import type { Descripteur, Unite } from "../parse.ts";

type GenreTitre = "clause" | "module" | "sousclause" | "autre";

type Titre = {
  genre: GenreTitre;
  position: number;
  fin: number;
  texte: string;
  numero: string | null;
  module: number | null;
};

const TITRE = /<p\b[^>]*class="oj-ti-grseq-1"[^>]*>([\s\S]*?)<\/p>/g;

/** Titres de l'annexe, dans l'ordre du document. */
function titres(annexe: string): Titre[] {
  const trouves: Titre[] = [];
  for (let trouve = TITRE.exec(annexe); trouve !== null; trouve = TITRE.exec(annexe)) {
    const texte = texteVisible(trouve[1] ?? "");
    const position = trouve.index;
    const fin = position + trouve[0].length;
    const module = /^MODULE\s+([1-4])\b/i.exec(texte);
    if (module?.[1] !== undefined) {
      trouves.push({ genre: "module", position, fin, texte, numero: null, module: Number(module[1]) });
      continue;
    }
    const clause = /^Clause\s+(\d+)\b/i.exec(texte);
    if (clause?.[1] !== undefined) {
      trouves.push({ genre: "clause", position, fin, texte, numero: String(Number(clause[1])), module: null });
      continue;
    }
    const sousclause = /^(\d+)\.(\d+)\./.exec(texte);
    if (sousclause?.[1] !== undefined && sousclause[2] !== undefined) {
      trouves.push({
        genre: "sousclause",
        position,
        fin,
        texte,
        numero: `${Number(sousclause[1])}.${Number(sousclause[2])}`,
        module: null,
      });
      continue;
    }
    trouves.push({ genre: "autre", position, fin, texte, numero: null, module: null });
  }
  return trouves;
}

function uniteClause(
  descripteur: Descripteur,
  numero: string,
  module: number | null,
  texte: string,
): Unite {
  const chemin = [
    descripteur.nom,
    "Annexe",
    "Clauses contractuelles types",
    `Clause ${numero}${module === null ? "" : `, module ${module}`}`,
  ].join(" > ");  return {
    ref: `${descripteur.document}#clause_${numero}${module === null ? "" : `_m${module}`}`,
    document: descripteur.document,
    corpus: descripteur.corpus,
    niveau: "clause",
    numero,
    chemin,
    texte,
    date_acte: descripteur.date_acte,
    date_debut: descripteur.date_debut,
    date_fin: descripteur.date_fin,
    statut: descripteur.statut,
    url: descripteur.url,
  };
}

/**
 * Rend les articles et considérants de la décision, puis une unité par clause
 * de l'annexe (une par module quand la clause est déclinée). Les comptes
 * attendus du descripteur font foi, comme pour `parseCellar` : une capture
 * incomplète lève avant toute écriture.
 */
export function parseCcs(xhtml: string, descripteur: Descripteur): Unite[] {
  const unites = parseCellar(xhtml, descripteur);
  const annexe = contenuDiv(xhtml, "anx_1");
  if (annexe === null) {
    throw new Error(`Capture ${descripteur.document} incomplète : annexe anx_1 absente`);
  }

  const reperes = titres(annexe);
  const clauses = reperes.filter((titre) => titre.genre === "clause");
  if (clauses.length === 0) {
    throw new Error(`Capture ${descripteur.document} incomplète : aucune clause dans l'annexe`);
  }

  const unitesClauses: Unite[] = [];
  for (const [index, clause] of clauses.entries()) {
    const finClause = clauses[index + 1]?.position ?? annexe.length;
    const modules = reperes.filter(
      (titre) => titre.genre === "module" && titre.position >= clause.fin && titre.position < finClause,
    );
    const sousclauses = reperes.filter(
      (titre) => titre.genre === "sousclause" && titre.position >= clause.fin && titre.position < finClause,
    );
    const numero = clause.numero ?? "";

    if (modules.length === 0) {
      if (sousclauses.length === 0) {
        unitesClauses.push(
          uniteClause(descripteur, numero, null, texteVisible(annexe.slice(clause.position, finClause))),
        );
        continue;
      }
      for (const [rang, sous] of sousclauses.entries()) {
        const fin = sousclauses[rang + 1]?.position ?? finClause;
        unitesClauses.push(
          uniteClause(descripteur, sous.numero ?? "", null, texteVisible(annexe.slice(sous.position, fin))),
        );
      }
      continue;
    }

    for (const [rang, module] of modules.entries()) {
      const finModule = modules[rang + 1]?.position ?? finClause;
      const dansModule = sousclauses.filter(
        (titre) => titre.position >= module.fin && titre.position < finModule,
      );
      if (dansModule.length === 0) {
        unitesClauses.push(
          uniteClause(
            descripteur,
            numero,
            module.module,
            texteVisible(annexe.slice(module.position, finModule)),
          ),
        );
        continue;
      }
      for (const [rangSous, sous] of dansModule.entries()) {
        const fin = dansModule[rangSous + 1]?.position ?? finModule;
        const texte = `${module.texte} ${texteVisible(annexe.slice(sous.position, fin))}`.trim();
        unitesClauses.push(uniteClause(descripteur, sous.numero ?? "", module.module, texte));
      }
    }
  }

  const clausesAttendues = descripteur.clauses_attendues ?? 0;
  if (unitesClauses.length !== clausesAttendues) {
    throw new Error(
      `Capture ${descripteur.document} : ${unitesClauses.length} clauses au lieu de ` +
        `${clausesAttendues} attendues`,
    );
  }
  return [...unites, ...unitesClauses];
}
