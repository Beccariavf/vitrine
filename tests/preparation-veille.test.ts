import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { Entry } from "../veille/types.ts";
import { normaliser } from "../mcp/embed/embedder.ts";
import type { Embedder } from "../mcp/embed/embedder.ts";
import type { Unite } from "../mcp/corpus/parse.ts";
import {
  arretsAVerser,
  decisionsSuivies,
  documentsCjue,
  incorporerArretVeille,
  incorporerArretsVeille,
} from "../mcp/corpus/cjue/veille.ts";
import type { SyncCjueOptions } from "../mcp/corpus/cjue/sync.ts";
import { agentsParDefaut, syncCorpus } from "../mcp/corpus/sync.ts";
import type { AgentSync } from "../mcp/corpus/sync.ts";
import { formaterRapport } from "../mcp/corpus/sync-rapport.ts";
import {
  corpusDeLEntree,
  documentsDeLEntree,
  documentsEcartes,
} from "../mcp/corpus/veille.ts";
import {
  anneesSuivies,
  choisirActeAdopte,
  corpusVise,
  decisionsParCle,
  detecterChangements,
  documentsSuivis,
  lireStatuts,
  passePreparation,
  requeteDatesArrets,
  requeteStatuts,
} from "../veille/sources/preparation.ts";
import type { CorpusVise, Suivi } from "../veille/sources/preparation.ts";

const FIXTURES = new URL("./fixtures/preparation/", import.meta.url);
const DATE_PASSE = new Date("2026-11-15T12:00:00.000Z");

function fixture(nom: string): unknown {
  return JSON.parse(readFileSync(new URL(nom, FIXTURES), "utf8")) as unknown;
}

const STATUTS = fixture("veille-statuts.json");
const STATUTS_INCHANGES = fixture("veille-statuts-inchanges.json");
const DECISIONS_2025 = fixture("veille-decisions-2025.json");
const DECISIONS_2020 = fixture("veille-decisions-2020.json");
const DATES = fixture("veille-dates.json");

const CORPUS_ACTES: Map<string, CorpusVise> = new Map([
  ["32016R0679", { corpus: "rgpd", nom: "RGPD" }],
  ["32002L0058", { corpus: "eprivacy", nom: "ePrivacy" }],
  ["32024R1689", { corpus: "aiact", nom: "AI Act" }],
]);

const SUIVIS: Suivi[] = [
  {
    document: "52025PC9001",
    niveau: "proposition",
    numero: "2025/9001/COD",
    titre: "Proposition de règlement modifiant le RGPD",
  },
  { document: "52025PC9002", niveau: "proposition", numero: "2025/9002/COD" },
  { document: "52025PC9003", niveau: "proposition", numero: "2025/9003/COD" },
  { document: "52025PC9004", niveau: "proposition", numero: "2025/9004/COD" },
  { document: "52025PC9005", niveau: "proposition", numero: "2025/9005/COD" },
  { document: "62025CN9001", niveau: "affaire", numero: "C-9001/25" },
  { document: "62025CN9002", niveau: "affaire", numero: "C-9002/25" },
  { document: "62020CN9003", niveau: "affaire", numero: "C-9003/20" },
];

/** Racine temporaire : aucun fichier du dépôt n'est touché. */
function racineTemporaire(prefixe = "preparation-veille-"): string {
  const racine = mkdtempSync(join(tmpdir(), prefixe));
  racines.push(racine);
  return racine;
}

const racines: string[] = [];

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

async function passe(
  racine: string,
  reponses: Record<string, unknown> = {
    propositions: STATUTS,
    decisions: { "2020": DECISIONS_2020, "2025": DECISIONS_2025 },
    dates: DATES,
  },
) {
  return passePreparation({
    rootDir: racine,
    suivis: SUIVIS,
    corpusActes: CORPUS_ACTES,
    maintenant: DATE_PASSE,
    delaiMs: 0,
    reponses,
  });
}

