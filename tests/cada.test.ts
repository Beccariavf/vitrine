import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { AnalyseurCsv, enregistrementsCsv, lireCsv } from "../mcp/corpus/cada/csv.ts";
import {
  anomaliesDe,
  dateIso,
  deciderVolume,
  decouperAvis,
  lireDescripteur,
  lireLigne,
  mesurer,
  motivationDe,
  sensDe,
  unitesCada,
} from "../mcp/corpus/cada/parse.ts";
import type { DescripteurCada } from "../mcp/corpus/cada/parse.ts";
import { colonnesDe } from "../mcp/corpus/cada/parse.ts";
import { lireEtat, syncCada, validerUnites } from "../mcp/corpus/cada/sync.ts";
import type { RessourceCada } from "../mcp/corpus/cada/source.ts";
import { idEntree, passeCada } from "../veille/sources/cada.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";
import { corpusDeLEntree } from "../mcp/corpus/veille.ts";
import type { FetchLike } from "../veille/fetch.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/cada/avis.csv", import.meta.url));
const DESCRIPTEUR_FIXTURE = fileURLToPath(new URL("./fixtures/cada/descripteur.json", import.meta.url));

const racines: string[] = [];

function racine(): string {
  const dossier = mkdtempSync(join(tmpdir(), "vitrine-cada-"));
  racines.push(dossier);
  return dossier;
}

after(() => {
  for (const dossier of racines) rmSync(dossier, { recursive: true, force: true });
});

/** Descripteur de test, avec le plafond de volume demandé. */
function descripteurTest(fragmentsMax: number, dateMin = "2016-10-08"): DescripteurCada {
  const descripteur = lireDescripteur(DESCRIPTEUR_FIXTURE);
  return {
    ...descripteur,
    date_min: dateMin,
    volume: { ...descripteur.volume, fragments_max: fragmentsMax },
  };
}

/** Écrit un descripteur dans une racine temporaire et rend son chemin. */
function ecrireDescripteur(root: string, descripteur: DescripteurCada): string {
  const chemin = join(root, "descripteur.json");
  writeFileSync(chemin, `${JSON.stringify(descripteur, null, 2)}\n`, "utf8");
  return chemin;
}

/** Ressource de test : la fixture, avec la taille et l'empreinte voulues. */
function ressourceFixture(sha1: string, taille: number): RessourceCada {
  return {
    id: "3a6d6fe3-8548-43ed-ad09-72052771447c",
    titre: "Ensemble consolidé des avis et conseils de la CADA",
    url: "https://static.data.gouv.fr/resources/avis-et-conseils-de-la-cada/20260814-172417/cada-2026-08-14.csv",
    sha1,
    modifiee_le: "2026-08-14",
    taille,
  };
}

/** Copie la fixture dans `data/raw/cada/` de la racine, comme le ferait un téléchargement. */
function installerFixture(root: string): { chemin: string; taille: number; sha256: string } {
  const dossier = join(root, "data", "raw", "cada");
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, "cada-2026-08-14.csv");
  copyFileSync(FIXTURE, chemin);
  const octets = readFileSync(chemin);
  return {
    chemin,
    taille: octets.length,
    sha256: createHash("sha256").update(octets).digest("hex"),
  };
}

const fetchInterdit: FetchLike = async () => {
  throw new Error("réseau interdit dans ce test");
};

describe("lecture du CSV de la CADA", () => {
  it("lit un en-tête avec BOM et cinq avis, guillemets et retours à la ligne compris", async () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    assert.equal(records.length, 6);
    assert.deepEqual(records[0], [
      "Numéro de dossier",
      "Administration",
      "Type",
      "Année",
      "Séance",
      "Objet",
      "Thème et sous thème",
      "Mots clés",
      "Sens et motivation",
      "Partie",
      "Avis",
    ]);
    assert.equal(records[1]?.[0], "202400001");
    assert.equal(records[3]?.[2], "Sanction");

    const parFlux: string[][] = [];
    for await (const enregistrement of enregistrementsCsv(FIXTURE)) parFlux.push(enregistrement);
    assert.deepEqual(parFlux, records);
  });

  it("décide du guillemet doublé à cheval sur deux morceaux", () => {
    const analyseur = new AnalyseurCsv();
    const records = [
      ...analyseur.pousser('a,"b""'),
      ...analyseur.pousser('c",d\n'),
      ...analyseur.terminer(),
    ];
    assert.deepEqual(records, [["a", 'b"c', "d"]]);

    const fin = new AnalyseurCsv();
    assert.deepEqual([...fin.pousser('x,"y"'), ...fin.terminer()], [["x", "y"]]);
  });

  it("gère les guillemets doublés, les virgules et les sauts de ligne cités", () => {
    const analyseur = new AnalyseurCsv();
    const records = [
      ...analyseur.pousser('a,"b,c","d""e"\r\n'),
      ...analyseur.pousser('f,"g\nh",i\nj,k'),
      ...analyseur.terminer(),
    ];
    assert.deepEqual(records, [
      ["a", "b,c", 'd"e'],
      ["f", "g\nh", "i"],
      ["j", "k"],
    ]);
  });
});

