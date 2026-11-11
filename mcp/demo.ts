/**
 * Démonstration bout en bout du serveur MCP, par le protocole stdio.
 *
 * Les tests couvrent le protocole en mémoire et le calcul hors ligne ; ce script
 * lance le vrai `mcp/server.ts`, s'y connecte comme un client MCP, appelle les
 * trois outils et imprime une transcription lisible. Il vérifie donc le chemin
 * réel — entrée stdio, embeddings Ollama, index construit — et pas seulement des
 * fonctions importées.
 *
 * Usage : `npm run mcp:demo`. Sort en erreur si un outil échoue.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { debutDispositif } from "./corpus/cnil/meta.ts";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

type Outil = "get_article" | "search" | "get_decision";

type Etape = {
  /** Ce que cette étape prouve, en une ligne. */
  titre: string;
  outil: Outil;
  arguments: Record<string, unknown>;
};

/** Cinq étapes, chacune un outil ou une capacité différente. */
export const ETAPES: Etape[] = [
  {
    titre: "Article exact, sans recherche vectorielle — RGPD, article 17",
    outil: "get_article",
    arguments: { document: "32016R0679", numero: "17" },
  },
  {
    titre: "Recherche sémantique dans le RGPD, avec provenance et confiance",
    outil: "search",
    arguments: {
      question: "Quels droits la personne concernée peut-elle exercer sur ses données ?",
      corpus: "rgpd",
      k: 3,
    },
  },
  {
    titre: "Recherche sémantique dans l'AI Act",
    outil: "search",
    arguments: {
      question: "Quelles obligations de transparence pour les systèmes d'IA à haut risque ?",
      corpus: "aiact",
      k: 3,
    },
  },
  {
    titre: "Filtres CNIL poussés dans l'index : cookies, amendes, 2025",
    outil: "search",
    arguments: {
      question: "Quelle sanction pour des cookies ?",
      corpus: "cnil",
      k: 3,
      date_min: "2025-01-01",
      date_max: "2025-12-31",
      type_sanction: "amende",
    },
  },
  {
    titre: "Décision par son numéro : dispositif et métadonnées",
    outil: "get_decision",
    arguments: { numero: "SAN-2026-015" },
  },
];

/** Texte d'un résultat d'outil, ou lève : le serveur ne rend que du texte ici. */
function texte(resultat: { content: unknown[] }): string {
  const bloc = resultat.content[0] as { type?: string; text?: string } | undefined;
  if (bloc?.type !== "text" || typeof bloc.text !== "string") {
    throw new Error("Le serveur n'a pas rendu de bloc texte.");
  }
  return bloc.text;
}

/** Extrait ramené à une ligne courte : la démonstration montre, elle ne recopie pas. */
function extrait(texte: string, longueur = 220): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  return propre.length <= longueur ? propre : `${propre.slice(0, longueur)}…`;
}

function euros(montant: number | null | undefined): string {
  if (montant === null || montant === undefined) return "montant non chiffré";
  return `${montant.toLocaleString("fr-FR")} €`;
}

type Passages = {
  niveau_confiance: string;
  message?: string;
  passages: {
    ref: string;
    document: string;
    corpus: string;
    niveau: string;
    numero: string;
    chemin: string;
    texte: string;
    url: string;
    date_acte: string;
    similarite: number;
    type_sanction?: string;
    montant?: number | null;
    injonction?: boolean;
  }[];
};

type Article = {
  trouve: boolean;
  document: string;
  numero: string;
  chemin?: string;
  texte?: string;
  url?: string;
  date_acte?: string;
  message?: string;
};

type Decision = {
  trouve: boolean;
  message?: string;
  decisions: {
    document: string;
    numero: string;
    date_acte: string;
    statut: string;
    url: string;
    type_sanction?: string;
    montant?: number | null;
    injonction?: boolean;
    fragments_total: number;
    partie: string;
    fragments: { ref: string; texte: string }[];
  }[];
};