function unitePreparation(
  document: string,
  niveau: "proposition" | "affaire",
  statut: string,
  numero: string,
): Unite {
  return {
    ref: `${document}#${niveau}`,
    document,
    corpus: "preparation",
    niveau,
    numero,
    chemin: `Préparation > ${niveau} > ${numero}`,
    texte: "Texte de la proposition ou de la communication.",
    date_acte: "2025-09-16",
    date_debut: "2025-09-16",
    date_fin: null,
    statut,
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${document}`,
  };
}

function ecrireCorpus(racine: string, corpus: string, unites: Unite[], manifeste?: unknown): void {
  const dossier = join(racine, "data", "corpus", corpus);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(
    join(dossier, "unites.jsonl"),
    `${unites.map((unite) => JSON.stringify(unite)).join("\n")}${unites.length === 0 ? "" : "\n"}`,
    "utf8",
  );
  writeFileSync(
    join(dossier, "manifest.json"),
    `${JSON.stringify(
      manifeste ?? {
        corpus,
        documents: new Set(unites.map((unite) => unite.document)).size,
        unites: unites.length,
        date_extraction: "2026-11-14",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function ecrireEntree(racine: string, entry: Entry): void {
  const dossier = join(racine, "data", "entries", "2026", "11");
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

function entreePreparation(document: string, statutApres: string, extra: Partial<Entry> = {}): Entry {
  return {
    id: `entree-${document}`,
    title: `Changement ${document}`,
    officialTitle: `Changement ${document}`,
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${document}`,
    publishedAt: "2026-11-15T12:00:00.000Z",
    summary: null,
    references: [],
    themes: ["donnees-personnelles"],
    source: "preparation",
    document,
    version: statutApres,
    statut_avant: "PROP_PENDING",
    statut_apres: statutApres,
    ...extra,
  };
}

function embedderFactice(dim = 8, model = "factice"): Embedder {
  const vecteur = (texte: string): number[] => {
    const valeurs = new Array<number>(dim).fill(0);
    for (const mot of texte.toLowerCase().split(/\s+/)) {
      if (mot === "") continue;
      let empreinte = 7;
      for (const caractere of mot) {
        empreinte = (empreinte * 31 + (caractere.codePointAt(0) ?? 0)) % 1_000_003;
      }
      valeurs[empreinte % dim] = (valeurs[empreinte % dim] ?? 0) + 1;
    }
    return normaliser(valeurs);
  };
  return {
    model,
    dim,
    embedPassages: async (textes) => textes.map(vecteur),
    embedQuery: async (texte) => vecteur(texte),
  };
}

const INERTE: AgentSync = async () => ({ ecrit: false, message: "inactif" });

describe("la veille des changements de statut", () => {
  it("rend une entrée par changement, avec l'acte adopté et le corpus visé", async () => {
    const racine = racineTemporaire();
    const resultat = await passe(racine);

    const parDocument = new Map(resultat.entries.map((entry) => [entry.document, entry]));
    const adoption = parDocument.get("52025PC9001");
    assert.ok(adoption !== undefined);
    assert.equal(adoption.source, "preparation");
    assert.equal(adoption.statut_avant, "PROP_PENDING");
    assert.equal(adoption.statut_apres, "PROP_ADOPTED");
    assert.equal(adoption.version, "PROP_ADOPTED", "la version comparée est le statut atteint");
    assert.equal(adoption.acte_adopte, "32026R9001");
    assert.equal(adoption.corpus_vise, "rgpd", "le premier corpus de l'ordre l'emporte");
    assert.equal(adoption.date_acte, "2026-05-30");
    assert.equal(adoption.numero, "2025/9001/COD");
    assert.equal(adoption.officialTitle, "Proposition de règlement modifiant le RGPD");
    assert.match(adoption.title, /RGPD : texte adopté le 30\/05\/2026/);
    assert.match(adoption.title, /PROP_PENDING → PROP_ADOPTED/);
    assert.match(adoption.url, /CELEX:32026R9001/);
    assert.equal(adoption.publishedAt, "2026-11-15T12:00:00.000Z");
    assert.deepEqual(adoption.themes, ["donnees-personnelles"]);
    assert.equal(adoption.summary, null);

    assert.equal(parDocument.get("52025PC9002")?.statut_apres, "RETIRE");
    assert.equal(parDocument.get("52025PC9003")?.statut_apres, "PROP_REJECTED");
    assert.equal(parDocument.has("52025PC9004"), false, "un dossier en cours ne produit rien");

    const autonome = parDocument.get("52025PC9005");
    assert.ok(autonome !== undefined);
    assert.equal(autonome.corpus_vise, undefined);
    assert.equal(autonome.acte_adopte, "32026R9005");
    assert.match(autonome.title, /^Texte adopté le 10\/06\/2026/);

    const arret = parDocument.get("62025CN9001");
    assert.ok(arret !== undefined);
    assert.equal(arret.statut_avant, "PENDANT");
    assert.equal(arret.statut_apres, "CJ");
    assert.equal(arret.decision, "62025CJ9001");
    assert.equal(arret.date_acte, "2026-11-05");
    assert.match(arret.title, /Affaire jugée le 05\/11\/2026/);
    assert.match(arret.title, /PENDANT → 62025CJ9001/);
    assert.match(arret.url, /CELEX:62025CJ9001/);

    assert.equal(parDocument.has("62025CN9002"), false, "un résumé (`_SUM`) n'est pas une décision");
    assert.equal(
      parDocument.get("62020CN9003")?.decision,
      "62020CJ0001",
      "une affaire jointe est fermée par l'arrêt principal",
    );

    assert.equal(resultat.entries.length, 6);
    assert.match(resultat.notes[0] ?? "", /8 document\(s\) suivi\(s\)/);
    assert.ok(
      resultat.notes.some((note) => /corpus rgpd : en attente de consolidation/.test(note)),
      "le rapport dit l'attente de consolidation",
    );
    assert.ok(
      resultat.notes.some((note) => /hors corpus, aucune création/.test(note)),
      "un acte autonome est signalé hors corpus",
    );

    const seconde = await passe(racine);
    assert.deepEqual(
      seconde.entries.map((entry) => entry.id),
      resultat.entries.map((entry) => entry.id),
      "l'identifiant d'un changement est stable",
    );
  });

  it("n'écrit aucune entrée quand aucun statut n'a changé", async () => {
    const racine = racineTemporaire();
    const resultat = await passe(racine, {
      propositions: STATUTS_INCHANGES,
      decisions: {
        "2020": { results: { bindings: [] } },
        "2025": { results: { bindings: [] } },
      },
    });
    assert.deepEqual(resultat.entries, []);
    assert.ok(resultat.notes.includes("preparation : aucun changement de statut"));
    assert.deepEqual(resultat.warnings, []);
  });

  it("lit les documents suivis du corpus et refuse un corpus absent", async () => {
    const racine = racineTemporaire();
    ecrireCorpus(racine, "preparation", [
      unitePreparation("52025PC9001", "proposition", "PROPOSE", "2025/9001/COD"),
      unitePreparation("62025CN9001", "affaire", "PENDANT", "C-9001/25"),
      // Les nouvelles unités des actes suivis entrent sans code par corpus.
      unitePreparation("52025PC0504", "proposition", "PROPOSE", "2025/0403/COD"),
      unitePreparation("62025CN0245", "affaire", "PENDANT", "C-245/25"),
    ]);
    const suivis = documentsSuivis(racine);
    assert.deepEqual(
      suivis.map((suivi) => `${suivi.document}:${suivi.niveau}`),
      [
        "52025PC0504:proposition",
        "52025PC9001:proposition",
        "62025CN0245:affaire",
        "62025CN9001:affaire",
      ],
    );
    assert.throws(
      () => documentsSuivis(join(racine, "absent")),
      /Corpus preparation illisible/,
    );
  });

  it("borne ses requêtes aux documents suivis et à leurs années", () => {
    const requete = requeteStatuts(["52025PC9001", "52025PC9005"]);
    assert.match(requete, /FILTER\(STR\(\?celex\) IN \("52025PC9001","52025PC9005"\)\)/);
    assert.match(requete, /act_preparatory_initiates_dossier/);
    assert.match(requete, /dossier_withdrawn-proposal/);
    assert.match(requete, /STRSTARTS\(STR\(\?acteAdopte\), "3"\)/);
    assert.match(requete, /resource_legal_amends_resource_legal/);
    assert.match(requete, /resource_legal_repeals_resource_legal/);
    assert.match(requete, /resource_legal_proposes_to_amend_resource_legal/);
    assert.match(requete, /\?proposeCelex/);
    assert.match(requete, /\?amendCelex/);
    assert.match(requete, /\?remplaceCelex/);
    assert.doesNotMatch(requete, /\?baseVise/, "une variable partagée masque la proposition");
    assert.doesNotMatch(requete, /VALUES \?celex/);

    assert.deepEqual(anneesSuivies(SUIVIS), ["2020", "2025"]);
    const dates = requeteDatesArrets(["62025CJ9001", "62020CJ0001"]);
    assert.match(dates, /FILTER\(STR\(\?celex\) IN \("62025CJ9001","62020CJ0001"\)\)/);
    assert.match(dates, /work_date_document/);
  });

  it("choisit la décision et l'acte adopté sans se tromper de nature", () => {
    const decisions = decisionsParCle(DECISIONS_2025);
    assert.equal(decisions.get("C20259001"), "62025CJ9001");
    assert.equal(decisions.has("C20259002"), false, "un `_SUM` ne se télécharge pas");
    assert.equal(
      decisions.get("C20259099"),
      "62025CO9001(01)",
      "une affaire jointe reste fermée, même par une ordonnance corrigée",
    );
    assert.equal(decisionsParCle(DECISIONS_2020).get("C20209003"), "62020CJ0001");

    const statuts = lireStatuts(STATUTS);
    const statut = statuts.get("52025PC9001");
    assert.ok(statut !== undefined);
    const acte = choisirActeAdopte(statut, CORPUS_ACTES);
    assert.equal(acte?.acte, "32026R9001");
    assert.equal(acte?.date, "2026-05-30");
    assert.equal(acte?.corpus?.corpus, "rgpd");
    assert.equal(
      corpusVise(["32002L0058", "32016R0679"], CORPUS_ACTES)?.corpus,
      "rgpd",
      "l'ordre des corpus tranche",
    );
    assert.equal(corpusVise(["32016R1036"], CORPUS_ACTES), null);

    const changements = detecterChangements(
      SUIVIS,
      statuts,
      decisionsParCle(DECISIONS_2020),
      new Map(),
      CORPUS_ACTES,
    );
    assert.deepEqual(
      changements.map((changement) => `${changement.suivi.document}:${changement.statutApres}`),
      [
        "52025PC9001:PROP_ADOPTED",
        "52025PC9002:RETIRE",
        "52025PC9003:PROP_REJECTED",
        "52025PC9005:PROP_ADOPTED",
        "62020CN9003:CJ",
      ],
    );
  });
});

describe("le raccord au corpus des changements de statut", () => {
  it("mappe la préparation et lit ses écarts durables", () => {
    const racine = racineTemporaire();
    ecrireCorpus(racine, "preparation", [
      unitePreparation("52025PC9001", "proposition", "PROPOSE", "2025/9001/COD"),
    ], {
      corpus: "preparation",
      documents: 1,
      unites: 1,
      couverture: {
        documents_ecartes: [
          { document: "52025PC9001", motif: "adoptee" },
          { document: "62025CN9001", motif: "decision_rendue" },
          { document: "62025CN9002", motif: "capture_absente" },
        ],
      },
    });

    assert.equal(corpusDeLEntree({ source: "preparation" }), "preparation");
    assert.deepEqual(
      documentsDeLEntree({ source: "preparation", id: "x", url: "", document: "52025PC9001" }, new Map()),
      ["52025PC9001"],
    );
    assert.deepEqual(
      documentsDeLEntree({ source: "preparation", id: "x", url: "", document: "32026R9001" }, new Map()),
      [],
      "un acte adopté n'est pas un document suivi",
    );
    const ecartes = documentsEcartes(racine, "preparation");
    assert.equal(ecartes.get("52025PC9001"), "adoptee");
    assert.equal(ecartes.get("62025CN9001"), "decision_rendue");
    assert.equal(
      ecartes.has("62025CN9002"),
      false,
      "une capture absente est transitoire, le document reste à rejouer",
    );
  });

  it("relance la préparation, la CJUE et le corpus visé selon le cas", async () => {
    const racine = racineTemporaire();
    ecrireCorpus(racine, "preparation", [
      unitePreparation("52025PC9001", "proposition", "PROPOSE", "2025/9001/COD"),
      unitePreparation("62025CN9001", "affaire", "PENDANT", "C-9001/25"),
    ]);
    ecrireCorpus(racine, "cjue", [
      {
        ...unitePreparation("62020CJ0002", "affaire", "rendue", "C-2/20"),
        corpus: "cjue",
        ref: "62020CJ0002#h1",
      },
    ]);
    ecrireEntree(
      racine,
      entreePreparation("52025PC9001", "PROP_ADOPTED", {
        acte_adopte: "32026R9001",
        corpus_vise: "rgpd",
        date_acte: "2026-05-30",
      }),
    );
    ecrireEntree(
      racine,
      entreePreparation("62025CN9001", "CJ", {
        statut_avant: "PENDANT",
        decision: "62025CJ9001",
        date_acte: "2026-11-05",
      }),
    );

    const appels: string[] = [];
    const preparation: AgentSync = async () => {
      appels.push("preparation");
      // La synchronisation réelle fait sortir les documents suivis du corpus et
      // les déclare écartés avec leur motif.
      ecrireCorpus(racine, "preparation", [], {
        corpus: "preparation",
        documents: 0,
        unites: 0,
        couverture: {
          documents_ecartes: [
            { document: "52025PC9001", motif: "adoptee" },
            { document: "62025CN9001", motif: "decision_rendue" },
          ],
        },
      });
      return { ecrit: true, message: "0 proposition(s), 0 affaire(s) pendante(s)" };
    };
    const cjue: AgentSync = async (cible) => {
      appels.push(`cjue:${cible?.entree?.decision ?? "liste"}`);
      return { ecrit: true, message: "62025CJ9001 entré au corpus CJUE par le filtre" };
    };
    const rgpd: AgentSync = async (cible) => {
      appels.push(`rgpd:${cible?.entree?.acte_adopte ?? "liste"}`);
      return { ecrit: false, message: "texte adopté : en attente de consolidation" };
    };

    const rapport = await syncCorpus({
      rootDir: racine,
      date: "2026-11-15",
      depuis: "2026-11-08",
      agents: { preparation, cjue, rgpd },
      embedder: embedderFactice(),
    });

    assert.deepEqual(
      appels,
      ["preparation", "cjue:liste", "rgpd:32026R9001"],
      "la préparation passe avant la CJUE ; le corpus visé est relancé",
    );
    const proposition = rapport.documents.find(
      (document) => document.document === "52025PC9001",
    );
    assert.equal(proposition?.statut, "ecarte");
    assert.equal(proposition?.motif, "adoptee");
    assert.equal(proposition?.corpus_vise, "rgpd");
    const affaire = rapport.documents.find((document) => document.document === "62025CN9001");
    assert.equal(affaire?.statut, "ecarte");
    assert.equal(affaire?.motif, "decision_rendue");
    assert.equal(rapport.sources.find((source) => source.source === "preparation")?.statut, "ok");
    assert.equal(rapport.sources.find((source) => source.source === "cjue")?.statut, "ok");
    assert.equal(rapport.sources.find((source) => source.source === "rgpd")?.statut, "ok");
    assert.equal(rapport.a_jour_au, "2026-11-15");
    assert.match(formaterRapport(rapport), /52025PC9001 \(preparation\) → rgpd/);
  });

  it("classe le document périmé tant que la préparation n'a pas suivi", async () => {
    const racine = racineTemporaire();
    ecrireCorpus(racine, "preparation", [
      unitePreparation("52025PC9001", "proposition", "PROPOSE", "2025/9001/COD"),
    ]);
    ecrireCorpus(racine, "cjue", [
      {
        ...unitePreparation("62020CJ0002", "affaire", "rendue", "C-2/20"),
        corpus: "cjue",
        ref: "62020CJ0002#h1",
      },
    ]);
    ecrireEntree(
      racine,
      entreePreparation("52025PC9001", "PROP_ADOPTED", {
        acte_adopte: "32026R9001",
        corpus_vise: "rgpd",
      }),
    );

    const appels: string[] = [];
    const rapport = await syncCorpus({
      rootDir: racine,
      date: "2026-11-15",
      depuis: "2026-11-08",
      agents: {
        preparation: async () => {
          appels.push("preparation");
          return { ecrit: false, message: "panne simulée sans écriture" };
        },
        rgpd: INERTE,
      },
      embedder: embedderFactice(),
    });

    assert.deepEqual(appels, ["preparation"]);
    const document = rapport.documents.find((element) => element.document === "52025PC9001");
    assert.equal(document?.statut, "perime");
    assert.equal(document?.motif, "statut du corpus antérieur");
    assert.equal(document?.version, "PROP_ADOPTED");
    assert.match(formaterRapport(rapport), /Périmés : 52025PC9001 \(preparation\) → rgpd — statut du corpus antérieur/);
  });

  it("dit l'attente de consolidation sans lire un statut comme une version", async () => {
    const agents = agentsParDefaut(racineTemporaire(), {
      syncPreparation: async () => ({
        propositions: 0,
        affaires: 0,
        affairesPresumees: 0,
        unites: 0,
        exclusions: {
          retiree: 0,
          adoptee: 1,
          rejetee: 0,
          statut_absent: 0,
          autre: 0,
          decision_rendue: 0,
          capture_absente: 0,
          date_invalide: 0,
          texte_vide: 0,
        },
        documentsEcartes: [{ document: "52025PC9001", motif: "adoptee" }],
        telechargements: 0,
        ecrit: true,
        manifestPath: "",
        unitesPath: "",
      }),
    });
    const entree = entreePreparation("52025PC9001", "PROP_ADOPTED", {
      acte_adopte: "32026R9001",
      corpus_vise: "rgpd",
    });
    const preparation = await agents.preparation({ entree });
    assert.match(preparation.message, /corpus rgpd en attente de consolidation/);

    // Le statut `PROP_ADOPTED` n'est pas une consolidation : il n'est jamais
    // transmis à `synchroniserActeUe`.
    const rgpd = await agents.rgpd({ entree });
    assert.equal(rgpd.ecrit, false);
    assert.match(rgpd.message, /aucune version consolidée à appliquer/);
  });

  it("n'ajoute rien aux CELEX complémentaires quand le filtre CJUE prend l'arrêt", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    writeFileSync(
      descripteurPath,
      `${JSON.stringify(
        {
          corpus: "cjue",
          types_retenus: { CJ: "Arrêt de la Cour" },
          celex_complementaires: ["62018CJ0746"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    ecrireCorpus(racine, "cjue", []);

    let appels = 0;
    const resultat = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CJ9001",
      descripteurPath,
      syncImpl: async () => {
        appels += 1;
        ajouterUniteCjue(racine, "62025CJ9001");
        return { ecrit: true };
      },
    });

    assert.equal(appels, 1);
    assert.equal(resultat.complementaire, false);
    assert.match(resultat.message, /par le filtre/);
    const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as {
      celex_complementaires: string[];
    };
    assert.deepEqual(descripteur.celex_complementaires, ["62018CJ0746"]);
  });

  it("ajoute un arrêt suivi hors filtre aux CELEX complémentaires, par le code", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    writeFileSync(
      descripteurPath,
      `${JSON.stringify(
        {
          corpus: "cjue",
          types_retenus: { CJ: "Arrêt de la Cour" },
          celex_complementaires: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    ecrireCorpus(racine, "cjue", []);

    let appels = 0;
    const syncImpl = async (options: SyncCjueOptions) => {
      appels += 1;
      const chemin = options.descripteurPath ?? descripteurPath;
      const descripteur = JSON.parse(readFileSync(chemin, "utf8")) as {
        celex_complementaires: string[];
      };
      if (descripteur.celex_complementaires.includes("62025CJ9001")) {
        ajouterUniteCjue(racine, "62025CJ9001");
      }
      return { ecrit: true };
    };

    const resultat = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CJ9001",
      descripteurPath,
      syncImpl,
    });

    assert.equal(appels, 2, "une passe par le filtre, une après l'ajout");
    assert.equal(resultat.complementaire, true);
    assert.match(resultat.message, /CELEX complémentaires/);
    assert.equal(documentsCjue(racine).has("62025CJ9001"), true);
    const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as {
      celex_complementaires: string[];
    };
    assert.deepEqual(descripteur.celex_complementaires, ["62025CJ9001"]);

    const encore = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CJ9001",
      descripteurPath,
      syncImpl,
    });
    assert.equal(appels, 2, "un arrêt déjà au corpus n'est pas relu");
    assert.match(encore.message, /déjà au corpus CJUE/);
  });

  it("rétablit le descripteur quand le corpus ne suit pas", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    const avant = `${JSON.stringify(
      {
        corpus: "cjue",
        types_retenus: { CJ: "Arrêt de la Cour" },
        celex_complementaires: [],
      },
      null,
      2,
    )}\n`;
    writeFileSync(descripteurPath, avant, "utf8");
    ecrireCorpus(racine, "cjue", []);

    await assert.rejects(
      incorporerArretVeille({
        rootDir: racine,
        celex: "62025CJ9001",
        descripteurPath,
        syncImpl: async () => ({ ecrit: false }),
      }),
      /absent\(s\) du corpus CJUE/,
    );
    assert.equal(readFileSync(descripteurPath, "utf8"), avant);
  });

  it("verse deux arrêts rendus le même jour en une passe", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    writeFileSync(
      descripteurPath,
      `${JSON.stringify(
        {
          corpus: "cjue",
          types_retenus: { CJ: "Arrêt de la Cour" },
          celex_complementaires: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    ecrireCorpus(racine, "cjue", []);

    let appels = 0;
    const syncImpl = async (options: SyncCjueOptions) => {
      appels += 1;
      const descripteur = JSON.parse(
        readFileSync(options.descripteurPath ?? descripteurPath, "utf8"),
      ) as { celex_complementaires: string[] };
      for (const celex of descripteur.celex_complementaires) ajouterUniteCjue(racine, celex);
      return { ecrit: true };
    };
    ecrireEntree(racine, entreePreparation("62025CN9001", "CJ", { decision: "62025CJ9001" }));
    ecrireEntree(racine, entreePreparation("62025CN9002", "CJ", { decision: "62025CJ9002" }));

    const resultat = await incorporerArretsVeille({
      rootDir: racine,
      celexes: decisionsSuivies(racine),
      descripteurPath,
      syncImpl,
    });

    assert.equal(appels, 2, "une passe par le filtre, une après l'ajout groupé");
    assert.deepEqual([...documentsCjue(racine)].sort(), ["62025CJ9001", "62025CJ9002"]);
    assert.deepEqual(resultat.complementaires, ["62025CJ9001", "62025CJ9002"]);
    assert.equal(resultat.messages.length, 2);
    assert.deepEqual(arretsAVerser(racine), [], "plus rien à verser après la passe");
  });

  it("ne redemande pas un arrêt durablement écarté du corpus CJUE", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    writeFileSync(
      descripteurPath,
      `${JSON.stringify({
        corpus: "cjue",
        types_retenus: { CJ: "Arrêt de la Cour" },
        celex_complementaires: [],
      })}\n`,
      "utf8",
    );
    ecrireCorpus(racine, "cjue", [], {
      corpus: "cjue",
      documents: 0,
      fragments: 0,
      couverture: {
        documents_ecartes: [{ celex: "62025CJ9001", motif: "xhtml_absent" }],
      },
    });

    let appels = 0;
    const resultat = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CJ9001",
      descripteurPath,
      syncImpl: async () => {
        appels += 1;
        return { ecrit: false };
      },
    });

    assert.equal(appels, 0, "un écart durable ne se redemande pas à chaque passe");
    assert.match(resultat.message, /écarté durablement/);
    assert.deepEqual(arretsAVerser(racine), []);
    const descripteur = JSON.parse(readFileSync(descripteurPath, "utf8")) as {
      celex_complementaires: string[];
    };
    assert.deepEqual(descripteur.celex_complementaires, []);
  });

  it("arrête la passe quand la synchronisation découvre un écart durable", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    const avant = `${JSON.stringify(
      {
        corpus: "cjue",
        types_retenus: { CJ: "Arrêt de la Cour" },
        celex_complementaires: [],
      },
      null,
      2,
    )}\n`;
    writeFileSync(descripteurPath, avant, "utf8");
    ecrireCorpus(racine, "cjue", []);

    let appels = 0;
    const resultat = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CJ9001",
      descripteurPath,
      syncImpl: async () => {
        appels += 1;
        // La synchronisation réelle écrit son manifeste d'exclusions : ici, un
        // XHTML absent, motif durable.
        ecrireCorpus(racine, "cjue", [], {
          corpus: "cjue",
          documents: 0,
          fragments: 0,
          couverture: {
            documents_ecartes: [{ celex: "62025CJ9001", motif: "xhtml_absent" }],
          },
        });
        return { ecrit: true };
      },
    });

    assert.equal(appels, 1, "aucune seconde synchronisation pour un écart durable");
    assert.match(resultat.message, /écarté durablement/);
    assert.equal(readFileSync(descripteurPath, "utf8"), avant);
  });

  it("ne verse pas un type que la CJUE ne retient pas", async () => {
    const racine = racineTemporaire();
    const descripteurPath = join(racine, "descripteur.json");
    writeFileSync(
      descripteurPath,
      `${JSON.stringify({
        corpus: "cjue",
        types_retenus: { CJ: "Arrêt de la Cour" },
        celex_complementaires: [],
      })}\n`,
      "utf8",
    );
    let appels = 0;
    const resultat = await incorporerArretVeille({
      rootDir: racine,
      celex: "62025CC9001",
      descripteurPath,
      syncImpl: async () => {
        appels += 1;
        return { ecrit: false };
      },
    });
    assert.equal(appels, 0);
    assert.equal(resultat.complementaire, false);
    assert.match(resultat.message, /type CC non retenu/);
  });
});

/** Ajoute une unité CJUE au corpus d'une racine temporaire. */
function ajouterUniteCjue(racine: string, celex: string): void {
  const chemin = join(racine, "data", "corpus", "cjue", "unites.jsonl");
  const existant = existsSync(chemin) ? readFileSync(chemin, "utf8") : "";
  const unite: Unite = {
    ref: `${celex}#h1`,
    document: celex,
    corpus: "cjue",
    niveau: "fragment",
    numero: "1",
    chemin: "CJUE > Arrêt > 1",
    texte: "La protection des données à caractère personnel est un droit fondamental.",
    date_acte: "2026-11-05",
    date_debut: "2026-11-05",
    date_fin: null,
    statut: "Arrêt de la Cour",
    url: `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${celex}`,
  };
  writeFileSync(chemin, `${existant}${JSON.stringify(unite)}\n`, "utf8");
}