describe("champs d'une ligne", () => {
  it("découpe date, sens et motivation", () => {
    assert.equal(dateIso("03/03/1984"), "1984-03-03");
    assert.equal(dateIso("32/03/1984"), null);
    assert.equal(dateIso("1984-03-03"), null);
    assert.equal(sensDe("Défavorable/Défense"), "Défavorable");
    assert.equal(sensDe("Sans objet"), "Sans objet");
    assert.equal(motivationDe("Défavorable/Défense"), "Défense");
    assert.equal(motivationDe("Sans objet"), "");
  });

  it("mappe un avis avec son administration, son sens, son thème et ses mots-clés", () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const lecture = lireLigne(records[1] ?? [], colonnes);
    assert.equal(lecture.genre, "document");
    if (lecture.genre !== "document") return;
    const { document } = lecture;
    assert.equal(document.numero, "202400001");
    assert.equal(document.nature, "Avis");
    assert.equal(document.date, "2024-04-18");
    assert.equal(document.seance, "18/04/2024");
    assert.equal(document.administration, "Préfecture de la Somme");
    assert.equal(document.sens, "Favorable");
    assert.equal(document.motivation, "Communication");
    assert.equal(document.theme, "Données publiques");
    assert.deepEqual(document.motsCles, ["Document administratif"]);
  });

  it("écarte une ligne sans numéro, sans date ou sans texte, en le motivant", () => {
    const colonnes = colonnesDe(lireCsv(readFileSync(FIXTURE, "utf8"))[0] ?? []);
    const ligne = (numero: string, seance: string, texte: string): string[] => [
      numero,
      "Administration",
      "Avis",
      "2024",
      seance,
      "",
      "",
      "",
      "Favorable",
      "III",
      texte,
    ];
    assert.deepEqual(lireLigne(ligne("abc", "18/04/2024", "texte"), colonnes), {
      genre: "exclue",
      motif: "numéro invalide",
    });
    assert.deepEqual(lireLigne(ligne("202400001", "18-04-2024", "texte"), colonnes), {
      genre: "exclue",
      motif: "date invalide",
    });
    assert.deepEqual(lireLigne(ligne("202400001", "18/04/2024", "  "), colonnes), {
      genre: "exclue",
      motif: "texte vide",
    });
  });
});

describe("découpage et unités", () => {
  it("découpe un texte long sans perdre de texte", () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const lecture = lireLigne(records[5] ?? [], colonnes);
    assert.equal(lecture.genre, "document");
    if (lecture.genre !== "document") return;
    const fragments = decouperAvis(lecture.document.texte);
    assert.equal(fragments.length, 3);
    assert.ok(fragments.every((fragment) => fragment.length <= 1200));
    assert.ok(fragments.every((fragment) => fragment.length >= 600));
    assert.equal(fragments.join(" "), lecture.document.texte.split(/\n+/).map((p) => p.trim()).filter(Boolean).join(" "));
  });

  it("rend une unité par fragment avec numéro, date, administration, sens et lien", () => {
    const descripteur = descripteurTest(35300);
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const lecture = lireLigne(records[1] ?? [], colonnes);
    assert.equal(lecture.genre, "document");
    if (lecture.genre !== "document") return;
    const unites = unitesCada(lecture.document, descripteur);
    assert.equal(unites.length, 1);
    const [unite] = unites;
    assert.equal(unite?.ref, "202400001#f0");
    assert.equal(unite?.document, "202400001");
    assert.equal(unite?.corpus, "cada");
    assert.equal(unite?.niveau, "fragment");
    assert.equal(unite?.numero, "202400001");
    assert.equal(unite?.date_acte, "2024-04-18");
    assert.equal(unite?.date_debut, "2024-04-18");
    assert.equal(unite?.nature, "Avis");
    assert.equal(unite?.statut, "Avis");
    assert.equal(unite?.administration, "Préfecture de la Somme");
    assert.equal(unite?.sens, "Favorable");
    assert.equal(unite?.motivation, "Communication");
    assert.equal(unite?.theme, "Données publiques");
    assert.deepEqual(unite?.mots_cles, ["Document administratif"]);
    assert.equal(unite?.url, "https://www.cada.fr/202400001");
    assert.match(unite?.chemin ?? "", /CADA > Avis > 202400001 > Préfecture de la Somme > Favorable/);
  });

  it("refuse une unité sans texte, sans date ou de référence dupliquée", () => {
    const descripteur = descripteurTest(35300);
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const lecture = lireLigne(records[1] ?? [], colonnes);
    assert.equal(lecture.genre, "document");
    if (lecture.genre !== "document") return;
    const unites = unitesCada(lecture.document, descripteur);
    const unite = unites[0];
    assert.ok(unite !== undefined);
    assert.throws(() => validerUnites([...unites, ...unites]), /référence dupliquée/);
    assert.throws(() => validerUnites([{ ...unite, texte: "" }]), /texte vide/);
    assert.throws(() => validerUnites([{ ...unite, date_acte: "2024-13-40" }]), /date non ISO/);
  });
});

