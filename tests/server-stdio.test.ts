import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

/**
 * Le point d'entrée du serveur, testé par stdio et non en mémoire : `mcp/demo.ts`
 * et les clients réels passent par ce chemin-là, et un entrypoint cassé ne se
 * verrait pas dans les tests qui construisent le serveur à la main.
 *
 * Aucun outil n'est appelé : `tools/list` ne touche ni Ollama ni l'index, donc
 * le test reste hors ligne.
 */
describe("le serveur MCP sur stdio", () => {
  it("démarre par son point d'entrée et expose les quatre outils", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["mcp/server.ts"],
      cwd: RACINE,
      stderr: "pipe",
    });
    const client = new Client({ name: "test-stdio", version: "0.0.0" });
    try {
      await client.connect(transport);
      const outils = (await client.listTools()).tools;
      assert.deepEqual(
        outils.map((outil) => outil.name).sort(),
        ["etat_corpus", "get_article", "get_decision", "search"],
      );

      const recherche = outils.find((outil) => outil.name === "search");
      const proprietes = Object.keys(recherche?.inputSchema.properties ?? {}).sort();
      assert.deepEqual(proprietes, [
        "corpus",
        "date_max",
        "date_min",
        "document",
        "k",
        "montant_max",
        "montant_min",
        "nature",
        "numero",
        "question",
        "type_sanction",
      ]);

      const instructions = client.getInstructions() ?? "";
      const descriptionCorpus =
        (recherche?.inputSchema.properties?.corpus as { description?: string } | undefined)
          ?.description ?? "";
      const outilsTexte = JSON.stringify(outils);
      for (const corpus of ["rgpd", "aiact", "cnil", "lil", "ce", "cepd", "cc", "cjue"]) {
        assert.ok(
          instructions.includes(`\`${corpus}\``),
          `les instructions nomment le corpus ${corpus}`,
        );
        assert.ok(
          descriptionCorpus.includes(corpus),
          `le schéma de corpus nomme ${corpus}`,
        );
        assert.ok(
          outilsTexte.includes(`\`${corpus}\``),
          `la description de search nomme ${corpus}`,
        );
      }
      assert.equal(instructions.includes("quatre corpus"), false);
      assert.ok(
        instructions.includes("etat_corpus"),
        "les instructions nomment l'outil de fraîcheur",
      );
    } finally {
      await client.close();
    }
  });
});