/** Rend une réponse d'outil en texte lisible ; `false` si l'étape a échoué. */
function rendre(outil: Outil, donnees: unknown): boolean {
  if (outil === "get_article") {
    const article = donnees as Article;
    if (!article.trouve) {
      process.stdout.write(`  ✗ ${article.message ?? "article introuvable"}\n`);
      return false;
    }
    process.stdout.write(
      `  ✓ ${article.document}, article ${article.numero} — ${article.chemin ?? ""}\n` +
        `    ${extrait(article.texte ?? "")}\n` +
        `    ${article.date_acte ?? ""} · ${article.url ?? ""}\n`,
    );
    return true;
  }

  if (outil === "get_decision") {
    const resultat = donnees as Decision;
    if (!resultat.trouve) {
      process.stdout.write(`  ✗ ${resultat.message ?? "décision introuvable"}\n`);
      return false;
    }
    for (const decision of resultat.decisions) {
      const meta = [
        decision.type_sanction ?? "",
        euros(decision.montant),
        decision.injonction === true ? "injonction" : "",
      ]
        .filter((partie) => partie !== "")
        .join(" · ");
      // Le premier fragment rendu peut commencer avant le dispositif : on
      // montre la partie opératoire, à la même borne que le serveur.
      const rendu = decision.fragments.map((element) => element.texte).join(" ");
      const operatoire = rendu.slice(debutDispositif(rendu));
      process.stdout.write(
        `  ✓ ${decision.numero} — ${decision.document} — ${decision.date_acte} — ${decision.statut}\n` +
          `    ${meta}\n` +
          `    ${decision.fragments.length}/${decision.fragments_total} fragments ` +
          `(${decision.partie}) · ${decision.url}\n` +
          `    ${extrait(operatoire)}\n`,
      );
    }
    return resultat.decisions.length > 0;
  }

  const resultat = donnees as Passages;
  process.stdout.write(`  confiance : ${resultat.niveau_confiance}\n`);
  if (resultat.message !== undefined) process.stdout.write(`  ${resultat.message}\n`);
  resultat.passages.forEach((passage, index) => {
    // Les métadonnées de sanction n'existent que pour la CNIL ; sur le RGPD et
    // l'AI Act, `type_sanction` vaut « autre » faute de colonne, et l'afficher
    // laisserait croire à une sanction.
    const meta = [
      passage.niveau,
      passage.numero,
      ...(passage.corpus === "cnil"
        ? [passage.date_acte, passage.type_sanction ?? "", euros(passage.montant)]
        : []),
    ]
      .filter((partie) => partie !== "")
      .join(" · ");
    process.stdout.write(
      `  ${index + 1}. ${passage.similarite.toFixed(3)} · ${meta}\n` +
        `     ${passage.ref} · ${passage.url}\n` +
        `     ${extrait(passage.texte)}\n`,
    );
  });
  return resultat.passages.length > 0;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.ts"],
    cwd: RACINE,
    stderr: "inherit",
  });
  const client = new Client({ name: "demo-vitrine", version: "0.1.0" });

  let echecs = 0;
  try {
    await client.connect(transport);
    const outils = (await client.listTools()).tools.map((outil) => outil.name).sort();
    process.stdout.write(`\nOutils exposés : ${outils.join(", ")}\n`);

    for (const [index, etape] of ETAPES.entries()) {
      process.stdout.write(`\n### ${index + 1}. ${etape.titre}\n`);
      process.stdout.write(
        `→ ${etape.outil} ${JSON.stringify(etape.arguments)}\n`,
      );
      const debut = Date.now();
      const reponse = await client.callTool({
        name: etape.outil,
        arguments: etape.arguments,
      });
      const donnees: unknown = JSON.parse(texte(reponse as { content: unknown[] }));
      if (!rendre(etape.outil, donnees)) echecs += 1;
      process.stdout.write(`  (${Date.now() - debut} ms)\n`);
    }
  } finally {
    await client.close();
  }

  process.stdout.write(
    `\n${ETAPES.length - echecs}/${ETAPES.length} étapes rendues sans erreur.\n`,
  );
  if (echecs > 0) process.exitCode = 1;
}

const entre = process.argv[1];
if (entre !== undefined && import.meta.url === pathToFileURL(entre).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