describe("mesure et règle de volume", () => {
  it("compte lignes, documents, fragments, exclusions et anomalies", () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const mesure = mesurer(records.slice(1), colonnes);
    assert.equal(mesure.lignes_lues, 5);
    assert.equal(mesure.documents, 5);
    assert.equal(mesure.fragments_total, 9);
    assert.equal(mesure.fragments.get("201400004"), 3);
    assert.deepEqual(anomaliesDe(mesure).map((anomalie) => anomalie.lignes), [1]);
  });

  it("tranche tout, sous-ensemble, ou sous-ensemble trop gros", () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const mesure = mesurer(records.slice(1), colonnesDe(records[0] ?? []));

    const tout = deciderVolume(mesure, descripteurTest(9));
    assert.equal(tout.decision, "tout");
    assert.equal(tout.indexable, true);
    assert.equal(tout.fragments_retenus, 9);

    const sousEnsemble = deciderVolume(mesure, descripteurTest(7));
    assert.equal(sousEnsemble.decision, "sous_ensemble");
    assert.equal(sousEnsemble.indexable, true);
    assert.equal(sousEnsemble.fragments_retenus, 6);
    assert.ok(sousEnsemble.part_index > 0);

    const trop = deciderVolume(mesure, descripteurTest(5));
    assert.equal(trop.decision, "sous_ensemble_non_indexe");
    assert.equal(trop.indexable, false);
    assert.equal(trop.fragments_retenus, 6);
  });

  it("compte une ligne dupliquée comme exclusion, sans doubler le document", () => {
    const records = lireCsv(readFileSync(FIXTURE, "utf8"));
    const colonnes = colonnesDe(records[0] ?? []);
    const mesure = mesurer([...(records.slice(1) as string[][]), records[1] as string[]], colonnes);
    assert.equal(mesure.documents, 5);
    assert.equal(mesure.motifs.get("numéro dupliqué"), 1);
  });
});

