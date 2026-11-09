import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { canonicalUrl, hashId } from "../veille/normalize.ts";
import { parseFeed, toIsoUtc } from "../veille/sources/cnil.ts";
import { ETAT_VIDE, archivesNouvelles, extraireTar, listerArchives, lireArchiveDepuis, fusionnerDecisions } from "../mcp/corpus/cnil/increments.ts";
import type { ArchiveLue } from "../mcp/corpus/cnil/increments.ts";
import { MAX_FRAGMENT, MIN_FRAGMENT, decouperParagraphes, parseTexteCnil, unitesDila } from "../mcp/corpus/cnil/parse.ts";
import {
  compterOrigines,
  lireCorpus,
  manifesteCnil,
  syncHistorique,
  syncIncrements,
  validerUnites,
} from "../mcp/corpus/cnil/sync.ts";
import {
  estDeNature,
  lireDescripteur,
  unitesDinum,
} from "../mcp/corpus/cnil/historique.ts";
import type { DescripteurCnil, FetchBinaire, FichierDinum, LigneDinum } from "../mcp/corpus/cnil/historique.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const FIXTURE = new URL("./fixtures/cnil/feed.xml", import.meta.url);
const xml = readFileSync(FIXTURE, "utf8");

/**
 * Identifiants attendus du flux figé, calculés une fois hors du test et figés
 * ici : une dérive de la normalisation les casse, au lieu de se comparer à elle-même.
 */
const EXPECTED_IDS = [
  "1fb831fb8c3243d4",
  "4b3a739cc4e144e1",
  "6b483b1190c73ddb",
  "8da07efb6db3ce65",
  "aaebf12b008c7872",
  "c8f46e5ff1ac1686",
  "c95fe100c8350d72",
  "d7fec0bf7c00fb0d",
  "dbedb621bf9e3232",
  "fc7865bf7518a1d6",
];

/** Construit un petit flux RSS valide autour des items fournis. */
function feedOf(items: string, extra = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>RSS - Actualités CNIL</title>${extra}
    ${items}
  </channel>
</rss>`;
}

describe("flux CNIL figé", () => {
  it("produit une entrée par actualité du flux", () => {
    assert.equal(parseFeed(xml).length, 10);
  });

  it("renseigne tous les champs de chaque entrée", () => {
    for (const entry of parseFeed(xml)) {
      assert.match(entry.id, /^[0-9a-f]{16}$/);
      assert.ok(entry.title.length > 0);
      assert.equal(entry.officialTitle, entry.title);
      assert.match(entry.url, /^https:\/\/www\.cnil\.fr\//);
      assert.match(entry.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.ok(entry.summary === null || entry.summary.length > 0);
      assert.deepEqual(entry.references, []);
      assert.equal(entry.source, "cnil");
    }
  });

  it("produit les identifiants attendus du flux figé", () => {
    const ids = parseFeed(xml)
      .map((entry) => entry.id)
      .sort();
    assert.deepEqual(ids, EXPECTED_IDS);
  });

  it("dérive l'identifiant de l'URL canonique", () => {
    for (const entry of parseFeed(xml)) {
      assert.equal(entry.id, hashId(entry.url));
      assert.equal(entry.url, canonicalUrl(entry.url));
    }
  });

  it("ne laisse aucun slash final ni query ni fragment dans l'URL", () => {
    for (const entry of parseFeed(xml)) {
      assert.ok(!entry.url.endsWith("/"));
      assert.ok(!entry.url.includes("?"));
      assert.ok(!entry.url.includes("#"));
    }
  });
});

describe("le résumé tiré de la description", () => {
  it("nettoie la description du flux figé : ni balise, ni entité, ni double espace", () => {
    const [fnac] = parseFeed(xml);

    assert.ok(fnac?.summary);
    assert.ok(fnac.summary.startsWith("Le 22 octobre 2026, la CNIL a sanctionné les sociétés FNAC"));
    assert.ok(fnac.summary.includes("7 millions d’euros"), "l'espace insécable doublement encodé est normalisé");
    assert.ok(!/[<>&]/.test(fnac.summary));
    assert.ok(!/\s{2}/.test(fnac.summary));
    assert.ok(fnac.summary.length <= 200);
    assert.ok(fnac.summary.endsWith("…"), "une description de plus de 200 caractères est tronquée");
  });

  it("garde les espaces insécables simples d'une description courte", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Séance plénière</title>
      <link>https://www.cnil.fr/fr/seance</link>
      <description>La CNIL s’est réunie à 9&amp;nbsp;h&amp;nbsp;30.</description>
    </item>`),
    );

    assert.equal(entries[0]?.summary, "La CNIL s’est réunie à 9 h 30.");
  });

  it("retire les balises d'une description HTML", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Balises</title>
      <link>https://www.cnil.fr/fr/balises</link>
      <description>&lt;p&gt;Un &lt;strong&gt;texte&lt;/strong&gt; utile.&lt;/p&gt;</description>
    </item>`),
    );

    assert.equal(entries[0]?.summary, "Un texte utile.");
  });

  it("met à null une description absente ou vide", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Sans description</title>
      <link>https://www.cnil.fr/fr/sans-description</link>
    </item>
    <item>
      <title>Description vide</title>
      <link>https://www.cnil.fr/fr/description-vide</link>
      <description>   </description>
    </item>`),
    );

    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.summary, null);
    assert.equal(entries[1]?.summary, null);
  });
});

