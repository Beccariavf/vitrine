import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  chargerTexte,
  documentsExplicites,
  extraireDocuments,
  extraireFiches,
  lireDescripteur,
  parcourirReference,
  pdfVersionFiche,
} from "../mcp/corpus/cnil-doctrine/liste.ts";
import type {
  DescripteurDoctrine,
  FetchHtml,
  FetchPdf,
  PageReference,
} from "../mcp/corpus/cnil-doctrine/liste.ts";
import {
  chevauchement,
  dateDePage,
  dateDuDocument,
  dateFrancaise,
  deliberationDuDocument,
  deliberationsCitees,
  mentionContraire,
  slugDe,
  texteFiche,
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
/** Base des descripteurs simulés : les exclusions déclarées du vrai descripteur ne comptent pas. */
const { documents_ecartes: _documentsEcartes, ...DESCRIPTEUR_SIMULE } = DESCRIPTEUR;

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

describe("fiches IA de la CNIL", () => {
  const REFERENCE_FICHES: PageReference = {
    type: "fiche_ia",
    url: "https://www.cnil.fr/fr/les-fiches-pratiques-ia",
    pages_max: 1,
    liens: "fiches",
  };

  it("liste chaque fiche de la page de référence, sa page ou son PDF", () => {
    const { pdfs, pages } = extraireFiches(
      fixture("fiches-ia.html"),
      REFERENCE_FICHES.url,
      "www.cnil.fr",
    );
    assert.equal(pages.length, 17);
    assert.equal(pdfs.length, 1);
    assert.deepEqual(pdfs[0]?.url, "https://www.cnil.fr/sites/default/files/2025-07/ia_liste_de_verification.pdf");
    assert.equal(pdfs[0]?.titre, "Développement des systèmes d'IA : Que faut-il vérifier ?");
    assert.equal(pages[0]?.url, "https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd");
    assert.equal(pages[0]?.titre, "Les recommandations de la CNIL en bref");
    assert.equal(
      pages.at(-1)?.url,
      "https://www.cnil.fr/fr/ia-analyser-le-statut-dun-modele-dia-au-regard-du-rgpd",
    );
    assert.equal(pages.at(-1)?.titre, "Analyser le statut d’un modèle d’IA au regard du RGPD");
  });

  it("lève plutôt que de perdre une fiche quand le balisage de la liste change", () => {
    const html = [
      "<main>",
      '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 1</p></div>',
      '<div class="col-sm-9 right"><h3>Une fiche</h3><a href="/fr/fiche-1">Lire</a></div></div>',
      '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 2</p></div>',
      '<div class="col-sm-9 right"><h3>Fiche sans lien</h3></div></div>',
      "</main>",
    ].join("");
    assert.throws(
      () => extraireFiches(html, REFERENCE_FICHES.url, "www.cnil.fr"),
      /Fiches listées non reconnues : 2 libellé\(s\) pour 1 document\(s\)/,
    );
  });

  it("extrait le corps de la fiche sans navigation, ni outils, ni pied de page", () => {
    const html = fixture("fiche-ia.html");
    const texte = texteFiche(html);
    assert.match(texte, /^IA : Annoter les données/);
    assert.match(texte, /La phase d’annotation des données est cruciale/);
    assert.match(texte, /annoter la position de ses membres peut être une indication utile/);
    assert.match(texte, /Les enjeux de l’annotation pour les droits et libertés des personnes/);
    assert.doesNotMatch(texte, /Déplier/);
    assert.doesNotMatch(texte, /Mentions légales/);
    assert.doesNotMatch(texte, /Accueil/);
    assert.doesNotMatch(texte, /Imprimer l’article/);
    assert.doesNotMatch(texte, /Intelligence artificielle \(IA\)/);
    assert.doesNotMatch(texte, /Fiche précédente|Fiche suivante|Sommaire/);
    assert.doesNotMatch(texte, /Pour approfondir|Texte reference/);
    assert.doesNotMatch(texte, /Document reference|Liste de vérification|Télécharger/);
    assert.equal(dateDePage(html), "2025-07-22");
  });

  it("préfère le PDF officiel de la même fiche, et seulement celui-là", () => {
    const html = fixture("fiche-ia-pdf.html");
    const page = "https://www.cnil.fr/fr/tenir-compte-de-la-protection-des-donnees-dans-la-conception-du-systeme";
    assert.deepEqual(
      pdfVersionFiche(
        html,
        page,
        "www.cnil.fr",
        "Tenir compte de la protection des données dans la conception du système",
      ),
      {
        url: "https://www.cnil.fr/sites/cnil/files/2024-06/fiche_ia_protection_des_donnees_des_la_conception_du_systeme.pdf",
        titre: "Tenir compte de la protection des données dans la conception du système",
      },
    );
    assert.equal(
      pdfVersionFiche(
        html,
        page,
        "www.cnil.fr",
        "Définir une finalité",
      ),
      null,
      "un PDF d'une autre fiche n'est pas la version de celle-ci",
    );
  });

  it("retire les commandes d'impression et l'encart de contribution", () => {
    const html = [
      "<main>",
      '<div class="ctn-gen">',
      "<h1>Se mettre en conformité</h1>",
      "<p class='ctn-gen-auteur'>28 mars 2022</p>",
      '<div class="ctn-gen-after">',
      "<p>Attribuer les responsabilités et documenter son traitement.</p>",
      '<p class="rtecenter"><button id="print" onclick="window.print();" title="Imprimer">Imprimer cette check-list</button></p>',
      '<p class="rtecenter"><em>Aucune information n\'est collectée par la CNIL.</em></p>',
      "</div>",
      '<div class="ctn-gen-mise-avant clearfix"><h2><span>Dossier du LINC</span></h2><div><p>Le Laboratoire d’innovation numérique a publié un dossier en quatre volets.</p></div></div>',
      '<div class="ctn-gen-mise-avant clearfix"><h2><span>Vous souhaitez contribuer ?</span></h2><div><p>Écrivez à ia[@]cnil.fr</p></div></div>',
      "</div>",
      "</main>",
    ].join("");
    const texte = texteFiche(html);
    assert.match(texte, /Attribuer les responsabilités/);
    assert.match(texte, /Dossier du LINC/, "un encart de doctrine survit au nettoyage");
    assert.doesNotMatch(
      texte,
      /Imprimer cette check-list|Aucune information|Vous souhaitez contribuer|Écrivez à ia/,
    );
  });

  it("lit une date de page en français et laisse une valeur illisible telle quelle", () => {
    assert.equal(dateFrancaise("22 juillet 2025"), "2025-07-22");
    assert.equal(dateFrancaise("2024-04-08"), "2024-04-08");
    assert.equal(dateFrancaise("sans date"), null);
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
        mention: "extrait non modifié",
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

  it("compose la ligne avec la licence du document, pas seulement celle du manifeste", () => {
    const racine = racineTemporaire();
    ecrire(
      racine,
      "data/corpus/cnil_doctrine/manifest.json",
      JSON.stringify({
        mention: "extrait non modifié",
        source: "Source : CNIL – https://www.cnil.fr",
        licence: "CC BY-ND 4.0",
        licence_url: "https://creativecommons.org/licenses/by-nd/4.0/deed.fr",
        documents_par_type: {
          referentiel: [
            {
              slug: "referentiel",
              titre: "Référentiel",
              url: "https://www.cnil.fr/sites/default/files/referentiel.pdf",
              date_extraction: "2026-11-14",
              licence: "Licence Ouverte 2.0",
              licence_url: "https://www.etalab.gouv.fr/licence-ouverte-open-licence",
              source: "Source : CNIL – https://www.cnil.fr",
            },
          ],
        },
      }),
    );
    const mention = mentionsDoctrine(racine).get("referentiel");
    assert.equal(
      mention?.mention,
      "extrait non modifié · Licence Ouverte 2.0 · https://www.cnil.fr/sites/default/files/referentiel.pdf",
    );
    assert.equal(mention?.licence, "Licence Ouverte 2.0");
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
      ...DESCRIPTEUR_SIMULE,
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
      liste_reference: { type: string; url: string; origine: string; consulte_le: string; documents: number }[];
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
        origine: "page",
        consulte_le: "2026-11-14",
        listes: 3,
        documents: 2,
      },
    ]);
    assert.equal(manifeste.consulte_le, "2026-11-14");
    assert.deepEqual(manifeste.types, {
      guide: 0,
      referentiel: 0,
      liste_aipd: 1,
      fiche_ia: 0,
      doctrine_ia: 0,
    });
    assert.deepEqual(manifeste.couverts_par_type, {
      guide: 0,
      referentiel: 0,
      liste_aipd: 1,
      fiche_ia: 0,
      doctrine_ia: 0,
    });
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
    assert.equal(manifeste.mention, "extrait non modifié");
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

  it("relit les pages de référence à chaque passe et ne fige pas la liste", async () => {
    const racine = racineTemporaire();
    const reference: PageReference = {
      type: "guide",
      url: "https://exemple.test/fr/guides",
      pages_max: 1,
      liens: "pdf",
    };
    ecrire(racine, "descripteur.json", JSON.stringify({ ...DESCRIPTEUR_SIMULE, domaine: "exemple.test", pages_reference: [reference] }));

    let liste = [
      '<a href="https://exemple.test/docs/guide-a.pdf">Guide A</a>',
      '<a href="https://exemple.test/docs/guide-b.pdf">Guide B</a>',
    ].join("");
    const fetchHtml: FetchHtml = async () => ({
      ok: true,
      status: 200,
      text: async () => `<main>${liste}</main>`,
    });
    const fetchPdf: FetchPdf = async () => {
      const octets = new TextEncoder().encode("%PDF-1.4\n");
      return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer };
    };
    const commun = {
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      fetchHtml,
      fetchPdf,
      extraireTexte: async () => "Un texte de guide avec des lettres.",
      attendre: async () => {},
      delaiMs: 0,
    };

    const premier = await syncDoctrine({ ...commun, date: "2026-12-01" });
    assert.equal(premier.documents, 2);

    // La page de référence a changé : la seconde passe doit la relire.
    liste = '<a href="https://exemple.test/docs/guide-a.pdf">Guide A</a>';
    const second = await syncDoctrine({ ...commun, date: "2026-12-02" });
    assert.equal(second.documents, 1);

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as { documents: number; consulte_le: string };
    assert.equal(manifeste.documents, 1);
    assert.equal(manifeste.consulte_le, "2026-12-02");
  });

  it("garde les PDF au cache dans la validité et les relit avec --refresh", async () => {
    const racine = racineTemporaire();
    const reference: PageReference = {
      type: "guide",
      url: "https://exemple.test/fr/guides",
      pages_max: 1,
      liens: "pdf",
    };
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({ ...DESCRIPTEUR_SIMULE, domaine: "exemple.test", validite_jours: 7, pages_reference: [reference] }),
    );
    const fetchHtml: FetchHtml = async () => ({
      ok: true,
      status: 200,
      text: async () => '<main><a href="https://exemple.test/docs/guide-a.pdf">Guide A</a></main>',
    });
    let telechargements = 0;
    const fetchPdf: FetchPdf = async () => {
      telechargements += 1;
      const octets = new TextEncoder().encode("%PDF-1.4\n");
      return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer };
    };
    const commun = {
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      fetchHtml,
      fetchPdf,
      extraireTexte: async () => "Un texte de guide avec des lettres.",
      attendre: async () => {},
      delaiMs: 0,
    };

    await syncDoctrine({ ...commun, date: "2026-12-01" });
    await syncDoctrine({ ...commun, date: "2026-12-02" });
    assert.equal(telechargements, 1, "le PDF reste au cache dans la validité");
    await syncDoctrine({ ...commun, date: "2026-12-09" });
    assert.equal(telechargements, 2, "le cache expire au bout de sept jours");
    await syncDoctrine({ ...commun, date: "2026-12-09", rafraichir: true });
    assert.equal(telechargements, 3, "--refresh relit le PDF");
  });

  it("ingère les fiches IA en page ou en PDF et déclare une fiche refusée", async () => {
    const racine = racineTemporaire();
    const reference: PageReference = {
      type: "fiche_ia",
      url: "https://exemple.test/fr/fiches-pratiques-ia",
      pages_max: 1,
      liens: "fiches",
    };
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({ ...DESCRIPTEUR_SIMULE, domaine: "exemple.test", pages_reference: [reference] }),
    );

    const pageA = "https://exemple.test/fr/fiche-annotations";
    const pageB = "https://exemple.test/fr/fiche-securite";
    const pageC = "https://exemple.test/fr/fiche-refusee";
    const pdfB = "https://exemple.test/sites/default/files/fiche_securite.pdf";
    const pdfListe = "https://exemple.test/sites/default/files/liste_verification.pdf";
    const textePdfB =
      "La sécurité du développement d'un système d'IA repose sur une analyse des risques.\n\n" +
      "Les mesures de sécurité sont proportionnées aux risques identifiés.";

    const htmlFiche = (titre: string, date: string, corps: string, pdf: string | null): string => [
      "<main>",
      '<ol class="breadcrumb"><li><a href="/fr">Accueil</a></li></ol>',
      '<div class="ctn-gen">',
      `<div class='ctn-gen-titre js-zoom-wrapper zoom-wrapper'><h1><span>${titre}</span></h1></div>`,
      `<p class='ctn-gen-auteur'>${date}</p>`,
      '<div class="page--tools"><div class="social"><ul><li><button type="button"><span class="sr-only">Imprimer l’article</span></button></li></ul></div></div>',
      '<div class="ctn-gen-after js-zoom-wrapper zoom-wrapper">',
      `<p>${corps}</p>`,
      pdf === null
        ? ""
        : `<p class="text-align-center"><a href="${pdf}" title="Fiche IA - ${titre} - PDF - Nouvelle fenêtre"><em>Consulter la version PDF</em></a></p>`,
      "</div>",
      "</div>",
      '<div class="general-tags"><ul><li><a href="/fr/tag/IA">#IA</a></li></ul></div>',
      "</main>",
      '<footer class="page--footer"><a href="/fr/mentions-legales">Mentions légales</a></footer>',
    ].join("");

    const pages: Record<string, string> = {
      "https://exemple.test/fr/fiches-pratiques-ia": [
        "<main>",
        '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 1</p></div>',
        '<div class="col-sm-9 right"><h3>Annoter les données</h3><a href="/fr/fiche-annotations">&gt; En savoir plus</a></div></div>',
        '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 2</p></div>',
        '<div class="col-sm-9 right"><h3>Garantir la sécurité du développement</h3><a href="/fr/fiche-securite">&gt; En savoir plus</a></div></div>',
        '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 3</p></div>',
        '<div class="col-sm-9 right"><h3>Fiche refusée</h3><a href="/fr/fiche-refusee">&gt; En savoir plus</a></div></div>',
        '<div class="row"><div class="col-sm-3 left"><p class="number">Liste de vérification</p></div>',
        `<div class="col-sm-9 right"><h3>Que faut-il vérifier ?</h3><a href="${pdfListe}">Télécharger</a></div></div>`,
        "</main>",
      ].join(""),
      [pageA]: htmlFiche(
        "Annoter les données",
        "22 juillet 2025",
        "La phase d’annotation des données est cruciale pour garantir la qualité du modèle entraîné.",
        null,
      ),
      [pageB]: htmlFiche(
        "Garantir la sécurité du développement",
        "22 juillet 2025",
        "La sécurité des systèmes d’IA est une obligation.",
        pdfB,
      ),
    };
    const textes: Record<string, string> = { [pdfB]: textePdfB, [pdfListe]: "Une liste de vérification avec des lettres." };

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
      date: "2026-11-21",
      fetchHtml,
      fetchPdf,
      extraireTexte: async (_octets, url) => textes[url] ?? "",
      attendre: async () => {},
      delaiMs: 0,
    });

    assert.equal(resultat.documents, 3);
    assert.equal(resultat.ecartes, 1);

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      documents_listes: number;
      types: Record<string, number>;
      liste_reference: { listes: number; documents: number }[];
      documents_par_type: Record<string, {
        slug: string;
        titre: string;
        url: string;
        date_acte: string;
        date_source: string;
        representation: string;
        pdf: string | null;
      }[]>;
      documents_ecartes: { url: string; raison: string }[];
    };

    assert.equal(manifeste.documents_listes, 4);
    assert.equal(manifeste.types.fiche_ia, 3);
    assert.equal(manifeste.liste_reference[0]?.listes, 4);
    assert.equal(manifeste.liste_reference[0]?.documents, 3);
    assert.equal(manifeste.documents_ecartes.length, 1);
    assert.equal(manifeste.documents_ecartes[0]?.url, pageC);
    assert.match(manifeste.documents_ecartes[0]?.raison ?? "", /HTTP 404/);

    const documents = manifeste.documents_par_type.fiche_ia ?? [];
    const annotations = documents.find((document) => document.slug === "fiche-annotations");
    const securite = documents.find((document) => document.slug === "fiche-securite");
    const liste = documents.find((document) => document.slug === "liste-verification");
    assert.ok(annotations !== undefined && securite !== undefined && liste !== undefined);
    assert.equal(annotations.url, pageA);
    assert.equal(annotations.representation, "page");
    assert.equal(annotations.pdf, null);
    assert.equal(annotations.date_acte, "2025-07-22");
    assert.equal(annotations.date_source, "document");
    assert.equal(securite.url, pageB, "le lien officiel reste la page de la fiche");
    assert.equal(securite.representation, "pdf");
    assert.equal(securite.pdf, pdfB);
    assert.equal(securite.date_acte, "2025-07-22", "la date affichée par la page date la fiche");
    assert.equal(liste.representation, "pdf");
    assert.equal(liste.date_acte, "2026-11-21");
    assert.equal(liste.date_source, "extraction");

    const unites = readFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne) as { document: string; chemin: string; texte: string; url: string });
    const annotees = unites.filter((unite) => unite.document === "fiche-annotations");
    assert.ok(annotees.length > 0);
    assert.match(annotees[0]?.chemin ?? "", /^Doctrine CNIL > Fiches IA > Annoter les données/);
    assert.ok(unites.every((unite) => !/Fiche précédente|Sommaire|#Intelligence artificielle/.test(unite.texte)));
    assert.equal(annotees[0]?.url, pageA);
    assert.ok(annotees.some((unite) => /La phase d’annotation des données/.test(unite.texte)));
    assert.ok(unites.every((unite) => !/Mentions légales/.test(unite.texte)));
    assert.ok(
      unites
        .filter((unite) => unite.document === "fiche-securite")
        .some((unite) => /analyse des risques/.test(unite.texte)),
      "le texte de la fiche vient de son PDF officiel",
    );

    assert.equal(
      mentionsDoctrine(racine).get("fiche-annotations")?.mention,
      `extrait non modifié · CC BY-ND 4.0 · ${pageA}`,
    );

    const snapshot = manifeste.documents_par_type.fiche_ia?.find(
      (document) => document.slug === "fiche-annotations",
    ) as { snapshot?: string } | undefined;
    assert.ok(snapshot?.snapshot !== undefined);
    assert.ok(
      existsSync(join(racine, "data", "raw", "cnil-doctrine", "page", `${snapshot.snapshot}.html`)),
      "la page retenue est conservée sous data/raw, adressée par son empreinte",
    );
  });

  function verifierDocumentsFiges(nomFixture: string): void {
    const attendus = JSON.parse(fixture(nomFixture)) as {
      documents: number;
      documents_par_slug: Record<string, { fragments: number; type: string; sha256: string }>;
    };
    const manifeste = JSON.parse(
      readFileSync(join(ICI, "..", "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      types: Record<string, number>;
      documents_par_type: Record<string, { slug: string; fragments: number }[]>;
    };
    const textes = new Map<string, string[]>();
    for (const ligne of readFileSync(
      join(ICI, "..", "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)) {
      const unite = JSON.parse(ligne) as { ref: string; document: string; texte: string };
      const liste = textes.get(unite.document) ?? [];
      liste.push(`${unite.ref}\n${unite.texte}\n`);
      textes.set(unite.document, liste);
    }

    assert.equal(attendus.documents, Object.keys(attendus.documents_par_slug).length);
    for (const [slug, attendu] of Object.entries(attendus.documents_par_slug)) {
      const document = manifeste.documents_par_type[attendu.type]?.find((entree) => entree.slug === slug);
      assert.ok(document !== undefined, `document disparu : ${slug}`);
      assert.equal(document.fragments, attendu.fragments, `fragments modifiés : ${slug}`);
      assert.equal(
        createHash("sha256").update((textes.get(slug) ?? []).join(""), "utf8").digest("hex"),
        attendu.sha256,
        `texte modifié à compte constant : ${slug}`,
      );
    }
    const slugs = new Set(
      Object.values(manifeste.documents_par_type)
        .flat()
        .map((document) => document.slug),
    );
    for (const slug of Object.keys(attendus.documents_par_slug)) assert.ok(slugs.has(slug));
  }

  it("ingère une liste explicite de doctrine IA, avec seuil et plafond", async () => {
    const racine = racineTemporaire();
    const rubrique = "https://exemple.test/fr/intelligence-artificielle";
    const pageA = "https://exemple.test/fr/position-a";
    const pageB = "https://exemple.test/fr/note-b";
    const pdfB = "https://exemple.test/sites/default/files/note-b.pdf";
    const pageC = "https://exemple.test/fr/courte-c";
    const pageD = "https://exemple.test/fr/position-d";
    const reference: PageReference = {
      type: "doctrine_ia",
      url: rubrique,
      pages_max: 1,
      liens: "urls",
      seuil_lettres: 1500,
      plafond: 2,
      urls: [
        { url: pageA, titre: "Position A" },
        { url: pageB, titre: "Note B", pdf: pdfB },
        { url: pageC, titre: "Courte C" },
        { url: pageD, titre: "Position D" },
      ],
    };
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({ ...DESCRIPTEUR_SIMULE, domaine: "exemple.test", pages_reference: [reference] }),
    );

    const htmlDoc = (titre: string, date: string, corps: string): string =>
      [
        "<main>",
        '<div class="ctn-gen">',
        `<h1>${titre}</h1>`,
        `<p class='ctn-gen-auteur'>${date}</p>`,
        '<div class="ctn-gen-after">',
        `<p>${corps}</p>`,
        "</div>",
        "</div>",
        "</main>",
      ].join("");
    const pages: Record<string, string> = {
      [pageA]: htmlDoc("Position A", "18 novembre 2024", "A".repeat(2200)),
      [pageB]: htmlDoc("Note B", "20 juillet 2026", "Résumé court de la note."),
      [pageC]: htmlDoc("Courte C", "11 juillet 2025", "C".repeat(120)),
      [pageD]: htmlDoc("Position D", "19 novembre 2024", "D".repeat(1800)),
    };
    const demandees: string[] = [];
    const fetchHtml: FetchHtml = async (url) => {
      demandees.push(url);
      const html = pages[url];
      if (html === undefined) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => html };
    };
    const fetchPdf: FetchPdf = async () => {
      const octets = new TextEncoder().encode("%PDF-1.4\n% fixture\n");
      return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer };
    };

    const resultat = await syncDoctrine({
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      date: "2026-11-25",
      fetchHtml,
      fetchPdf,
      extraireTexte: async (_octets, url) =>
        url === pdfB ? "Texte intégral de la note B.".repeat(120) : "",
      attendre: async () => {},
      delaiMs: 0,
    });

    assert.equal(resultat.documents, 2, "les deux documents les plus substantiels sont retenus");
    assert.ok(
      !demandees.includes(rubrique),
      "la rubrique qui a établi la liste n'est pas une page de résultats à relire",
    );

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      types: Record<string, number>;
      liste_reference: { listes: number; documents: number }[];
      documents_par_type: Record<
        string,
        { slug: string; url: string; representation: string; pdf: string | null; date_acte: string; date_source: string }[]
      >;
      documents_ecartes: { url: string; raison: string }[];
    };
    assert.equal(manifeste.types.doctrine_ia, 2);
    assert.deepEqual(manifeste.liste_reference[0], {
      type: "doctrine_ia",
      url: rubrique,
      origine: "liste",
      consulte_le: "2026-11-25",
      listes: 4,
      documents: 2,
    });

    const documents = manifeste.documents_par_type.doctrine_ia ?? [];
    const a = documents.find((document) => document.url === pageA);
    const b = documents.find((document) => document.url === pageB);
    assert.ok(
      a !== undefined && b !== undefined,
      JSON.stringify({
        documents: documents.map((document) => document.url),
        ecartes: manifeste.documents_ecartes,
      }),
    );
    assert.equal(a.representation, "page");
    assert.equal(a.date_acte, "2024-11-18");
    assert.equal(a.date_source, "document");
    assert.equal(b.representation, "pdf");
    assert.equal(b.pdf, pdfB);
    assert.equal(b.date_acte, "2026-07-20", "la page date la note lue dans son PDF");

    const raisons = new Map(manifeste.documents_ecartes.map((ecarte) => [ecarte.url, ecarte.raison]));
    assert.match(raisons.get(pageC) ?? "", /moins de 1500 lettres/);
    assert.match(raisons.get(pageD) ?? "", /plafond de 2 documents/);

    const unites = readFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne) as { document: string; chemin: string; texte: string });
    assert.match(unites[0]?.chemin ?? "", /^Doctrine CNIL > Doctrine IA > Position A/);
    assert.ok(
      unites
        .filter((unite) => unite.document === "note-b")
        .some((unite) => /Texte intégral de la note B/.test(unite.texte)),
      "le texte de la note vient du PDF déclaré",
    );
  });

  it("dédoublonne par URL et déclare le document couvert par une autre liste", async () => {
    const racine = racineTemporaire();
    const pageA = "https://exemple.test/fr/position-a";
    const fiches: PageReference = {
      type: "fiche_ia",
      url: "https://exemple.test/fr/fiches-pratiques-ia",
      pages_max: 1,
      liens: "fiches",
    };
    const doctrine: PageReference = {
      type: "doctrine_ia",
      url: "https://exemple.test/fr/intelligence-artificielle",
      pages_max: 1,
      liens: "urls",
      urls: [{ url: pageA, titre: "Position A" }],
    };
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({
        ...DESCRIPTEUR_SIMULE,
        domaine: "exemple.test",
        pages_reference: [fiches, doctrine],
      }),
    );

    const listeFiches = [
      "<main>",
      '<div class="row"><div class="col-sm-3 left"><p class="number">Fiche 1</p></div>',
      `<div class="col-sm-9 right"><h3>Position A</h3><a href="${pageA}">&gt; En savoir plus</a></div></div>`,
      "</main>",
    ].join("");
    const pageHtml = [
      "<main>",
      '<div class="ctn-gen">',
      "<h1>Position A</h1>",
      "<p class='ctn-gen-auteur'>18 novembre 2024</p>",
      `<div class="ctn-gen-after"><p>${"A".repeat(1800)}</p></div>`,
      "</div>",
      "</main>",
    ].join("");
    const fetchHtml: FetchHtml = async (url) => {
      const html =
        url === fiches.url ? listeFiches : url === pageA ? pageHtml : undefined;
      if (html === undefined) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => html };
    };

    const resultat = await syncDoctrine({
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      date: "2026-11-25",
      fetchHtml,
      extraireTexte: async () => "",
      attendre: async () => {},
      delaiMs: 0,
    });

    assert.equal(resultat.documents, 1);
    assert.equal(resultat.couverts_doctrine, 1);
    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      types: Record<string, number>;
      couverts_par_doctrine: { type: string; titre: string; url: string }[];
      liste_reference: { listes: number; documents: number }[];
    };
    assert.equal(manifeste.types.fiche_ia, 1);
    assert.equal(manifeste.types.doctrine_ia, 0);
    assert.deepEqual(manifeste.couverts_par_doctrine, [
      { type: "doctrine_ia", titre: "Position A", url: pageA },
    ]);
    assert.equal(manifeste.liste_reference[1]?.documents, 1, "le doublon est déclaré couvert");
  });

  it("garde la date d'extraction d'un document inchangé et la renouvelle s'il change", async () => {
    const racine = racineTemporaire();
    const page = "https://exemple.test/fr/position-a";
    const reference: PageReference = {
      type: "doctrine_ia",
      url: "https://exemple.test/fr/intelligence-artificielle",
      pages_max: 1,
      liens: "urls",
      urls: [{ url: page, titre: "Position A" }],
    };
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({ ...DESCRIPTEUR_SIMULE, domaine: "exemple.test", pages_reference: [reference] }),
    );
    let corps = "A".repeat(1800);
    const fetchHtml: FetchHtml = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        [
          "<main>",
          '<div class="ctn-gen">',
          "<h1>Position A</h1>",
          `<div class="ctn-gen-after"><p>${corps}</p></div>`,
          "</div>",
          "</main>",
        ].join(""),
    });
    const commun = {
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      fetchHtml,
      extraireTexte: async () => "",
      attendre: async () => {},
      delaiMs: 0,
    };
    const lireDates = (): { acte: string; extraction: string } => {
      const manifeste = JSON.parse(
        readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
      ) as {
        documents_par_type: Record<
          string,
          { date_acte: string; date_extraction: string; date_source: string }[]
        >;
      };
      const document = manifeste.documents_par_type.doctrine_ia?.[0];
      return {
        acte: document?.date_acte ?? "",
        extraction: document?.date_extraction ?? "",
      };
    };

    await syncDoctrine({ ...commun, date: "2026-11-21" });
    assert.deepEqual(lireDates(), { acte: "2026-11-21", extraction: "2026-11-21" });
    await syncDoctrine({ ...commun, date: "2026-11-25" });
    assert.deepEqual(
      lireDates(),
      { acte: "2026-11-21", extraction: "2026-11-21" },
      "un texte inchangé n'est pas redaté",
    );
    corps = "B".repeat(1800);
    await syncDoctrine({ ...commun, date: "2026-11-25" });
    assert.deepEqual(
      lireDates(),
      { acte: "2026-11-25", extraction: "2026-11-25" },
      "un texte réédité reprend la date de la passe",
    );
  });

  it("laisse les 56 documents déjà au corpus inchangés", () => {
    verifierDocumentsFiges("documents-2026-11-21.json");
  });

  it("laisse les 18 fiches IA déjà au corpus inchangées", () => {
    verifierDocumentsFiges("fiches-ia-2026-11-25.json");
    const manifeste = JSON.parse(
      readFileSync(join(ICI, "..", "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as { types: Record<string, number> };
    assert.equal(manifeste.types.fiche_ia, 18, "aucune fiche ajoutée ni retirée");
  });

  it("lit le numéro d'une délibération depuis un corpus cnil réduit", () => {
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

describe("méthodologies de référence révisées en 2026", () => {
  const PDF_MR = "https://exemple.test/sites/default/files/mr-001_referentiel.pdf";
  const REFERENCE_MR: PageReference = {
    type: "referentiel",
    url: "https://exemple.test/fr/methodologies-de-reference",
    pages_max: 1,
    liens: "urls",
    urls: [
      {
        url: PDF_MR,
        titre: "Méthodologie de référence MR-001 (version 2026)",
        numero: "2026-050",
        date_acte: "2026-03-19",
        remplace: ["2018-153"],
      },
    ],
  };

  it("lit le numéro, la date et le remplacement déclarés d'un document explicite", () => {
    assert.deepEqual(documentsExplicites(REFERENCE_MR, "exemple.test"), [
      {
        url: PDF_MR,
        titre: "Méthodologie de référence MR-001 (version 2026)",
        numero: "2026-050",
        date_acte: "2026-03-19",
        remplace: ["2018-153"],
      },
    ]);
  });

  it("refuse un remplacement sans numéro de délibération", () => {
    const sansNumero: PageReference = {
      ...REFERENCE_MR,
      urls: [{ url: PDF_MR, titre: "MR-001", remplace: ["2018-153"] }],
    };
    assert.throws(() => documentsExplicites(sansNumero, "exemple.test"), /sans porter de numéro/);
  });

  it("date et numérote une méthodologie depuis le descripteur, et déclare son remplacement", async () => {
    const racine = racineTemporaire();
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({
        ...DESCRIPTEUR_SIMULE,
        domaine: "exemple.test",
        pages_reference: [REFERENCE_MR],
      }),
    );
    const fetchPdf: FetchPdf = async () => {
      const octets = new TextEncoder().encode("%PDF-1.4\n% fixture\n");
      return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer };
    };

    await syncDoctrine({
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      date: "2026-11-26",
      fetchPdf,
      extraireTexte: async () =>
        "Paragraphe un de la méthodologie de référence.\n\nParagraphe deux de la méthodologie.",
      attendre: async () => {},
      delaiMs: 0,
    });

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      remplacements: Record<string, string>;
      documents_par_type: Record<
        string,
        {
          slug: string;
          numero?: string;
          remplace?: string[];
          date_acte: string;
          date_source: string;
          licence: string;
          url: string;
          fragments: number;
        }[]
      >;
    };
    const document = manifeste.documents_par_type.referentiel?.[0];
    assert.ok(document !== undefined);
    assert.equal(document.numero, "2026-050");
    assert.equal(document.date_acte, "2026-03-19", "la date est celle de la délibération, pas de l'extraction");
    assert.equal(document.date_source, "descripteur");
    assert.deepEqual(document.remplace, ["2018-153"]);
    assert.equal(document.licence, "CC BY-ND 4.0");
    assert.equal(document.url, PDF_MR);
    assert.ok(document.fragments > 0);
    assert.deepEqual(manifeste.remplacements, { "2018-153": "2026-050" });

    const unites = readFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne) as { document: string; numero: string });
    assert.equal(unites[0]?.document, "mr-001-referentiel");
    assert.equal(unites[0]?.numero, "2026-050");
  });

  it("rattache les MR de 2026 aux délibérations de 2018 qu'elles remplacent", () => {
    const declaration = DESCRIPTEUR.pages_reference.flatMap((reference) => reference.urls ?? []);
    const parMR = new Map(
      declaration
        .filter((document) => document.numero !== undefined)
        .map((document) => [document.titre, document]),
    );
    const mr001 = [...parMR.values()].find((document) => /MR-001/.test(document.titre));
    const mr003 = [...parMR.values()].find((document) => /MR-003/.test(document.titre));
    assert.equal(mr001?.numero, "2026-050");
    assert.deepEqual(mr001?.remplace, ["2018-153"]);
    assert.equal(mr003?.numero, "2026-051");
    assert.deepEqual(mr003?.remplace, ["2018-154"]);

    const statuts = new Map<string, string>();
    for (const ligne of readFileSync(
      join(ICI, "..", "data", "corpus", "cnil", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)) {
      const unite = JSON.parse(ligne) as { numero: string; statut: string };
      if (!statuts.has(unite.numero)) statuts.set(unite.numero, unite.statut);
    }
    assert.equal(statuts.get("2018-153"), "Remplacée par 2026-050");
    assert.equal(statuts.get("2018-154"), "Remplacée par 2026-051");
  });

  it("porte les quatre délibérations de 2026 au corpus avec lien, date et licence", () => {
    const manifeste = JSON.parse(
      readFileSync(join(ICI, "..", "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      documents_par_type: Record<
        string,
        { numero?: string; url: string; date_acte: string; licence: string; fragments: number }[]
      >;
      remplacements: Record<string, string>;
    };
    const documents = Object.values(manifeste.documents_par_type).flat();
    for (const numero of ["2026-049", "2026-050", "2026-051", "2026-052"]) {
      const document = documents.find((entree) => entree.numero === numero);
      assert.ok(document !== undefined, `délibération ${numero} absente du corpus`);
      assert.match(document.url, /^https:\/\/www\.cnil\.fr\/sites\/default\/files\/2026-05\/.+\.pdf$/);
      assert.equal(document.date_acte, "2026-03-19");
      assert.equal(document.licence, "CC BY-ND 4.0");
      assert.ok(document.fragments > 0);
    }
    assert.deepEqual(manifeste.remplacements, {
      "2018-153": "2026-050",
      "2018-154": "2026-051",
    });
  });

  it("refuse une date d'acte qui n'existe pas", () => {
    const impossible: PageReference = {
      ...REFERENCE_MR,
      urls: [{ ...REFERENCE_MR.urls?.[0], url: PDF_MR, titre: "MR-001", date_acte: "2026-02-30" }],
    };
    assert.throws(() => documentsExplicites(impossible, "exemple.test"), /Date d'acte/);
  });

  it("retire du manifeste un numéro et un remplacement que le descripteur ne déclare plus", async () => {
    const racine = racineTemporaire();
    const avecDeclaration = {
      ...DESCRIPTEUR_SIMULE,
      domaine: "exemple.test",
      pages_reference: [REFERENCE_MR],
    };
    ecrire(racine, "descripteur.json", JSON.stringify(avecDeclaration));
    const fetchPdf: FetchPdf = async () => {
      const octets = new TextEncoder().encode("%PDF-1.4\n% fixture\n");
      return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(0) as ArrayBuffer };
    };
    const commun = {
      rootDir: racine,
      descripteurPath: join(racine, "descripteur.json"),
      date: "2026-11-26",
      fetchPdf,
      extraireTexte: async () => "Paragraphe unique de la méthodologie de référence.",
      attendre: async () => {},
      delaiMs: 0,
    };

    await syncDoctrine(commun);
    ecrire(
      racine,
      "descripteur.json",
      JSON.stringify({
        ...avecDeclaration,
        pages_reference: [
          {
            ...REFERENCE_MR,
            urls: [{ url: PDF_MR, titre: REFERENCE_MR.urls?.[0]?.titre ?? "MR-001" }],
          },
        ],
      }),
    );
    await syncDoctrine(commun);

    const manifeste = JSON.parse(
      readFileSync(join(racine, "data", "corpus", "cnil_doctrine", "manifest.json"), "utf8"),
    ) as {
      remplacements: Record<string, string>;
      documents_par_type: Record<
        string,
        { numero?: string; remplace?: string[]; date_source: string }[]
      >;
    };
    const document = manifeste.documents_par_type.referentiel?.[0];
    assert.ok(document !== undefined);
    assert.equal(document.numero, undefined, "le numéro retiré du descripteur ne reste pas");
    assert.equal(document.remplace, undefined);
    assert.equal(document.date_source, "extraction");
    assert.deepEqual(manifeste.remplacements, {});

    const unites = readFileSync(
      join(racine, "data", "corpus", "cnil_doctrine", "unites.jsonl"),
      "utf8",
    )
      .split("\n")
      .filter(Boolean)
      .map((ligne) => JSON.parse(ligne) as { numero: string });
    assert.equal(unites[0]?.numero, "mr-001-referentiel");
  });
});
