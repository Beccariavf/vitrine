import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  analyserArguments,
  mettreAJour,
  normaliserNom,
  resoudreOption,
} from "../tools/kanban.ts";
import type { Executeur, OptionStatut } from "../tools/kanban.ts";

const OPTIONS: readonly OptionStatut[] = [
  { id: "opt_faire", name: "À faire" },
  { id: "opt_encours", name: "En cours" },
  { id: "opt_revue", name: "En revue" },
  { id: "opt_bloque", name: "Bloqué" },
  { id: "opt_fait", name: "Fait" },
];

/** Sorties de `gh` telles que l'API les rend, relevées sur la forme documentée. */
const PROJETS = {
  projects: [{ number: 7, title: "Vitrine — tickets", id: "PVT_projet" }],
  totalCount: 1,
};

const CHAMPS = {
  fields: [
    {
      id: "PVTSSF_statut",
      name: "Status",
      type: "ProjectV2SingleSelectField",
      options: OPTIONS.map((option) => ({ id: option.id, name: option.name })),
    },
    { id: "PVTF_reprises", name: "Reprises", type: "ProjectV2Field" },
  ],
  totalCount: 2,
};

const ITEM = {
  id: "PVTI_item",
  title: "Suivi Kanban",
  type: "Issue",
  url: "https://github.com/Beccariavf/vitrine/issues/12",
};

type Reponses = { projets: unknown; item: unknown; champs: unknown };

/** Exécuteur simulé : enregistre chaque appel et rend la sortie de la commande. */
function executerSimule(reponses: Reponses): { executer: Executeur; appels: string[][] } {
  const appels: string[][] = [];
  const executer: Executeur = (args) => {
    appels.push([...args]);
    if (args[1] === "list") return JSON.stringify(reponses.projets);
    if (args[1] === "item-add") return JSON.stringify(reponses.item);
    if (args[1] === "field-list") return JSON.stringify(reponses.champs);
    return "{}";
  };
  return { executer, appels };
}

