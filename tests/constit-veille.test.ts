import { strict as assert } from "node:assert";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { FetchTexte } from "../mcp/corpus/dila.ts";
import type { FetchFlux, ReponseFlux } from "../mcp/corpus/tar.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import {
  RETARD_MAX_JOURS,
  entreeDeDecision,
  identifiant,
  passeConstit,
  rapportDeRetard,
} from "../veille/sources/constit.ts";
import { urlOfficielleConstit } from "../mcp/corpus/constit/parse.ts";
import { writeEntries } from "../veille/write.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/constit/constit.tar.gz", import.meta.url));
const ARCHIVE = "Freemium_constit_global_20261115-140000.tar.gz";
const ANCIENNE = "Freemium_constit_global_20261108-140000.tar.gz";

/** Dernière décision de la fixture, toutes natures confondues. */
const DERNIERE = "2010-07-22";

function racine(): string {
  return mkdtempSync(join(tmpdir(), "constit-veille-"));
}

/** La liste OPENDATA en HTML, avec l'archive demandée. */
function listeFetch(nom: string): FetchTexte {
  return async () => ({
    ok: true,
    status: 200,
    text: async () =>
      [
        `<a href="DILA_CONSTIT_Presentation_20170824.pdf">fiche</a>`,
        `<a href="${ANCIENNE}">ancienne</a>`,
        `<a href="${nom}">dernière</a>`,
      ].join(""),
  });
}

/** L'archive de la fixture, servie en flux une fois par passe. */
function archiveFetch(): FetchFlux {
  return async () => ({
    ok: true,
    status: 200,
    body: Readable.toWeb(createReadStream(FIXTURE)) as ReponseFlux["body"],
  });
}

function manifeste(root: string, archive: string, derniere = DERNIERE): void {
  mkdirSync(join(root, "data", "corpus", "constit"), { recursive: true });
  writeFileSync(
    join(root, "data", "corpus", "constit", "manifest.json"),
    `${JSON.stringify({ archive, couverture: { archive: { derniere_decision: derniere } } }, null, 2)}\n`,
    "utf8",
  );
}

function unite(document: string): Unite {
  return {
    ref: `${document}#f0`,
    document,
    corpus: "constit",
    niveau: "fragment",
    numero: "2010-25 QPC",
    chemin: "Conseil constitutionnel > Décision 2010-25 QPC",
    texte: "Considérant que la vie privée est garantie.",
    date_acte: "2010-07-22",
    date_debut: "2010-07-22",
    date_fin: null,
    statut: "Décision QPC",
    url: "https://www.conseil-constitutionnel.fr/decision/2010/201025QPC.htm",
    nature: "QPC",
  };
}

function corpus(root: string, documents: string[]): void {
  mkdirSync(join(root, "data", "corpus", "constit"), { recursive: true });
  writeFileSync(
    join(root, "data", "corpus", "constit", "unites.jsonl"),
    `${documents.map((document) => JSON.stringify(unite(document))).join("\n")}\n`,
    "utf8",
  );
}

