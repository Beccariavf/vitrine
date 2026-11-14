import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { FetchLike } from "../veille/fetch.ts";
import { statutApplication, mentionPreparation } from "../mcp/corpus/statut.ts";
import { inventaireCorpus } from "../mcp/corpus/sync-rapport.ts";
import {
  choisirProposition,
  classerProposition,
  clesDecisions,
  dateIso,
  decisionRendue,
  derniereEtape,
  lireAffaires,
  lireEvenements,
  lirePropositions,
  numeroAffaire,
  pendantPresume,
  regrouperParDossier,
  requeteEvenements,
  requetePropositions,
} from "../mcp/corpus/preparation/liste.ts";
import type { AffaireListee, DescripteurPreparation } from "../mcp/corpus/preparation/liste.ts";
import { extraireCommunication, nomFichierCache } from "../mcp/corpus/preparation/parse.ts";
import { syncPreparation } from "../mcp/corpus/preparation/sync.ts";
import type { ManifestePreparation } from "../mcp/corpus/preparation/sync.ts";

const FIXTURES = new URL("./fixtures/preparation/", import.meta.url);
const DESCRIPTEUR = JSON.parse(
  readFileSync(new URL("../mcp/corpus/preparation/descripteur.json", import.meta.url), "utf8"),
) as DescripteurPreparation;

function fixture(nom: string): unknown {
  return JSON.parse(readFileSync(new URL(nom, FIXTURES), "utf8")) as unknown;
}

function capture(nom: string): string {
  return readFileSync(new URL(nom, FIXTURES), "utf8");
}

const PROPOSITIONS = fixture("propositions.json");
const EVENEMENTS = fixture("evenements.json");
const AFFAIRES = fixture("affaires.json");
const DECISIONS: Record<string, unknown> = {
  "2019": fixture("decisions-2019.json"),
  "2020": fixture("decisions-2020.json"),
  "2024": fixture("decisions-2024.json"),
  "2025": fixture("decisions-2025.json"),
};
const MODERNE = capture("62025CN0703.xhtml");
const PATRIMONIAL = capture("62019TN0001.xhtml");

/** Aucune passe de test ne sort du disque : la seule capture absente répond 404. */
function fetchAbsent(): FetchLike {
  return async () => ({ ok: false, status: 404, text: async () => "" });
}

const DATE_PASSE = "2026-11-14";

const racines: string[] = [];

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "preparation-"));
  racines.push(racine);
  return racine;
}

after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

/** Passe complète hors ligne : listes en fixtures, captures fournies, 404 sur la dernière. */
async function passe(rootDir: string) {
  return syncPreparation({
    rootDir,
    date: DATE_PASSE,
    reponses: {
      propositions: PROPOSITIONS,
      evenements: EVENEMENTS,
      affaires: AFFAIRES,
      decisions: DECISIONS,
    },
    captures: { "62025CN0703": MODERNE, "62019TN0001": PATRIMONIAL },
    fetchImpl: fetchAbsent(),
  });
}

