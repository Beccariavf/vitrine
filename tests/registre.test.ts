import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { CONSIGNE_SERVEUR } from "../mcp/server.ts";
import {
  CORPUS,
  NOMBRE_CORPUS,
  NOMS_CORPUS,
  PERIMETRE,
  nombreEnLettres,
} from "../mcp/corpus/registre.ts";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const DESCRIPTION_ATTENDUE = readFileSync(
  join(RACINE, "tests", "fixtures", "description-serveur.txt"),
  "utf8",
);
const SCRIPTS = (
  JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

describe("registre des corpus", () => {
  it("déclare chaque corpus une seule fois, avec ses propriétés obligatoires", () => {
    assert.equal(NOMS_CORPUS.length, CORPUS.length);
    assert.equal(new Set(NOMS_CORPUS).size, NOMS_CORPUS.length);
    for (const corpus of CORPUS) {
      assert.ok(corpus.libelle !== "", `${corpus.nom} : libellé`);
      assert.ok(corpus.gouvernance.length > 0, `${corpus.nom} : champ de gouvernance`);
      assert.ok(corpus.commandeSync.startsWith("npm run "), `${corpus.nom} : commande`);
      assert.ok(corpus.descriptionServeur !== "", `${corpus.nom} : description serveur`);
      assert.ok(corpus.descriptionProvenance !== "", `${corpus.nom} : description provenance`);
    }
    assert.equal(NOMBRE_CORPUS, 22);
  });

  it("garde la description du serveur identique à celle d'avant le registre", () => {
    assert.equal(CONSIGNE_SERVEUR, DESCRIPTION_ATTENDUE);
  });

  it("nomme une commande de synchronisation qui existe dans package.json", () => {
    for (const corpus of CORPUS) {
      const commande = /^npm run ([^\s]+)(.*)$/.exec(corpus.commandeSync);
      assert.ok(commande !== null, `${corpus.nom} : commande illisible « ${corpus.commandeSync} »`);
      const [, script, reste] = commande;
      assert.ok(SCRIPTS[script!] !== undefined, `${corpus.nom} : script absent « ${script} »`);
      if (script === "corpus:build") {
        const document = /-- --document ([a-z_]+)$/.exec(reste ?? "")?.[1];
        assert.equal(document, corpus.nom, `${corpus.nom} : --document`);
      }
    }
  });

  it("compte les corpus en toutes lettres, sans nombre en dur", () => {
    assert.equal(nombreEnLettres(NOMBRE_CORPUS), "vingt-deux");
    assert.equal(nombreEnLettres(0), "zéro");
    assert.equal(nombreEnLettres(1), "un");
    assert.equal(nombreEnLettres(21), "vingt et un");
    assert.equal(nombreEnLettres(71), "soixante et onze");
    assert.equal(nombreEnLettres(80), "quatre-vingts");
    assert.equal(nombreEnLettres(99), "quatre-vingt-dix-neuf");
    assert.ok(CONSIGNE_SERVEUR.includes(`sur ${nombreEnLettres(NOMBRE_CORPUS)} corpus juridiques`));
    assert.throws(() => nombreEnLettres(100), /hors bornes/);
    assert.throws(() => nombreEnLettres(-1), /hors bornes/);
  });

  it("garde la phrase de périmètre des refus", () => {
    assert.equal(
      PERIMETRE,
      "RGPD, AI Act, ePrivacy, directive 2016/680, règlement 2018/1725, règlement procédural RGPD, " +
        "clauses contractuelles types, décisions d'adéquation, textes UE de l'économie des données, " +
        "espace européen des données de santé (EHDS), LIL, textes français d'application, " +
        "textes en préparation et affaires pendantes, CNIL, CADA, doctrine CNIL, CEPD, Conseil d'État, " +
        "Conseil constitutionnel, Cour de cassation, CJUE",
    );
  });
});

/**
 * Un tableau ou une ligne qui n'énumère que des noms de corpus, au moins trois,
 * est une liste recopiée : elle doit vivre dans `mcp/corpus/registre.ts`. Les
 * fichiers exemptés sont nommés, pas devinés.
 */
const EXEMPTS = new Map([
  [
    "mcp/corpus/parse.ts",
    "sélecteur de parseur : ccs, donnees et sante_ue y nomment la valeur de `parseur` qui lit le document, pas une liste de corpus",
  ],
]);

const NOMS = new Set<string>(NOMS_CORPUS);
const EXTENSIONS = [".ts", ".astro"];

function fichiersSource(dossier: string): string[] {
  const chemins: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name === "node_modules" || entree.name.startsWith(".")) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      chemins.push(...fichiersSource(chemin));
    } else if (EXTENSIONS.some((extension) => entree.name.endsWith(extension))) {
      chemins.push(chemin);
    }
  }
  return chemins;
}

/** Littéraux de chaîne d'un fragment de code, dans l'ordre du texte. */
function litteraux(texte: string): string[] {
  return [...texte.matchAll(/["'`]([a-z_]+)["'`]/g)].map((trouve) => trouve[1] ?? "");
}

/** Vrai quand le fragment n'énumère que des noms de corpus, au moins trois. */
function estListeDeCorpus(texte: string): boolean {
  const trouves = litteraux(texte);
  if (trouves.length < 3) return false;
  const noms = new Set(trouves);
  return noms.size >= 3 && [...noms].every((nom) => NOMS.has(nom));
}

/** Corps des littéraux de tableau `[...]`, y compris sur plusieurs lignes. */
function tableaux(texte: string): string[] {
  const corps: string[] = [];
  for (let index = 0; index < texte.length; index += 1) {
    if (texte[index] !== "[") continue;
    let profondeur = 0;
    let fin = index;
    for (; fin < texte.length; fin += 1) {
      if (texte[fin] === "[") profondeur += 1;
      else if (texte[fin] === "]") {
        profondeur -= 1;
        if (profondeur === 0) break;
      }
    }
    corps.push(texte.slice(index + 1, fin));
    index = fin;
  }
  return corps;
}

describe("aucune liste de corpus hors du registre", () => {
  it("ne trouve ni tableau ni ligne qui énumère des noms de corpus", () => {
    const fautes: string[] = [];
    for (const racine of ["mcp", "veille", "src"]) {
      for (const chemin of fichiersSource(join(RACINE, racine))) {
        const relatif = relative(RACINE, chemin).split("\\").join("/");
        if (relatif === "mcp/corpus/registre.ts" || EXEMPTS.has(relatif)) continue;
        const texte = readFileSync(chemin, "utf8");
        for (const corps of tableaux(texte)) {
          if (estListeDeCorpus(corps)) {
            fautes.push(`${relatif} : tableau [${corps.trim().slice(0, 80)}…]`);
          }
        }
        texte.split("\n").forEach((ligne, index) => {
          if (estListeDeCorpus(ligne)) {
            fautes.push(`${relatif}:${index + 1} : ${ligne.trim().slice(0, 120)}`);
          }
        });
      }
    }
    assert.deepEqual(fautes, [], `listes de corpus à déplacer dans le registre :\n${fautes.join("\n")}`);
  });

  it("garde les exemptions courtes et justifiées", () => {
    assert.ok(EXEMPTS.size <= 2, "une exemption silencieuse n'est pas une exemption");
    for (const justification of EXEMPTS.values()) assert.ok(justification.length > 20);
  });
});