describe("URL canonique et identifiant", () => {
  it("calcule l'identifiant attendu pour une URL connue", () => {
    assert.equal(hashId("https://www.cnil.fr/fr/sanction-cookies-app-fnac"), "1fb831fb8c3243d4");
  });

  it("donne le même identifiant à deux écritures de la même page", () => {
    const plain = "https://www.cnil.fr/fr/sanction-cookies-app-fnac";
    const noisy = "https://WWW.CNIL.FR/fr/sanction-cookies-app-fnac/?utm_source=rss#haut";
    assert.equal(canonicalUrl(noisy), plain);
    assert.equal(hashId(noisy), hashId(plain));
  });

  it("donne des identifiants distincts à deux pages différentes", () => {
    assert.notEqual(
      hashId("https://www.cnil.fr/fr/cloture-injonction-google"),
      hashId("https://www.cnil.fr/fr/cepd-declaration-lunettes-connectees"),
    );
  });
});

describe("dates", () => {
  it("convertit un offset en heure UTC", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 2026 13:00:00 +0100"), "2026-10-29T12:00:00.000Z");
  });

  it("accepte une année sur deux chiffres", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 26 13:00:00 +0100"), "2026-10-29T12:00:00.000Z");
  });

  it("refuse une date sans offset explicite", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 2026 13:00:00"), null);
  });

  it("refuse une valeur qui n'est pas une date RFC 822", () => {
    assert.equal(toIsoUtc("2026"), null);
    assert.equal(toIsoUtc("2026-10-29"), null);
    assert.equal(toIsoUtc("pas une date"), null);
    assert.equal(toIsoUtc(""), null);
    assert.equal(toIsoUtc(null), null);
  });

  it("conserve une actualité sans date avec une date nulle", () => {
    const [entry] = parseFeed(
      feedOf(`
    <item>
      <title>Sans date</title>
      <link>https://www.cnil.fr/fr/sans-date</link>
    </item>`),
    );
    assert.equal(entry?.publishedAt, null);
    assert.equal(entry?.title, "Sans date");
  });

  it("met à null une date illisible", () => {
    assert.equal(toIsoUtc("pas une date"), null);
    assert.equal(toIsoUtc(""), null);
    assert.equal(toIsoUtc(null), null);
  });

  it("refuse une année qui n'a ni deux ni quatre chiffres", () => {
    assert.equal(toIsoUtc("Thu, 29 Oct 123 13:00:00 +0100"), null);
  });
});
describe("flux dégénérés", () => {
  it("accepte un canal sans item", () => {
    assert.deepEqual(parseFeed(feedOf("")), []);
  });

  it("accepte un flux à un seul item", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Unique</title>
      <link>https://www.cnil.fr/fr/unique</link>
      <pubDate>Tue, 13 Oct 2026 14:00:00 +0200</pubDate>
    </item>`),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.publishedAt, "2026-10-13T12:00:00.000Z");
  });

  it("lève une exception explicite sur un XML malformé", () => {
    assert.throws(() => parseFeed("<rss><channel><item></rss>"), /not valid XML/);
  });

  it("lève une exception explicite sur un XML sans channel", () => {
    assert.throws(() => parseFeed("<autre></autre>"), /no <rss><channel> root/);
  });

  it("refuse un lien qui n'est pas une URL https de la CNIL", () => {
    assert.throws(
      () =>
        parseFeed(
          feedOf(`
    <item>
      <title>Lien piégé</title>
      <link>javascript:alert(1)</link>
    </item>`),
        ),
      /item #0 link is not https/,
    );
    assert.throws(
      () =>
        parseFeed(
          feedOf(`
    <item>
      <title>Lien externe</title>
      <link>https://example.com/fr/actualite</link>
    </item>`),
        ),
      /item #0 link leaves cnil\.fr/,
    );
  });

  it("ne garde qu'une entrée quand deux items partagent la même URL", () => {
    const entries = parseFeed(
      feedOf(`
    <item>
      <title>Première</title>
      <link>https://www.cnil.fr/fr/doublon</link>
    </item>
    <item>
      <title>Seconde</title>
      <link>https://www.cnil.fr/fr/doublon/?utm_source=rss</link>
    </item>`),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.title, "Première");
  });
});

const DESCRIPTEUR = lireDescripteur(
  new URL("../mcp/corpus/cnil/descripteur.json", import.meta.url).pathname,
);
const LIGNES = JSON.parse(
  readFileSync(new URL("./fixtures/cnil/lignes.json", import.meta.url), "utf8"),
) as LigneDinum[];
const FICHIERS: FichierDinum[] = [
  {
    url: "https://exemple.test/cnil_part_0.parquet",
    chemin: "/dev/null",
    sha256: "0".repeat(64),
  },
];

function descriptorReduit(attendus: { documents: number; fragments: number }): DescripteurCnil {
  return { ...DESCRIPTEUR, ...attendus };
}

describe("l'historique DINUM", () => {
  it("retient les trois natures demandées, AVIS majuscule compris", () => {
    const retenues = LIGNES.filter((ligne) => estDeNature(ligne, DESCRIPTEUR.natures));
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);

    assert.equal(retenues.length, 5);
    assert.equal(unites.length, 5);
    assert.deepEqual(
      unites.map((unite) => unite.nature),
      ["Sanction", "Sanction", "Avis", "Avis", "Recommandation/Lignes directrices"],
      "AVIS majuscule est retenu et ramené à l'étiquette du descripteur",
    );
    assert.equal(
      unites.find((unite) => unite.document === "CNILTEXT000043470687")?.nature,
      "Avis",
    );
  });

  it("compte les lignes écartées par nature, (vide) compris", () => {
    const exclues: LigneDinum[] = [
      { ...LIGNES[0]!, doc_id: "CNILTEXT_EXCLU_1", chunk_index: 0, nature_delib: "Plainte" },
      { ...LIGNES[0]!, doc_id: "CNILTEXT_EXCLU_2", chunk_index: 0, nature_delib: null },
      { ...LIGNES[0]!, doc_id: "CNILTEXT_EXCLU_3", chunk_index: 0, nature_delib: null },
    ];
    const { unites, exclusions } = unitesDinum([...LIGNES, ...exclues], DESCRIPTEUR);

    assert.equal(unites.length, 5, "les lignes écartées ne deviennent pas des unités");
    assert.deepEqual(exclusions, [
      { nature: "(vide)", lignes: 2 },
      { nature: "Plainte", lignes: 1 },
    ]);
    assert.equal(
      exclusions.reduce((total, exclusion) => total + exclusion.lignes, 0),
      3,
    );
  });

  it("ne retient que la nature explicitement demandée", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR, ["Sanction"]);

    assert.equal(unites.length, 2);
    assert.ok(unites.every((unite) => unite.nature === "Sanction"));
    assert.ok(
      LIGNES.filter((ligne) => !estDeNature(ligne, ["Sanction"])).every(
        (ligne) => !unites.some((unite) => unite.document === ligne.doc_id),
      ),
    );
  });

  it("mappe une ligne sanction en unité citable", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);
    const [premier] = unites;

    assert.ok(premier);
    assert.equal(premier.ref, "CNILTEXT000043470685#f0");
    assert.equal(premier.document, "CNILTEXT000043470685");
    assert.equal(premier.corpus, "cnil");
    assert.equal(premier.niveau, "fragment");
    assert.equal(premier.numero, "SAN-2021-004");
    assert.equal(premier.nature, "Sanction");
    assert.equal(premier.chemin, "CNIL > Sanction > Délibération SAN-2021-004");
    assert.equal(premier.date_acte, "2021-04-30");
    assert.equal(premier.date_debut, "2021-04-30");
    assert.equal(premier.date_fin, null);
    assert.equal(premier.statut, "VIGUEUR");
    assert.equal(premier.origine, "dinum");
    assert.equal(premier.url, "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000043470685");
  });

  it("nomme l'avis dans le chemin et ne lui pose aucune métadonnée de sanction", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);
    const avis = unites.find((unite) => unite.document === "CNILTEXT000043470686");

    assert.ok(avis);
    assert.equal(avis.nature, "Avis");
    assert.equal(avis.chemin, "CNIL > Avis > Délibération CNILTEXT000043470686");
    assert.equal(avis.type_sanction, undefined);
    assert.equal(avis.montant, undefined);
    assert.equal(avis.injonction, undefined);
  });

  it("rejette une ligne sans texte en la nommant", () => {
    const vide: LigneDinum = { ...LIGNES[0]!, chunk_index: 2, text: "   " };
    const { unites, erreurs } = unitesDinum([...LIGNES, vide], DESCRIPTEUR);

    assert.equal(unites.length, 5);
    assert.deepEqual(erreurs, ["CNILTEXT000043470685#f2 : texte vide"]);
  });

  it("refuse une référence dupliquée", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);

    assert.throws(
      () => validerUnites([...unites, unites[0]!], { documents: 1, fragments: 3 }),
      /référence dupliquée : CNILTEXT000043470685#f0/,
    );
  });

  it("refuse un texte vide et une date non ISO", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);
    const casse: Unite = { ...unites[1]!, texte: "", date_acte: "30 avril 2021" };

    assert.throws(
      () => validerUnites([unites[0]!, casse], { documents: 1, fragments: 2 }),
      /texte vide : CNILTEXT000043470685#f1.*date non ISO : CNILTEXT000043470685#f1/,
    );
  });
});

describe("le manifeste CNIL", () => {
  it("compte les documents, les fragments, les natures, les exclusions et les deux origines", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);
    const exclusions = [
      { nature: "(vide)", lignes: 2 },
      { nature: "Plainte", lignes: 1 },
    ];
    const manifeste = manifesteCnil(
      descriptorReduit({ documents: 4, fragments: 5 }),
      unites,
      FICHIERS,
      ETAT_VIDE,
      exclusions,
    );

    assert.equal(manifeste.corpus, "cnil");
    assert.deepEqual(manifeste.natures, [
      "Sanction",
      "Avis",
      "Recommandation/Lignes directrices",
    ]);
    assert.equal(manifeste.documents, 4);
    assert.equal(manifeste.unites, 5);
    assert.deepEqual(manifeste.par_nature, {
      Avis: { documents: 2, unites: 2 },
      "Recommandation/Lignes directrices": { documents: 1, unites: 1 },
      Sanction: { documents: 1, unites: 2 },
    });
    assert.deepEqual(manifeste.origines, { dinum: 5, dila: 0 });
    assert.equal(manifeste.decoupage, "dinum");
    assert.equal(manifeste.url_texte_verifiee, false);
    assert.deepEqual(
      manifeste.sources.map((source) => source.origine),
      ["dinum", "dila"],
    );
    assert.deepEqual(manifeste.sources[0]?.fichiers, [
      { url: FICHIERS[0]!.url, sha256: FICHIERS[0]!.sha256 },
    ]);
    assert.equal(manifeste.sources[0]?.licence?.huggingface, "etalab-2.0");
    assert.equal(manifeste.sources[0]?.licence?.data_gouv, "lov2");
    assert.equal(manifeste.sources[0]?.licence?.incoherence, true);
    assert.equal(manifeste.couverture.source, "CNIL — historique DINUM et incréments DILA");
    assert.deepEqual(manifeste.couverture.natures, manifeste.natures);
    assert.deepEqual(manifeste.couverture.comptes, { documents: 4, unites: 5 });
    assert.deepEqual(manifeste.couverture.exclusions, exclusions);
    assert.equal(manifeste.couverture.lignes_lues, 8);
  });

  it("refuse des comptes qui ne correspondent pas au contenu", () => {
    const { unites } = unitesDinum(LIGNES, DESCRIPTEUR);

    assert.throws(
      () => validerUnites(unites, { documents: 249, fragments: 6342 }),
      /4 documents au lieu de 249 attendus ; 5 fragments au lieu de 6342 attendus/,
    );
  });

  it("le corpus commité porte les comptes de son manifeste", () => {
    const manifeste = JSON.parse(
      readFileSync(new URL("../data/corpus/cnil/manifest.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;
    const unites = lireCorpus(
      new URL("../data/corpus/cnil/unites.jsonl", import.meta.url).pathname,
    );

    assert.equal(unites.length, manifeste.unites);
    assert.equal(new Set(unites.map((unite) => unite.document)).size, manifeste.documents);
    assert.deepEqual(compterOrigines(unites), manifeste.origines);
    assert.ok(unites.every((unite) => unite.corpus === "cnil"));
    assert.ok(unites.every((unite) => unite.niveau === "fragment"));
  });
});

describe("la synchronisation DINUM", () => {
  const ATTENDUS = { documents: 4, fragments: 5 };

  it("écrit le corpus après validation et ne le réécrit pas au second passage", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    try {
      const premier = await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });
      const cheminUnites = join(root, "data", "corpus", "cnil", "unites.jsonl");
      const avant = statSync(cheminUnites).mtimeMs;

      assert.equal(premier.documents, 4);
      assert.equal(premier.unites, 5);
      assert.equal(premier.ecrit, true);
      assert.equal(readFileSync(cheminUnites, "utf8").trimEnd().split("\n").length, 5);

      const second = await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });

      assert.equal(second.ecrit, false);
      assert.equal(statSync(cheminUnites).mtimeMs, avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("n'écrit rien quand une ligne est invalide", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    const casse: LigneDinum = { ...LIGNES[0]!, chunk_index: 2, text: "" };
    try {
      await assert.rejects(
        syncHistorique({ rootDir: root, lignes: [...LIGNES, casse], attendus: ATTENDUS }),
        /CNILTEXT000043470685#f2 : texte vide/,
      );
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("--dry-run ne compte sans écrire", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    try {
      const resultat = await syncHistorique({
        rootDir: root,
        lignes: LIGNES,
        attendus: ATTENDUS,
        dryRun: true,
      });

      assert.equal(resultat.ecrit, false);
      assert.equal(resultat.unites, 5);
      assert.equal(existsSync(join(root, "data")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const XML = readFileSync(new URL("./fixtures/cnil/deliberation.xml", import.meta.url), "utf8");

/** Construit un tar minimal : en-têtes de 512 octets, données alignées. */
function tarDe(fichiers: { nom: string; contenu: string }[]): Buffer {
  const blocs: Buffer[] = [];
  for (const fichier of fichiers) {
    const donnees = Buffer.from(fichier.contenu, "utf8");
    const entete = Buffer.alloc(512, 0);
    entete.write(fichier.nom, 0, 100, "utf8");
    entete.write("0000644\0", 100, 8, "ascii");
    entete.write(`${donnees.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
    entete.write("0", 156, 1, "ascii");
    blocs.push(entete, donnees);
    const reste = (512 - (donnees.length % 512)) % 512;
    if (reste > 0) blocs.push(Buffer.alloc(reste, 0));
  }
  blocs.push(Buffer.alloc(1024, 0));
  return Buffer.concat(blocs);
}

/** Un `fetch` binaire qui rend des octets fixes. */
function fetchOctets(octets: Buffer): FetchBinaire {
  return async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.length) as ArrayBuffer,
  });
}