describe("analyse des arguments", () => {
  it("refuse une issue seule", () => {
    assert.throws(() => analyserArguments(["12"]), /Indiquer un statut ou --reprises/);
  });

  it("refuse une issue qui n'est pas un entier positif", () => {
    for (const saisie of ["0", "12a", "1.5", "-3", ""]) {
      assert.throws(() => analyserArguments([saisie, "fait"]), /Numéro d'issue attendu/);
    }
  });

  it("refuse un nombre de reprises négatif, décimal ou absent", () => {
    assert.throws(() => analyserArguments(["12", "--reprises", "-1"]), /entier supérieur ou égal/);
    assert.throws(() => analyserArguments(["12", "--reprises", "1.5"]), /entier supérieur ou égal/);
    assert.throws(() => analyserArguments(["12", "--reprises"]), /entier supérieur ou égal/);
  });

  it("accepte un statut seul", () => {
    assert.deepEqual(analyserArguments(["12", "fait"]), { issue: 12, statut: "fait", reprises: null });
  });

  it("accepte des reprises seules", () => {
    assert.deepEqual(analyserArguments(["12", "--reprises", "3"]), {
      issue: 12,
      statut: null,
      reprises: 3,
    });
  });

  it("accepte un statut et des reprises", () => {
    assert.deepEqual(analyserArguments(["12", "en-revue", "--reprises", "0"]), {
      issue: 12,
      statut: "en-revue",
      reprises: 0,
    });
  });

  it("refuse une option inconnue et un argument en trop", () => {
    assert.throws(() => analyserArguments(["12", "fait", "--force"]), /Option inconnue/);
    assert.throws(() => analyserArguments(["12", "fait", "reprises"]), /Argument en trop/);
  });
});

describe("résolution d'un nom", () => {
  it("compare sans accent, sans casse et sans séparateur", () => {
    assert.equal(normaliserNom("Bloqué"), "bloque");
    assert.equal(normaliserNom("EN REVUE"), "en revue");
    assert.equal(normaliserNom("en--revue"), "en revue");
    assert.equal(normaliserNom("  À_faire  "), "a faire");
  });

  it("retrouve l'option quelle que soit la forme saisie", () => {
    assert.equal(resoudreOption("en-revue", OPTIONS).name, "En revue");
    assert.equal(resoudreOption("EN REVUE", OPTIONS).name, "En revue");
    assert.equal(resoudreOption("bloque", OPTIONS).name, "Bloqué");
    assert.equal(resoudreOption("A FAIRE", OPTIONS).id, "opt_faire");
  });

  it("nomme l'option inconnue et liste les options du champ", () => {
    assert.throws(
      () => resoudreOption("terminé", OPTIONS),
      /Option « terminé » introuvable dans le champ Status ; options disponibles : À faire, En cours, En revue, Bloqué, Fait\./,
    );
  });
});

describe("écriture au tableau", () => {
  it("écrit le statut puis les reprises, un champ par appel", () => {
    const { executer, appels } = executerSimule({ projets: PROJETS, item: ITEM, champs: CHAMPS });

    const resultat = mettreAJour({ issue: 12, statut: "en-revue", reprises: 2 }, executer);

    assert.deepEqual(appels, [
      ["project", "list", "--owner", "Beccariavf", "--format", "json"],
      [
        "project",
        "item-add",
        "7",
        "--owner",
        "Beccariavf",
        "--url",
        "https://github.com/Beccariavf/vitrine/issues/12",
        "--format",
        "json",
      ],
      ["project", "field-list", "7", "--owner", "Beccariavf", "--format", "json"],
      [
        "project",
        "item-edit",
        "--id",
        "PVTI_item",
        "--project-id",
        "PVT_projet",
        "--field-id",
        "PVTSSF_statut",
        "--single-select-option-id",
        "opt_revue",
      ],
      [
        "project",
        "item-edit",
        "--id",
        "PVTI_item",
        "--project-id",
        "PVT_projet",
        "--field-id",
        "PVTF_reprises",
        "--number",
        "2",
      ],
    ]);
    assert.deepEqual(resultat, { issue: 12, statut: "En revue", reprises: 2 });
  });

  it("n'écrit que les reprises quand le statut n'est pas demandé", () => {
    const { executer, appels } = executerSimule({ projets: PROJETS, item: ITEM, champs: CHAMPS });

    const resultat = mettreAJour({ issue: 12, statut: null, reprises: 0 }, executer);

    assert.equal(appels.length, 4);
    assert.deepEqual(appels.at(-1), [
      "project",
      "item-edit",
      "--id",
      "PVTI_item",
      "--project-id",
      "PVT_projet",
      "--field-id",
      "PVTF_reprises",
      "--number",
      "0",
    ]);
    assert.deepEqual(resultat, { issue: 12, statut: null, reprises: 0 });
  });

  it("s'arrête sans écrire quand le projet est absent", () => {
    const { executer, appels } = executerSimule({
      projets: { projects: [], totalCount: 0 },
      item: ITEM,
      champs: CHAMPS,
    });

    assert.throws(
      () => mettreAJour({ issue: 12, statut: "fait", reprises: null }, executer),
      /Projet « Vitrine — tickets » introuvable pour Beccariavf ; projets disponibles : aucun\./,
    );
    assert.deepEqual(appels, [["project", "list", "--owner", "Beccariavf", "--format", "json"]]);
  });

  it("s'arrête sans écrire quand le champ Reprises manque, statut compris", () => {
    const sansReprises = {
      fields: [
        {
          id: "PVTSSF_statut",
          name: "Status",
          type: "ProjectV2SingleSelectField",
          options: OPTIONS.map((option) => ({ id: option.id, name: option.name })),
        },
      ],
      totalCount: 1,
    };
    const { executer, appels } = executerSimule({
      projets: PROJETS,
      item: ITEM,
      champs: sansReprises,
    });

    assert.throws(
      () => mettreAJour({ issue: 12, statut: "fait", reprises: 1 }, executer),
      /Champ « Reprises » introuvable dans le projet Vitrine — tickets ; champs disponibles : Status\./,
    );
    assert.equal(
      appels.some((appel) => appel[1] === "item-edit"),
      false,
    );
  });

  it("s'arrête sans écrire quand l'option du statut est inconnue", () => {
    const { executer, appels } = executerSimule({ projets: PROJETS, item: ITEM, champs: CHAMPS });

    assert.throws(
      () => mettreAJour({ issue: 12, statut: "terminé", reprises: null }, executer),
      /options disponibles : À faire, En cours, En revue, Bloqué, Fait\./,
    );
    assert.equal(
      appels.some((appel) => appel[1] === "item-edit"),
      false,
    );
  });
});