describe("la veille du Conseil constitutionnel", () => {
  it("ne retélécharge pas une archive déjà lue par le corpus", async () => {
    const root = racine();
    try {
      manifeste(root, ARCHIVE);
      let telechargements = 0;
      const flux: FetchFlux = async () => {
        telechargements += 1;
        throw new Error("aucun téléchargement attendu");
      };

      const resultat = await passeConstit({
        rootDir: root,
        fetchImpl: listeFetch(ARCHIVE),
        fetchFlux: flux,
        maintenant: new Date("2010-08-20T12:00:00.000Z"),
      });

      assert.equal(telechargements, 0);
      assert.deepEqual(resultat.entries, []);
      assert.deepEqual(resultat.warnings, []);
      assert.match(resultat.notes.join("\n"), /déjà lue, aucun téléchargement/);
      assert.match(resultat.notes.join("\n"), /retard 29 jour\(s\)/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rend une entrée pour une décision retenue absente du corpus", async () => {
    const root = racine();
    try {
      corpus(root, ["CONSTEXT000000000002"]);

      const resultat = await passeConstit({
        rootDir: root,
        fetchImpl: listeFetch(ARCHIVE),
        fetchFlux: archiveFetch(),
        maintenant: new Date("2010-08-20T12:00:00.000Z"),
      });

      assert.equal(resultat.entries.length, 1);
      const entree = resultat.entries[0];
      assert.ok(entree);
      assert.equal(entree.source, "constit");
      assert.equal(entree.document, "CONSTEXT000000000005");
      assert.equal(entree.numero, "2003-467 DC");
      assert.equal(entree.nature, "DC");
      assert.equal(entree.date_acte, "2003-03-13");
      assert.equal(entree.publishedAt, "2010-08-20T12:00:00.000Z");
      assert.equal(entree.title, "Décision n° 2003-467 DC du 13/03/2003 : Loi pour la sécurité intérieure");
      assert.equal(entree.officialTitle, "Loi pour la sécurité intérieure");
      assert.equal(
        entree.url,
        "https://www.conseil-constitutionnel.fr/decision/2003/2003467DC.htm",
      );
      assert.equal(
        entree.summary,
        "Considérant que la protection des données à caractère personnel s'impose au législateur.",
      );
      assert.deepEqual(entree.themes, ["donnees-personnelles"]);
      assert.deepEqual(entree.references, []);
      assert.equal(entree.id, identifiant("CONSTEXT000000000005"));

      assert.match(
        resultat.notes.join("\n"),
        /7 décision\(s\) lue\(s\), 2 retenue\(s\), 1 entrée\(s\) de veille/,
      );
      assert.match(resultat.notes.join("\n"), /retard 29 jour\(s\)/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit aucune entrée pour les décisions hors filtre", async () => {
    const root = racine();
    try {
      const resultat = await passeConstit({
        rootDir: root,
        fetchImpl: listeFetch(ARCHIVE),
        fetchFlux: archiveFetch(),
        maintenant: new Date("2010-08-20T12:00:00.000Z"),
      });

      assert.deepEqual(
        resultat.entries.map((entree) => entree.document),
        ["CONSTEXT000000000002", "CONSTEXT000000000005"],
      );
      for (const ecartee of [
        "CONSTEXT000000000003",
        "CONSTEXT000000000004",
        "CONSTEXT000000000006",
        "CONSTEXT000000000007",
      ]) {
        assert.equal(
          resultat.entries.some((entree) => entree.document === ecartee),
          false,
          ecartee,
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit aucune entrée quand les décisions retenues sont déjà au corpus", async () => {
    const root = racine();
    try {
      corpus(root, ["CONSTEXT000000000002", "CONSTEXT000000000005"]);

      const resultat = await passeConstit({
        rootDir: root,
        fetchImpl: listeFetch(ARCHIVE),
        fetchFlux: archiveFetch(),
        maintenant: new Date("2010-08-20T12:00:00.000Z"),
      });

      assert.deepEqual(resultat.entries, []);
      assert.match(resultat.notes.join("\n"), /0 entrée\(s\) de veille/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("avertit quand le retard de l'archive dépasse le seuil", async () => {
    const root = racine();
    try {
      manifeste(root, ARCHIVE);

      const resultat = await passeConstit({
        rootDir: root,
        fetchImpl: listeFetch(ARCHIVE),
        maintenant: new Date("2010-09-30T12:00:00.000Z"),
      });

      assert.equal(RETARD_MAX_JOURS, 45);
      assert.equal(resultat.warnings.length, 1);
      assert.match(
        resultat.warnings[0] ?? "",
        /archive Freemium_constit_global_20261115-140000\.tar\.gz en retard de 70 jours/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuse d'écrire une entrée dont URL_CC est en javascript:", () => {
    const entree = entreeDeDecision(
      {
        id: "CONSTEXT000000000002",
        nature: "QPC",
        numero: "2010-25",
        titre: "M. Jean-Louis N.",
        date: "2010-07-22",
        solution: "Non conformité",
        juridiction: "Conseil constitutionnel",
        ecli: "ECLI:FR:CC:CONSTEXT000000000002",
        url: urlOfficielleConstit("CONSTEXT000000000002", "javascript:alert(1)"),
        paragraphes: [],
        textePublie: "",
      },
      "2010-08-20",
    );
    const root = racine();
    try {
      assert.throws(() => writeEntries(root, [entree]), /refusée.*schéma javascript:/);
      assert.equal(existsSync(join(root, "data", "entries")), false, "rien n'est écrit");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("garde la date de la décision hors de publishedAt et du retard", () => {
    const entree = entreeDeDecision(
      {
        id: "CONSTEXT000000000002",
        nature: "QPC",
        numero: "2010-25",
        titre: "M. Jean-Louis N. (Question prioritaire de constitutionnalité)",
        date: "2010-07-22",
        solution: "Non conformité",
        juridiction: "Conseil constitutionnel",
        ecli: "ECLI:FR:CC:CONSTEXT000000000002",
        url: "https://www.conseil-constitutionnel.fr/decision/2010/201025QPC.htm",
        paragraphes: [],
        textePublie: "",
      },
      "2010-08-20",
    );

    assert.equal(entree.publishedAt, "2010-08-20T12:00:00.000Z");
    assert.equal(entree.date_acte, "2010-07-22");
    assert.equal(entree.summary, null);
    assert.equal(
      entree.title,
      "Décision n° 2010-25 QPC du 22/07/2010 : M. Jean-Louis N. (Question prioritaire de constitutionnalité)",
    );
    assert.deepEqual(rapportDeRetard("a.tar.gz", "2010-08-20", null), {
      warnings: [],
      notes: ["constit : archive a.tar.gz, dernière décision inconnue, retard non calculable"],
    });
  });
});