describe("le parse TEXTE_CNIL", () => {
  const decision = parseTexteCnil(XML, "deliberation.xml");

  it("lit les métadonnées et les paragraphes non vides", () => {
    assert.equal(decision.id, "CNILTEXT000043470685");
    assert.equal(decision.nature, "DELIBERATION");
    assert.equal(decision.numero, "SAN-2021-004");
    assert.equal(decision.natureDelib, "Sanction");
    assert.equal(decision.dateTexte, "2021-04-30");
    assert.equal(decision.datePubli, "2021-05-06");
    assert.equal(decision.etatJuridique, "VIGUEUR");
    assert.match(decision.titre, /SAN-2021-004/);
    assert.equal(decision.paragraphes.length, 5);
  });

  it("retire les balises internes d'un paragraphe", () => {
    const fort = decision.paragraphes.find((paragraphe) => paragraphe.includes("formation restreinte"));

    assert.ok(fort);
    assert.equal(fort.includes("<strong>"), false);
  });

  it("lève sans BLOC_TEXTUEL en nommant le fichier et l'identifiant", () => {
    const ampute = XML.replace(/<BLOC_TEXTUEL>[\s\S]*<\/BLOC_TEXTUEL>/, "");

    assert.throws(
      () => parseTexteCnil(ampute, "ampute.xml"),
      /ampute\.xml : CNILTEXT000043470685 sans BLOC_TEXTUEL\/CONTENU/,
    );
  });

  it("lève sans date de texte", () => {
    const ampute = XML.replace(/<DATE_TEXTE>[^<]*<\/DATE_TEXTE>/, "");

    assert.throws(() => parseTexteCnil(ampute, "sans-date.xml"), /sans META_CNIL\/DATE_TEXTE/);
  });
});