describe("la liste des textes en préparation", () => {
  it("choisit une proposition par dossier et écarte le corrigendum", () => {
    const groupes = regrouperParDossier(lirePropositions(PROPOSITIONS));
    const dossier = groupes.get("http://publications.europa.eu/resource/dossier/2025/0360");
    assert.ok(dossier !== undefined);
    const choisie = choisirProposition(dossier);
    assert.equal(choisie.celex, "52025PC0360");
    assert.equal(choisie.ref, "2025/0360/COD");
    assert.equal(choisie.date, "2025-09-16");
    assert.ok(choisie.titre !== null);
  });

  it("classe les dossiers par statut, le retrait primant sur le statut", () => {
    const choisies = [...regrouperParDossier(lirePropositions(PROPOSITIONS)).values()].map(
      choisirProposition,
    );
    const motif = (celex: string) => {
      const proposition = choisies.find((candidate) => candidate.celex === celex);
      assert.ok(proposition !== undefined, celex);
      const verdict = classerProposition(proposition);
      return verdict.retenue ? "retenue" : verdict.motif;
    };
    assert.equal(motif("52025PC0360"), "retenue");
    assert.equal(motif("52024PC0599"), "retiree");
    assert.equal(motif("52025PC0401"), "rejetee");
    assert.equal(motif("52025PC0500"), "statut_absent");
    assert.equal(motif("52025PC0600"), "autre");
    // Le Digital Omnibus IA est adopté : il s'exclut, il n'est pas une unité.
    assert.equal(motif("52025PC0836"), "adoptee");
  });

  it("borne la requête aux actes du corpus et à la matière PDON", () => {
    const requete = requetePropositions(DESCRIPTEUR);
    assert.match(requete, /subject-matter\/PDON/);
    for (const acte of DESCRIPTEUR.actes_du_corpus) {
      assert.ok(requete.includes(`"${acte.celex}"`), acte.celex);
    }
    assert.equal(DESCRIPTEUR.actes_du_corpus.length, 7);
  });

  it("retient la dernière étape passée et ignore l'étape planifiée", () => {
    const etapes = lireEvenements(EVENEMENTS);
    assert.equal(etapes.length, 3);
    const derniere = derniereEtape(etapes, DATE_PASSE);
    assert.ok(derniere !== null);
    assert.equal(derniere.date, "2025-11-05");
    assert.equal(derniere.type, "COUNCIL_ORIENTATION_DEBATE");
    assert.match(requeteEvenements(["http://exemple/dossier"]), /VALUES \?dossier \{ <http:\/\/exemple\/dossier> \}/);
  });

  it("lit une date CELLAR même horodatée et rejette le reste", () => {
    assert.equal(dateIso("2025-11-05T00:00:00"), "2025-11-05");
    assert.equal(dateIso("2025-11-05"), "2025-11-05");
    assert.equal(dateIso("05/11/2025"), null);
    assert.equal(dateIso(null), null);
  });
});

describe("les affaires pendantes", () => {
  const affaires = lireAffaires(AFFAIRES);
  const affaire = (celex: string): AffaireListee => {
    const trouvee = affaires.find((candidate) => candidate.celex === celex);
    assert.ok(trouvee !== undefined, celex);
    return trouvee;
  };

  it("numérote les affaires selon leur type et leur procédure", () => {
    assert.equal(numeroAffaire(affaire("62025CN0703")), "C-703/25 P");
    assert.equal(numeroAffaire(affaire("62019TN0001")), "T-1/19");
    assert.equal(numeroAffaire(affaire("62020CN0149")), "C-149/20");
  });

  it("garde pendante une affaire sans décision de même numéro", () => {
    const decisions = clesDecisions(DECISIONS["2020"]);
    assert.equal(decisionRendue(affaire("62019TN0001"), decisions), false);
    // Une décision de la Cour de même année et de même numéro ferme l'affaire.
    assert.equal(decisionRendue(affaire("62020CN0149"), decisions), true);
    // Une décision du Tribunal de même numéro ne ferme pas une affaire de la Cour.
    const tribunal = clesDecisions({
      results: { bindings: [{ celex: { value: "62020TO0149" } }] },
    });
    assert.equal(decisionRendue(affaire("62020CN0149"), tribunal), false);
  });

  it("présume pendante une affaire ouverte depuis plus de trois ans", () => {
    assert.equal(pendantPresume(affaire("62019TN0001").date, DATE_PASSE, 3), true);
    assert.equal(pendantPresume(affaire("62025CN0703").date, DATE_PASSE, 3), false);
  });
});

