import { strict as assert } from "node:assert";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ReadableStream as WebReadableStream } from "node:stream/web";
import { describe, it } from "node:test";
import { lireEntreesJade } from "../mcp/corpus/ce/archive.ts";
import type { EntreeJade } from "../mcp/corpus/ce/archive.ts";
import {
  classerDecision,
  parseDecisionJade,
  unitesJade,
  validerUnites,
} from "../mcp/corpus/ce/parse.ts";
import type { DescripteurCe } from "../mcp/corpus/ce/parse.ts";
import {
  listerArchives,
  motifVersExpression,
  syncCe,
  telechargerArchive,
} from "../mcp/corpus/ce/sync.ts";
import type { ManifesteCe } from "../mcp/corpus/ce/sync.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/ce/jade.tar.gz", import.meta.url));
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/ce/descripteur.json", import.meta.url), "utf8"),
) as DescripteurCe;
const DATE = "2026-11-09";

async function entrees(): Promise<EntreeJade[]> {
  const lues: EntreeJade[] = [];
  for await (const entree of lireEntreesJade(createReadStream(FIXTURE), {
    nomArchive: "jade.tar.gz",
  })) {
    lues.push(entree);
  }
  return lues;
}

function decisionParId(lues: EntreeJade[], id: string) {
  const entree = lues.find((element) => element.nom.endsWith(`${id}.xml`));
  assert.ok(entree, `entrée ${id} absente du fixture`);
  return parseDecisionJade(entree.donnees.toString("utf8"), entree.nom);
}

function racineTemporaire(): string {
  return mkdtempSync(join(tmpdir(), "ce-corpus-"));
}