describe("le découpage local", () => {
  const decision = parseTexteCnil(XML, "deliberation.xml");

  it("borne les fragments et ne perd aucun texte", () => {
    const fragments = decouperParagraphes(decision.paragraphes);

    assert.ok(fragments.every((fragment) => fragment.length <= MAX_FRAGMENT));
    assert.ok(fragments.slice(0, -1).every((fragment) => fragment.length >= MIN_FRAGMENT));
    assert.equal(fragments.join(" "), decision.paragraphes.join(" "));
  });

  it("laisse seul un paragraphe plus long que la borne haute", () => {
    const long = "x".repeat(1300);
    const fragments = decouperParagraphes(["a".repeat(300), long, "b".repeat(300)]);

    assert.deepEqual(fragments, ["a".repeat(300), long, "b".repeat(300)]);
  });

  it("marque l'origine dila, la nature et le découpage local", () => {
    const unites = unitesDila(decision, DESCRIPTEUR);

    assert.equal(unites.length, 2);
    assert.equal(unites[0]?.ref, "CNILTEXT000043470685#f0");
    assert.equal(unites[0]?.origine, "dila");
    assert.equal(unites[0]?.nature, "Sanction");
    assert.equal(unites[0]?.niveau, "fragment");
    assert.equal(unites[0]?.numero, "SAN-2021-004");
    assert.equal(unites[0]?.chemin, "CNIL > Sanction > Délibération SAN-2021-004 > Découpage local");
    assert.equal(unites[0]?.statut, "VIGUEUR");
    assert.equal(unites[0]?.date_acte, "2021-04-30");
  });

  it("nomme la nature d'un avis et ne lui pose aucune métadonnée de sanction", () => {
    const avis = parseTexteCnil(XML.replace("Sanction", "Avis"), "avis.xml");
    const unites = unitesDila(avis, DESCRIPTEUR);

    assert.equal(avis.natureDelib, "Avis");
    assert.ok(unites.every((unite) => unite.nature === "Avis"));
    assert.ok(unites.every((unite) => unite.chemin.includes("CNIL > Avis >")));
    assert.ok(unites.every((unite) => unite.type_sanction === undefined));
    assert.ok(unites.every((unite) => unite.montant === undefined));
    assert.ok(unites.every((unite) => unite.injonction === undefined));
  });
});

