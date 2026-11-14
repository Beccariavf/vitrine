import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  chargerTexte,
  extraireDocuments,
  lireDescripteur,
  parcourirReference,
} from "../mcp/corpus/cnil-doctrine/liste.ts";
import type {
  DescripteurDoctrine,
  FetchHtml,
  FetchPdf,
  PageReference,
} from "../mcp/corpus/cnil-doctrine/liste.ts";
import {
  chevauchement,
  dateDuDocument,
  deliberationDuDocument,
  deliberationsCitees,
  mentionContraire,
  slugDe,
  unitesDoctrine,
  validerUnites,
} from "../mcp/corpus/cnil-doctrine/parse.ts";
import { dateFr, mentionsDoctrine } from "../mcp/corpus/cnil-doctrine/mention.ts";
import { lireCorpusCnil, syncDoctrine } from "../mcp/corpus/cnil-doctrine/sync.ts";
import type { Passage } from "../mcp/tools.ts";
import { avecMarquageDoctrine } from "../mcp/tools.ts";
import { statutApplication } from "../mcp/corpus/statut.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = join(ICI, "fixtures", "cnil-doctrine");
const DESCRIPTEUR = lireDescripteur(join(ICI, "..", "mcp", "corpus", "cnil-doctrine", "descripteur.json"));

function fixture(nom: string): string {
  return readFileSync(join(FIXTURES, nom), "utf8");
}

const REFERENCE_GUIDES: PageReference = {
  type: "guide",
  url: "https://www.cnil.fr/fr/mediatheque?field_scald_collection_tid=29",
  pages_max: 8,
  liens: "pdf",
};
const REFERENCE_REFERENTIELS: PageReference = {
  type: "referentiel",
  url: "https://www.cnil.fr/fr/autres-referentiels",
  pages_max: 10,
  liens: "pdf",
};
const REFERENCE_LISTES: PageReference = {
  type: "liste_aipd",
  url: "https://www.cnil.fr/fr/listes-des-traitements-pour-lesquels-une-aipd-est-requise-ou-non",
  pages_max: 1,
  liens: "page",
  motif_page: "aipd",
  motif_pdf: "liste-traitements-aipd",
};

/** Un passage minimal du corpus de doctrine, pour tester le rendu du marquage. */
function passageDoctrine(document: string): Passage {
  return {
    ref: `${document}#f0`,
    document,
    corpus: "cnil_doctrine",
    niveau: "fragment",
    numero: document,
    texte: "Un extrait copié mot pour mot.",
    chemin: "Doctrine CNIL > Guides > Guide",
    url: `https://www.cnil.fr/sites/default/files/${document}.pdf`,
    date_acte: "2026-11-14",
    date_debut: "2026-11-14",
    date_fin: null,
    statut: "Publié",
    distance: 0.1,
    similarite: 0.9,
    statut_application: "adoptee",
  };
}

const racines: string[] = [];
after(() => {
  for (const racine of racines) rmSync(racine, { recursive: true, force: true });
});

function racineTemporaire(): string {
  const racine = mkdtempSync(join(tmpdir(), "cnil-doctrine-"));
  racines.push(racine);
  return racine;
}

function ecrire(racine: string, chemin: string, contenu: string): void {
  const complet = join(racine, chemin);
  mkdirSync(join(complet, ".."), { recursive: true });
  writeFileSync(complet, contenu, "utf8");
}