describe("la communication du Journal officiel", () => {
  it("extrait le texte du rendu moderne jusqu'à la fin, sans le pied ELI / ISSN", () => {
    const communication = extraireCommunication(MODERNE, "62025CN0703");
    assert.ok(communication !== null);
    assert.equal(communication.numero, "C-703/25 P");
    assert.match(communication.texte, /^Pourvoi formé/);
    assert.match(communication.texte, /\(Affaire C-703\/25 P\)/);
    assert.match(communication.texte, /Moyens et principaux arguments/);
    assert.equal(communication.texte.includes("ELI:"), false);
    assert.equal(communication.texte.includes("ISSN"), false);
  });

  it("lit aussi le rendu patrimonial, entités décodées", () => {
    const communication = extraireCommunication(PATRIMONIAL, "62019TN0001");
    assert.ok(communication !== null);
    assert.equal(communication.numero, "T-1/19");
    assert.match(communication.texte, /^Recours introduit/);
    assert.match(communication.texte, /CJ\/Cour de justice de l’Union européenne/);
    assert.match(communication.texte, /anonymisé/);
    assert.equal(communication.texte.includes("ISSN"), false);
  });

  it("rend null sur une capture sans titre de document", () => {
    assert.equal(extraireCommunication("<html><body><p>vide</p></body></html>", "62024CN0999"), null);
  });

  it("nomme le fichier de cache d'après le CELEX", () => {
    assert.equal(nomFichierCache("62025CN0703"), "62025CN0703.xhtml");
    assert.equal(nomFichierCache("52025PC0360R(01)"), "52025PC0360R_01_.xhtml");
  });
});

describe("le statut d'application de la préparation", () => {
  it("rend propose et pendant, et jamais en_vigueur ni rendue", () => {
    assert.equal(statutApplication("preparation", "PROPOSE"), "propose");
    assert.equal(statutApplication("preparation", "PENDANT"), "pendant");
    for (const statut of [
      "EN_VIGUEUR",
      "VIGUEUR",
      "ADOPTE",
      "ADOPTEE",
      "PROP_PENDING",
      "PROP_ADOPTED",
      "PROP_REJECTED",
      "RENDU",
      "",
    ]) {
      const application = statutApplication("preparation", statut);
      assert.notEqual(application, "en_vigueur", statut);
      assert.notEqual(application, "rendue", statut);
      assert.equal(application, "inconnu", statut);
    }
  });

  it("porte la mise en garde du rendu", () => {
    assert.equal(
      mentionPreparation("propose"),
      "Texte non applicable — proposition en cours de procédure",
    );
    assert.equal(
      mentionPreparation("pendant"),
      "Affaire pendante — aucune décision rendue",
    );
    assert.match(mentionPreparation("inconnu"), /statut non reconnu/);
  });
});

