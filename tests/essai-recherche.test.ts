import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  BASE_RECHERCHE_PAR_DEFAUT,
  COMMANDE_DEMO,
  MESSAGE_INDISPONIBLE,
  corpusAffiche,
  dateLisible,
  lireReponse,
  urlOfficielle,
  urlRecherche,
} from "../src/lib/essai-recherche.ts";

describe("urlRecherche", () => {
  it("construit l'URL du contrat sous la base du build, sans double barre", () => {
    assert.equal(urlRecherche("http://127.0.0.1:8787/", "sanction cookies"), "http://127.0.0.1:8787/recherche?q=sanction%20cookies");
    assert.equal(BASE_RECHERCHE_PAR_DEFAUT, "http://127.0.0.1:8787");
  });

  it("encode la question et rogne ses espaces, sans ajouter de paramètre", () => {
    assert.equal(
      urlRecherche("https://demo.example", "  durée de conservation vidéosurveillance  "),
      "https://demo.example/recherche?q=dur%C3%A9e%20de%20conservation%20vid%C3%A9osurveillance",
    );
    assert.equal(urlRecherche("http://127.0.0.1:8787", "a&b=c"), "http://127.0.0.1:8787/recherche?q=a%26b%3Dc");
  });
});

describe("lireReponse", () => {
  it("rend les passages d'un 200, du rang au lien", () => {
    const resultat = lireReponse(200, {
      mode: "lexicale",
      question: "sanction cookies",
      duree_ms: 12,
      passages: [
        {
          rang: 1,
          ref: "CNIL · SAN-2023-008",
          corpus: "cnil",
          chemin: "Décision · sanctions",
          date: "2023-12-28",
          extrait: "La formation restreinte prononce une amende.",
          url: "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT1",
        },
      ],
    });
    assert.deepEqual(resultat, {
      etat: "resultats",
      passages: [
        {
          rang: 1,
          ref: "CNIL · SAN-2023-008",
          corpus: "cnil",
          chemin: "Décision · sanctions",
          date: "2023-12-28",
          extrait: "La formation restreinte prononce une amende.",
          url: "https://www.legifrance.gouv.fr/cnil/id/CNILTEXT1",
        },
      ],
    });
  });

  it("rend une liste vide quand l'API n'a rien trouvé", () => {
    assert.deepEqual(lireReponse(200, { mode: "lexicale", question: "zzz", duree_ms: 3, passages: [] }), {
      etat: "resultats",
      passages: [],
    });
  });

  it("écarte les passages dont le lien n'est pas http(s)", () => {
    const resultat = lireReponse(200, {
      passages: [
        { rang: 1, ref: "Injecté", corpus: "cnil", url: "javascript:alert(1)" },
        { rang: 2, ref: "Relatif", corpus: "cnil", url: "/recherche" },
        { rang: 3, ref: "Sain", corpus: "rgpd", url: "http://127.0.0.1/texte" },
      ],
    });
    assert.equal(resultat.etat, "resultats");
    assert.deepEqual(
      resultat.etat === "resultats" ? resultat.passages.map((passage) => passage.ref) : [],
      ["Sain"],
    );
  });

  it("dit qu'une réponse 200 sans passages est illisible", () => {
    assert.deepEqual(lireReponse(200, { mode: "lexicale" }), {
      etat: "erreur",
      message: "La réponse de la recherche est illisible.",
    });
    assert.deepEqual(lireReponse(200, null), { etat: "erreur", message: "La réponse de la recherche est illisible." });
  });

  it("reprend le motif d'un 400, et en a un quand le corps se tait", () => {
    assert.deepEqual(lireReponse(400, { erreur: "q absent" }), {
      etat: "erreur",
      message: "La question n'a pas été acceptée : q absent",
    });
    assert.deepEqual(lireReponse(400, null), { etat: "erreur", message: "La question n'a pas été acceptée." });
  });

  it("annonce le délai d'un 429", () => {
    assert.deepEqual(lireReponse(429, { erreur: "trop de requêtes", reessayer_dans_s: 42 }), {
      etat: "erreur",
      message: "Trop de requêtes : réessayez dans 42 s.",
    });
    assert.deepEqual(lireReponse(429, {}), { etat: "erreur", message: "Trop de requêtes : réessayez dans un instant." });
  });

  it("signale un 503 et tout autre statut", () => {
    assert.deepEqual(lireReponse(503, { erreur: "index absent" }), {
      etat: "erreur",
      message: "La démonstration est indisponible : index absent",
    });
    assert.deepEqual(lireReponse(500, null), { etat: "erreur", message: "La recherche a échoué (500)." });
  });

  it("nomme le service éteint et sa commande", () => {
    assert.equal(MESSAGE_INDISPONIBLE, "Le service de démonstration est éteint :");
    assert.equal(COMMANDE_DEMO, "npm run mcp:http");
  });
});

describe("urlOfficielle", () => {
  it("ne garde que http et https", () => {
    assert.equal(urlOfficielle("https://eur-lex.europa.eu/x"), "https://eur-lex.europa.eu/x");
    assert.equal(urlOfficielle("http://127.0.0.1:8787/x"), "http://127.0.0.1:8787/x");
    assert.equal(urlOfficielle("javascript:alert(1)"), null);
    assert.equal(urlOfficielle("data:text/html,<p>"), null);
    assert.equal(urlOfficielle("legifrance.gouv.fr"), null);
    assert.equal(urlOfficielle(42), null);
  });
});

describe("corpusAffiche", () => {
  const table = {
    cnil: { libelle: "CNIL", famille: "Autorités françaises", pastille: "bg-autorites" },
  };

  it("rend le libellé et la famille calculés au build", () => {
    assert.deepEqual(corpusAffiche("cnil", table), table.cnil);
  });

  it("garde l'identifiant brut et la famille « autre » pour un corpus inconnu", () => {
    assert.deepEqual(corpusAffiche("nouveau", table), { libelle: "nouveau", famille: "Autres", pastille: "bg-encre-douce" });
    assert.deepEqual(corpusAffiche("constructor", table), {
      libelle: "constructor",
      famille: "Autres",
      pastille: "bg-encre-douce",
    });
  });
});

describe("dateLisible", () => {
  it("met une date ISO en français, et laisse toute autre forme telle quelle", () => {
    assert.equal(dateLisible("2023-12-28"), "28 déc. 2023");
    assert.equal(dateLisible("sans date"), "sans date");
    assert.equal(dateLisible(""), "");
  });
});