describe("les archives DILA", () => {
  it("lit un tar et rend ses fichiers", () => {
    const tar = tarDe([
      { nom: "2026/cnil/global/CNIL/TEXT/00/00/43/47/06/CNILTEXT000043470685.xml", contenu: XML },
      { nom: "2026/notice.txt", contenu: "notice" },
    ]);

    const entrees = extraireTar(tar);

    assert.equal(entrees.length, 2);
    assert.match(entrees[0]?.nom ?? "", /CNILTEXT000043470685\.xml$/);
    assert.equal(entrees[0]?.donnees.toString("utf8"), XML);
    assert.equal(entrees[1]?.donnees.toString("utf8"), "notice");
  });

  it("liste les archives sans doublon et les trie", async () => {
    const html = `
      <a href="CNIL_20261028-212713.tar.gz">a</a>
      <a href="CNIL_20250711-120000.tar.gz">b</a>
      <a href="CNIL_20261028-212713.tar.gz">a</a>`;
    const noms = await listerArchives("https://exemple.test/", async () => ({
      ok: true,
      status: 200,
      text: async () => html,
    }));

    assert.deepEqual(noms, ["CNIL_20250711-120000.tar.gz", "CNIL_20261028-212713.tar.gz"]);
  });

  it("ne retient que les archives postérieures à l'état", () => {
    const liste = ["CNIL_20250711-120000.tar.gz", "CNIL_20261028-212713.tar.gz"];

    assert.deepEqual(archivesNouvelles(liste, ETAT_VIDE), liste);
    assert.deepEqual(
      archivesNouvelles(liste, {
        ...ETAT_VIDE,
        derniere_archive: "CNIL_20250711-120000.tar.gz",
      }),
      ["CNIL_20261028-212713.tar.gz"],
    );
    assert.deepEqual(
      archivesNouvelles(liste, { ...ETAT_VIDE, derniere_archive: "CNIL_20261028-212713.tar.gz" }),
      [],
    );
  });

  it("décompresse une archive et retient les natures demandées", async () => {
    const archive = gzipSync(
      tarDe([
        { nom: "a/CNILTEXT000043470685.xml", contenu: XML },
        { nom: "a/CNILTEXT000043470686.xml", contenu: XML.replace("Sanction", "Avis") },
      ]),
    );
    const sanctions = await lireArchiveDepuis(
      "CNIL_20261028-212713.tar.gz",
      DESCRIPTEUR,
      fetchOctets(archive),
      ["Sanction"],
    );
    const toutes = await lireArchiveDepuis(
      "CNIL_20261028-212713.tar.gz",
      DESCRIPTEUR,
      fetchOctets(archive),
    );

    assert.equal(sanctions.documentsLus, 2);
    assert.equal(sanctions.decisions.length, 1);
    assert.equal(sanctions.decisions[0]?.id, "CNILTEXT000043470685");
    assert.equal(sanctions.sha256.length, 64);
    assert.equal(toutes.decisions.length, 2, "les trois natures du descripteur sont retenues");
  });

  it("remplace toutes les unités d'un document connu, sans doublon", () => {
    const decision = parseTexteCnil(XML.replace("2021-04-30", "2021-05-01"), "plus-recent.xml");
    const existantes = unitesDinum(LIGNES, DESCRIPTEUR).unites;
    const fusion = fusionnerDecisions(existantes, [decision], DESCRIPTEUR);

    assert.equal(fusion.remplacees, 2);
    assert.equal(fusion.ajoutees, 2);
    assert.equal(fusion.ignorees, 0);
    assert.equal(fusion.unites.length, 5, "les autres délibérations restent en place");
    assert.deepEqual(
      fusion.unites
        .filter((unite) => unite.document === "CNILTEXT000043470685")
        .map((unite) => unite.ref),
      ["CNILTEXT000043470685#f0", "CNILTEXT000043470685#f1"],
    );
    assert.ok(
      fusion.unites
        .filter((unite) => unite.document === "CNILTEXT000043470685")
        .every((unite) => unite.origine === "dila"),
    );
    assert.equal(new Set(fusion.unites.map((unite) => unite.ref)).size, 5);
  });

  it("écarte une décision hors des natures demandées", () => {
    const avis = parseTexteCnil(
      XML.replace("Sanction", "Avis").replace("CNILTEXT000043470685", "CNILTEXT000099999999"),
      "avis.xml",
    );
    const fusion = fusionnerDecisions([], [avis], DESCRIPTEUR, ["Sanction"]);

    assert.equal(fusion.ajoutees, 0);
    assert.equal(fusion.unites.length, 0);
  });

  it("conserve le découpage DINUM quand l'archive n'est pas plus récente", () => {
    const decision = parseTexteCnil(XML, "deliberation.xml");
    const existantes = unitesDinum(LIGNES, DESCRIPTEUR).unites;
    const fusion = fusionnerDecisions(existantes, [decision], DESCRIPTEUR);

    assert.equal(fusion.ignorees, 1);
    assert.equal(fusion.remplacees, 0);
    assert.equal(fusion.ajoutees, 0);
    assert.deepEqual(fusion.unites, existantes);
  });

  it("ajoute un document absent même si son archive est ancienne", () => {
    const decision = parseTexteCnil(
      XML.replace("CNILTEXT000043470685", "CNILTEXT000099999999"),
      "nouveau.xml",
    );
    const fusion = fusionnerDecisions([], [decision], DESCRIPTEUR);

    assert.equal(fusion.ajoutees, 2);
    assert.equal(fusion.ignorees, 0);
    assert.equal(fusion.unites.length, 2);
    assert.ok(fusion.unites.every((unite) => unite.document === "CNILTEXT000099999999"));
  });

  it("conserve une décision non VIGUEUR avec son statut", () => {
    const decision = parseTexteCnil(XML.replace("VIGUEUR", "ABROGE"), "abroge.xml");
    const unites = unitesDila(decision, DESCRIPTEUR);

    assert.equal(decision.etatJuridique, "ABROGE");
    assert.ok(unites.every((unite) => unite.statut === "ABROGE"));
  });
});

