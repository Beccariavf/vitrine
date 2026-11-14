import { strict as assert } from "node:assert";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { lireEntreesConstit } from "../mcp/corpus/constit/archive.ts";
import type { EntreeConstit } from "../mcp/corpus/constit/archive.ts";
import {
  classerDecision,
  parseDecisionConstit,
  unitesConstit,
} from "../mcp/corpus/constit/parse.ts";
import type { DescripteurConstit } from "../mcp/corpus/constit/parse.ts";
import {
  dateArchive,
  joursEntre,
  syncConstit,
} from "../mcp/corpus/constit/sync.ts";
import { listerArchives } from "../mcp/corpus/dila.ts";
import type { ManifesteConstit } from "../mcp/corpus/constit/sync.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/constit/constit.tar.gz", import.meta.url));
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/constit/descripteur.json", import.meta.url), "utf8"),
) as DescripteurConstit;
const DATE = "2026-11-09";
const RACINE = fileURLToPath(new URL("..", import.meta.url));

async function entrees(): Promise<EntreeConstit[]> {
  const lues: EntreeConstit[] = [];
  for await (const entree of lireEntreesConstit(createReadStream(FIXTURE), {
    nomArchive: "constit.tar.gz",
  })) {
    lues.push(entree);
  }
  return lues;
}

function decisionParId(lues: EntreeConstit[], id: string) {
  const entree = lues.find((element) => element.nom.endsWith(`${id}.xml`));
  assert.ok(entree, `entrée ${id} absente du fixture`);
  return parseDecisionConstit(entree.donnees.toString("utf8"), entree.nom);
}

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "constit-corpus-"));
}

describe("la lecture de l'archive CONSTIT", () => {
  it("rend les décisions XML de constit/global/CONS/TEXT", async () => {
    const lues = await entrees();

    assert.equal(lues.length, 7);
    for (const entree of lues) {
      assert.match(entree.nom, /^constit\/global\/CONS\/TEXT\/.+\.xml$/);
      assert.equal(entree.donnees.subarray(0, 5).toString("utf8"), "<?xml");
    }
  });

  it("lit les métadonnées, la décision et le texte publié", async () => {
    const decision = decisionParId(await entrees(), "CONSTEXT000000000001");

    assert.equal(decision.id, "CONSTEXT000000000001");
    assert.equal(decision.nature, "DC");
    assert.equal(decision.numero, "2003-467");
    assert.equal(decision.date, "2003-03-13");
    assert.equal(decision.juridiction, "Conseil constitutionnel");
    assert.equal(decision.paragraphes.length, 2);
    assert.equal(
      decision.url,
      "https://www.conseil-constitutionnel.fr/decision/2003/2003467DC.htm",
    );
    assert.equal(classerDecision(decision, DESCRIPTEUR).retenue, true);
  });

  it("lit une QPC par sa saisine sans indexer la saisine", async () => {
    const decision = decisionParId(await entrees(), "CONSTEXT000000000002");

    assert.equal(decision.nature, "QPC");
    assert.equal(decision.paragraphes.some((p) => p.includes("données personnelles")), false);
    assert.equal(decision.textePublie.includes("données personnelles"), true);
    assert.equal(classerDecision(decision, DESCRIPTEUR).retenue, true);

    const unites = unitesConstit(decision, DESCRIPTEUR);
    assert.equal(unites.length, 1);
    assert.equal(unites[0]?.texte.includes("données personnelles"), false);
    assert.equal(unites[0]?.texte.includes("&nbsp;"), false, "entité double-échappée décodée");
    assert.match(unites[0]?.texte ?? "", /vie privée sont garantis/);
  });

  it("écarte une nature non retenue, un hors filtre, une date invalide et un texte vide", async () => {
    const lues = await entrees();
    const cas: [string, string][] = [
      ["CONSTEXT000000000001", "retenue"],
      ["CONSTEXT000000000002", "retenue"],
      ["CONSTEXT000000000003", "nature_ecartee"],
      ["CONSTEXT000000000004", "sans_mot_cle"],
      ["CONSTEXT000000000005", "retenue"],
      ["CONSTEXT000000000006", "date_invalide"],
      ["CONSTEXT000000000007", "texte_vide"],
    ];

    for (const [id, attendu] of cas) {
      const verdict = classerDecision(decisionParId(lues, id), DESCRIPTEUR);
      if (attendu === "retenue") {
        assert.equal(verdict.retenue, true, id);
      } else {
        assert.equal(verdict.retenue, false, id);
        if (!verdict.retenue) assert.equal(verdict.motif, attendu, id);
      }
    }
  });

  it("produit des fragments adressables avec numéro, nature et lien officiel", async () => {
    const decision = decisionParId(await entrees(), "CONSTEXT000000000002");
    const unites = unitesConstit(decision, DESCRIPTEUR);

    assert.equal(unites.length, 1);
    const unite = unites[0];
    assert.ok(unite);
    assert.equal(unite.ref, "CONSTEXT000000000002#f0");
    assert.equal(unite.document, "CONSTEXT000000000002");
    assert.equal(unite.corpus, "constit");
    assert.equal(unite.niveau, "fragment");
    assert.equal(unite.numero, "2010-25 QPC");
    assert.equal(unite.nature, "QPC");
    assert.equal(unite.date_acte, "2010-07-22");
    assert.equal(unite.chemin, "Conseil constitutionnel > Décision 2010-25 QPC");
    assert.match(unite.statut, /^Décision QPC · /);
    assert.equal(
      unite.url,
      "https://www.conseil-constitutionnel.fr/decision/2010/201025QPC.htm",
    );
    assert.equal(unite.texte.includes("<"), false);
  });
});