describe("liste de référence de la doctrine CNIL", () => {
  it("reconnaît les guides de la médiathèque depuis la page de référence", () => {
    const { pdfs } = extraireDocuments(
      fixture("mediatheque-guides.html"),
      REFERENCE_GUIDES.url,
      REFERENCE_GUIDES,
      "www.cnil.fr",
    );
    assert.deepEqual(
      pdfs.map((pdf) => pdf.url.split("/").at(-1)),
      [
        "guide_pratique_rgpd_collectivites_territoriales.pdf",
        "guide_communication_politique.pdf",
        "guide_violations_education_etablissements.pdf",
      ],
    );
    assert.equal(pdfs[0]?.titre, "Guide pratique RGPD pour les collectivités territoriales");
  });

  it("reconnaît les référentiels comme tels", () => {
    const { pdfs } = extraireDocuments(
      fixture("autres-referentiels.html"),
      REFERENCE_REFERENTIELS.url,
      REFERENCE_REFERENTIELS,
      "www.cnil.fr",
    );
    assert.equal(pdfs.length, 3);
    assert.ok(pdfs.every((pdf) => pdf.url.includes("referentiel")));
  });

  it("reconnaît les pages de listes AIPD, puis leurs PDF filtrés", () => {
    const pages = extraireDocuments(
      fixture("listes-aipd.html"),
      REFERENCE_LISTES.url,
      REFERENCE_LISTES,
      "www.cnil.fr",
    );
    assert.equal(pages.pdfs.length, 0);
    assert.deepEqual(pages.pages.map((page) => page.url), [
      "https://www.cnil.fr/liste-traitements-aipd-requise",
      "https://www.cnil.fr/fr/liste-traitements-aipd-non-requise",
    ]);

    const documents = extraireDocuments(
      fixture("page-liste-aipd-requise.html"),
      "https://www.cnil.fr/fr/analyse-dimpact-relative-la-protection-des-donnees-publication-dune-liste-des-traitements-pour",
      { type: "liste_aipd", url: REFERENCE_LISTES.url, pages_max: 1, liens: "pdf", motif_pdf: "liste-traitements-aipd" },
      "www.cnil.fr",
    );
    assert.deepEqual(
      documents.pdfs.map((pdf) => pdf.url.split("/").at(-1)),
      ["liste-traitements-aipd-requise.pdf"],
    );
    assert.equal(
      documents.pdfs[0]?.titre,
      "Liste des types d’opérations de traitement pour lesquelles une analyse d’impact relative à la protection des données est requise",
    );
  });

  it("accepte un PDF servi sans www et écarte un autre domaine", () => {
    const html = [
      "<main>",
      '<a href="https://cnil.fr/sites/default/files/guide.pdf">Guide sans www</a>',
      '<a href="https://exemple.test/sites/default/files/autre.pdf">Autre domaine</a>',
      "</main>",
    ].join("");
    const { pdfs } = extraireDocuments(html, REFERENCE_GUIDES.url, REFERENCE_GUIDES, "www.cnil.fr");
    assert.deepEqual(pdfs.map((pdf) => pdf.url), ["https://cnil.fr/sites/default/files/guide.pdf"]);
  });

  it("s'arrête quand une page de résultats ne rend plus rien de nouveau", async () => {
    const html = fixture("autres-referentiels.html");
    const fetchHtml: FetchHtml = async (url) => {
      if (url.includes("page=1")) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => html };
    };
    const resultat = await parcourirReference(
      { ...REFERENCE_REFERENTIELS, pages_max: 5 },
      "www.cnil.fr",
      { fetchHtml, attendre: async () => {}, delaiMs: 0 },
    );
    assert.equal(resultat.pdfs.length, 3);
    assert.equal(resultat.pagesLues, 1);
  });
});

describe("fragments de doctrine", () => {
  const texte = [
    "La CNIL recommande de définir une politique de mots de passe.",
    "Les mots de passe doivent être suffisamment complexes et renouvelés en cas de doute.",
    "Cette fiche décrit les mesures de sécurité attendues des organismes.",
  ].join("\n\n");

  function document() {
    return {
      type: "guide" as const,
      url: "https://www.cnil.fr/sites/default/files/guide.pdf",
      titre: "Guide de la sécurité des données personnelles",
      slug: slugDe("https://www.cnil.fr/sites/default/files/guide.pdf"),
      date_acte: "2024-01-15",
      date_source: "document" as const,
      date_extraction: "2026-11-14",
      snapshot: "0".repeat(64),
    };
  }

  it("copie chaque fragment mot pour mot depuis le texte source", () => {
    const unites = unitesDoctrine(document(), texte, DESCRIPTEUR);
    assert.ok(unites.length > 0);
    const normaliser = (valeur: string): string => valeur.replace(/\s+/g, " ").trim();
    const source = normaliser(texte);
    for (const unite of unites) {
      assert.ok(
        source.includes(normaliser(unite.texte)),
        `fragment absent du texte source : ${unite.texte.slice(0, 80)}`,
      );
    }
    assert.equal(unites.map((unite) => unite.texte).join(" "), normaliser(texte));
    assert.equal(unites[0]?.corpus, "cnil_doctrine");
    assert.equal(unites[0]?.statut, "Publié");
    assert.match(unites[0]?.chemin ?? "", /^Doctrine CNIL > Guides > Guide de la sécurité/);
  });

  it("refuse un corpus invalide avant écriture", () => {
    const unites = unitesDoctrine(document(), texte, DESCRIPTEUR);
    assert.throws(
      () => validerUnites([{ ...unites[0]!, texte: "" }], "cnil_doctrine"),
      /texte vide/,
    );
    assert.throws(() => validerUnites(unites, "cnil"), /corpus inattendu/);
  });
});

