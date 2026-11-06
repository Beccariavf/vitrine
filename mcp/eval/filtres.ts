/**
 * Pilot de mesure du filtrage par métadonnées CNIL.
 *
 * Chaque cas vise une décision précise et porte une question qui nomme la
 * métadonnée (date, type, montant). On mesure le rang du document attendu deux
 * fois : sans filtre, puis avec. Ce n'est pas un jeu tenu à l'écart : c'est un
 * pilote de douze cas, écrit pour vérifier que le filtre apporte ce qu'il promet.
 */

import { pathToFileURL } from "node:url";
import { createOllamaEmbedder } from "../embed/embedder.ts";
import { search } from "../tools.ts";
import type { SearchDemande } from "../tools.ts";

type Cas = {
  nom: string;
  question: string;
  attendu: string;
  filtres: Omit<SearchDemande, "question" | "corpus" | "k">;
};

export const CAS: Cas[] = [
  {
    nom: "cookies 2025",
    question: "Quelle sanction pour des cookies en 2025 ?",
    attendu: "CNILTEXT000052851847",
    filtres: { date_min: "2025-01-01", date_max: "2025-12-31", type_sanction: "amende" },
  },
  {
    nom: "amende 27 M€",
    question: "Quelle amende de 27 millions d'euros ?",
    attendu: "CNILTEXT000053352594",
    filtres: { montant_min: 27_000_000, montant_max: 27_000_000 },
  },
  {
    nom: "hôpital 2026",
    question: "Quelle sanction en 2026 contre un hôpital ?",
    attendu: "CNILTEXT000054790100",
    filtres: { date_min: "2026-01-01", date_max: "2026-12-31", type_sanction: "amende" },
  },
  {
    nom: "avertissement",
    question: "Quelle décision a prononcé un avertissement ?",
    attendu: "CNILTEXT000030324201",
    filtres: { type_sanction: "avertissement" },
  },
  {
    nom: "50 M€ en 2024",
    question: "Quelle amende de 50 millions d'euros en 2024 ?",
    attendu: "CNILTEXT000050760620",
    filtres: {
      date_min: "2024-01-01",
      date_max: "2024-12-31",
      montant_min: 50_000_000,
      montant_max: 50_000_000,
    },
  },
  {
    nom: "syndicat 2013",
    question: "Quelle sanction en 2013 pour un syndicat de copropriétaires ?",
    attendu: "CNILTEXT000026971936",
    filtres: { date_min: "2013-01-01", date_max: "2013-12-31" },
  },
  {
    nom: "amende 325 M€",
    question: "Quelle amende de 325 millions d'euros ?",
    attendu: "CNILTEXT000052182222",
    filtres: { montant_min: 325_000_000, montant_max: 325_000_000 },
  },
  {
    nom: "liquidation 2023",
    question: "Quelle décision de liquidation d'astreinte en 2023 ?",
    attendu: "CNILTEXT000047527412",
    filtres: { date_min: "2023-01-01", date_max: "2023-12-31", type_sanction: "liquidation" },
  },
  {
    nom: "repas 2020",
    question: "Quelle sanction en 2020 pour un service de livraison de repas ?",
    attendu: "CNILTEXT000042848036",
    filtres: { date_min: "2020-01-01", date_max: "2020-12-31" },
  },
  {
    nom: "rappel 2023",
    question: "Quelle décision a prononcé un rappel à l'ordre en 2023 ?",
    attendu: "CNILTEXT000049059221",
    filtres: { date_min: "2023-01-01", date_max: "2023-12-31", type_sanction: "rappel" },
  },
  {
    nom: "1,5 M€ en 2025",
    question: "Quelle amende de 1 500 000 euros en 2025 ?",
    attendu: "CNILTEXT000052981827",
    filtres: {
      date_min: "2025-01-01",
      date_max: "2025-12-31",
      montant_min: 1_500_000,
      montant_max: 1_500_000,
    },
  },
  {
    nom: "association 2014",
    question: "Quelle sanction en 2014 pour une association d'urbanistes ?",
    attendu: "CNILTEXT000028711033",
    filtres: { date_min: "2014-01-01", date_max: "2014-12-31" },
  },
];

/** Rang du document attendu dans les cinq passages, `0` s'il est absent. */
export function rang(passages: { document: string }[], attendu: string): number {
  return passages.findIndex((passage) => passage.document === attendu) + 1;
}

export async function mesurerCas(
  cas: Cas,
  embedder: ReturnType<typeof createOllamaEmbedder>,
): Promise<{ sans: number; avec: number }> {
  const sans = await search(
    process.cwd(),
    { question: cas.question, k: 5, corpus: "cnil" },
    { embedder, seuils: { bas: -1, haut: 2, marge: 0 } },
  );
  const avec = await search(
    process.cwd(),
    { question: cas.question, k: 5, corpus: "cnil", ...cas.filtres },
    { embedder, seuils: { bas: -1, haut: 2, marge: 0 } },
  );
  return {
    sans: rang(sans.passages, cas.attendu),
    avec: rang(avec.passages, cas.attendu),
  };
}

async function main(): Promise<void> {
  const embedder = createOllamaEmbedder();
  const lignes: string[] = [];
  let sans = 0;
  let avec = 0;
  for (const cas of CAS) {
    const mesure = await mesurerCas(cas, embedder);
    sans += mesure.sans === 0 ? 0 : 1;
    avec += mesure.avec === 0 ? 0 : 1;
    lignes.push(
      `${cas.nom}\tsans=${mesure.sans === 0 ? "absent" : mesure.sans}\t` +
        `avec=${mesure.avec === 0 ? "absent" : mesure.avec}`,
    );
  }
  process.stdout.write(
    `filtres CNIL : ${CAS.length} cas\n` +
      `top 5 sans filtre : ${sans}/${CAS.length}\n` +
      `top 5 avec filtre : ${avec}/${CAS.length}\n\n` +
      `${lignes.join("\n")}\n`,
  );
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(entre).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