describe("la synchronisation du corpus Conseil constitutionnel", () => {
  it("écrit l'état, le corpus et le manifeste après filtrage", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncConstit({ rootDir: racine, archive: FIXTURE, date: DATE });

      assert.equal(resultat.ignore, false);
      assert.equal(resultat.ecrit, true);
      assert.equal(resultat.documentsLus, 7);
      assert.equal(resultat.documentsDcQpc, 6);
      assert.equal(resultat.documents, 2);
      assert.equal(resultat.fragments, 2);
      assert.equal(resultat.doublons, 1);
      assert.deepEqual(resultat.parNature, { DC: 1, QPC: 1 });
      assert.deepEqual(resultat.naturesEcartees, { AN: 1 });
      assert.deepEqual(resultat.ecartes, {
        nature_ecartee: 1,
        date_invalide: 1,
        texte_vide: 1,
        sans_mot_cle: 1,
      });

      const unites = readFileSync(
        join(racine, "data", "corpus", "constit", "unites.jsonl"),
        "utf8",
      )
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.deepEqual(
        [...new Set(unites.map((unite) => unite.document))],
        ["CONSTEXT000000000002", "CONSTEXT000000000005"],
        "le doublon garde l'identifiant le plus récent",
      );

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "constit", "manifest.json"), "utf8"),
      ) as ManifesteConstit;
      assert.equal(manifeste.archive, "constit.tar.gz");
      assert.equal(manifeste.date_extraction, DATE);
      assert.equal(manifeste.documents_lus, 7);
      assert.equal(manifeste.documents_dc_qpc, 6);
      assert.equal(manifeste.documents, 2);
      assert.equal(manifeste.fragments, 2);
      assert.equal(manifeste.doublons, 1);
      assert.deepEqual(manifeste.natures_retenues, ["DC", "QPC"]);
      assert.deepEqual(manifeste.couverture.par_nature, { DC: 1, QPC: 1 });
      assert.deepEqual(manifeste.ecartes, resultat.ecartes);
      assert.deepEqual(manifeste.natures_ecartees, { AN: 1 });
      assert.equal(manifeste.couverture.source, "DILA — CONSTIT (OPENDATA), XML Légifrance");
      assert.equal(manifeste.couverture.lecture.filtre.includes("saisines"), true);
      assert.equal(manifeste.couverture.lecture.unites.includes("BLOC_TEXTUEL"), true);
      assert.deepEqual(manifeste.couverture.filtre.natures_retenues, ["DC", "QPC"]);
      assert.equal(manifeste.couverture.filtre.terme_vie_privee, "vie privée");
      assert.equal(manifeste.couverture.exclusions.natures.motif.includes("DC et QPC"), true);
      assert.equal(manifeste.couverture.exclusions.natures.comptes.AN, 1);
      assert.equal(manifeste.licence, "Licence Ouverte 2.0 (Etalab)");
      assert.equal(manifeste.couverture.licence.nom, manifeste.licence);
      assert.equal(manifeste.couverture.archive.derniere_decision, "2010-07-22");
      assert.equal(manifeste.couverture.retard_archive.derniere_decision, "2010-07-22");
      assert.equal(manifeste.couverture.periode.date_min, "2003-03-13");
      assert.equal(manifeste.couverture.periode.date_max, "2010-07-22");

      const etat = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "constit", "etat.json"), "utf8"),
      ) as Record<string, unknown>;
      assert.equal(etat.archive, "constit.tar.gz");
      assert.match(String(etat.sha256), /^[0-9a-f]{64}$/);
      assert.match(String(etat.filtre_sha256), /^[0-9a-f]{64}$/);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne relit et ne réécrit rien quand l'archive et l'empreinte sont identiques", async () => {
    const racine = racineTemporaire();
    try {
      await syncConstit({ rootDir: racine, archive: FIXTURE, date: DATE });
      const chemins = [
        join(racine, "data", "corpus", "constit", "unites.jsonl"),
        join(racine, "data", "corpus", "constit", "manifest.json"),
        join(racine, "data", "corpus", "constit", "etat.json"),
      ];
      const avant = chemins.map((chemin) => statSync(chemin).mtimeMs);

      const second = await syncConstit({ rootDir: racine, archive: FIXTURE, date: DATE });

      assert.equal(second.ignore, true);
      assert.equal(second.ecrit, false);
      assert.deepEqual(
        chemins.map((chemin) => statSync(chemin).mtimeMs),
        avant,
        "aucun fichier ne doit être réécrit",
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne crée aucun fichier en dry-run", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncConstit({
        rootDir: racine,
        archive: FIXTURE,
        date: DATE,
        dryRun: true,
      });

      assert.equal(resultat.ecrit, false);
      assert.equal(resultat.documents, 2);
      assert.equal(existsSync(join(racine, "data")), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("le corpus commité porte les comptes et les métadonnées de son manifeste", () => {
    const manifeste = JSON.parse(
      readFileSync(join(RACINE, "data", "corpus", "constit", "manifest.json"), "utf8"),
    ) as ManifesteConstit;
    const unites = readFileSync(join(RACINE, "data", "corpus", "constit", "unites.jsonl"), "utf8")
      .split("\n")
      .filter((ligne) => ligne !== "")
      .map((ligne) => JSON.parse(ligne) as Unite);

    assert.equal(unites.length, manifeste.fragments);
    assert.equal(new Set(unites.map((unite) => unite.document)).size, manifeste.documents);
    assert.equal(
      Object.values(manifeste.ecartes).reduce((total, compte) => total + compte, 0) +
        manifeste.documents +
        manifeste.doublons,
      manifeste.documents_lus,
    );
    assert.equal(
      Object.values(manifeste.natures_ecartees).reduce((total, compte) => total + compte, 0),
      manifeste.ecartes.nature_ecartee,
    );
    assert.equal(
      Object.values(manifeste.couverture.par_nature).reduce((total, compte) => total + compte, 0),
      manifeste.documents,
    );
    for (const unite of unites) {
      assert.match(unite.document, /^CONSTEXT\d+$/);
      assert.ok(["DC", "QPC"].includes(unite.nature ?? ""), unite.ref);
      assert.match(unite.numero, /^\d{2,4}-\d+(?:\/\d+)? (?:DC|QPC)$/);
      assert.match(unite.date_acte, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(unite.url, /^https:\/\/www\.conseil-constitutionnel\.fr\//);
    }
  });

  it("nomme la date de l'archive et le retard de sa dernière décision", () => {
    assert.equal(dateArchive("Freemium_constit_global_20261108-140000.tar.gz"), "2026-11-08");
    assert.equal(dateArchive("constit.tar.gz"), null);
    assert.equal(joursEntre("2026-10-16", "2026-11-14"), 29);
    assert.equal(joursEntre(null, "2026-11-14"), null);
  });
});

describe("la liste des archives CONSTIT", () => {
  it("ne garde que le global CONSTIT, pas la fiche de présentation", async () => {
    const html = [
      '<a href="DILA_CONSTIT_Presentation_20170824.pdf">fiche</a>',
      '<a href="Freemium_constit_global_20261001-120000.tar.gz">vieux</a>',
      '<a href="Freemium_constit_global_20261108-140000.tar.gz">récent</a>',
    ].join("");
    const liste = await listerArchives(
      "https://echanges.dila.gouv.fr/OPENDATA/CONSTIT/",
      "Freemium_constit_global_*.tar.gz",
      async () => ({ ok: true, status: 200, text: async () => html }),
      "CONSTIT",
    );

    assert.deepEqual(liste, [
      "Freemium_constit_global_20261001-120000.tar.gz",
      "Freemium_constit_global_20261108-140000.tar.gz",
    ]);
  });
});