describe("licences et délibérations", () => {
  it("écarte une mention contraire explicite, jamais le mot copyright seul", () => {
    assert.match(mentionContraire("Tous droits réservés. Reproduction interdite.") ?? "", /tous droits/);
    assert.match(mentionContraire("All rights reserved.") ?? "", /all rights/);
    assert.equal(mentionContraire("Le droit d'auteur et le copyright sont étudiés."), null);
    assert.equal(mentionContraire("La CNIL recommande des mots de passe robustes."), null);
  });

  it("lit une date déclarée dans l'en-tête, jamais une date de visa", () => {
    assert.equal(dateDuDocument("Référentiel\nAdopté le 21 novembre 2019\n"), "2019-11-21");
    assert.equal(dateDuDocument("Version 2024\nMise à jour 2026\n"), null);
    assert.equal(dateDuDocument("Publié le 2018-10-11"), "2018-10-11");
    assert.equal(dateDuDocument("Guide du 27 avril 2016 sur la protection des données"), null);
  });

  it("relève les numéros de délibération et leur intitulé", () => {
    const page =
      "Délibération n° 2018-326 du 11 octobre 2018 portant adoption de lignes directrices sur les analyses d'impact " +
      "Délibération n° 2018-327 du 11 octobre 2018 portant adoption de la liste des types d'opérations de traitement " +
      "pour lesquelles une analyse d'impact relative à la protection des données est requise";
    assert.deepEqual(deliberationsCitees(page).map((citee) => citee.numero), ["2018-326", "2018-327"]);
    assert.match(deliberationsCitees(page)[1]?.libelle ?? "", /liste des types d'opérations/);
    assert.equal(chevauchement("Liste des types d'opérations de traitement", "portant adoption de la liste des types d'opérations de traitement"), 4);
  });

  it("ne retient une délibération du corpus cnil que si l'intitulé la désigne", () => {
    const corpus = new Map([
      ["2018-326", "CNILTEXT000037560701"],
      ["2018-327", "CNILTEXT000037560659"],
    ]);
    const page = deliberationsCitees(
      "Délibération n° 2018-326 du 11 octobre 2018 portant adoption de lignes directrices sur les analyses d'impact " +
        "Délibération n° 2018-327 du 11 octobre 2018 portant adoption de la liste des types d'opérations de traitement pour lesquelles une analyse d'impact relative à la protection des données est requise",
    );
    assert.deepEqual(
      deliberationDuDocument(
        "Liste des types d'opérations de traitement pour lesquelles une analyse d'impact relative à la protection des données est requise",
        page,
        corpus,
      ),
      { numero: "2018-327", document: "CNILTEXT000037560659" },
    );
    assert.equal(
      deliberationDuDocument("Un guide sans rapport", page, new Map()),
      null,
    );
    assert.equal(
      deliberationDuDocument("Un guide sans rapport", page, corpus),
      null,
    );
  });
});

describe("marquage de licence au rendu", () => {
  it("titre, source et date d'extraction au format JJ/MM/AAAA", () => {
    const racine = racineTemporaire();
    ecrire(
      racine,
      "data/corpus/cnil_doctrine/manifest.json",
      JSON.stringify({
        mention: "extrait non modifié · CC BY-ND 4.0",
        source: "Source : CNIL – https://www.cnil.fr",
        licence: "CC BY-ND 4.0",
        licence_url: "https://creativecommons.org/licenses/by-nd/4.0/deed.fr",
        documents_par_type: {
          guide: [
            {
              slug: "guide",
              titre: "Guide de la sécurité des données personnelles",
              url: "https://www.cnil.fr/sites/default/files/guide.pdf",
              date_extraction: "2026-11-14",
            },
          ],
        },
      }),
    );
    const mentions = mentionsDoctrine(racine);
    assert.deepEqual(mentions.get("guide"), {
      mention:
        "extrait non modifié · CC BY-ND 4.0 · https://www.cnil.fr/sites/default/files/guide.pdf",
      titre: "Guide de la sécurité des données personnelles",
      source: "Source : CNIL – https://www.cnil.fr",
      date_extraction: "14/11/2026",
      licence: "CC BY-ND 4.0",
      licence_url: "https://creativecommons.org/licenses/by-nd/4.0/deed.fr",
    });

    const passages = avecMarquageDoctrine(racine, [passageDoctrine("guide")]);
    assert.equal(
      passages[0]?.marquage?.mention,
      "extrait non modifié · CC BY-ND 4.0 · https://www.cnil.fr/sites/default/files/guide.pdf",
    );
    assert.equal(passages[0]?.texte, "Un extrait copié mot pour mot.");
  });

  it("laisse un passage d'un autre corpus intact", () => {
    const racine = racineTemporaire();
    const passage = { ...passageDoctrine("guide"), corpus: "cnil" };
    assert.equal(avecMarquageDoctrine(racine, [passage])[0]?.marquage, undefined);
  });

  it("lève plutôt que de rendre un extrait sans attribution", () => {
    const racine = racineTemporaire();
    assert.throws(
      () => avecMarquageDoctrine(racine, [passageDoctrine("inconnu")]),
      /Marquage de licence introuvable/,
    );
  });

  it("formate une date ISO et laisse le reste tel quel", () => {
    assert.equal(dateFr("2026-11-14"), "14/11/2026");
    assert.equal(dateFr("14/11/2026"), "14/11/2026");
  });

  it("rend le statut d'application adoptée pour la doctrine publiée", () => {
    assert.equal(statutApplication("cnil_doctrine", "Publié"), "adoptee");
    assert.equal(statutApplication("cnil_doctrine", "ABROGE"), "abroge");
    assert.equal(statutApplication("cnil_doctrine", "Version de travail"), "inconnu");
  });
});

describe("synchronisation de la doctrine CNIL", () => {
  it("écarte une mention contraire et ne duplique pas une délibération du corpus cnil", async () => {
    const racine = racineTemporaire();
    ecrire(
      racine,
      "data/corpus/cnil/unites.jsonl",
      `${JSON.stringify({
        ref: "CNILTEXT000037560659#f0",
        document: "CNILTEXT000037560659",
        corpus: "cnil",
        niveau: "fragment",
        numero: "2018-327",
        chemin: "CNIL > Recommandation/Lignes directrices > Délibération 2018-327",
        texte: "Délibération 2018-327",
        date_acte: "2018-10-11",
        date_debut: "2018-10-11",
        date_fin: null,
        statut: "VIGUEUR",
        url: "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000037560659",
        nature: "Recommandation/Lignes directrices",
      })}\n`,
    );

    const reference: PageReference = {
      type: "liste_aipd",
      url: "https://exemple.test/fr/listes-aipd",
      pages_max: 1,
      liens: "page",
      motif_page: "aipd",
      motif_pdf: "liste",
    };
    const descripteur: DescripteurDoctrine = {
      ...DESCRIPTEUR,
      domaine: "exemple.test",
      pages_reference: [reference],
    };
    ecrire(racine, "descripteur.json", JSON.stringify(descripteur));

    const pages: Record<string, string> = {
      "https://exemple.test/fr/listes-aipd":
        "<main><a href=\"https://exemple.test/fr/page-aipd-requise\">Consulter la liste des traitements AIPD</a></main>",
      "https://exemple.test/fr/page-aipd-requise": [
        "<main>",
        "<p>Délibération n° 2018-327 du 11 octobre 2018 portant adoption de la liste des types d'opérations de traitement pour lesquelles une analyse d'impact relative à la protection des données est requise</p>",
        '<p><a href="https://exemple.test/docs/liste-aipd-requise.pdf">Liste des types d\'opérations requise</a></p>',
        '<p><a href="https://exemple.test/docs/liste-aipd-reservee.pdf">Liste sous droits réservés</a></p>',
        '<p><a href="https://exemple.test/docs/liste-aipd-libre.pdf">Liste libre</a></p>',
        "</main>",
      ].join(""),
    };
    const textes: Record<string, string> = {
      "https://exemple.test/docs/liste-aipd-requise.pdf": "Texte de la liste requise, sans mention contraire.",
      "https://exemple.test/docs/liste-aipd-reservee.pdf":
        "Tous droits réservés. La reproduction est interdite.",
      "https://exemple.test/docs/liste-aipd-libre.pdf": [
        "Les traitements de données de santé mis en œuvre par les établissements de santé sont soumis à une analyse d'impact.",
        "La liste précise les critères issus des lignes directrices du CEPD et les exemples de traitements concernés.",
      ].join("\n\n"),
    };

    const fetchHtml: FetchHtml = async (url) => {
      const html = pages[url];
      if (html === undefined) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => html };
    };
    const fetchPdf: FetchPdf = async (url) => {
      if (textes[url] === undefined) {
        return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      const octets = new TextEncoder().encode("%PDF-1.4\n% fixture\n");
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer,
      };
    };

    const resultat = await syncDoctrine({
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      date: "2026-11-14",
      fetchHtml,
      fetchPdf,
      extraireTexte: async (_octets, url) => textes[url] ?? "",
      attendre: async () => {},
      delaiMs: 0,
    });

    assert.equal(resultat.documents, 1);
    assert.equal(resultat.couverts, 1);
    assert.equal(resultat.ecartes, 1);
    assert.ok(resultat.fragments > 0);

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      liste_reference: { type: string; url: string; consulte_le: string; documents: number }[];
      consulte_le: string;
      types: Record<string, number>;
      couverts_par_type: Record<string, number>;
      couverts_par_cnil: { numero: string; document: string; url: string }[];
      documents_ecartes: { url: string; raison: string }[];
      mention: string;
      licence: string;
      documents_par_type: Record<
        string,
        { licence: string; licence_url: string; source: string }[]
      >;
    };
    assert.deepEqual(manifeste.liste_reference, [
      {
        type: "liste_aipd",
        url: "https://exemple.test/fr/listes-aipd",
        consulte_le: "2026-11-14",
        documents: 2,
      },
    ]);
    assert.equal(manifeste.consulte_le, "2026-11-14");
    assert.deepEqual(manifeste.types, { guide: 0, referentiel: 0, liste_aipd: 1 });
    assert.deepEqual(manifeste.couverts_par_type, { guide: 0, referentiel: 0, liste_aipd: 1 });
    assert.deepEqual(manifeste.couverts_par_cnil, [
      {
        type: "liste_aipd",
        titre: "Liste des types d'opérations requise",
        url: "https://exemple.test/docs/liste-aipd-requise.pdf",
        numero: "2018-327",
        document: "CNILTEXT000037560659",
      },
    ]);
    assert.equal(manifeste.documents_ecartes.length, 1);
    assert.match(manifeste.documents_ecartes[0]?.raison ?? "", /tous droits réservés/);
    assert.equal(manifeste.mention, "extrait non modifié · CC BY-ND 4.0");
    assert.equal(manifeste.licence, "CC BY-ND 4.0");
    assert.equal(manifeste.documents_par_type.liste_aipd?.[0]?.licence, "CC BY-ND 4.0");
    assert.equal(
      manifeste.documents_par_type.liste_aipd?.[0]?.licence_url,
      "https://creativecommons.org/licenses/by-nd/4.0/deed.fr",
    );
    assert.equal(manifeste.documents_par_type.liste_aipd?.[0]?.source, "Source : CNIL – https://www.cnil.fr");

    const unites = readFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne) as { document: string; texte: string; corpus: string });
    assert.ok(unites.length > 0);
    assert.ok(unites.every((unite) => unite.document === "liste-aipd-libre"));
    assert.ok(unites.every((unite) => unite.corpus === "cnil_doctrine"));
    assert.ok(unites.every((unite) => !unite.texte.includes("Tous droits réservés")));
  });

  it("lit le numéro d'une délibération depuis le corpus cnil réel", () => {
    const racine = racineTemporaire();
    ecrire(
      racine,
      "data/corpus/cnil/unites.jsonl",
      `${JSON.stringify({ document: "CNILTEXT000037560659", numero: "2018-327" })}\n`,
    );
    assert.deepEqual([...lireCorpusCnil(racine)], [["2018-327", "CNILTEXT000037560659"]]);
    assert.equal(lireCorpusCnil(join(racine, "absent")).size, 0);
  });
});
