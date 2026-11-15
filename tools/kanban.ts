/**
 * Suivi des tickets dans le tableau Kanban « Vitrine — tickets ».
 *
 * Le tableau est un projet GitHub (v2) du compte `Beccariavf`. Rien n'est figé
 * ici sauf les noms : le projet, ses champs et ses options sont résolus à
 * l'exécution, et un nom absent est dit avec la liste des noms disponibles.
 *
 * `gh` n'est appelé qu'après validation des arguments, et la fonction
 * d'exécution est injectable : les tests n'ont pas besoin du réseau.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Propriétaire du projet. */
export const OWNER = "Beccariavf";

/** Dépôt dont les issues sont suivies. */
export const DEPOT = "Beccariavf/vitrine";

/** Titre exact du projet qui porte le tableau. */
export const TITRE_PROJET = "Vitrine — tickets";

/** Champ simple sélection qui porte l'avancement. */
export const CHAMP_STATUT = "Status";

/** Champ nombre qui compte les reprises à la relecture. */
export const CHAMP_REPRISES = "Reprises";

export const USAGE = [
  "Usage : npm run kanban -- <issue> [statut] [--reprises <n>]",
  "",
  `  <issue>          numéro d'issue de ${DEPOT} (entier > 0)`,
  "  <statut>         nom d'une option du champ Status ; accents, casse, espaces",
  "                   et tirets indifférents (« en-revue » = « En revue »)",
  "  --reprises <n>   entier >= 0 écrit dans le champ Reprises",
  "",
  "Au moins le statut ou --reprises est requis.",
].join("\n");

/** Ce que la ligne de commande demande, une fois validé. */
export type ArgumentsKanban = {
  issue: number;
  /** Nom d'option tel que saisi ; `null` quand seul `--reprises` est donné. */
  statut: string | null;
  /** Nombre de reprises ; `null` quand seul le statut est demandé. */
  reprises: number | null;
};

/** Un champ simple sélection du projet et ses options. */
export type OptionStatut = { id: string; name: string };

/** Un champ du projet, avec ses options quand il est simple sélection. */
export type ChampProjet = { id: string; name: string; options: readonly OptionStatut[] };

/** Un projet GitHub (v2) tel que `gh project list` le rend. */
export type ProjetGh = { id: string; numero: number; titre: string };

/** Exécute `gh` et rend sa sortie standard. Injectable pour les tests. */
export type Executeur = (args: readonly string[]) => string;

/** Ce qui a été écrit, dans les noms du projet et non ceux de la saisie. */
export type ResultatKanban = { issue: number; statut: string | null; reprises: number | null };

/** Entier en base dix, sans signe ni espace ; `null` sinon. */
function entier(texte: string): number | null {
  if (!/^\d+$/.test(texte)) return null;
  const valeur = Number(texte);
  return Number.isSafeInteger(valeur) ? valeur : null;
}

/**
 * Valide la ligne de commande. Toute erreur porte l'usage : rien n'est appelé
 * quand elle lève.
 */
export function analyserArguments(argv: readonly string[]): ArgumentsKanban {
  const positions: string[] = [];
  let reprises: number | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (argument === "--reprises") {
      if (reprises !== null) throw new Error(`--reprises donné deux fois.\n${USAGE}`);
      const valeur = entier(argv[index + 1] ?? "");
      if (valeur === null) {
        throw new Error(`--reprises attend un entier supérieur ou égal à 0.\n${USAGE}`);
      }
      reprises = valeur;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`Option inconnue « ${argument} ».\n${USAGE}`);
    positions.push(argument);
  }

  const [numeroIssue, statut, ...reste] = positions;
  if (numeroIssue === undefined) throw new Error(`Numéro d'issue manquant.\n${USAGE}`);
  const issue = entier(numeroIssue);
  if (issue === null || issue === 0) {
    throw new Error(`Numéro d'issue attendu (entier > 0) ; reçu « ${numeroIssue} ».\n${USAGE}`);
  }
  const enTrop = reste[0];
  if (enTrop !== undefined) {
    throw new Error(`Argument en trop « ${enTrop} » : une issue, un statut, --reprises.\n${USAGE}`);
  }
  if (statut !== undefined && statut.trim() === "") throw new Error(`Statut vide.\n${USAGE}`);
  if (statut === undefined && reprises === null) {
    throw new Error(`Indiquer un statut ou --reprises.\n${USAGE}`);
  }
  return { issue, statut: statut ?? null, reprises };
}

