import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  citationsDesUnites,
  citationsDuCorpus,
  extraireCitations,
  urlOfficielle,
} from "../mcp/corpus/citations.ts";
import type { Citation } from "../mcp/corpus/citations.ts";
import type { Unite } from "../mcp/corpus/parse.ts";

const RGPD = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679";
const DIRECTIVE_95_46 = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:31995L0046";
const EPRIVACY = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0058";
const DIRECTIVE_2016_680 = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016L0680";
const REGLEMENT_2018_1725 = "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32018R1725";
const LIL = "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006068624";
const CPCE = "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070987";
const CODE_PENAL = "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070719";

/** Références rendues, dans l'ordre, pour un texte. */
function references(texte: string): string[] {
  return extraireCitations(texte).map((citation) => citation.reference);
}

function citation(texte: string): Citation {
  const [premiere] = extraireCitations(texte);
  assert.ok(premiere, `aucune citation pour « ${texte} »`);
  return premiere;
}

describe("l'extraction des citations d'une décision", () => {
  it("attribue un article à l'instrument qui le suit", () => {
    const trouvee = citation("l'article 82 de la loi n° 78-17");

    assert.equal(trouvee.instrument, "loi 78-17");
    assert.deepEqual(trouvee.articles, ["82"]);
    assert.equal(trouvee.reference, "loi 78-17 · art. 82");
    assert.equal(trouvee.url, LIL);
  });

  it("lit une liste d'articles et l'ordre du texte", () => {
    assert.deepEqual(references("articles 8 et 20 de la loi n° 78-17"), ["loi 78-17 · art. 8, 20"]);
    assert.deepEqual(references("l'article 82 de la loi du 6 janvier 1978"), ["loi 78-17 · art. 82"]);
  });

  it("lit une plage d'articles", () => {
    assert.deepEqual(references("aux articles 5 à 7 du RGPD"), ["RGPD · art. 5–7"]);
    // Une plage au milieu d'une liste garde sa forme.
    assert.deepEqual(references("aux articles 5, 12 à 22 et 34 du RGPD"), ["RGPD · art. 5, 12–22, 34"]);
  });

  it("reconnaît un article de la LIL, du CPCE et de l'ePrivacy", () => {
    assert.deepEqual(references("l'article L. 34-5 du code des postes et des communications électroniques"), [
      "CPCE · art. L. 34-5",
    ]);
    assert.deepEqual(references("l'article L. 34-5 du CPCE"), ["CPCE · art. L. 34-5"]);
    assert.deepEqual(references("l'article 13 de la directive ePrivacy"), ["ePrivacy · art. 13"]);
  });

  it("rend les huit instruments du périmètre avec leur lien officiel", () => {
    const textes: [string, string, string][] = [
      ["l'article 6 du règlement (UE) 2016/679", "RGPD", RGPD],
      ["l'article 6 de la directive 95/46/CE", "directive 95/46/CE", DIRECTIVE_95_46],
      ["l'article 13 de la directive 2002/58/CE", "ePrivacy", EPRIVACY],
      ["l'article 5 de la directive (UE) 2016/680", "2016/680", DIRECTIVE_2016_680],
      ["l'article 5 du règlement (UE) 2018/1725", "2018/1725", REGLEMENT_2018_1725],
      ["l'article 82 de la loi n° 78-17", "loi 78-17", LIL],
      ["l'article L. 34-5 du CPCE", "CPCE", CPCE],
      ["l'article 226-21 du code pénal", "code pénal", CODE_PENAL],
    ];

    for (const [texte, instrument, url] of textes) {
      const trouvee = citation(texte);
      assert.equal(trouvee.instrument, instrument, texte);
      assert.equal(trouvee.url, url, texte);
    }
  });

  it("rend `null` pour un libellé inconnu", () => {
    assert.equal(urlOfficielle("inconnu"), null);
    assert.equal(urlOfficielle("RGPD"), RGPD);
  });

  it("lit l'instrument qui précède sa liste", () => {
    assert.deepEqual(references("Directive 95/46/CE — Articles 2, 4, 12 et 14"), [
      "directive 95/46/CE · art. 2, 4, 12, 14",
    ]);
    assert.deepEqual(references("Règlement (UE) 2016/679, articles 5 et 6"), ["RGPD · art. 5, 6"]);
    assert.deepEqual(
      references(
        "ARRÊT DE LA COUR «Données à caractère personnel — Directive 95/46/CE — Articles 2, 4, 12 et 14 — Champ d'application»",
      ),
      ["directive 95/46/CE · art. 2, 4, 12, 14"],
    );
    // Deux instruments dans un même en-tête gardent chacun leur liste.
    assert.deepEqual(
      references(
        "Directive 2002/58/CE – Article 12 – Annuaires publics – Règlement (UE) 2016/679 – Article 17",
      ),
      ["RGPD · art. 17", "ePrivacy · art. 12"],
    );
  });

  it("lit un visa qui nomme le titre officiel entre l'instrument et sa liste", () => {
    assert.deepEqual(
      references(
        "Vu la loi n° 78-17 du 6 janvier 1978 relative à l'Informatique, aux Fichiers et aux Libertés, " +
          "notamment son article 31 ;",
      ),
      ["loi 78-17 · art. 31"],
    );
    assert.deepEqual(
      references("Vu la loi n° 78-17 du 6 janvier 1978 et notamment ses articles 15 et 20 ;"),
      ["loi 78-17 · art. 15, 20"],
    );
    assert.deepEqual(
      references(
        "Vu le règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016, " +
          "notamment ses articles 5 et 6 ;",
      ),
      ["RGPD · art. 5, 6"],
    );
  });

  it("n'attribue pas un article au titre d'une loi qu'un décret applique", () => {
    assert.deepEqual(
      references(
        "Vu le décret n° 78-774 du 17 juillet 1978 pris pour l'application de la loi du 6 janvier 1978 " +
          "et notamment son article 1er ;",
      ),
      [],
    );
    assert.deepEqual(
      references(
        "Vu le décret n° 78-774 du 17 juillet 1978 pris pour l'application de la loi du 6 janvier 1978 " +
          "susvisée, notamment son article 12 ;",
      ),
      [],
    );
  });

  it("lit les formes anglaises", () => {
    assert.deepEqual(references("Article 6 GDPR"), ["RGPD · art. 6"]);
    assert.deepEqual(references("Article 6 of Regulation (EU) 2016/679"), ["RGPD · art. 6"]);
    assert.deepEqual(references("Article 13 of Directive 2002/58/EC"), ["ePrivacy · art. 13"]);
  });

  it("ne retient rien quand l'instrument ne suit pas immédiatement le connecteur", () => {
    assert.deepEqual(
      references(
        "l'article 94 du décret du 20 octobre 2005 pris pour l'application de la loi du 6 janvier 1978",
      ),
      [],
    );
    assert.deepEqual(references("l'article 6 de la convention européenne"), []);
    assert.deepEqual(
      references("Article 101 du traité sur le fonctionnement de l'Union européenne"),
      [],
    );
    assert.deepEqual(references("Vu le règlement (UE) 2016/679 du Parlement européen et du Conseil"), []);
    assert.deepEqual(references("l'article 6, paragraphe 1, du règlement (UE) 2016/679"), []);
  });

  it("écarte les instruments hors périmètre", () => {
    assert.deepEqual(references("article 6 du règlement (UE) 2024/1689"), []);
    assert.deepEqual(
      references("Charte des droits fondamentaux de l'Union européenne — Articles 7 et 8"),
      [],
    );
    // « de la même directive » ne s'ouvre pas sur la charte ni sur la convention.
    assert.deepEqual(
      references("la Charte des droits fondamentaux — Articles 7 et 8. L'article 6 de la même directive"),
      [],
    );
  });

  it("écarte les articles du code pénal antérieurs à 226-16", () => {
    assert.deepEqual(references("articles 378 et 226-21 du code pénal"), ["code pénal · art. 226-21"]);
    assert.deepEqual(references("articles 323-1 et 226-21 du code pénal"), ["code pénal · art. 226-21"]);
    assert.deepEqual(references("articles 226-16 à 226-22 du code pénal"), [
      "code pénal · art. 226-16–226-22",
    ]);
  });

  it("ne prend pas un point d'énumération pour un numéro d'article", () => {
    // « article 4-2° » cite l'article 4, point 2° : mieux vaut ne rien rendre
    // que rendre un article 4-2 qui n'existe pas.
    assert.deepEqual(references("l'article 4-2° de la loi du 6 janvier 1978 impose"), []);
    assert.deepEqual(
      references("Vu la loi n° 78-17 du 6 janvier 1978, notamment ses articles 16, 21-4° et 41 ;"),
      ["loi 78-17 · art. 16, 21"],
    );
  });

  it("résout une anaphore quand un seul instrument de cette nature est nommé", () => {
    assert.deepEqual(
      references(
        "le règlement (UE) 2016/679 s'applique aux traitements. L'article 15 du même règlement prévoit",
      ),
      ["RGPD · art. 15"],
    );
    assert.deepEqual(
      references("la directive 95/46/CE est citée. L'article 6 de la même directive"),
      ["directive 95/46/CE · art. 6"],
    );
    assert.deepEqual(references("la loi n° 78-17 s'applique. L'article 82 de la même loi"), [
      "loi 78-17 · art. 82",
    ]);
  });

  it("compte une loi nommée par sa date ou son qualificatif comme un antécédent concurrent", () => {
    // L'antécédent est la loi organique, la loi du pays, la loi de 1984 ou la
    // loi du 6 fructidor : aucune n'appartient au périmètre, et la LIL n'est pas
    // « la même loi ».
    assert.deepEqual(references("Vu la loi organique n° 2004-192. L'article 96 de la même loi organique"), []);
    assert.deepEqual(references("la loi du pays n° 2018-1. L'article 90 de la même loi du pays"), []);
    assert.deepEqual(references("Vu la loi du 22 décembre 1984. L'article 4 de la même loi"), []);
    assert.deepEqual(
      references("Vu la loi du 6 fructidor an II et la loi n° 78-17. L'article 4 de la même loi"),
      [],
    );
    // La LIL nommée par sa date reste une seule et même loi.
    assert.deepEqual(references("Vu la loi du 6 janvier 1978. L'article 82 de la même loi"), [
      "loi 78-17 · art. 82",
    ]);
  });

  it("attribue une liste distribuée à l'instrument de chaque segment", () => {
    assert.deepEqual(references("articles 9 du RGPD et 6 de la loi n° 78-17"), [
      "RGPD · art. 9",
      "loi 78-17 · art. 6",
    ]);
    assert.deepEqual(references("articles 13 du RGPD, 32 de la loi n° 78-17"), [
      "RGPD · art. 13",
      "loi 78-17 · art. 32",
    ]);
    // Un segment sans instrument ne reçoit rien.
    assert.deepEqual(references("articles 9 du RGPD et 6 sans instrument"), ["RGPD · art. 9"]);
  });

  it("admet l'institution sans parenthèses", () => {
    assert.deepEqual(references("article 6 du règlement UE 2016/679"), ["RGPD · art. 6"]);
    assert.deepEqual(references("l'article 5 de la directive CE 95/46"), ["directive 95/46/CE · art. 5"]);
  });

  it("lit les formes anglaises du périmètre", () => {
    assert.deepEqual(references("Article 4 of Directive (EU) 2016/680"), ["2016/680 · art. 4"]);
    assert.deepEqual(references("Article 4 of Regulation (EU) 2018/1725"), ["2018/1725 · art. 4"]);
    assert.deepEqual(references("Article 5(3) of Directive 2002/58/EC"), ["ePrivacy · art. 5(3)"]);
    assert.deepEqual(references("Article 6(1)(a) GDPR"), ["RGPD · art. 6(1)(a)"]);
    assert.deepEqual(references("Article 6 of the GDPR"), ["RGPD · art. 6"]);
    assert.deepEqual(references("Articles 12 to 14 GDPR"), ["RGPD · art. 12–14"]);
  });

  it("laisse l'anaphore béante quand deux instruments de même nature sont nommés", () => {
    assert.deepEqual(
      references(
        "le règlement (UE) 2016/679 et le règlement (UE) 2018/1725 s'appliquent. " +
          "L'article 15 du même règlement prévoit",
      ),
      [],
    );
    assert.deepEqual(
      references(
        "la loi n° 78-17 modifiée par la loi n° 2004-801. L'article 82 de la même loi",
      ),
      [],
    );
  });

  it("rend les instruments dans l'ordre du périmètre, quel que soit l'ordre du texte", () => {
    const texte =
      "l'article 82 de la loi n° 78-17, puis l'article 6 du règlement (UE) 2016/679, " +
      "puis l'article 226-21 du code pénal";
    assert.deepEqual(references(texte), [
      "RGPD · art. 6",
      "loi 78-17 · art. 82",
      "code pénal · art. 226-21",
    ]);
    assert.deepEqual(references(texte), references(texte));
  });

  it("rend une liste vide pour un texte sans citation reconnue", () => {
    assert.deepEqual(references(""), []);
    assert.deepEqual(references("La formation restreinte prononce une amende de 5 000 euros."), []);
  });

  it("lit les citations au niveau du document, pas du fragment", () => {
    const unites: Unite[] = [
      {
        ref: "CNILTEXT000055022778#f0",
        document: "CNILTEXT000055022778",
        corpus: "cnil",
        niveau: "fragment",
        numero: "SAN-2026-015",
        chemin: "CNIL > Sanctions > Délibération SAN-2026-015",
        texte: "La formation restreinte rappelle l'article 6 du règlement (UE) 2016/679.",
        date_acte: "2026-10-22",
        date_debut: "2026-10-22",
        date_fin: null,
        statut: "VIGUEUR",
        url: "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000055022778",
      },
      {
        ref: "CNILTEXT000055022778#f1",
        document: "CNILTEXT000055022778",
        corpus: "cnil",
        niveau: "fragment",
        numero: "SAN-2026-015",
        chemin: "CNIL > Sanctions > Délibération SAN-2026-015",
        texte: "Le manquement est constitué.",
        date_acte: "2026-10-22",
        date_debut: "2026-10-22",
        date_fin: null,
        statut: "VIGUEUR",
        url: "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000055022778",
      },
    ];

    assert.deepEqual(
      citationsDesUnites(unites).map((trouvee) => trouvee.reference),
      ["RGPD · art. 6"],
    );
    assert.deepEqual(citationsDesUnites([]), []);
  });

  it("cache les citations par corpus et suit la date du fichier", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-citations-"));
    const dossier = join(root, "data", "corpus", "cnil");
    const chemin = join(dossier, "unites.jsonl");
    try {
      mkdirSync(dossier, { recursive: true });
      const ligne = (document: string, texte: string): string =>
        JSON.stringify({
          ref: `${document}#f0`,
          document,
          corpus: "cnil",
          niveau: "fragment",
          numero: "SAN-2026-015",
          chemin: "CNIL > Sanctions",
          texte,
          date_acte: "2026-10-22",
          date_debut: "2026-10-22",
          date_fin: null,
          statut: "VIGUEUR",
          url: `https://www.legifrance.gouv.fr/cnil/id/${document}`,
        });
      writeFileSync(
        chemin,
        `${ligne("CNILTEXT000055022778", "l'article 6 du règlement (UE) 2016/679")}\n`,
        "utf8",
      );

      const premier = citationsDuCorpus(root, "cnil");
      const second = citationsDuCorpus(root, "cnil");
      assert.equal(premier, second, "le second appel relit le cache, pas le fichier");
      assert.deepEqual(
        premier.get("CNILTEXT000055022778")?.map((trouvee) => trouvee.reference),
        ["RGPD · art. 6"],
      );

      writeFileSync(
        chemin,
        `${ligne("CNILTEXT000055022778", "l'article 82 de la loi n° 78-17 s'applique")}\n`,
        "utf8",
      );
      assert.deepEqual(
        citationsDuCorpus(root, "cnil").get("CNILTEXT000055022778")?.map((trouvee) => trouvee.reference),
        ["loi 78-17 · art. 82"],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ne lit aucun corpus hors des décisions", () => {
    const root = mkdtempSync(join(tmpdir(), "vitrine-citations-"));
    try {
      assert.equal(citationsDuCorpus(root, "rgpd").size, 0);
      assert.equal(citationsDuCorpus(root, "cnil").size, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
