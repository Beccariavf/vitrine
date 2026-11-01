import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  extractCetatReferences,
  extractCnilReferences,
  extractReferences,
  extractVisaReferences,
} from "../veille/references.ts";

/** Les textes intégraux de six décisions du Conseil d'État, tels rendus par `/consult/juri`. */
const CETAT = JSON.parse(readFileSync(new URL("./fixtures/cetat/textes.json", import.meta.url), "utf8")) as Record<
  string,
  { id: string; text: string }
>;


/** Le début des motifs : avant, ce sont les visas et les moyens des parties. */
function motifs(text: string): string {
  return `Considérant ce qui suit : ${text}`;
}

function cetatText(number: string): string {
  const decision = CETAT[number];
  if (decision === undefined) throw new Error(`missing CETAT fixture ${number}`);
  return decision.text;
}

/** Le titre officiel de Jautiva, avec les espaces insécables du flux réel. */
const JAUTIVA =
  "Affaire C-798/24, Jautiva: Arrêt de la Cour (première chambre) du 3\u00a0septembre 2026 " +
  "(demande de décision préjudicielle de la Satversmes tiesa – Lettonie) – A e. a. " +
  "[Renvoi préjudiciel – Protection des personnes physiques à l'égard du traitement des données " +
  "à caractère personnel – Règlement (UE) 2016/679 – Article\u00a05 – Principes relatifs au traitement " +
  "des données à caractère personnel – Article 6 – Licéité du traitement – Droit des sociétés – " +
  "Directive (UE) 2017/1132 – Article 14 – Actes et indications soumis à publicité – Actionnaires minoritaires]";

describe("les références juridiques", () => {
  it("extrait les instruments et les articles du titre Jautiva", () => {
    assert.deepEqual(extractReferences(JAUTIVA), [
      "Règlement (UE) 2016/679 · art. 5, 6",
      "Directive (UE) 2017/1132 · art. 14",
    ]);
  });

  it("supporte les listes et les plages d'articles", () => {
    assert.deepEqual(
      extractReferences("Règlement (UE) 2016/679 – articles 5 et 6"),
      ["Règlement (UE) 2016/679 · art. 5, 6"],
    );
    assert.deepEqual(
      extractReferences("Règlement (UE) 2016/679 – articles 5 à 7"),
      ["Règlement (UE) 2016/679 · art. 5–7"],
    );
  });

  it("ne confond pas un article de la charte avec l'instrument précédent", () => {
    assert.deepEqual(
      extractReferences(
        "Règlement (UE) 2016/679 – Article 5 – Charte des droits fondamentaux – Article 47",
      ),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("rattache un article placé avant le premier instrument", () => {
    assert.deepEqual(
      extractReferences("Manquement d'État – Protection des données – Article 5 – Règlement (UE) 2016/679"),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("ne rattache pas à un instrument un article d'une convention voisine", () => {
    assert.deepEqual(
      extractReferences("Convention de Rome – Article 5 – Règlement (UE) 2016/679 – Article 6"),
      ["Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("gère une directive sans institution entre parenthèses", () => {
    assert.deepEqual(
      extractReferences("Directive 95/46/CE – Article 7 – Consentement"),
      ["Directive 95/46/CE · art. 7"],
    );
  });

  it("rend un tableau vide quand aucun instrument n'est reconnu", () => {
    assert.deepEqual(extractReferences("Arrêt de la Cour du 3 septembre 2026"), []);
    assert.deepEqual(extractReferences("Article 5 de la charte"), []);
  });

  it("ne duplique ni les instruments ni les articles", () => {
    assert.deepEqual(
      extractReferences(
        "Règlement (UE) 2016/679 – Article 5 – Article 5 – Article 6 – Règlement (UE) 2016/679 – Article 7",
      ),
      ["Règlement (UE) 2016/679 · art. 5, 6, 7"],
    );
  });
});

describe("les références CNIL", () => {
  it("lit l'article avant l'instrument, comme sur la page FNAC", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article 82 de la loi Informatique et Libertés (règles pour les cookies et autres traceurs)",
      ]),
      ["Loi Informatique et Libertés · art. 82"],
    );
  });

  it("canonise RGPD et regroupe ses articles", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article 6 du RGPD (bases légales)",
        "Article 7 du RGPD (conditions applicables au consentement)",
        "Article 21 du RGPD (droit d'opposition)",
        "Article 4.11 du règlement général sur la protection des données (définition du consentement)",
      ]),
      ["Règlement (UE) 2016/679 · art. 6, 7, 21, 4.11"],
    );
  });

  it("reconnaît le Code de la consommation et ignore les décrets", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L.223-1 du code de la consommation - Légifrance",
        "Décret n°2026-662 du 23 juillet 2026 relatif aux modalités de recueil",
        "Articles 134 à 137 du décret n°2019-539 du 29 mai 2019 (droit des personnes)",
      ]),
      ["Code de la consommation · art. L. 223-1"],
    );
  });

  it("reconnaît les alias d'instruments et les directives citées", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L. 34-5 du Code des postes et des communications électroniques",
        "Article 7 de la directive 95/46/CE",
        "Article 5 de la directive 2002/58/CE",
        "Article 5 de la directive ePrivacy",
        "Article 82 de la loi n° 78-17 du 6 janvier 1978",
      ]),
      [
        "Code des postes et des communications électroniques · art. L. 34-5",
        "Directive 95/46/CE · art. 7",
        "Directive 2002/58/CE · art. 5",
        "Loi Informatique et Libertés · art. 82",
      ],
    );
  });

  it("conserve le suffixe « et suivants »", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Article L. 34-5 et suivants du Code des postes et des communications électroniques",
      ]),
      ["Code des postes et des communications électroniques · art. L. 34-5 et suivants"],
    );
  });

  it("rend les plages, les articles 1er et le dédoublonnage", () => {
    assert.deepEqual(
      extractCnilReferences([
        "Articles 134 à 137 du Code de la consommation",
        "Article 1er du Code de la consommation",
        "Article 6 du RGPD",
        "Article 6 du RGPD",
      ]),
      ["Code de la consommation · art. 134–137, 1er", "Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("ignore un instrument inconnu ou un instrument sans article", () => {
    assert.deepEqual(extractCnilReferences(["Décret n°2026-662 du 23 juillet 2026"]), []);
    assert.deepEqual(extractCnilReferences(["Article 5 du décret n°2019-539"]), []);
    assert.deepEqual(extractCnilReferences(["Règlement (UE) 2016/679"]), []);
  });
});