describe("la synchronisation DILA", () => {
  const NOM = "CNIL_20261028-212713.tar.gz";
  const ATTENDUS = { documents: 4, fragments: 5 };

  function archiveLue(): Promise<ArchiveLue> {
    return Promise.resolve({
      nom: NOM,
      sha256: "a".repeat(64),
      documentsLus: 3,
      decisions: [parseTexteCnil(XML.replace("2021-04-30", "2021-05-01"), "plus-recent.xml")],
    });
  }

  it("garde un incrément quand l'historique est rejoué", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    try {
      await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });
      await syncIncrements({ rootDir: root, lister: async () => [NOM], lireArchive: archiveLue });

      const rejoue = await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });
      const unites = readFileSync(join(root, "data", "corpus", "cnil", "unites.jsonl"), "utf8")
        .trimEnd()
        .split("\n")
        .map((ligne) => JSON.parse(ligne) as { ref: string; document: string; origine?: string });

      assert.equal(rejoue.unites, 5);
      assert.ok(
        unites
          .filter((unite) => unite.document === "CNILTEXT000043470685")
          .every((unite) => unite.origine === "dila"),
        "l'incrément DILA survit au rejeu de l'historique",
      );
      assert.equal(
        unites.filter((unite) => unite.document !== "CNILTEXT000043470685").length,
        3,
        "les autres délibérations restent DINUM",
      );
      assert.equal(new Set(unites.map((unite) => unite.ref)).size, unites.length);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("remplace le document, écrit l'état, puis ne réécrit rien", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    try {
      await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });
      const cheminUnites = join(root, "data", "corpus", "cnil", "unites.jsonl");
      const cheminEtat = join(root, "data", "corpus", "cnil", "etat.json");

      const premier = await syncIncrements({
        rootDir: root,
        lister: async () => [NOM],
        lireArchive: archiveLue,
      });

      assert.deepEqual(premier.archives, [NOM]);
      assert.equal(premier.documents_lus, 3);
      assert.equal(premier.documents_retenus, 1);
      assert.equal(premier.documents_ignores, 0);
      assert.equal(premier.unites_remplacees, 2);
      assert.equal(premier.unites, 5);
      assert.deepEqual(premier.origines, { dinum: 3, dila: 2 });
      assert.equal(premier.ecrit, true);
      assert.equal(JSON.parse(readFileSync(cheminEtat, "utf8")).derniere_archive, NOM);

      const lignes = readFileSync(cheminUnites, "utf8").trimEnd().split("\n");
      assert.equal(lignes.length, 5);
      assert.equal(
        lignes.filter((ligne) => JSON.parse(ligne).origine === "dila").length,
        2,
      );
      const avant = statSync(cheminUnites).mtimeMs;

      const second = await syncIncrements({
        rootDir: root,
        lister: async () => [NOM],
        lireArchive: archiveLue,
      });

      assert.deepEqual(second.archives, []);
      assert.equal(second.ecrit, false);
      assert.equal(statSync(cheminUnites).mtimeMs, avant);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("--dry-run ne télécharge ni n'écrit, mais compte", async () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-cnil-"));
    try {
      await syncHistorique({ rootDir: root, lignes: LIGNES, attendus: ATTENDUS });
      const cheminEtat = join(root, "data", "corpus", "cnil", "etat.json");
      let lue = 0;

      const resultat = await syncIncrements({
        rootDir: root,
        dryRun: true,
        lister: async () => [NOM],
        lireArchive: async () => {
          lue += 1;
          return archiveLue();
        },
      });

      assert.equal(lue, 1);
      assert.equal(resultat.ecrit, false);
      assert.equal(resultat.documents_retenus, 1);
      assert.equal(existsSync(cheminEtat), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