describe("synchronisation du corpus", () => {
  it("mesure en dry-run sans rien écrire, puis écrit après validation", async () => {
    const root = racine();
    const { chemin, taille, sha256 } = installerFixture(root);
    const descripteur = ecrireDescripteur(root, descripteurTest(7));

    const essai = await syncCada({
      rootDir: root,
      descripteurPath: descripteur,
      fichier: chemin,
      dryRun: true,
    });
    assert.equal(essai.lignes_lues, 5);
    assert.equal(essai.documents, 4);
    assert.equal(essai.unites, 6);
    assert.equal(essai.fragments_total, 9);
    assert.equal(essai.volume.decision, "sous_ensemble");
    assert.deepEqual(
      essai.exclusions.map((exclusion) => [exclusion.motif, exclusion.lignes]),
      [["antérieur au 2016-10-08", 1]],
    );
    assert.equal(existsSync(join(root, "data", "corpus", "cada", "unites.jsonl")), false);

    const resultat = await syncCada({ rootDir: root, descripteurPath: descripteur, fichier: chemin });
    assert.equal(resultat.ecrit, true);
    assert.equal(resultat.delta.documents_ajoutes, 4);
    assert.equal(resultat.delta.unites_ajoutees, 6);

    const manifeste = JSON.parse(
      readFileSync(join(root, "data", "corpus", "cada", "manifest.json"), "utf8"),
    ) as {
      documents: number;
      unites: number;
      par_nature: Record<string, { documents: number; unites: number }>;
      par_sens: Record<string, number>;
      source: { fichier: string; sha256: string };
      couverture: {
        lignes_lues: number;
        exclusions: { motif: string; lignes: number }[];
        anomalies: { lignes: number; constat: string }[];
        volume: { decision: string; indexable: boolean };
        bornes: { debut: string; fin: string };
      };
    };
    assert.equal(manifeste.documents, 4);
    assert.equal(manifeste.unites, 6);
    assert.equal(manifeste.par_nature.Avis?.documents, 2);
    assert.equal(manifeste.par_nature.Sanction?.documents, 1);
    assert.equal(manifeste.par_sens.Favorable, 2);
    assert.equal(manifeste.par_sens["Sans objet"], 1);
    assert.equal(manifeste.source.fichier, "cada-2026-08-14.csv");
    assert.equal(manifeste.source.sha256, sha256);
    assert.equal(manifeste.couverture.lignes_lues, 5);
    assert.deepEqual(manifeste.couverture.bornes, { debut: "2024-04-18", fin: "2024-04-20" });
    assert.equal(manifeste.couverture.anomalies[0]?.lignes, 1);
    assert.match(manifeste.couverture.anomalies[0]?.constat ?? "", /Sanction/);
    assert.equal(manifeste.couverture.volume.indexable, true);

    const etat = lireEtat(join(root, "data", "corpus", "cada", "etat.json"));
    assert.equal(etat?.sha256, sha256);
    assert.equal(etat?.documents, 4);
    assert.equal(etat?.unites, 6);
    assert.equal(etat?.fichier, "cada-2026-08-14.csv");
    assert.equal(taille, readFileSync(chemin).length);
  });

  it("ne relit ni ne réécrit un fichier identique", async () => {
    const root = racine();
    const { taille } = installerFixture(root);
    const sha1 = "a".repeat(40);
    const descripteur = ecrireDescripteur(root, descripteurTest(7));
    await syncCada({
      rootDir: root,
      descripteurPath: descripteur,
      ressource: ressourceFixture(sha1, taille),
      fetchImpl: fetchInterdit,
    });

    const second = await syncCada({
      rootDir: root,
      descripteurPath: descripteur,
      ressource: ressourceFixture(sha1, taille),
      fetchImpl: fetchInterdit,
    });
    assert.equal(second.relu, false);
    assert.equal(second.ecrit, false);
    assert.equal(second.documents, 4);
    assert.equal(second.unites, 6);
    assert.equal(second.delta.documents_inchanges, 4);
    assert.equal(second.anomalies.length, 1);
  });

  it("n'indexe que les nouveaux avis lors d'une ressource mise à jour", async () => {
    const root = racine();
    const { chemin, taille } = installerFixture(root);
    const descripteur = ecrireDescripteur(root, descripteurTest(7));
    await syncCada({
      rootDir: root,
      descripteurPath: descripteur,
      ressource: ressourceFixture("a".repeat(40), taille),
      fetchImpl: fetchInterdit,
    });

    const ancien = readFileSync(chemin, "utf8");
    const ligne = '"202400006","Préfecture du Nord","Conseil","2024","21/04/2024","","Urbanisme","Permis de construire","Sans objet","III","La commission a rappelé les règles de communication des permis de construire."';
    writeFileSync(chemin, `${ancien.trimEnd()}\r\n${ligne}\r\n`, "utf8");
    const nouvelleTaille = readFileSync(chemin).length;

    const resultat = await syncCada({
      rootDir: root,
      descripteurPath: descripteur,
      ressource: ressourceFixture("b".repeat(40), nouvelleTaille),
      fetchImpl: fetchInterdit,
    });
    assert.equal(resultat.ecrit, true);
    assert.equal(resultat.documents, 5);
    assert.equal(resultat.unites, 7);
    assert.equal(resultat.delta.documents_ajoutes, 1);
    assert.equal(resultat.delta.documents_inchanges, 4);
    assert.equal(resultat.delta.unites_ajoutees, 1);
    assert.equal(resultat.delta.unites_inchangees, 6);
  });

  it("écrit le corpus mais le dit non indexable quand le sous-ensemble dépasse le plafond", async () => {
    const root = racine();
    const { chemin } = installerFixture(root);
    const descripteur = ecrireDescripteur(root, descripteurTest(5));
    const resultat = await syncCada({ rootDir: root, descripteurPath: descripteur, fichier: chemin });
    assert.equal(resultat.volume.decision, "sous_ensemble_non_indexe");
    assert.equal(resultat.volume.indexable, false);
    assert.equal(resultat.unites, 6);
    const manifeste = JSON.parse(
      readFileSync(join(root, "data", "corpus", "cada", "manifest.json"), "utf8"),
    ) as { couverture: { volume: { indexable: boolean; motif: string } } };
    assert.equal(manifeste.couverture.volume.indexable, false);
    assert.match(manifeste.couverture.volume.motif, /index n'est pas construit/);
  });
});

describe("veille de la ressource CADA", () => {
  const api = (sha1: string): string =>
    JSON.stringify({
      id: "53698f37a3a729239d2036a0",
      resources: [
        {
          id: "3a6d6fe3-8548-43ed-ad09-72052771447c",
          title: "Ensemble consolidé des avis et conseils de la CADA",
          url: "https://static.data.gouv.fr/resources/avis-et-conseils-de-la-cada/20260814-172417/cada-2026-08-14.csv",
          filesize: 198398592,
          last_modified: "2026-08-14T17:24:26.026000+00:00",
          checksum: { type: "sha1", value: sha1 },
        },
      ],
    });

  it("écrit une entrée quand l'état manque, puis rien quand la ressource est identique", async () => {
    const root = racine();
    const sha1 = "c".repeat(40);
    const fetchApi: FetchLike = async () => ({ ok: true, status: 200, text: async () => api(sha1) });

    const premiere = await passeCada({ rootDir: root, fetchImpl: fetchApi, maintenant: new Date("2026-11-25T10:00:00Z") });
    assert.equal(premiere.entries.length, 1);
    assert.equal(premiere.raw.length, 1);
    const [entree] = premiere.entries;
    assert.equal(entree?.source, "cada");
    assert.equal(entree?.version, sha1);
    assert.equal(entree?.publishedAt, "2026-11-25");
    assert.deepEqual(entree?.themes, ["donnees-non-personnelles"]);
    assert.equal(entree?.id, idEntree(ressourceFixture(sha1, 0)));
    assert.match(premiere.notes[0] ?? "", /ressource modifiée/);

    mkdirSync(join(root, "data", "corpus", "cada"), { recursive: true });
    writeFileSync(
      join(root, "data", "corpus", "cada", "etat.json"),
      `${JSON.stringify(
        {
          fichier: "cada-2026-08-14.csv",
          sha256: "d".repeat(64),
          lu_le: "2026-11-25",
          lignes_lues: 5,
          documents: 4,
          unites: 6,
          ressource: {
            id: "3a6d6fe3-8548-43ed-ad09-72052771447c",
            url: ressourceFixture(sha1, 0).url,
            sha1,
            modifiee_le: "2026-08-14",
            taille: 198398592,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const seconde = await passeCada({ rootDir: root, fetchImpl: fetchApi });
    assert.deepEqual(seconde.entries, []);
    assert.deepEqual(seconde.raw, []);
    assert.match(seconde.notes[0] ?? "", /ressource inchangée/);
  });

  it("écrit une nouvelle entrée quand le sha1 change", async () => {
    const root = racine();
    mkdirSync(join(root, "data", "corpus", "cada"), { recursive: true });
    writeFileSync(
      join(root, "data", "corpus", "cada", "etat.json"),
      `${JSON.stringify({
        fichier: "cada-2026-08-14.csv",
        sha256: "e".repeat(64),
        lu_le: "2026-11-24",
        lignes_lues: 5,
        documents: 4,
        unites: 6,
        ressource: {
          id: "3a6d6fe3-8548-43ed-ad09-72052771447c",
          url: ressourceFixture("f".repeat(40), 0).url,
          sha1: "f".repeat(40),
          modifiee_le: "2026-08-01",
          taille: 198398592,
        },
      })}\n`,
      "utf8",
    );
    const fetchApi: FetchLike = async () => ({ ok: true, status: 200, text: async () => api("a".repeat(40)) });
    const resultat = await passeCada({ rootDir: root, fetchImpl: fetchApi });
    assert.equal(resultat.entries.length, 1);
    assert.equal(resultat.entries[0]?.version, "a".repeat(40));
  });

  it("raccorde la source au corpus et rend un statut adopté", () => {
    assert.equal(corpusDeLEntree({ source: "cada" }), "cada");
    assert.equal(statutApplication("cada", "Avis", "Avis"), "adoptee");
    assert.equal(statutApplication("cada", "Conseil", "Conseil"), "adoptee");
  });
});