describe("la lecture de l'archive JADE", () => {
  it("rend les seuls XML de jade/global/publie, dans l'ordre du tar", async () => {
    const lues = await entrees();

    assert.equal(lues.length, 6);
    for (const entree of lues) {
      assert.match(entree.nom, /^jade\/global\/publie\/.+\.xml$/);
      assert.equal(entree.donnees.subarray(0, 5).toString("utf8"), "<?xml");
    }
    assert.equal(
      lues.some((entree) => entree.nom.includes("autre")),
      false,
      "un autre fonds ne doit pas être lu",
    );
  });

  it("refuse une entrée plus grosse que le plafond en la nommant", async () => {
    await assert.rejects(
      async () => {
        for await (const _ of lireEntreesJade(createReadStream(FIXTURE), {
          nomArchive: "jade.tar.gz",
          maxOctets: 100,
        })) {
          // La première entrée XML dépasse déjà 100 octets.
        }
      },
      /Entrée jade\/global\/publie\/.*\.xml refusée.*plafond de 100 octets/,
    );
  });

  it("nomme l'archive quand le gzip est corrompu", async () => {
    const racine = racineTemporaire();
    try {
      const chemin = join(racine, "corrompue.tar.gz");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(chemin, "ceci n'est pas du gzip");
      await assert.rejects(
        async () => {
          for await (const _ of lireEntreesJade(createReadStream(chemin), {
            nomArchive: "corrompue.tar.gz",
          })) {
            // Rien : la lecture doit lever.
          }
        },
        /Archive corrompue\.tar\.gz illisible \(gzip corrompu\)/,
      );
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("le filtrage des décisions JADE", () => {
  it("lit les métadonnées et les paragraphes d'une décision", async () => {
    const decision = decisionParId(await entrees(), "CETATEXT000007422412");

    assert.equal(decision.id, "CETATEXT000007422412");
    assert.equal(decision.date, "2016-03-10");
    assert.equal(decision.juridiction, "Conseil d'État");
    assert.equal(decision.numero, "387654");
    assert.equal(decision.solution, "Rejet");
    assert.equal(decision.publiRecueil, "Oui");
    assert.equal(decision.paragraphes.length, 4);
    assert.match(decision.paragraphes[0] ?? "", /protection des données/);
  });

  it("classe chaque décision par son premier motif d'écart", async () => {
    const lues = await entrees();
    const cas: [string, string][] = [
      ["CETATEXT000007422412", "retenue"],
      ["CETATEXT000000000002", "sans_mot_cle"],
      ["CETATEXT000000000003", "autre_juridiction"],
      ["CETATEXT000000000004", "avant_borne"],
      ["CETATEXT000000000005", "texte_vide"],
      ["CETATEXT000000000006", "date_invalide"],
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

  it("reconnaît le Conseil d'État et écarte les autres juridictions", async () => {
    const lues = await entrees();
    const ce = decisionParId(lues, "CETATEXT000007422412");
    const caa = decisionParId(lues, "CETATEXT000000000003");

    assert.equal(classerDecision(ce, DESCRIPTEUR).retenue, true);
    const verdict = classerDecision(caa, DESCRIPTEUR);
    assert.equal(verdict.retenue, false);
    if (!verdict.retenue) assert.equal(verdict.motif, "autre_juridiction");
  });

  it("produit des fragments adressables avec numéro et URL Légifrance", async () => {
    const decision = decisionParId(await entrees(), "CETATEXT000007422412");
    const unites = unitesJade(decision, DESCRIPTEUR);

    assert.equal(unites.length, 2);
    assert.deepEqual(
      unites.map((unite) => unite.ref),
      ["CETATEXT000007422412#f0", "CETATEXT000007422412#f1"],
    );
    for (const unite of unites) {
      assert.equal(unite.document, "CETATEXT000007422412");
      assert.equal(unite.corpus, "ce");
      assert.equal(unite.niveau, "fragment");
      assert.equal(unite.numero, "387654");
      assert.equal(unite.date_acte, "2016-03-10");
      assert.equal(unite.url, "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000007422412");
      assert.ok(unite.texte.length >= 600 && unite.texte.length <= 1200, unite.ref);
      assert.equal(unite.texte.includes("<"), false);
    }
  });
});

describe("la synchronisation du corpus CE", () => {
  it("écrit l'état, le corpus et le manifeste après filtrage", async () => {
    const racine = racineTemporaire();
    try {
      const resultat = await syncCe({ rootDir: racine, archive: FIXTURE, date: DATE });

      assert.equal(resultat.ignore, false);
      assert.equal(resultat.ecrit, true);
      assert.equal(resultat.documentsLus, 6);
      assert.equal(resultat.decisionsCeDepuis2014, 3);
      assert.equal(resultat.documents, 1);
      assert.equal(resultat.fragments, 2);
      assert.deepEqual(resultat.ecartes, {
        autre_juridiction: 1,
        avant_borne: 1,
        date_invalide: 1,
        sans_mot_cle: 1,
        texte_vide: 1,
      });

      const unites = readFileSync(join(racine, "data", "corpus", "ce", "unites.jsonl"), "utf8")
        .split("\n")
        .filter((ligne) => ligne !== "")
        .map((ligne) => JSON.parse(ligne) as Unite);
      assert.equal(unites.length, 2);
      assert.equal(unites[0]?.document, "CETATEXT000007422412");

      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "ce", "manifest.json"), "utf8"),
      ) as ManifesteCe;
      assert.equal(manifeste.archive, "jade.tar.gz");
      assert.equal(manifeste.date_extraction, DATE);
      assert.equal(manifeste.date_min, "2014-01-01");
      assert.equal(manifeste.documents_lus, 6);
      assert.equal(manifeste.decisions_ce_depuis_2014, 3);
      assert.equal(manifeste.documents, 1);
      assert.equal(manifeste.fragments, 2);
      assert.deepEqual(manifeste.ecartes, resultat.ecartes);
      assert.equal(manifeste.couverture.source, "DILA — JADE (OPENDATA)");
      assert.equal(manifeste.couverture.periode.date_max, "2016-03-10");
      assert.deepEqual(manifeste.couverture.exclusions.juridictions, DESCRIPTEUR.juridictions_exclues);
      assert.equal(manifeste.licence, "Licence Ouverte 2.0 (Etalab)");

      const etat = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "ce", "etat.json"), "utf8"),
      ) as Record<string, unknown>;
      assert.equal(etat.archive, "jade.tar.gz");
      assert.equal(etat.date_min, "2014-01-01");
      assert.match(String(etat.sha256), /^[0-9a-f]{64}$/);
      assert.match(String(etat.filtre_sha256), /^[0-9a-f]{64}$/);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("ne relit et ne réécrit rien quand l'archive et l'empreinte sont identiques", async () => {
    const racine = racineTemporaire();
    try {
      await syncCe({ rootDir: racine, archive: FIXTURE, date: DATE });
      const chemins = [
        join(racine, "data", "corpus", "ce", "unites.jsonl"),
        join(racine, "data", "corpus", "ce", "manifest.json"),
        join(racine, "data", "corpus", "ce", "etat.json"),
      ];
      const avant = chemins.map((chemin) => statSync(chemin).mtimeMs);

      const second = await syncCe({ rootDir: racine, archive: FIXTURE, date: DATE });

      assert.equal(second.ignore, true);
      assert.equal(second.ecrit, false);
      assert.equal(second.documents, 1);
      assert.equal(second.fragments, 2);
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
      const resultat = await syncCe({
        rootDir: racine,
        archive: FIXTURE,
        date: DATE,
        dryRun: true,
      });

      assert.equal(resultat.ecrit, false);
      assert.equal(resultat.documents, 1);
      assert.equal(existsSync(join(racine, "data")), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("refuse une référence dupliquée, une date non ISO ou un texte vide", () => {
    const base: Unite = {
      ref: "CETATEXT000000000001#f0",
      document: "CETATEXT000000000001",
      corpus: "ce",
      niveau: "fragment",
      numero: "1",
      chemin: "Conseil d'État > Décision 1",
      texte: "Un texte.",
      date_acte: "2016-01-01",
      date_debut: "2016-01-01",
      date_fin: null,
      statut: "Rejet",
      url: "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000000000001",
    };

    assert.doesNotThrow(() => validerUnites([base]));
    assert.throws(() => validerUnites([base, { ...base }]), /référence dupliquée/);
    assert.throws(() => validerUnites([{ ...base, date_acte: "01/01/2016" }]), /date non ISO/);
    assert.throws(() => validerUnites([{ ...base, texte: "  " }]), /texte vide/);
  });
});

describe("la liste et le téléchargement JADE", () => {
  it("choisit l'archive la plus récente et ignore les autres fonds", async () => {
    const html = [
      '<a href="Freemium_jade_global_20261001-120000.tar.gz">vieux</a>',
      '<a href="Freemium_jade_global_20261108-140000.tar.gz">récent</a>',
      '<a href="Freemium_jade_inc_20261109-000000.tar.gz">incrément</a>',
    ].join("");
    const liste = await listerArchives(
      "https://echanges.dila.gouv.fr/OPENDATA/JADE/",
      "Freemium_jade_global_*.tar.gz",
      async () => ({ ok: true, status: 200, text: async () => html }),
    );

    assert.deepEqual(liste, [
      "Freemium_jade_global_20261001-120000.tar.gz",
      "Freemium_jade_global_20261108-140000.tar.gz",
    ]);
    assert.equal(liste.at(-1), "Freemium_jade_global_20261108-140000.tar.gz");
    assert.equal(
      motifVersExpression("Freemium_jade_global_*.tar.gz").test(
        "Freemium_jade_global_20261108-140000.tar.gz",
      ),
      true,
    );
  });

  it("télécharge par fichier temporaire puis renommage", async () => {
    const racine = racineTemporaire();
    try {
      const chemin = join(racine, "archive.tar.gz");
      const octets = new TextEncoder().encode("contenu binaire");
      await telechargerArchive("https://example.test/archive.tar.gz", chemin, async () => ({
        ok: true,
        status: 200,
        body: new WebReadableStream<Uint8Array>({
          start(controleur) {
            controleur.enqueue(octets);
            controleur.close();
          },
        }),
      }));

      assert.equal(readFileSync(chemin, "utf8"), "contenu binaire");
      assert.equal(existsSync(`${chemin}.tmp`), false);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