/** Nom ramené à sa forme comparable : sans accent ni casse, séparateurs unifiés. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .trim();
}

function lister(noms: readonly string[]): string {
  return noms.length === 0 ? "aucun" : noms.join(", ");
}

/** Options d'un champ, dans l'ordre où le projet les rend. */
export function resoudreOption(demande: string, options: readonly OptionStatut[]): OptionStatut {
  const cherche = normaliserNom(demande);
  const trouvee = options.find((option) => normaliserNom(option.name) === cherche);
  if (trouvee !== undefined) return trouvee;
  throw new Error(
    `Option « ${demande} » introuvable dans le champ ${CHAMP_STATUT} ; ` +
      `options disponibles : ${lister(options.map((option) => option.name))}.`,
  );
}

/** Champ du projet portant ce nom. */
export function trouverChamp(nom: string, champs: readonly ChampProjet[]): ChampProjet {
  const cherche = normaliserNom(nom);
  const champ = champs.find((element) => normaliserNom(element.name) === cherche);
  if (champ !== undefined) return champ;
  throw new Error(
    `Champ « ${nom} » introuvable dans le projet ${TITRE_PROJET} ; ` +
      `champs disponibles : ${lister(champs.map((element) => element.name))}.`,
  );
}

/** URL de l'issue suivie ; c'est elle que `item-add` attend. */
export function urlIssue(issue: number): string {
  return `https://github.com/${DEPOT}/issues/${issue}`;
}

export function argsListeProjets(): string[] {
  return ["project", "list", "--owner", OWNER, "--format", "json"];
}

export function argsAjoutItem(numeroProjet: number, issue: number): string[] {
  return [
    "project",
    "item-add",
    String(numeroProjet),
    "--owner",
    OWNER,
    "--url",
    urlIssue(issue),
    "--format",
    "json",
  ];
}

export function argsListeChamps(numeroProjet: number): string[] {
  return ["project", "field-list", String(numeroProjet), "--owner", OWNER, "--format", "json"];
}

/** Ce qui désigne l'élément et le champ à écrire : les identifiants du projet. */
export type ClesEdition = { projet: string; item: string; champ: string };

function argsEdition(cles: ClesEdition): string[] {
  return [
    "project",
    "item-edit",
    "--id",
    cles.item,
    "--project-id",
    cles.projet,
    "--field-id",
    cles.champ,
  ];
}

export function argsEditionStatut(cles: ClesEdition, optionId: string): string[] {
  return [...argsEdition(cles), "--single-select-option-id", optionId];
}

export function argsEditionReprises(cles: ClesEdition, reprises: number): string[] {
  return [...argsEdition(cles), "--number", String(reprises)];
}