/** Le visa réel de la décision 25-10.664, tel que rendu par Judilibre. */
const VISA_25_10_664 = [
  'Articles L. <a href="https://www.legifrance.gouv.fr/search/code?query=2315-34" target="_blank">2315-34</a> ' +
    'et D. <a href="https://www.legifrance.gouv.fr/search/code?query=2315-27" target="_blank">2315-27</a> ' +
    "du code du travail.",
  "Articles 4, § 1, 5 et 6, § 1, du règlement (UE) n° 2016/679 du Parlement européen et du Conseil du " +
    "27 avril 2016, relatif à la protection des personnes physiques à l'égard du traitement des données " +
    "à caractère personnel et à la libre circulation de ces données.",
];

describe("les références du visa de la Cour de cassation", () => {
  it("lit le visa de 25-10.664 et ignore le code du travail", () => {
    assert.deepEqual(extractVisaReferences(VISA_25_10_664), [
      "Règlement (UE) 2016/679 · art. 4, 5, 6",
    ]);
  });

  it("nettoie les balises, les paragraphes et les virgules du visa", () => {
    assert.deepEqual(
      extractVisaReferences([
        'Articles 5, § 1, et 6, § 2, du <a href="#">règlement (UE) n° 2016/679</a>.',
      ]),
      ["Règlement (UE) 2016/679 · art. 5, 6"],
    );
  });

  it("reconnaît la LIL, le CPCE et une directive", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 82, de la loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés.",
        "Article L. 34-5 du code des postes et des communications électroniques.",
        "Article 5, § 3, de la directive 2002/58/CE du Parlement européen et du Conseil.",
      ]),
      [
        "Loi Informatique et Libertés · art. 82",
        "Code des postes et des communications électroniques · art. L. 34-5",
        "Directive 2002/58/CE · art. 5",
      ],
    );
  });

  it("reconnaît les actes européens des autres matières", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 6 du règlement (UE) 2024/1689.",
        "Article 5 du règlement (UE) 2022/1925.",
        "Article 13 du règlement (UE) 2022/2065.",
        "Article 7 du règlement (UE) 2022/2554.",
        "Article 21 de la directive (UE) 2022/2555.",
      ]),
      [
        "Règlement (UE) 2024/1689 · art. 6",
        "Règlement (UE) 2022/1925 · art. 5",
        "Règlement (UE) 2022/2065 · art. 13",
        "Règlement (UE) 2022/2554 · art. 7",
        "Directive (UE) 2022/2555 · art. 21",
      ],
    );
  });

  it("rattache chaque liste d'articles à son instrument", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679 et articles 6 et 7 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6, 7",
      ],
    );
  });

  it("ne donne pas l'article de l'instrument précédent au suivant", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Règlement (UE) 2016/679 – Article 5 – Directive 2002/58/CE – Article 6",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 5",
        "Directive 2002/58/CE · art. 6",
      ],
    );
  });

  it("sépare aussi une liste introduite par une virgule ou « ainsi que »", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679, articles 6 et 7 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6, 7",
      ],
    );
    assert.deepEqual(
      extractVisaReferences([
        "Articles 4 et 5 du règlement (UE) 2016/679 ainsi que l'article 6 de la directive 2002/58/CE",
      ]),
      [
        "Règlement (UE) 2016/679 · art. 4, 5",
        "Directive 2002/58/CE · art. 6",
      ],
    );
  });

  it("ne rend qu'un article par doublon", () => {
    assert.deepEqual(
      extractVisaReferences([
        "Article 6 du règlement (UE) n° 2016/679.",
        "Articles 6, § 1, du règlement (UE) n° 2016/679.",
      ]),
      ["Règlement (UE) 2016/679 · art. 6"],
    );
  });

  it("n'invente rien sans article, ni pour un code non suivi", () => {
    assert.deepEqual(
      extractVisaReferences(["Règlement (UE) n° 2016/679 du Parlement européen et du Conseil."]),
      [],
    );
    assert.deepEqual(
      extractVisaReferences(["Article 1er du code de justice administrative."]),
      [],
    );
    assert.deepEqual(extractVisaReferences([]), []);
  });
});