describe("la passe de préparation", () => {
  it("écrit un corpus idempotent, avec ses comptes et ses exclusions", async () => {
    const racine = racineTemporaire();
    const resultat = await passe(racine);

    assert.equal(resultat.propositions, 1);
    assert.equal(resultat.affaires, 2);
    assert.equal(resultat.affairesPresumees, 1);
    assert.equal(resultat.unites, 3);
    assert.equal(resultat.telechargements, 1);
    assert.equal(resultat.ecrit, true);
    assert.deepEqual(resultat.exclusions, {
      retiree: 1,
      adoptee: 1,
      rejetee: 1,
      statut_absent: 1,
      autre: 1,
      decision_rendue: 1,
      capture_absente: 1,
      date_invalide: 0,
      texte_vide: 0,
    });
    assert.deepEqual(
      resultat.documentsEcartes.map((ecarte) => `${ecarte.document}:${ecarte.motif}`),
      [
        "52024PC0599:retiree",
        "52025PC0401:rejetee",
        "52025PC0500:statut_absent",
        "52025PC0600:autre",
        "52025PC0836:adoptee",
        "62020CN0149:decision_rendue",
        "62024CN0999:capture_absente",
      ],
    );

    const unitesPath = join(racine, "data/corpus/preparation/unites.jsonl");
    const manifestPath = join(racine, "data/corpus/preparation/manifest.json");
    const unites = readFileSync(unitesPath, "utf8")
      .split("\n")
      .filter((ligne) => ligne.trim() !== "")
      .map((ligne) => JSON.parse(ligne) as Record<string, unknown>);

    assert.deepEqual(
      unites.map((unite) => unite.ref),
      ["52025PC0360#proposition", "62025CN0703#affaire", "62019TN0001#affaire"],
    );
    const [proposition, pendant, presume] = unites;
    assert.ok(proposition !== undefined && presume !== undefined && pendant !== undefined);
    assert.equal(proposition.niveau, "proposition");
    assert.equal(proposition.statut, "PROPOSE");
    assert.equal(proposition.numero, "2025/0360/COD");
    assert.equal(proposition.chemin, "Préparation > Textes en préparation > 2025/0360/COD");
    assert.equal(proposition.derniere_etape, "COUNCIL_ORIENTATION_DEBATE — 2025-11-05");
    assert.match(String(proposition.texte), /Dernière étape : COUNCIL_ORIENTATION_DEBATE le 05\/11\/2025/);
    assert.match(String(proposition.texte), /protection des données personnelles/);
    assert.match(String(proposition.texte), /RGPD \(32016R0679\)/);
    assert.match(String(proposition.texte), /ePrivacy \(32002L0058\)/);
    // L'objet nomme les actes que cette proposition modifie, pas tout le corpus.
    assert.doesNotMatch(String(proposition.texte), /AI Act/);
    assert.equal(proposition.url, "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:52025PC0360");

    assert.equal(presume.niveau, "affaire");
    assert.equal(presume.statut, "PENDANT");
    assert.equal(presume.numero, "T-1/19");
    assert.equal(presume.pendant_presume, true);
    assert.equal(presume.url, "https://curia.europa.eu/juris/liste.jsf?num=T-1/19");

    assert.equal(pendant.numero, "C-703/25 P");
    assert.equal(pendant.decision_attaquee, "T-553/23 (62023TJ0553)");
    assert.equal(pendant.pendant_presume, undefined);
    assert.equal(pendant.chemin, "Préparation > Affaires pendantes > C-703/25 P");
    assert.equal(pendant.url, "https://curia.europa.eu/juris/liste.jsf?num=C-703/25");

    const manifeste = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestePreparation;
    assert.equal(manifeste.corpus, "preparation");
    assert.equal(manifeste.date_extraction, DATE_PASSE);
    assert.equal(manifeste.documents, 3);
    assert.equal(manifeste.unites, 3);
    assert.equal(manifeste.couverture.comptes.propositions, 1);
    assert.equal(manifeste.couverture.comptes.affaires, 2);
    assert.equal(manifeste.couverture.comptes.affaires_presumees, 1);
    assert.equal(manifeste.couverture.presomption_annees, 3);
    assert.equal(manifeste.couverture.consulte_le, DATE_PASSE);
    assert.deepEqual(manifeste.couverture.periode.propositions, {
      min: "2025-09-16",
      max: "2025-09-16",
    });
    assert.deepEqual(manifeste.couverture.periode.affaires, {
      min: "2019-01-07",
      max: "2025-10-31",
    });
    assert.deepEqual(manifeste.couverture.presumees, [
      { document: "62019TN0001", numero: "T-1/19" },
    ]);
    assert.match(manifeste.couverture.mention, /décision 2011\/833\/UE/);
    assert.match(manifeste.couverture.requetes.propositions, /act_preparatory_initiates_dossier/);
    assert.doesNotMatch(manifeste.couverture.requetes.propositions, /PLANNED/);
    assert.deepEqual(Object.keys(manifeste.couverture.requetes.decisions), [
      "2019",
      "2020",
      "2024",
      "2025",
    ]);

    // L'inventaire du serveur lit `documents`, `unites` et `date_extraction`.
    const inventaire = inventaireCorpus(racine).find((entree) => entree.corpus === "preparation");
    assert.ok(inventaire !== undefined);
    assert.equal(inventaire.documents, 3);
    assert.equal(inventaire.unites, 3);
    assert.equal(inventaire.arrete_le, DATE_PASSE);

    assert.equal(
      existsSync(join(racine, "data/raw/preparation/62025CN0703.xhtml")),
      true,
      "la communication est gardée en cache brut",
    );

    const octetsUnites = readFileSync(unitesPath, "utf8");
    const octetsManifeste = readFileSync(manifestPath, "utf8");
    const seconde = await passe(racine);
    assert.equal(seconde.ecrit, false, "une passe identique ne réécrit rien");
    assert.equal(readFileSync(unitesPath, "utf8"), octetsUnites);
    assert.equal(readFileSync(manifestPath, "utf8"), octetsManifeste);
  });
});