/** Exécute `gh` ; l'échec garde la première ligne d'erreur, seule décisive. */
export function executerGh(args: readonly string[]): string {
  try {
    return execFileSync("gh", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const cause = error as { stderr?: unknown; message?: unknown };
    const brut = typeof cause.stderr === "string" ? cause.stderr : String(cause.message ?? "");
    const premiere = brut.split("\n").find((ligne) => ligne.trim() !== "")?.trim() ?? "";
    throw new Error(
      `gh ${args.slice(0, 3).join(" ")} a échoué${premiere === "" ? "" : ` : ${premiere}`}`,
    );
  }
}

function lireJson(texte: string, quoi: string): Record<string, unknown> {
  let valeur: unknown;
  try {
    valeur = JSON.parse(texte);
  } catch {
    throw new Error(`Sortie de gh illisible pour ${quoi} : JSON attendu.`);
  }
  if (typeof valeur !== "object" || valeur === null) {
    throw new Error(`Sortie de gh illisible pour ${quoi} : objet attendu.`);
  }
  return valeur as Record<string, unknown>;
}

function listeDe(valeur: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(
    (element): element is Record<string, unknown> => typeof element === "object" && element !== null,
  );
}

function lireProjets(sortie: Record<string, unknown>): ProjetGh[] {
  return listeDe(sortie.projects).flatMap((projet) => {
    const { id, number, title } = projet;
    return typeof id === "string" && typeof number === "number" && typeof title === "string"
      ? [{ id, numero: number, titre: title }]
      : [];
  });
}

function lireChamps(sortie: Record<string, unknown>): ChampProjet[] {
  return listeDe(sortie.fields).flatMap((champ) => {
    const { id, name } = champ;
    if (typeof id !== "string" || typeof name !== "string") return [];
    const options = listeDe(champ.options).flatMap((option) => {
      const { id: idOption, name: nomOption } = option;
      return typeof idOption === "string" && typeof nomOption === "string"
        ? [{ id: idOption, name: nomOption }]
        : [];
    });
    return [{ id, name, options }];
  });
}

/**
 * Écrit le statut et les reprises. Tout est résolu avant la première écriture :
 * un champ ou une option absente laisse le tableau intact.
 */
export function mettreAJour(
  demande: ArgumentsKanban,
  executer: Executeur = executerGh,
): ResultatKanban {
  const projets = lireProjets(lireJson(executer(argsListeProjets()), "la liste des projets"));
  const cherche = normaliserNom(TITRE_PROJET);
  const projet = projets.find((element) => normaliserNom(element.titre) === cherche);
  if (projet === undefined) {
    throw new Error(
      `Projet « ${TITRE_PROJET} » introuvable pour ${OWNER} ; ` +
        `projets disponibles : ${lister(projets.map((element) => element.titre))}.`,
    );
  }

  // `item-add` rend l'élément existant quand l'issue est déjà au tableau : son
  // identifiant sert aux deux écritures, sans passer par `item-list`.
  const item = lireJson(
    executer(argsAjoutItem(projet.numero, demande.issue)),
    "l'élément ajouté au projet",
  );
  const idItem = item.id;
  if (typeof idItem !== "string" || idItem === "") {
    throw new Error("Élément du projet rendu sans identifiant par gh.");
  }

  const champs = lireChamps(lireJson(executer(argsListeChamps(projet.numero)), "la liste des champs"));
  let statut: { champ: ChampProjet; option: OptionStatut } | null = null;
  if (demande.statut !== null) {
    const champ = trouverChamp(CHAMP_STATUT, champs);
    statut = { champ, option: resoudreOption(demande.statut, champ.options) };
  }
  const champReprises = demande.reprises === null ? null : trouverChamp(CHAMP_REPRISES, champs);

  // Une issue non brouillon n'accepte qu'un champ par appel : deux écritures.
  if (statut !== null) {
    executer(
      argsEditionStatut(
        { projet: projet.id, item: idItem, champ: statut.champ.id },
        statut.option.id,
      ),
    );
  }
  if (champReprises !== null && demande.reprises !== null) {
    executer(
      argsEditionReprises(
        { projet: projet.id, item: idItem, champ: champReprises.id },
        demande.reprises,
      ),
    );
  }

  return {
    issue: demande.issue,
    statut: statut === null ? null : statut.option.name,
    reprises: demande.reprises,
  };
}

/** Lignes rendues : le statut écrit, puis les reprises. */
export function resumer(resultat: ResultatKanban): string[] {
  const lignes: string[] = [];
  if (resultat.statut !== null) lignes.push(`#${resultat.issue} → ${resultat.statut}`);
  if (resultat.reprises !== null) lignes.push(`reprises = ${resultat.reprises}`);
  return lignes;
}

async function main(argv: readonly string[]): Promise<void> {
  const resultat = mettreAJour(analyserArguments(argv));
  for (const ligne of resumer(resultat)) process.stdout.write(`${ligne}\n`);
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(resolve(entre)).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