describe("les références du Conseil d'État", () => {
  it("lit les instruments appliqués de 501268", () => {
    // Le texte réel porte aussi le barème de l'article 83 § 2 du RGPD, cité
    // « aux termes », et l'article 8 de la LIL, cité « en vertu des dispositions
    // du I de l'article 8 » ; les notes du plan n'en attendaient que deux.
    assert.deepEqual(extractCetatReferences(cetatText("501268")), [
      "Loi Informatique et Libertés · art. 8, 82, 20",
      "Code des postes et des communications électroniques · art. L. 34-5",
      "Règlement (UE) 2016/679 · art. 83",
    ]);
  });

  it("lit le considérant et son anaphore de 509210", () => {
    assert.deepEqual(extractCetatReferences(cetatText("509210")), [
      "Règlement (UE) 2016/679 · art. 15, 16",
    ]);
  });

  it("lit une liste d'articles de 509589", () => {
    assert.deepEqual(extractCetatReferences(cetatText("509589")), [
      "Loi Informatique et Libertés · art. 8, 20",
    ]);
  });

  it("lit le texte de 511155 et de 513996", () => {
    assert.deepEqual(extractCetatReferences(cetatText("511155")), [
      "Règlement (UE) 2016/679 · art. 15",
    ]);
    assert.deepEqual(extractCetatReferences(cetatText("513996")), [
      "Loi Informatique et Libertés · art. 31, 118",
    ]);
  });

  it("lit l'article 8 cité « des dispositions du I de l'article 8 »", () => {
    const references = extractCetatReferences(cetatText("501268"));
    const lil = references.find((reference) => reference.startsWith("Loi Informatique et Libertés · art. "));
    assert.equal(lil, "Loi Informatique et Libertés · art. 8, 82, 20");
  });

  it("ignore les moyens des parties, avant les motifs", () => {
    assert.deepEqual(
      extractCetatReferences(
        "Il soutient que : - a méconnu les dispositions de l'article L. 34-5 du code des postes et des communications électroniques, sur le fondement de l'article 82 de la loi du 6 janvier 1978.",
      ),
      [],
    );
  });

  it("écarte une formule introduite par un grief dans les motifs", () => {
    for (const text of [
      "Le requérant soutient qu'en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.",
      "Le requérant soutient que, en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.",
      "Il est soutenu, sur le fondement de l'article 83 du RGPD, que l'amende est excessive.",
      "Il est soutenu que, sur le fondement de l'article 83 du RGPD, l'amende est excessive.",
      "Selon la requérante, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "Selon les requérantes, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "Selon un requérant, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "Selon une partie, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "Selon cette partie, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "Selon les sociétés, en vertu de l'article 15 du RGPD, la CNIL devait agir.",
      "La requérante se plaint de ce que, en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a erré.",
      "Le moyen tiré de ce que, sur le fondement de l'article 83 du RGPD, l'amende est excessive.",
      "Le grief tiré de ce que, sur le fondement de l'article 83 du RGPD, l'amende est excessive.",
    ]) {
      assert.deepEqual(extractCetatReferences(motifs(text)), [], text);
    }
  });

  it("écarte les autres verbes de grief, avec et sans « que »", () => {
    const formulas = [
      "qu'en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.",
      "que, en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.",
      ", en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.",
    ];
    const verbs = ["reproche", "reprochent", "conteste", "contestent", "se plaint", "se plaignent"];

    for (const verb of verbs) {
      const subject = verb.endsWith("nt") ? "Les requérants" : "Le requérant";
      for (const formula of formulas) {
        const text = motifs(`${subject} ${verb} ${formula}`);
        assert.deepEqual(extractCetatReferences(text), [], text);
      }
    }
  });

  it("n'écarte « selon » que devant une partie", () => {
    assert.deepEqual(
      extractCetatReferences(motifs("Selon la Cour de justice, en vertu de l'article 5 du RGPD, le traitement est licite.")),
      ["Règlement (UE) 2016/679 · art. 5"],
    );

    for (const party of [
      "le requérant",
      "la requérante",
      "la société",
      "la partie",
      "le ministre",
      "l'administration",
      "la CNIL",
      "le défendeur",
      "le demandeur",
      "lui",
      "elle",
      "eux",
      "elles",
    ]) {
      const text = motifs(`Selon ${party}, en vertu de l'article 82 de la loi du 6 janvier 1978, la CNIL a commis une erreur.`);
      assert.deepEqual(extractCetatReferences(text), [], text);
    }
  });

  it("ne rend rien sans le repère des motifs", () => {
    assert.deepEqual(
      extractCetatReferences("Aux termes de l'article 82 de la loi du 6 janvier 1978, la CNIL peut sanctionner."),
      [],
    );
    assert.deepEqual(
      extractCetatReferences("Considérant ce qui suit 1. Aux termes de l'article 82 de la loi du 6 janvier 1978"),
      ["Loi Informatique et Libertés · art. 82"],
    );
  });

  it("garde une formule appliquée qui suit un moyen écarté", () => {
    assert.deepEqual(
      extractCetatReferences(
        motifs("Le moyen étant écarté, aux termes de l'article 82 de la loi du 6 janvier 1978, la CNIL peut sanctionner."),
      ),
      ["Loi Informatique et Libertés · art. 82"],
    );
  });

  it("ne retient pas une règle qui constate l'inapplication", () => {
    assert.deepEqual(
      extractCetatReferences(motifs("Il résulte de l'instruction que les données ne relèvent pas de l'article 2 du RGPD.")),
      [],
    );
    assert.deepEqual(
      extractCetatReferences(motifs("Il résulte des dispositions de l'article 5 du RGPD que le traitement est licite.")),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("ne retient pas un grief ni « les dispositions de l'article »", () => {
    assert.deepEqual(
      extractCetatReferences(
        motifs("Le requérant soutient que la décision méconnaît les dispositions de l'article 82 de la loi du 6 janvier 1978."),
      ),
      [],
    );
    assert.deepEqual(
      extractCetatReferences(motifs("Il soutient une violation de l'article 15 du RGPD et de l'article 16 du même règlement.")),
      [],
    );
  });

  it("ne rend rien pour une anaphore sans instrument nommé", () => {
    assert.deepEqual(extractCetatReferences(motifs("L'article 16 du même règlement permet à la personne concernée d'agir.")), []);
    assert.deepEqual(extractCetatReferences(""), []);
  });

  it("garde une formule appliquée attribuée à la Cour de justice", () => {
    assert.deepEqual(
      extractCetatReferences(motifs("Selon la Cour de justice, en vertu de l'article 5 du RGPD, le traitement est licite.")),
      ["Règlement (UE) 2016/679 · art. 5"],
    );
  });

  it("lit les plages et reconnaît les instruments canoniques", () => {
    assert.deepEqual(
      extractCetatReferences(motifs("Aux termes des articles 5 à 7 du règlement (UE) 2016/679, le responsable …")),
      ["Règlement (UE) 2016/679 · art. 5–7"],
    );
    assert.deepEqual(
      extractCetatReferences(
        motifs("Aux termes de l'article 5 de la directive 2002/58/CE, l'utilisation des cookies est encadrée."),
      ),
      ["Directive 2002/58/CE · art. 5"],
    );
    assert.deepEqual(
      extractCetatReferences(motifs("Aux termes de l'article 6 du règlement (UE) 2024/1689, le système est conforme.")),
      ["Règlement (UE) 2024/1689 · art. 6"],
    );
    assert.deepEqual(
      extractCetatReferences(motifs("Aux termes de l'article L. 34-5 du code des postes et des communications électroniques,")),
      ["Code des postes et des communications électroniques · art. L. 34-5"],
    );
  });

  it("rend un tableau vide pour une décision sans formule, comme 520279", () => {
    assert.deepEqual(extractCetatReferences(cetatText("520279")), []);
  });
});
